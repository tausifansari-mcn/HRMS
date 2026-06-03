import { Router } from "express";
import { randomUUID } from "crypto";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { db } from "../../db/mysql.js";
import type { RowDataPacket } from "mysql2";

const router = Router();
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

// GET /api/employee-docs/:employeeId
router.get("/:employeeId", h(async (req: AuthenticatedRequest, res: Response) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, employee_id, doc_type AS document_type, doc_name AS document_name, file_url, verified, created_at AS uploaded_at FROM employee_documents WHERE employee_id = ? ORDER BY created_at DESC",
    [req.params.employeeId]
  );
  res.json({ success: true, data: rows });
}));

// POST /api/employee-docs/:employeeId — register document metadata (file URL from caller)
router.post("/:employeeId", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { document_type, document_name, file_url } = req.body as {
    document_type: string;
    document_name: string;
    file_url: string;
  };
  if (!document_type || !file_url) return res.status(400).json({ error: "document_type and file_url required" });
  const id = randomUUID();
  await db.execute(
    "INSERT INTO employee_documents (id, employee_id, doc_type, doc_name, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)",
    [id, req.params.employeeId, document_type, document_name ?? null, file_url, req.authUser!.id]
  );
  const [rows] = await db.execute<RowDataPacket[]>("SELECT id, employee_id, doc_type AS document_type, doc_name AS document_name, file_url, verified, created_at AS uploaded_at FROM employee_documents WHERE id = ? LIMIT 1", [id]);
  res.status(201).json({ success: true, data: (rows as RowDataPacket[])[0] });
}));

// DELETE /api/employee-docs/:employeeId/:docId
router.delete("/:employeeId/:docId", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  await db.execute(
    "DELETE FROM employee_documents WHERE id = ? AND employee_id = ?",
    [req.params.docId, req.params.employeeId]
  );
  res.json({ success: true });
}));

export { router as employeeDocsRouter };
