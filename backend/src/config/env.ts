import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  SUPABASE_URL: z.string().url().optional().default("https://placeholder.supabase.co"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  SUPABASE_ANON_KEY: z.string().optional().default(""),

  ACTIVE_DB_PROVIDER: z.enum(["supabase", "sqlserver", "mysql"]).default("supabase"),

  // MySQL (mas_hrms) — optional, only required when ACTIVE_DB_PROVIDER includes mysql modules
  DB_HOST:     z.string().default("localhost"),
  DB_PORT:     z.coerce.number().default(3306),
  DB_USER:     z.string().default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME:     z.string().default("mas_hrms"),
  DB_POOL_MAX: z.coerce.number().default(10),

  // NCOSEC Biometric DB (Matrix Cosec SQL Server)
  NCOSEC_DB_HOST:     z.string().default("172.10.10.146"),
  NCOSEC_DB_PORT:     z.coerce.number().default(1433),
  NCOSEC_DB_USER:     z.string().default("shivamg"),
  NCOSEC_DB_PASSWORD: z.string().default(""),
  NCOSEC_DB_NAME:     z.string().default("NCOSEC"),
  NCOSEC_DB_ENCRYPT:  z.string().default("false"),

  PORTAL_JWT_SECRET: z.string().min(32).default("change-me-in-production-portal-secret-32ch"),
  JWT_SECRET: z.string().min(32).default('change-me-jwt-secret-32characters!!'),
  // Must be explicitly "true" to enable demo bypass. Production default is disabled.
  PORTAL_DEMO_BYPASS: z.string().optional().default("false"),
  // Required secret for payroll bank account AES encryption. Must be set in production.
  PAYROLL_BANK_KEY: z.string().min(16).default("hrms-bank-key-dev"),
  // Dedicated AES-256-GCM key for communication provider secrets. Falls back to PAYROLL_BANK_KEY if not set.
  COMM_SECRET: z.string().min(16).optional(),
  // Enables mock-token demo bypass. Must NOT be "true" in production.
  INTERNAL_DEMO_BYPASS: z.string().optional().default("false"),
  SMTP_HOST:   z.string().default("smtp.gmail.com"),
  SMTP_PORT:   z.coerce.number().default(587),
  SMTP_USER:   z.string().default(""),
  SMTP_PASS:   z.string().default(""),
  SMTP_FROM:   z.string().default("noreply@mascallnet.com"),

  // Legacy MySQL Database
  LEGACY_MYSQL_HOST: z.string().default(""),
  LEGACY_MYSQL_PORT: z.coerce.number().default(3306),
  LEGACY_MYSQL_DATABASE: z.string().default(""),
  LEGACY_MYSQL_USER: z.string().default(""),
  LEGACY_MYSQL_PASSWORD: z.string().default(""),

  // Sync configuration
  LEGACY_SYNC_ENABLED: z.string().default("false"),
  LEGACY_SYNC_INTERVAL_MS: z.coerce.number().default(60000),
  LEGACY_SYNC_BATCH_SIZE: z.coerce.number().default(1000),
  LEGACY_SYNC_PARALLEL_DOMAINS: z.string().default("true"),
  LEGACY_SYNC_MAX_RETRIES: z.coerce.number().default(3),
  LEGACY_SYNC_RETRY_DELAY_MS: z.coerce.number().default(5000),
  LEGACY_CT_RETENTION_DAYS: z.coerce.number().default(2),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid backend environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const KNOWN_INSECURE_DEFAULTS = [
  "change-me-in-production-portal-secret-32ch",
  "change-me-jwt-secret-32characters!!",
];

if (parsed.data.NODE_ENV === "production") {
  if (KNOWN_INSECURE_DEFAULTS.includes(parsed.data.PORTAL_JWT_SECRET)) {
    console.error("[FATAL] PORTAL_JWT_SECRET must be changed from the default value in production.");
    process.exit(1);
  }
  if (KNOWN_INSECURE_DEFAULTS.includes(parsed.data.JWT_SECRET)) {
    console.error("[FATAL] JWT_SECRET must be changed from the default value in production.");
    process.exit(1);
  }
  if (parsed.data.PAYROLL_BANK_KEY === "hrms-bank-key-dev") {
    console.error("[FATAL] PAYROLL_BANK_KEY must be set to a secure value in production.");
    process.exit(1);
  }
  if (parsed.data.INTERNAL_DEMO_BYPASS === "true") {
    console.error("[FATAL] INTERNAL_DEMO_BYPASS must not be 'true' in production.");
    process.exit(1);
  }
  if (parsed.data.PORTAL_DEMO_BYPASS === "true") {
    console.error("[FATAL] PORTAL_DEMO_BYPASS must not be 'true' in production.");
    process.exit(1);
  }
}

export const env = {
  ...parsed.data,
  // Convert string boolean env vars to actual booleans
  LEGACY_SYNC_ENABLED: parsed.data.LEGACY_SYNC_ENABLED === 'true',
  LEGACY_SYNC_PARALLEL_DOMAINS: parsed.data.LEGACY_SYNC_PARALLEL_DOMAINS !== 'false',
};
