import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto, { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";

const router = Router();
const h = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: Response, next: (err?: unknown) => void) => fn(req, res).catch(next);

router.use(requireAuth);
router.use(requireRole("admin"));

type EmployeeRow = RowDataPacket & {
  id: string;
  employee_code?: string;
  email?: string | null;
  official_email?: string | null;
  user_id?: string | null;
  branch_id?: string | null;
  process_id?: string | null;
  reporting_manager_id?: string | null;
  designation_name?: string | null;
  department_name?: string | null;
};

function tempPassword(): string {
  return crypto.randomBytes(12).toString("base64url") + "A1!";
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : null;
}

async function tableExists(tableName: string): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [tableName]
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function assignRole(userId: string, roleKey: string, actorUserId: string) {
  const [roleRows] = await db.execute<RowDataPacket[]>("SELECT id FROM roles WHERE role_key=? AND active_status=1 LIMIT 1", [roleKey]);
  if (!roleRows[0]) return;
  await db.execute(
    `INSERT INTO user_roles (id, user_id, role_key, assigned_by, active_status, assigned_at)
     VALUES (?, ?, ?, ?, 1, NOW())
     ON DUPLICATE KEY UPDATE active_status=1, assigned_by=VALUES(assigned_by), assigned_at=NOW(), revoked_by=NULL, revoked_at=NULL`,
    [randomUUID(), userId, roleKey, actorUserId]
  );
}

function inferRoles(row: EmployeeRow): string[] {
  const text = `${row.designation_name ?? ""} ${row.department_name ?? ""}`.toLowerCase();
  const roles = new Set<string>(["employee"]);
  if (text.includes("payroll")) roles.add("payroll");
  if (text.includes("finance")) roles.add("finance");
  if (text.includes("wfm")) roles.add("wfm");
  if (text.includes("trainer") || text.includes("training")) roles.add("trainer");
  if (text.includes("quality") || text.includes("qa")) roles.add("qa");
  if (text.includes("recruit")) roles.add("recruiter");
  if (text.includes("hr")) roles.add("hr");
  if (text.includes("branch head")) roles.add("branch_head");
  if (text.includes("manager")) roles.add("process_manager");
  if (text.includes("tl") || text.includes("team leader")) roles.add("team_leader");
  return Array.from(roles);
}

async function createInboxForRole(roleKey: string, title: string, description: string, priority = "normal") {
  try {
    const [users] = await db.execute<RowDataPacket[]>("SELECT DISTINCT user_id FROM user_roles WHERE role_key=? AND active_status=1 LIMIT 25", [roleKey]);
    for (const user of users) {
      await db.execute(
        `INSERT INTO work_inbox_item (id, user_id, type, title, description, entity_type, action_url, priority)
         VALUES (?, ?, 'LAUNCH_READINESS', ?, ?, 'auth_user', '/settings/access-control', ?)`,
        [randomUUID(), user.user_id, title, description, priority]
      );
    }
  } catch {
    // Non-fatal: launch bootstrap must not fail only because inbox table/routing is unavailable.
  }
}

async function addJourney(employeeId: string, eventType: string, description: string, userId?: string) {
  try {
    await db.execute(
      `INSERT INTO employee_journey_log (id, employee_id, event_type, event_date, description, module, triggered_by, metadata)
       VALUES (?, ?, ?, CURDATE(), ?, 'AUTH', ?, ?)`,
      [randomUUID(), employeeId, eventType, description, userId ?? null, JSON.stringify({ source: "launch_bootstrap" })]
    );
  } catch {
    // Non-fatal: journey table may not exist in older deployments.
  }
}

