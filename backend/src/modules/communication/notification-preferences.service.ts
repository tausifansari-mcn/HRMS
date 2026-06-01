// backend/src/modules/communication/notification-preferences.service.ts
import { randomUUID } from 'crypto';
import { db } from '../../db/mysql.js';
import { RowDataPacket } from 'mysql2';
import { NotificationPreferences, UpdatePreferencesDTO, Channel, NotificationCategory } from './communication.types.js';

class NotificationPreferencesService {
  async getPreferences(employeeId: string): Promise<NotificationPreferences[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM notification_preferences WHERE employee_id = ?',
      [employeeId]
    );
    return rows as NotificationPreferences[];
  }

  async getPreferredChannel(employeeId: string, category: NotificationCategory): Promise<Channel> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT preferred_channel FROM notification_preferences WHERE employee_id = ? AND category = ? AND enabled = 1',
      [employeeId, category]
    );

    if (rows.length === 0) return 'email'; // Default
    return rows[0].preferred_channel as Channel;
  }

  async updatePreferences(employeeId: string, updates: UpdatePreferencesDTO[]): Promise<void> {
    for (const update of updates) {
      const [existing] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM notification_preferences WHERE employee_id = ? AND category = ?',
        [employeeId, update.category]
      );

      if (existing.length > 0) {
        await db.execute(
          'UPDATE notification_preferences SET preferred_channel = ?, enabled = ? WHERE id = ?',
          [update.preferred_channel, update.enabled ? 1 : 0, existing[0].id]
        );
      } else {
        await db.execute(
          'INSERT INTO notification_preferences (id, employee_id, category, preferred_channel, enabled) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), employeeId, update.category, update.preferred_channel, update.enabled ? 1 : 0]
        );
      }
    }
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();
