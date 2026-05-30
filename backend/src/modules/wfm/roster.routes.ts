import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { rosterController as c } from "./roster.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are accepted"));
    }
  },
});

export const rosterRouter = Router();
rosterRouter.use(requireAuth);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// Plans
rosterRouter.post("/plans",              h(c.createPlan.bind(c)));
rosterRouter.get("/plans",               h(c.listPlans.bind(c)));
rosterRouter.patch("/plans/:id/publish", h(c.publishPlan.bind(c)));

// Assignments
rosterRouter.post("/assignments", h(c.assignEmployee.bind(c)));
rosterRouter.get("/assignments",  h(c.listAssignments.bind(c)));

// CSV upload — multer runs before controller
rosterRouter.post("/upload", upload.single("file"), h(c.uploadCsv.bind(c)));
