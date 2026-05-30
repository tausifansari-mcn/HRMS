import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { leaveController } from "./leave.controller.js";

export const leaveRouter = Router();
leaveRouter.use(requireAuth);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

leaveRouter.get("/types",                         h(leaveController.listLeaveTypes.bind(leaveController)));
leaveRouter.post("/types",                        h(leaveController.createLeaveType.bind(leaveController)));
leaveRouter.post("/requests",                     h(leaveController.submitRequest.bind(leaveController)));
leaveRouter.get("/requests",                      h(leaveController.listRequests.bind(leaveController)));
leaveRouter.patch("/requests/:id/review",         h(leaveController.reviewRequest.bind(leaveController)));
leaveRouter.get("/balance/:employeeId",           h(leaveController.getBalance.bind(leaveController)));
leaveRouter.get("/holidays",                      h(leaveController.listHolidays.bind(leaveController)));
leaveRouter.post("/holidays",                     h(leaveController.createHoliday.bind(leaveController)));
