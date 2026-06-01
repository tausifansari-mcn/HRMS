import { randomUUID } from 'crypto';
import { db } from '../../db/mysql.js';
import type { RowDataPacket } from 'mysql2';
import type {
  NotificationPreferences,
  NotificationCategory,
  Channel,
  UpdatePreferencesDTO,
} from './communication.types.js';

const CATEGORIES: NotificationCategory[] = [
  'onboarding','payroll','attendance','leave','performance','alerts','announcements'
];

class NotificationPreferencesService {
  async initializeDefaults(employeeId: string): Promise<void> {
    const values = CATEGORIES.map(cat => [randomUUID(), employeeId, cat, 'email', 1]);
    await db.query(
      `INSERT INTO notification_preferences (id, employee_id, category, preferred_channel, enabled)
       VALUES ${values.map(() => '(?, ?, ?, ?, ?)').join(', ')}
       ON DUPLICATE KEY UPDATE id = id`,
      values.flat()
    );
  }

  async getPreferences(employeeId: string): Promise<NotificationPreferences[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM notification_preferences WHERE employee_id = ? ORDER BY category',
      [employeeId]
    );
    return rows as NotificationPreferences[];
  }

  async updatePreference(employeeId: string, dto: UpdatePreferencesDTO): Promise<NotificationPreferences> {
    await db.execute(
      `INSERT INTO notification_preferences (id, employee_id, category, preferred_channel, enabled)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE preferred_channel = VALUES(preferred_channel), enabled = VALUES(enabled)`,
      [randomUUID(), employeeId, dto.category, dto.preferred_channel, dto.enabled ? 1 : 0]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM notification_preferences WHERE employee_id = ? AND category = ?',
      [employeeId, dto.category]
    );
    return rows[0] as NotificationPreferences;
  }

  async getPreferredChannel(employeeId: string, category: string): Promise<Channel> {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT preferred_channel FROM notification_preferences WHERE employee_id = ? AND category = ? AND enabled = 1',
      [employeeId, category]
    );
    return (rows[0] as any)?.preferred_channel as Channel ?? 'email';
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();
