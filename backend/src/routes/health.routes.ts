import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  return res.json({
    success: true,
    service: "MCN HRMS Backend API",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});
