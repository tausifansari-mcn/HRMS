import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { exitController } from "./exit.controller.js";

export const exitRouter = Router();
exitRouter.use(requireAuth);

const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// Stats MUST be defined before /:id to avoid route shadowing
exitRouter.get("/stats",       h(exitController.getExitStats.bind(exitController)));
exitRouter.get("/",            h(exitController.listExitRequests.bind(exitController)));
exitRouter.post("/",           h(exitController.createExitRequest.bind(exitController)));
exitRouter.get("/:id",         h(exitController.getExitRequest.bind(exitController)));
exitRouter.patch("/:id/status", h(exitController.updateExitStatus.bind(exitController)));
