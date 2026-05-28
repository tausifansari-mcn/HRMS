import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { payrollController as c } from "./payroll.controller.js";
import { calculatePayrollRun } from "./payrollCalculate.service.js";

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

// Structures
router.get("/structures", h(c.listStructures));
router.post("/structures", h(c.createStructure));

// Components
router.get("/components", h(c.listComponents));
router.post("/components", h(c.createComponent));

// Salary assignment
router.post("/salary-assignments", h(c.assignSalary));
router.post("/salary-assignments/bulk", h(c.bulkAssignSalary));
router.get("/salary-assignments/:employeeId", h(c.getEmployeeSalary));

// Prep runs — static paths before :id
router.get("/runs", h(c.listRuns));
router.post("/runs", h(c.createRun));
router.get("/runs/:id", h(c.getRun));
router.patch("/runs/:id/status", h(c.updateRunStatus));
router.get("/runs/:id/lines", h(c.listLines));
router.post("/runs/:id/calculate", async (req: any, res: any, next: any) => {
  try {
    const result = await calculatePayrollRun(req.params.id, req.authUser?.id ?? "system");
    return res.json({ success: true, data: result, message: "Payroll calculated" });
  } catch (err) { next(err); }
});

// Prep lines
router.patch("/lines/:id", h(c.updateLine));

// Advances
router.post("/advances", h(c.createAdvance));
router.get("/advances/:employeeId", h(c.listAdvances));

// Statutory config
router.get("/statutory-config", h(c.getStatutoryConfig));

export { router as payrollRouter };