router.get("/launch-readiness", h(async (_req, res) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS active_employees,
       SUM(CASE WHEN e.user_id IS NULL THEN 1 ELSE 0 END) AS employees_without_user,
       SUM(CASE WHEN e.email IS NULL OR e.email='' THEN 1 ELSE 0 END) AS employees_without_email,
       SUM(CASE WHEN e.reporting_manager_id IS NULL THEN 1 ELSE 0 END) AS missing_manager,
       SUM(CASE WHEN e.branch_id IS NULL THEN 1 ELSE 0 END) AS missing_branch,
       SUM(CASE WHEN e.process_id IS NULL THEN 1 ELSE 0 END) AS missing_process
     FROM employees e
     WHERE e.active_status = 1`
  );
  res.json({ success: true, data: rows[0] });
}));

router.post("/bootstrap-existing-users", h(async (req, res) => {
  const dryRun = req.body?.dryRun === true;
  const runId = randomUUID();
  const [employees] = await db.execute<EmployeeRow[]>(
    `SELECT e.*, d.designation_name, dep.department_name
       FROM employees e
       LEFT JOIN designations d ON d.id = e.designation_id
       LEFT JOIN departments dep ON dep.id = e.department_id
      WHERE e.active_status = 1
      ORDER BY e.employee_code`
  );

  const result = { runId, created: 0, updated: 0, skipped: 0, failed: 0, kpiAssigned: 0, kpiMissing: 0 };
  const hasKpiTables = await tableExists("kpi_employee_assignment") && await tableExists("kpi_role_template");

  for (const emp of employees) {
    const email = normalizeEmail(emp.email ?? emp.official_email);
    const employeeId = String(emp.id);
    const employeeCode = String(emp.employee_code ?? "");
    try {
      if (!email || !employeeCode) {
        result.skipped++;
        if (!dryRun) await db.execute("INSERT INTO hrms_launch_bootstrap_log (id, run_id, employee_id, employee_code, status, message) VALUES (?, ?, ?, ?, 'skipped', ?)", [randomUUID(), runId, employeeId, employeeCode, "Missing official email or employee code"]);
        continue;
      }

      const [existing] = await db.execute<RowDataPacket[]>("SELECT id FROM auth_user WHERE email=? LIMIT 1", [email]);
      let userId = emp.user_id ? String(emp.user_id) : null;
      let status: "created" | "updated" = "updated";
      if (!userId && existing[0]?.id) userId = String(existing[0].id);

      if (!userId) {
        status = "created";
        userId = randomUUID();
        const hash = await bcrypt.hash(tempPassword(), 10);
        if (!dryRun) await db.execute("INSERT INTO auth_user (id, email, password_hash, must_change_password) VALUES (?, ?, ?, 1)", [userId, email, hash]);
      } else if (!dryRun) {
        await db.execute("UPDATE auth_user SET must_change_password=1 WHERE id=?", [userId]);
      }

      if (!dryRun) {
        await db.execute("UPDATE employees SET user_id=? WHERE id=?", [userId, employeeId]);
        for (const role of inferRoles(emp)) await assignRole(userId, role, req.authUser!.id);
        await db.execute("INSERT INTO hrms_launch_invite_log (id, employee_id, user_id, email, invite_status, message) VALUES (?, ?, ?, ?, 'pending', ?)", [randomUUID(), employeeId, userId, email, "Account prepared. Connect communication module for invite dispatch."]);
        await addJourney(employeeId, "login_account_prepared", "HRMS login account prepared", req.authUser!.id);

        if (hasKpiTables && emp.process_id) {
          const roleCodes = inferRoles(emp);
          const placeholders = roleCodes.map(() => "?").join(",");
          const [templates] = await db.execute<RowDataPacket[]>(
            `SELECT rt.id FROM kpi_role_template rt JOIN kpi_process_template pt ON pt.id=rt.process_template_id
             WHERE pt.process_id=? AND pt.status='active' AND rt.status='active' AND rt.role_code IN (${placeholders})
             ORDER BY FIELD(rt.role_code, ${placeholders}), pt.effective_from DESC LIMIT 1`,
            [emp.process_id, ...roleCodes, ...roleCodes]
          );
          if (templates[0]) {
            await db.execute("INSERT INTO kpi_employee_assignment (id, employee_id, process_id, role_template_id, effective_from, assignment_type, created_by) VALUES (UUID(), ?, ?, ?, CURDATE(), 'auto', ?) ON DUPLICATE KEY UPDATE effective_to=NULL", [employeeId, emp.process_id, templates[0].id, req.authUser!.id]);
            result.kpiAssigned++;
          } else {
            result.kpiMissing++;
            await createInboxForRole("hr", "KPI template missing during launch", `Employee ${employeeCode} has no active process-role KPI template.`, "high");
          }
        }

        await db.execute("INSERT INTO hrms_launch_bootstrap_log (id, run_id, employee_id, employee_code, status, message) VALUES (?, ?, ?, ?, ?, ?)", [randomUUID(), runId, employeeId, employeeCode, status, "Employee login account prepared"]);
      }
      if (status === "created") result.created++; else result.updated++;
    } catch (error) {
      result.failed++;
      if (!dryRun) await db.execute("INSERT INTO hrms_launch_bootstrap_log (id, run_id, employee_id, employee_code, status, message) VALUES (?, ?, ?, ?, 'failed', ?)", [randomUUID(), runId, employeeId, employeeCode, error instanceof Error ? error.message : String(error)]);
    }
  }

  res.json({ success: true, data: result, dryRun });
}));

router.post("/send-invites", h(async (_req, res) => {
  const [pending] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM hrms_launch_invite_log WHERE invite_status='pending'");
  res.json({ success: true, data: { pending: Number(pending[0]?.total ?? 0), status: "communication_gateway_pending", message: "Invite records are prepared. Connect communication module before production email/SMS dispatch." } });
}));

export { router as authLaunchRouter };
