import rateLimit from "express-rate-limit";

/** 60 req/min per IP — for paginated list endpoints (employees, payslips, reports) */
export const listEndpointLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please slow down" },
});

/** 5 payroll runs per 5 min per IP — expensive CPU+DB operation */
export const payrollRunLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Payroll calculation rate limit exceeded, please wait and retry" },
});

/** 30 req/min per IP — for report generation endpoints */
export const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many report requests, please slow down" },
});
