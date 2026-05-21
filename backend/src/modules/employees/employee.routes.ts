import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { employeeController as c } from "./employee.controller.js";

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

router.get("/", h(c.listEmployees));
router.post("/", h(c.createEmployee));
router.get("/:id", h(c.getEmployee));
router.patch("/:id", h(c.updateEmployee));
router.delete("/:id", h(c.deactivateEmployee));

export { router as employeeRouter };
