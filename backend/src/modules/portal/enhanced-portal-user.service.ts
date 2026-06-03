import { db } from "../../db/mysql.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

// ============================================================
// ENHANCED PORTAL USER MANAGEMENT
// ============================================================

export interface EnhancedPortalUser {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  designation?: string;
  department?: string;
  client_id: string;
  process_ids: string[];
  access_level: 'READ_ONLY' | 'FULL_ACCESS' | 'ADMIN';
  access_start_date?: Date;
  access_end_date?: Date;
  last_login_at?: Date;
  last_login_ip?: string;
  login_count: number;
  is_active: boolean;
  deactivated_by?: string;
  deactivated_at?: Date;
  deactivation_reason?: string;
  created_at: Date;
}

export interface UpdatePortalUserInput {
  full_name?: string;
  phone?: string;
  designation?: string;
  department?: string;
  access_level?: 'READ_ONLY' | 'FULL_ACCESS' | 'ADMIN';
  access_start_date?: string;
  access_end_date?: string;
  process_ids?: string[];
}

export async function getEnhancedPortalUser(userId: string): Promise<EnhancedPortalUser | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM portal_users WHERE id = ?",
    [userId]
  );
  return rows.length > 0 ? (rows[0] as EnhancedPortalUser) : null;
}

export async function listEnhancedPortalUsers(filters?: {
  client_id?: string;
  active_only?: boolean;
  access_level?: string;
  search?: string;
}): Promise<EnhancedPortalUser[]> {
  let query = "SELECT * FROM portal_users WHERE 1=1";
  const params: any[] = [];

  if (filters?.client_id) {
    query += " AND client_id = ?";
    params.push(filters.client_id);
  }

  if (filters?.active_only) {
    query += " AND is_active = 1";
  }

  if (filters?.access_level) {
    query += " AND access_level = ?";
    params.push(filters.access_level);
  }

  if (filters?.search) {
    query += " AND (email LIKE ? OR full_name LIKE ? OR designation LIKE ?)";
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  query += " ORDER BY created_at DESC";

  const [rows] = await db.execute<RowDataPacket[]>(query, params);
  return rows as EnhancedPortalUser[];
}

export async function updatePortalUser(
  userId: string,
  data: UpdatePortalUserInput
): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.full_name !== undefined) {
    updates.push("full_name = ?");
    params.push(data.full_name);
  }
  if (data.phone !== undefined) {
    updates.push("phone = ?");
    params.push(data.phone);
  }
  if (data.designation !== undefined) {
    updates.push("designation = ?");
    params.push(data.designation);
  }
  if (data.department !== undefined) {
    updates.push("department = ?");
    params.push(data.department);
  }
  if (data.access_level !== undefined) {
    updates.push("access_level = ?");
    params.push(data.access_level);
  }
  if (data.access_start_date !== undefined) {
    updates.push("access_start_date = ?");
    params.push(data.access_start_date);
  }
  if (data.access_end_date !== undefined) {
    updates.push("access_end_date = ?");
    params.push(data.access_end_date);
  }
  if (data.process_ids !== undefined) {
    updates.push("process_ids = ?");
    params.push(JSON.stringify(data.process_ids));
  }

  if (updates.length === 0) return;

  params.push(userId);
  await db.execute(
    `UPDATE portal_users SET ${updates.join(", ")} WHERE id = ?`,
    params
  );
}

export async function deactivatePortalUser(
  userId: string,
  deactivatedBy: string,
  reason?: string
): Promise<void> {
  await db.execute(
    `UPDATE portal_users
     SET is_active = 0, deactivated_by = ?, deactivated_at = NOW(), deactivation_reason = ?
     WHERE id = ?`,
    [deactivatedBy, reason || null, userId]
  );
}

export async function reactivatePortalUser(userId: string): Promise<void> {
  await db.execute(
    `UPDATE portal_users
     SET is_active = 1, deactivated_by = NULL, deactivated_at = NULL, deactivation_reason = NULL
     WHERE id = ?`,
    [userId]
  );
}

// ============================================================
// ACTIVITY TRACKING
// ============================================================

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  action_type: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_path?: string;
  response_status?: number;
  duration_ms?: number;
  metadata?: any;
  created_at: Date;
}

