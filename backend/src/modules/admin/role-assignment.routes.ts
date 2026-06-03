import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { db } from "../../db/mysql.js";
import type { RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";

const router = Router();
const h = (fn: (req: any, res: any) => Promise<unknown>) =>
  (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);
router.use(requireRole("admin")); // All role assignment operations admin-only

// ── List all roles ────────────────────────────────────────────────────────────
router.get("/roles", h(async (_req: AuthenticatedRequest, res: Response) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM roles WHERE active_status = 1 ORDER BY role_name`
  );
  return res.json({ success: true, data: rows });
}));

// ── List user's roles ─────────────────────────────────────────────────────────
router.get("/users/:userId/roles", h(async (req: AuthenticatedRequest, res: Response) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT ur.*, r.role_name, r.description,
            assigner.email AS assigned_by_email,
            revoker.email AS revoked_by_email
     FROM user_roles ur
     JOIN roles r ON r.role_key = ur.role_key
     LEFT JOIN users assigner ON assigner.id = ur.assigned_by
     LEFT JOIN users revoker ON revoker.id = ur.revoked_by
     WHERE ur.user_id = ?
     ORDER BY ur.active_status DESC, ur.assigned_at DESC`,
    [req.params.userId]
  );
  return res.json({ success: true, data: rows });
}));

// ── Assign role to user ───────────────────────────────────────────────────────
router.post("/users/:userId/roles", h(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;
  const { roleKey } = req.body as { roleKey: string };

  if (!roleKey) {
    return res.status(400).json({ success: false, message: "roleKey is required" });
  }

  // Check if role exists
  const [roles] = await db.execute<RowDataPacket[]>(
    `SELECT id FROM roles WHERE role_key = ? AND active_status = 1`,
    [roleKey]
  );

  if (!roles.length) {
    return res.status(404).json({ success: false, message: "Role not found or inactive" });
  }

  // Check if user exists
  const [users] = await db.execute<RowDataPacket[]>(
    `SELECT id FROM users WHERE id = ?`,
    [userId]
  );

  if (!users.length) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Assign role (upsert - reactivate if exists but was revoked)
  const id = randomUUID();
  await db.execute(
    `INSERT INTO user_roles (id, user_id, role_key, assigned_by, active_status, assigned_at)
     VALUES (?, ?, ?, ?, 1, NOW())
     ON DUPLICATE KEY UPDATE
       active_status = 1,
       assigned_by = VALUES(assigned_by),
       assigned_at = NOW(),
       revoked_by = NULL,
       revoked_at = NULL`,
    [id, userId, roleKey, req.authUser!.id]
  );

  // Return updated role list
  const [updatedRoles] = await db.execute<RowDataPacket[]>(
    `SELECT ur.*, r.role_name, r.description
     FROM user_roles ur
     JOIN roles r ON r.role_key = ur.role_key
     WHERE ur.user_id = ? AND ur.role_key = ?
     LIMIT 1`,
    [userId, roleKey]
  );

  return res.json({
    success: true,
    data: updatedRoles[0],
    message: `Role '${roleKey}' assigned successfully`
  });
}));

// ── Revoke role from user ─────────────────────────────────────────────────────
router.delete("/users/:userId/roles/:roleKey", h(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, roleKey } = req.params;

  const [result] = await db.execute(
    `UPDATE user_roles
     SET active_status = 0,
         revoked_by = ?,
         revoked_at = NOW()
     WHERE user_id = ? AND role_key = ? AND active_status = 1`,
    [req.authUser!.id, userId, roleKey]
  ) as unknown as [{ affectedRows: number }, unknown];

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: "Role assignment not found or already revoked"
    });
  }

  return res.json({
    success: true,
    message: `Role '${roleKey}' revoked successfully`
  });
}));

// ── Role assignment audit log ─────────────────────────────────────────────────
router.get("/role-audit", h(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, roleKey, fromDate, toDate, limit = "500" } = req.query as {
    userId?: string;
    roleKey?: string;
    fromDate?: string;
    toDate?: string;
    limit?: string;
  };

  const conds: string[] = [];
  const params: unknown[] = [];

  if (userId) {
    conds.push("ur.user_id = ?");
    params.push(userId);
  }

  if (roleKey) {
    conds.push("ur.role_key = ?");
    params.push(roleKey);
  }

  if (fromDate) {
    conds.push("ur.assigned_at >= ?");
    params.push(fromDate);
  }

  if (toDate) {
    conds.push("ur.assigned_at <= ?");
    params.push(toDate);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  params.push(parseInt(limit, 10));

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT ur.*,
            u.email AS user_email,
            r.role_name,
            assigner.email AS assigned_by_email,
            revoker.email AS revoked_by_email
     FROM user_roles ur
     JOIN users u ON u.id = ur.user_id
     JOIN roles r ON r.role_key = ur.role_key
     LEFT JOIN users assigner ON assigner.id = ur.assigned_by
     LEFT JOIN users revoker ON revoker.id = ur.revoked_by
     ${where}
     ORDER BY ur.assigned_at DESC
     LIMIT ?`,
    params
  );

  return res.json({ success: true, data: rows });
}));

// ── Bulk role assignment ──────────────────────────────────────────────────────
router.post("/users/bulk-assign", h(async (req: AuthenticatedRequest, res: Response) => {
  const { assignments } = req.body as {
    assignments: Array<{ userId: string; roleKey: string }>;
  };

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({
      success: false,
      message: "assignments array is required and must not be empty"
    });
  }

  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const { userId, roleKey } of assignments) {
    try {
      // Check if role exists
      const [roles] = await db.execute<RowDataPacket[]>(
        `SELECT id FROM roles WHERE role_key = ? AND active_status = 1`,
        [roleKey]
      );

      if (!roles.length) {
        results.failed++;
        results.errors.push(`User ${userId}: Role ${roleKey} not found`);
        continue;
      }

      // Assign role
      const id = randomUUID();
      await db.execute(
        `INSERT INTO user_roles (id, user_id, role_key, assigned_by, active_status, assigned_at)
         VALUES (?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           active_status = 1,
           assigned_by = VALUES(assigned_by),
           assigned_at = NOW()`,
        [id, userId, roleKey, req.authUser!.id]
      );

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`User ${userId}: ${(error as Error).message}`);
    }
  }

  return res.json({
    success: true,
    data: results,
    message: `Bulk assignment completed: ${results.success} success, ${results.failed} failed`
  });
}));

export { router as roleAssignmentRouter };
