import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { processService } from "./process.service.js";
import {
  createProcessSchema,
  processFiltersSchema,
  updateProcessSchema,
  updateProcessStatusSchema
} from "./process.validation.js";

export const processController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const filters = processFiltersSchema.parse(req.query);

    const data = await processService.list(filters);

    return res.json({
      success: true,
      data
    });
  },

  async getById(req: AuthenticatedRequest, res: Response) {
    const data = await processService.getById(req.params.id);

    return res.json({
      success: true,
      data
    });
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const input = createProcessSchema.parse(req.body);

    const data = await processService.create(input, req.authUser!.id);

    return res.status(201).json({
      success: true,
      data,
      message: "Process created successfully"
    });
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const input = updateProcessSchema.parse(req.body);

    const data = await processService.update(
      req.params.id,
      input,
      req.authUser!.id
    );

    return res.json({
      success: true,
      data,
      message: "Process updated successfully"
    });
  },

  async updateStatus(req: AuthenticatedRequest, res: Response) {
    const input = updateProcessStatusSchema.parse(req.body);

    const data = await processService.updateStatus(
      req.params.id,
      input.activeStatus,
      req.authUser!.id
    );

    return res.json({
      success: true,
      data,
      message: input.activeStatus
        ? "Process activated successfully"
        : "Process deactivated successfully"
    });
  }
};
