import { z } from "zod";

const INTEGRATION_TYPES = ["rest_pull", "rest_push", "database", "sftp", "file_upload"] as const;

export const createIntegrationSchema = z.object({
  integrationKey: z.string().trim().min(2).max(100),
  integrationName: z.string().trim().min(2).max(255),
  integrationType: z.enum(INTEGRATION_TYPES),
  vendorName: z.string().trim().max(255).nullable().optional(),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  authType: z.string().trim().max(50).nullable().optional(),
  secretName: z.string().trim().max(255).nullable().optional(),
  configJson: z.record(z.unknown()).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const updateIntegrationSchema = z.object({
  integrationName: z.string().trim().min(2).max(255).optional(),
  integrationType: z.enum(INTEGRATION_TYPES).optional(),
  vendorName: z.string().trim().max(255).nullable().optional(),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  authType: z.string().trim().max(50).nullable().optional(),
  secretName: z.string().trim().max(255).nullable().optional(),
  configJson: z.record(z.unknown()).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  activeStatus: z.boolean().optional(),
});

export const confirmFieldMapSchema = z.object({
  integrationKey: z.string().trim().min(1).max(100),
  sourceField: z.string().trim().min(1).max(255),
  targetTable: z.string().trim().min(1).max(100),
  targetColumn: z.string().trim().min(1).max(100),
  transform: z.string().trim().max(500).nullable().optional(),
});

export const runFiltersSchema = z.object({
  integrationKey: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Basic cron: 5 or 6 space-separated tokens — enough to reject obviously wrong input
const CRON_RE = /^(\S+\s+){4}\S+(\s+\S+)?$/;

export const upsertScheduleSchema = z.object({
  cronExpression: z
    .string()
    .trim()
    .min(9)
    .regex(CRON_RE, "Invalid cron expression"),
  enabled: z.boolean().optional(),
}).refine((d) => d.cronExpression !== undefined || d.enabled !== undefined, {
  message: "Provide at least cronExpression or enabled",
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;
export type ConfirmFieldMapInput = z.infer<typeof confirmFieldMapSchema>;
export type RunFilters = z.infer<typeof runFiltersSchema>;
export type UpsertScheduleInput = z.infer<typeof upsertScheduleSchema>;