export async function logPortalUserActivity(data: {
  user_id: string;
  action_type: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_path?: string;
  response_status?: number;
  duration_ms?: number;
  metadata?: any;
}): Promise<void> {
  await db.execute(
    `INSERT INTO portal_user_activity_log (
      user_id, action_type, resource_type, resource_id,
      ip_address, user_agent, request_method, request_path,
      response_status, duration_ms, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.action_type,
      data.resource_type || null,
      data.resource_id || null,
      data.ip_address || null,
      data.user_agent || null,
      data.request_method || null,
      data.request_path || null,
      data.response_status || null,
      data.duration_ms || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ]
  );
}

export async function getPortalUserActivity(
  userId: string,
  limit: number = 100,
  actionType?: string
): Promise<ActivityLogEntry[]> {
  let query = `
    SELECT * FROM portal_user_activity_log
    WHERE user_id = ?
  `;
  const params: any[] = [userId];

  if (actionType) {
    query += " AND action_type = ?";
    params.push(actionType);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const [rows] = await db.execute<RowDataPacket[]>(query, params);
  return rows as ActivityLogEntry[];
}

export async function getRecentLogins(
  userId: string,
  limit: number = 20
): Promise<Array<{ login_time: Date; ip_address: string; user_agent: string }>> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT created_at as login_time, ip_address, user_agent
     FROM portal_user_activity_log
     WHERE user_id = ? AND action_type = 'LOGIN'
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows as Array<{ login_time: Date; ip_address: string; user_agent: string }>;
}

export async function updateLastLogin(
  userId: string,
  ipAddress: string
): Promise<void> {
  await db.execute(
    `UPDATE portal_users
     SET last_login_at = NOW(), last_login_ip = ?, login_count = login_count + 1
     WHERE id = ?`,
    [ipAddress, userId]
  );
}

// ============================================================
// PERMISSIONS MANAGEMENT
// ============================================================

export interface PortalUserPermission {
  id: string;
  user_id: string;
  permission_type: string;
  resource_scope: string;
  resource_ids?: string[];
  granted_by: string;
  granted_at: Date;
  expires_at?: Date;
  active_status: boolean;
}

export async function grantPermission(data: {
  user_id: string;
  permission_type: string;
  resource_scope: string;
  resource_ids?: string[];
  granted_by: string;
  expires_at?: Date;
}): Promise<void> {
  await db.execute(
    `INSERT INTO portal_user_permissions (
      user_id, permission_type, resource_scope, resource_ids, granted_by, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      resource_ids = VALUES(resource_ids),
      granted_by = VALUES(granted_by),
      granted_at = NOW(),
      expires_at = VALUES(expires_at),
      active_status = 1`,
    [
      data.user_id,
      data.permission_type,
      data.resource_scope,
      data.resource_ids ? JSON.stringify(data.resource_ids) : null,
      data.granted_by,
      data.expires_at || null
    ]
  );
}

export async function revokePermission(
  userId: string,
  permissionType: string
): Promise<void> {
  await db.execute(
    `UPDATE portal_user_permissions
     SET active_status = 0
     WHERE user_id = ? AND permission_type = ?`,
    [userId, permissionType]
  );
}

export async function getUserPermissions(userId: string): Promise<PortalUserPermission[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM portal_user_permissions
     WHERE user_id = ? AND active_status = 1
     AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );
  return rows as PortalUserPermission[];
}

// ============================================================
// ANALYTICS
// ============================================================

export interface UserActivitySummary {
  user_id: string;
  email: string;
  full_name?: string;
  total_actions: number;
  logins: number;
  api_calls: number;
  report_views: number;
  downloads: number;
  last_activity: Date;
  avg_session_duration_minutes: number;
}

export async function getUserActivitySummary(
  clientId?: string,
  days: number = 30
): Promise<UserActivitySummary[]> {
  let query = `
    SELECT
      pu.id as user_id,
      pu.email,
      pu.full_name,
      COUNT(pal.id) as total_actions,
      SUM(CASE WHEN pal.action_type = 'LOGIN' THEN 1 ELSE 0 END) as logins,
      SUM(CASE WHEN pal.action_type = 'API_CALL' THEN 1 ELSE 0 END) as api_calls,
      SUM(CASE WHEN pal.action_type = 'VIEW_REPORT' THEN 1 ELSE 0 END) as report_views,
      SUM(CASE WHEN pal.action_type = 'DOWNLOAD' THEN 1 ELSE 0 END) as downloads,
      MAX(pal.created_at) as last_activity,
      COALESCE(AVG(pal.duration_ms) / 60000, 0) as avg_session_duration_minutes
    FROM portal_users pu
    LEFT JOIN portal_user_activity_log pal ON pal.user_id = pu.id
      AND pal.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    WHERE pu.is_active = 1
  `;
  const params: any[] = [days];

  if (clientId) {
    query += " AND pu.client_id = ?";
    params.push(clientId);
  }

  query += `
    GROUP BY pu.id, pu.email, pu.full_name
    ORDER BY last_activity DESC
  `;

  const [rows] = await db.execute<RowDataPacket[]>(query, params);
  return rows as UserActivitySummary[];
}
