import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createEmployeeSchema = z.object({
  employeeCode: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  mobile: z.string().trim().max(20).nullable().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  dateOfBirth: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD").optional(),
  dateOfJoining: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD"),
  salaryStartDate: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD").optional(),
  employmentType: z.string().trim().optional(),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  processId: z.string().uuid().nullable().optional(),
  designationId: z.string().uuid().nullable().optional(),
  reportingManagerId: z.string().uuid().nullable().optional(),
  // Optional: auto-assign salary at creation
  structureId: z.string().uuid().optional(),
  ctcAnnual: z.number().positive().optional(),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  mobile: z.string().trim().max(20).nullable().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  dateOfBirth: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD").optional(),
  dateOfJoining: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD").optional(),
  salaryStartDate: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD").nullable().optional(),
  dateOfExit: z.string().regex(DATE_REGEX, "Date must be YYYY-MM-DD").nullable().optional(),
  employmentType: z.string().trim().optional(),
  employmentStatus: z.enum(["Active", "Inactive", "On Notice", "Absconded", "Terminated", "Onboarding"]).optional(),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  processId: z.string().uuid().nullable().optional(),
  designationId: z.string().uuid().nullable().optional(),
  reportingManagerId: z.string().uuid().nullable().optional(),
  photoUrl: z.string().trim().url().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
});

export const employeeFiltersSchema = z.object({
  status: z.string().optional(),
  processId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFilters = z.infer<typeof employeeFiltersSchema>;
