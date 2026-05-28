import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { integrationController } from "./integration.controller.js";

export const integrationRouter = Router();

integrationRouter.use(requireAuth);

integrationRouter.get("/runs", (req, res, next) => {
  integrationController.listRuns(req as any, res).catch(next);
});

integrationRouter.post("/field-maps/confirm", (req, res, next) => {
  integrationController.confirmFieldMap(req as any, res).catch(next);
});

integrationRouter.get("/", (req, res, next) => {
  integrationController.list(req as any, res).catch(next);
});

integrationRouter.post("/", (req, res, next) => {
  integrationController.create(req as any, res).catch(next);
});

integrationRouter.get("/:key", (req, res, next) => {
  integrationController.getByKey(req as any, res).catch(next);
});

integrationRouter.put("/:key", (req, res, next) => {
  integrationController.update(req as any, res).catch(next);
});

integrationRouter.post("/:key/run", (req, res, next) => {
  integrationController.createRun(req as any, res).catch(next);
});

integrationRouter.get("/:key/field-maps", (req, res, next) => {
  integrationController.listFieldMaps(req as any, res).catch(next);
});

integrationRouter.get("/:key/suggestions", (req, res, next) => {
  integrationController.listSuggestions(req as any, res).catch(next);
});

integrationRouter.get("/:key/schedule", (req, res, next) => {
  integrationController.getSchedule(req as any, res).catch(next);
});

integrationRouter.put("/:key/schedule", (req, res, next) => {
  integrationController.upsertSchedule(req as any, res).catch(next);
});
