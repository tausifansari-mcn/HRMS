import { BaseSyncHandler } from './base-sync-handler.js';
import { db as mysqlDb } from '../../db/mysql.js';
import type { LegacyChange, TransformedRecord, ValidationResult, StagingResult, MergeResult } from '../../modules/legacy/types.js';
import { randomUUID } from 'crypto';

/**
 * Employee Domain Sync Handler
 * Syncs legacy employee master → HRMS employees table
 */
export class EmployeeSyncHandler extends BaseSyncHandler {
  
  constructor() {
    super('Employee', 'stg_legacy_employee_master');
  }
  
  /**
   * Transform legacy employee record to HRMS format
   */
  protected transform(change: LegacyChange): TransformedRecord {
    // Example transformation (adjust based on actual legacy schema)
    const data: Record<string, any> = {
      employee_code: change.emp_code || change.employee_id || change.empcode,
      full_name: change.emp_name || change.employee_name || change.name,
      first_name: this.extractFirstName(change.emp_name || change.name),
      last_name: this.extractLastName(change.emp_name || change.name),
      official_email: change.email || change.official_email,
      personal_email: change.personal_email || null,
      mobile: change.mobile || change.phone || change.contact,
      date_of_joining: this.parseDate(change.join_date || change.doj),
      date_of_exit: this.parseDate(change.exit_date || change.doe),
      branch_code: change.branch_code || change.branch,
      process_code: change.process_code || change.process,
      department_code: change.dept_code || change.department,
      designation_code: change.designation_code || change.designation,
      reporting_manager_code: change.manager_code || change.reporting_to,
      employment_status: this.mapEmploymentStatus(change.status || change.emp_status),
      active_status: change.active === 1 || change.is_active === 1,
    };
    
    return {
      operation: change.SYS_CHANGE_OPERATION,
      source_key: String(change.emp_id || change.id || change.employee_id),
      data,
    };
  }
  
  /**
   * Validate transformed record
   */
  protected validate(record: TransformedRecord): ValidationResult {
    const errors: string[] = [];
    
    if (!record.data.employee_code) {
      errors.push('Missing employee_code');
    }
    
    if (!record.data.full_name) {
      errors.push('Missing full_name');
    }
    
    if (!record.data.mobile && !record.data.official_email) {
      errors.push('Missing both mobile and email');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Stage records into stg_legacy_employee_master
   */
  protected async stage(syncRunId: string, records: TransformedRecord[]): Promise<StagingResult> {
    let staged = 0;
    
    for (const record of records) {
      await mysqlDb.execute(
        `INSERT INTO stg_legacy_employee_master
         (id, sync_run_id, source_db, source_schema, source_table, source_key,
          raw_payload_json, employee_code, full_name, first_name, last_name,
          official_email, personal_email, mobile, date_of_joining, date_of_exit,
          branch_code, process_code, department_code, designation_code,
          reporting_manager_code, employment_status, active_status,
          processed_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          randomUUID(),
          syncRunId,
          'db_bill',
          'dbo', // Adjust if different
          'employee_master', // Adjust to actual table name
          record.source_key,
          JSON.stringify(record.data),
          record.data.employee_code,
          record.data.full_name,
          record.data.first_name,
          record.data.last_name,
          record.data.official_email,
          record.data.personal_email,
          record.data.mobile,
          record.data.date_of_joining,
          record.data.date_of_exit,
          record.data.branch_code,
          record.data.process_code,
          record.data.department_code,
          record.data.designation_code,
          record.data.reporting_manager_code,
          record.data.employment_status,
          record.data.active_status,
          'pending',
        ]
      );
      staged++;
    }
    
    return { staged };
  }
  
  /**
   * Merge staged records into final employees table
   * Legacy wins conflicts (source of truth during transition)
   */
  protected async merge(syncRunId: string): Promise<MergeResult> {
    // Insert new employees
    const [insertResult] = await mysqlDb.execute<any>(
      `INSERT INTO employees
       (id, employee_code, full_name, first_name, last_name, official_email, personal_email,
        mobile, date_of_joining, date_of_exit, active_status)
       SELECT 
         UUID(),
         stg.employee_code,
         stg.full_name,
         stg.first_name,
         stg.last_name,
         stg.official_email,
         stg.personal_email,
         stg.mobile,
         stg.date_of_joining,
         stg.date_of_exit,
         stg.active_status
       FROM stg_legacy_employee_master stg
       WHERE stg.sync_run_id = ?
         AND stg.processed_status = 'pending'
         AND NOT EXISTS (
           SELECT 1 FROM employees e WHERE e.employee_code = stg.employee_code
         )`
    );
    
    const inserted = insertResult.affectedRows || 0;
    
    // Update existing employees (legacy wins)
    const [updateResult] = await mysqlDb.execute<any>(
      `UPDATE employees e
       INNER JOIN stg_legacy_employee_master stg ON e.employee_code = stg.employee_code
       SET 
         e.full_name = stg.full_name,
         e.first_name = stg.first_name,
         e.last_name = stg.last_name,
         e.official_email = COALESCE(stg.official_email, e.official_email),
         e.personal_email = COALESCE(stg.personal_email, e.personal_email),
         e.mobile = COALESCE(stg.mobile, e.mobile),
         e.date_of_exit = stg.date_of_exit,
         e.active_status = stg.active_status,
         e.updated_at = NOW()
       WHERE stg.sync_run_id = ?
         AND stg.processed_status = 'pending'`
    );
    
    const updated = updateResult.affectedRows || 0;
    
    // Mark staged records as processed
    await mysqlDb.execute(
      `UPDATE stg_legacy_employee_master
       SET processed_status = 'completed', processed_at = NOW()
       WHERE sync_run_id = ? AND processed_status = 'pending'`,
      [syncRunId]
    );
    
    return { inserted, updated };
  }
  
  // Helper methods
  
  private extractFirstName(fullName: string | null): string | null {
    if (!fullName) return null;
    return fullName.split(' ')[0];
  }
  
  private extractLastName(fullName: string | null): string | null {
    if (!fullName) return null;
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : null;
  }
  
  private parseDate(dateValue: any): string | null {
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch {
      return null;
    }
  }
  
  private mapEmploymentStatus(status: any): string {
    if (!status) return 'Active';
    const statusStr = String(status).toLowerCase();
    if (statusStr.includes('active')) return 'Active';
    if (statusStr.includes('exit') || statusStr.includes('left')) return 'Exited';
    if (statusStr.includes('notice')) return 'Notice Period';
    return 'Active'; // Default
  }
}

export const employeeSyncHandler = new EmployeeSyncHandler();
