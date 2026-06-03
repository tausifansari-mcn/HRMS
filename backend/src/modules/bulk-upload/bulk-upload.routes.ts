import { Router } from "express";
import { randomUUID } from "crypto";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { db } from "../../db/mysql.js";
import type { RowDataPacket } from "mysql2";

const router = Router();
const h = (fn: any) => (req: any, res: any, next: any) => fn(req, res).catch(next);
router.use(requireAuth);

router.get("/batches", requireRole("admin", "hr"), h(async (_req: AuthenticatedRequest, res: Response) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM upload_batch ORDER BY created_at DESC LIMIT 50"
  );
  res.json({ success: true, data: rows });
}));

router.get("/batches/:id/rows", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM upload_batch_row WHERE upload_batch_id = ? ORDER BY row_no ASC",
    [req.params.id]
  );
  res.json({ success: true, data: rows });
}));

router.post("/batches", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as {
    upload_batch_no?: string; upload_type_code: string; original_file_name?: string;
    file_path?: string; file_size_bytes?: number; total_rows: number; valid_rows: number;
    error_rows: number; batch_status?: string; error_summary?: string; metadata?: any;
  };
  if (!body.upload_type_code) {
    return res.status(400).json({ error: "upload_type_code is required" });
  }
  if (body.total_rows === undefined || body.valid_rows === undefined || body.error_rows === undefined) {
    return res.status(400).json({ error: "total_rows, valid_rows, and error_rows are required" });
  }
  const id = randomUUID();
  const batchNo = body.upload_batch_no || `BATCH-${Date.now()}`;
  await db.execute(
    `INSERT INTO upload_batch (id, upload_batch_no, upload_type_code, original_file_name, file_path,
     file_size_bytes, total_rows, valid_rows, error_rows, batch_status, error_summary, metadata,
     uploaded_by, validated_by, validated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, batchNo, body.upload_type_code, body.original_file_name ?? null, body.file_path ?? null,
     body.file_size_bytes ?? null, body.total_rows, body.valid_rows, body.error_rows,
     body.batch_status ?? "pending", body.error_summary ?? null,
     body.metadata ? JSON.stringify(body.metadata) : null,
     req.authUser!.id,
     body.valid_rows > 0 ? req.authUser!.id : null,
     body.valid_rows > 0 ? new Date().toISOString() : null]
  );
  const [rows] = await db.execute<RowDataPacket[]>("SELECT * FROM upload_batch WHERE id = ? LIMIT 1", [id]);
  res.status(201).json({ success: true, data: (rows as RowDataPacket[])[0] });
}));

router.post("/batches/:id/rows", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  const rows = req.body as Array<{
    row_no: number; raw_data?: any; normalized_data?: any; row_status?: string; error_messages?: any;
  }>;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "rows array required" });
  }
  for (const row of rows) {
    await db.execute(
      `INSERT INTO upload_batch_row (id, upload_batch_id, row_no, raw_data, normalized_data, row_status, error_messages)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), req.params.id, row.row_no,
       row.raw_data ? JSON.stringify(row.raw_data) : null,
       row.normalized_data ? JSON.stringify(row.normalized_data) : null,
       row.row_status ?? "pending",
       row.error_messages ? JSON.stringify(row.error_messages) : null]
    );
  }
  res.status(201).json({ success: true, count: rows.length });
}));

export { router as bulkUploadRouter };
