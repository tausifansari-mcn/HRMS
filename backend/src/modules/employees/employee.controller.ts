import type { Request, Response } from "express";
import { createEmployeeSchema, employeeFiltersSchema, updateEmployeeSchema } from "./employee.validation.js";
import { employeeService } from "./employee.service.js";

export const employeeController = {
  async createEmployee(req: Request, res: Response) {
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await employeeService.createEmployee(parsed.data, (req as any).userId ?? "system");
    res.status(201).json({ data });
  },

  async listEmployees(req: Request, res: Response) {
    const parsed = employeeFiltersSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const result = await employeeService.listEmployees(parsed.data);
    res.json({ data: result.data, total: result.total, page: result.page, limit: result.limit });
  },

  async getEmployee(req: Request, res: Response) {
    const data = await employeeService.getEmployee(req.params.id);
    res.json({ data });
  },

  async updateEmployee(req: Request, res: Response) {
    const parsed = updateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = await employeeService.updateEmployee(req.params.id, parsed.data, (req as any).userId ?? "system");
    res.json({ data });
  },

  async deactivateEmployee(req: Request, res: Response) {
    await employeeService.deactivateEmployee(req.params.id, (req as any).userId ?? "system");
    res.status(204).send();
  },
};
