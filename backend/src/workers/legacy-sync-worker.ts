import { env } from '../config/env.js';
import { db as mysqlDb } from '../db/mysql.js';
import { changeTrackingEngine } from './sync-engine/change-tracking-engine.js';
import { employeeSyncHandler } from './domains/employee-sync-handler.js';
import type { BaseSyncHandler } from './domains/base-sync-handler.js';
import { randomUUID } from 'crypto';

/**
 * Legacy Sync Worker - Main Orchestrator
 * Runs on interval, fetches changes, delegates to domain handlers
 */
export class LegacySyncWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  /**
   * Start the sync worker
   */
  start(): void {
    if (!env.LEGACY_SYNC_ENABLED) {
      console.log('[LegacySync] Worker disabled (LEGACY_SYNC_ENABLED=false)');
      return;
    }
    
    console.log(`[LegacySync] Worker starting (interval: ${env.LEGACY_SYNC_INTERVAL_MS}ms)`);
    
    // Run immediately
    this.runSyncCycle().catch(err => {
      console.error('[LegacySync] Initial sync failed:', err);
    });
    
    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runSyncCycle().catch(err => {
        console.error('[LegacySync] Sync cycle failed:', err);
      });
    }, env.LEGACY_SYNC_INTERVAL_MS);
  }
  
  /**
   * Stop the sync worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[LegacySync] Worker stopped');
    }
  }
  
  /**
   * Run one sync cycle
   */
  private async runSyncCycle(): Promise<void> {
    if (this.isRunning) {
      console.log('[LegacySync] Skipping cycle (previous cycle still running)');
      return;
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('[LegacySync] === Sync cycle starting ===');
      
      // Get active sync maps
      const [syncMaps] = await mysqlDb.execute<any[]>(
        `SELECT * FROM legacy_sync_map
         WHERE active_status = 1
         ORDER BY sync_order ASC, hrms_domain ASC`
      );
      
      if (syncMaps.length === 0) {
        console.log('[LegacySync] No active sync maps configured');
        return;
      }
      
      console.log(`[LegacySync] Processing ${syncMaps.length} sync maps`);
      
      // Process each domain
      for (const syncMap of syncMaps) {
        await this.processDomain(syncMap);
      }
      
      const duration = Date.now() - startTime;
      console.log(`[LegacySync] === Sync cycle complete (${duration}ms) ===`);
      
    } catch (error: any) {
      console.error('[LegacySync] Sync cycle error:', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Process one domain (sync map)
   */
  private async processDomain(syncMap: any): Promise<void> {
    const runId = randomUUID();
    const handler = this.getHandler(syncMap.hrms_domain);
    
    if (!handler) {
      console.warn(`[LegacySync] No handler for domain: ${syncMap.hrms_domain}`);
      return;
    }
    
    // Create run log
    await mysqlDb.execute(
      `INSERT INTO legacy_sync_run_log
       (id, sync_map_id, run_type, started_at, status)
       VALUES (?, ?, ?, NOW(), ?)`,
      [runId, syncMap.id, 'incremental', 'running']
    );
    
    try {
      // Get checkpoint (last synced version)
      const [checkpoints] = await mysqlDb.execute<any[]>(
        `SELECT last_ct_version FROM legacy_sync_checkpoint WHERE sync_map_id = ?`,
        [syncMap.id]
      );
      
      const lastVersion = checkpoints[0]?.last_ct_version 
        ? BigInt(checkpoints[0].last_ct_version)
        : null;
      
      // Fetch changes from legacy DB
      const { changes, currentVersion } = await changeTrackingEngine.fetchChanges(
        syncMap.source_schema,
        syncMap.source_table,
        lastVersion,
        env.LEGACY_SYNC_BATCH_SIZE
      );
      
      if (changes.length === 0) {
        console.log(`[LegacySync] ${syncMap.hrms_domain}: No changes`);
        await this.completeRun(runId, 0, 0);
        return;
      }
      
      // Process changes through domain handler
      const result = await handler.syncDomain(runId, changes);
      
      // Update checkpoint
      await mysqlDb.execute(
        `INSERT INTO legacy_sync_checkpoint
         (id, sync_map_id, last_ct_version, last_success_at, last_run_status)
         VALUES (UUID(), ?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE
          last_ct_version = VALUES(last_ct_version),
          last_success_at = VALUES(last_success_at),
          last_run_status = VALUES(last_run_status),
          updated_at = NOW()`,
        [syncMap.id, currentVersion.toString(), 'success']
      );
      
      // Complete run log
      await this.completeRun(runId, result.inserted, result.updated);
      
      console.log(`[LegacySync] ${syncMap.hrms_domain}: ✓ ${result.inserted} inserted, ${result.updated} updated`);
      
    } catch (error: any) {
      console.error(`[LegacySync] ${syncMap.hrms_domain} error:`, error);
      
      // Mark run as failed
      await mysqlDb.execute(
        `UPDATE legacy_sync_run_log
         SET status = ?, error_message = ?, finished_at = NOW()
         WHERE id = ?`,
        ['failed', error.message, runId]
      );
    }
  }
  
  /**
   * Complete a sync run (mark as success)
   */
  private async completeRun(runId: string, inserted: number, updated: number): Promise<void> {
    await mysqlDb.execute(
      `UPDATE legacy_sync_run_log
       SET rows_inserted = ?, rows_updated = ?, status = ?, finished_at = NOW()
       WHERE id = ?`,
      [inserted, updated, 'success', runId]
    );
  }
  
  /**
   * Get domain handler by name
   */
  private getHandler(domain: string): BaseSyncHandler | null {
    switch (domain.toLowerCase()) {
      case 'employee':
        return employeeSyncHandler;
      // Add other domain handlers here when implemented
      default:
        return null;
    }
  }
}

export const legacySyncWorker = new LegacySyncWorker();
