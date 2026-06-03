import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./authMiddleware.js";
import { hasScopedAccess, type ScopeTarget } from "../shared/scopeAccess.js";

export function requireScopedRole(
  allowedRoles: string[],
  targetResolver: (req: AuthenticatedRequest) => ScopeTarget,
  options: { allowAdminBypass?: boolean; requireScopeForNonAdmin?: boolean } = {}
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const target = targetResolver(req);
      const ok = await hasScopedAccess(userId, allowedRoles, target, options);

      if (!ok) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: this record is outside your assigned branch/process/team scope",
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function getTargetFromBodyOrQuery(req: AuthenticatedRequest): ScopeTarget {
  return {
    branchId: (req.body?.branchId ?? req.body?.branch_id ?? req.query?.branchId ?? req.query?.branch_id ?? null) as string | null,
    processId: (req.body?.processId ?? req.body?.process_id ?? req.query?.processId ?? req.query?.process_id ?? null) as string | null,
    lobId: (req.body?.lobId ?? req.body?.lob_id ?? req.query?.lobId ?? req.query?.lob_id ?? null) as string | null,
    departmentId: (req.body?.departmentId ?? req.body?.department_id ?? req.query?.departmentId ?? req.query?.department_id ?? null) as string | null,
    managerEmployeeId: (req.body?.managerEmployeeId ?? req.body?.manager_employee_id ?? req.query?.managerEmployeeId ?? req.query?.manager_employee_id ?? null) as string | null,
    employeeId: (req.body?.employeeId ?? req.body?.employee_id ?? req.query?.employeeId ?? req.query?.employee_id ?? null) as string | null,
  };
}
