/**
 * PII Redaction Service
 * Role-based field redaction for sensitive data protection
 */

import db from '../db.js';
import { RowDataPacket } from 'mysql2';

interface RedactionRule {
  field_name: string;
  redaction_rule: 'hide' | 'mask' | 'allow';
}

class PIIRedactionService {
  private cache: Map<string, RedactionRule[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Load redaction rules for a role and entity type
   */
  async loadRules(roleKey: string, entityType: string): Promise<RedactionRule[]> {
    const cacheKey = `${roleKey}:${entityType}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (Date.now() < expiry) {
        return this.cache.get(cacheKey)!;
      }
    }

    // Load from database
    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT field_name, redaction_rule
         FROM ats_pii_redaction_config
         WHERE role_key = ? AND entity_type = ?`,
        [roleKey, entityType]
      );

      const rules = rows as RedactionRule[];

      // Update cache
      this.cache.set(cacheKey, rules);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return rules;
    } catch (error) {
      console.error('[PIIRedaction] Error loading rules:', error);
      return []; // Fail open - no redaction if DB error
    }
  }

  /**
   * Redact sensitive fields from a single record
   */
  async redact<T extends Record<string, any>>(
    record: T,
    roleKey: string,
    entityType: string
  ): Promise<T> {
    const rules = await this.loadRules(roleKey, entityType);
    const redacted = { ...record };

    for (const rule of rules) {
      const fieldName = rule.field_name;

      if (!(fieldName in redacted)) continue;

      switch (rule.redaction_rule) {
        case 'hide':
          // Remove field completely
          delete redacted[fieldName];
          break;

        case 'mask':
          // Mask the value
          redacted[fieldName] = this.maskValue(fieldName, redacted[fieldName]);
          break;

        case 'allow':
          // No redaction
          break;
      }
    }

    return redacted;
  }

  /**
   * Redact sensitive fields from multiple records
   */
  async redactMany<T extends Record<string, any>>(
    records: T[],
    roleKey: string,
    entityType: string
  ): Promise<T[]> {
    // Load rules once for all records
    const rules = await this.loadRules(roleKey, entityType);

    return records.map(record => {
      const redacted = { ...record };

      for (const rule of rules) {
        const fieldName = rule.field_name;

        if (!(fieldName in redacted)) continue;

        switch (rule.redaction_rule) {
          case 'hide':
            delete redacted[fieldName];
            break;

          case 'mask':
            redacted[fieldName] = this.maskValue(fieldName, redacted[fieldName]);
            break;

          case 'allow':
            // No redaction
            break;
        }
      }

      return redacted;
    });
  }

  /**
   * Mask a value based on field name and type
   */
  private maskValue(fieldName: string, value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Salary masking: show range instead of exact value
    if (fieldName === 'offer_salary' && typeof value === 'number') {
      if (value < 15000) return '<15K';
      if (value < 20000) return '15-20K';
      if (value < 25000) return '20-25K';
      if (value < 30000) return '25-30K';
      if (value < 40000) return '30-40K';
      return '40K+';
    }

    // Email masking: show first char + domain
    if (fieldName.includes('email') && typeof value === 'string') {
      const [local, domain] = value.split('@');
      if (!domain) return '***';
      return `${local[0]}***@${domain}`;
    }

    // Mobile masking: show last 4 digits
    if (fieldName.includes('mobile') && typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 4) return '***';
      return `******${digits.slice(-4)}`;
    }

    // Generic string masking: show first 2 and last 2 chars
    if (typeof value === 'string') {
      if (value.length <= 4) return '***';
      return `${value.slice(0, 2)}***${value.slice(-2)}`;
    }

    // For other types, return masked placeholder
    return '***';
  }

  /**
   * Clear cache (call when redaction rules are updated)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Clear cache for specific role/entity
   */
  clearCacheFor(roleKey: string, entityType: string): void {
    const cacheKey = `${roleKey}:${entityType}`;
    this.cache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
  }
}

export const piiRedactionService = new PIIRedactionService();
