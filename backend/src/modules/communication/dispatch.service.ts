// backend/src/modules/communication/dispatch.service.ts
import { randomUUID } from 'crypto';
import { db } from '../../db/mysql.js';
import { RowDataPacket } from 'mysql2';
import { providerFactory } from './providers/provider.factory.js';
import { templateService } from './template.service.js';
import { notificationPreferencesService } from './notification-preferences.service.js';
import { SendMessageDTO, BulkSendDTO, DispatchResult, DispatchLog, DispatchLogFilters, PaginatedDispatchLogs, DispatchStats, Channel } from './communication.types.js';

class DispatchService {
  async send(dto: SendMessageDTO): Promise<DispatchResult> {
    const queued: string[] = [];
    const failed: string[] = [];

    const [employees] = await db.execute<RowDataPacket[]>(
      `SELECT id, full_name, email, phone FROM employees WHERE id IN (${dto.recipient_employee_ids.map(() => '?').join(',')})`,
      dto.recipient_employee_ids
    );

    for (const employee of employees) {
      try {
        let channel = dto.channel;
        if (!channel) {
          const template = await this.getTemplateInfo(dto.template_id, dto.template_name);
          channel = await notificationPreferencesService.getPreferredChannel(employee.id, template.category);
        }

        const contact = channel === 'email' ? employee.email : employee.phone;
        if (!contact) {
          failed.push(employee.id);
          continue;
        }

        const rendered = await templateService.renderTemplate({
          template_id: dto.template_id,
          template_name: dto.template_name,
          data: { ...dto.data, employee: { name: employee.full_name, id: employee.id } }
        });

        const dispatchId = randomUUID();
        const template = await this.getTemplateInfo(dto.template_id, dto.template_name);

        await db.execute(
          `INSERT INTO dispatch_log
          (id, template_id, template_name, recipient_employee_id, recipient_contact, channel, status,
           subject, body_preview, is_critical, retention_category, sent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            dispatchId,
            dto.template_id || null,
            dto.template_name || template.name,
            employee.id,
            contact,
            channel,
            'queued',
            dto.data.subject || template.subject || null,
            rendered.html.substring(0, 500),
            dto.is_critical ? 1 : 0,
            dto.is_critical ? 'critical' : 'standard'
          ]
        );

        this.sendViaProvider(dispatchId, channel, contact, rendered).catch(err => {
          console.error(`Failed to send dispatch ${dispatchId}:`, err);
        });

        queued.push(dispatchId);
      } catch (error) {
        console.error(`Failed to queue message for employee ${employee.id}:`, error);
        failed.push(employee.id);
      }
    }

    return {
      queued: queued.length,
      failed: failed.length,
      dispatch_ids: queued
    };
  }

  private async sendViaProvider(dispatchId: string, channel: Channel, contact: string, rendered: { html: string; text?: string }): Promise<void> {
    try {
      const provider = providerFactory.getProvider(channel);

      if (!provider.validateRecipient(contact)) {
        await this.updateDispatchStatus(dispatchId, 'failed', 'Invalid recipient format');
        return;
      }

      const body = channel === 'email' ? rendered.html : (rendered.text || rendered.html);
      const result = await provider.send(contact, '', body);

      if (result.success) {
        await this.updateDispatchStatus(dispatchId, 'sent', undefined, result.message_id);
      } else {
        await this.updateDispatchStatus(dispatchId, 'failed', result.error);
      }
    } catch (error) {
      await this.updateDispatchStatus(dispatchId, 'failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async updateDispatchStatus(dispatchId: string, status: string, errorMessage?: string, messageId?: string): Promise<void> {
    await db.execute(
      `UPDATE dispatch_log
       SET status = ?, error_message = ?, sent_at = IF(? = 'sent', NOW(), sent_at)
       WHERE id = ?`,
      [status, errorMessage || null, status, dispatchId]
    );
  }

  private async getTemplateInfo(templateId?: string, templateName?: string): Promise<any> {
    if (templateId) {
      return await templateService.getTemplateById(templateId);
    } else if (templateName) {
      const tmpl = await templateService.getTemplateByName(templateName);
      return { name: templateName, category: tmpl?.category, subject: null };
    }
    throw new Error('Template not found');
  }

  async bulkSend(dto: BulkSendDTO): Promise<DispatchResult> {
    let query = 'SELECT id FROM employees WHERE 1=1';
    const params: any[] = [];

    if (dto.recipient_filter.department) {
      query += ' AND department = ?';
      params.push(dto.recipient_filter.department);
    }

    if (dto.recipient_filter.process_id) {
      query += ' AND process_id = ?';
      params.push(dto.recipient_filter.process_id);
    }

    if (dto.recipient_filter.designation) {
      query += ' AND designation = ?';
      params.push(dto.recipient_filter.designation);
    }

    if (dto.recipient_filter.status) {
      query += ' AND status = ?';
      params.push(dto.recipient_filter.status);
    }

    const [rows] = await db.execute<RowDataPacket[]>(query, params);
    const recipientIds = rows.map((r: any) => r.id);

    return this.send({
      template_id: dto.template_id,
      template_name: dto.template_name,
      recipient_employee_ids: recipientIds,
      data: dto.data,
      channel: dto.channel
    });
  }

  async retry(dispatchId: string): Promise<void> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT channel, recipient_contact, body_preview FROM dispatch_log WHERE id = ?',
      [dispatchId]
    );

    if (rows.length === 0) throw new Error('Dispatch not found');

    const log = rows[0];

    await db.execute(
      'UPDATE dispatch_log SET status = ?, retry_count = retry_count + 1 WHERE id = ?',
      ['queued', dispatchId]
    );

    this.sendViaProvider(dispatchId, log.channel, log.recipient_contact, { html: log.body_preview }).catch(err => {
      console.error(`Retry failed for ${dispatchId}:`, err);
    });
  }

  async getLogs(filters: DispatchLogFilters): Promise<PaginatedDispatchLogs> {
    let query = 'SELECT * FROM dispatch_log WHERE 1=1';
    const params: any[] = [];

    if (filters.employee_id) {
      query += ' AND recipient_employee_id = ?';
      params.push(filters.employee_id);
    }

    if (filters.channel) {
      query += ' AND channel = ?';
      params.push(filters.channel);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.date_from) {
      query += ' AND sent_at >= ?';
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ' AND sent_at <= ?';
      params.push(filters.date_to);
    }

    const [countRows] = await db.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM dispatch_log WHERE 1=1`, params);
    const total = countRows[0].total;

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    query += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [logs] = await db.execute<RowDataPacket[]>(query, params);

    return {
      logs: logs as DispatchLog[],
      total,
      page,
      limit
    };
  }

  async getStats(): Promise<DispatchStats> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
        COUNT(*) as total_sent_today,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN channel = 'email' THEN 1 ELSE 0 END) as email_count,
        SUM(CASE WHEN channel = 'sms' THEN 1 ELSE 0 END) as sms_count,
        SUM(CASE WHEN channel = 'whatsapp' THEN 1 ELSE 0 END) as whatsapp_count
       FROM dispatch_log
       WHERE DATE(sent_at) = CURDATE()`
    );

    const stats = rows[0];
    const total = stats.total_sent_today || 0;

    return {
      total_sent_today: total,
      delivery_rate: total > 0 ? (stats.delivered / total) * 100 : 0,
      open_rate: total > 0 ? (stats.opened / total) * 100 : 0,
      failed_count: stats.failed || 0,
      by_channel: {
        email: stats.email_count || 0,
        sms: stats.sms_count || 0,
        whatsapp: stats.whatsapp_count || 0
      }
    };
  }
}

export const dispatchService = new DispatchService();
