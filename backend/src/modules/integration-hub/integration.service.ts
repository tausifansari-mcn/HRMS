import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import type {
  IntegrationConfig,
  IntegrationConnectorRun,
  IntegrationFieldMap,
  IntegrationFieldMapSuggestion,
  IntegrationListFilters,
  PaginatedResult,
} from "./integration.types.js";
import type {
  ConfirmFieldMapInput,
  CreateIntegrationInput,
  RunFilters,
  UpdateIntegrationInput,
  UpsertScheduleInput,
} from "./integration.validation.js";
import type { IntegrationSchedule } from "./integration.types.js";

export const integrationService = {
  async list(filters?: IntegrationListFilters): Promise<IntegrationConfig[]> {
    let sql = `
      SELECT ic.*,
             (SELECT MAX(icr.started_at)
                FROM integration_connector_run icr
               WHERE icr.integration_key = ic.integration_key) AS last_run_at
        FROM integration_config ic`;
    const params: unknown[] = [];

    if (filters?.activeStatus === "active") {
      sql += " WHERE ic.active_status = 1";
    } else if (filters?.activeStatus === "inactive") {
      sql += " WHERE ic.active_status = 0";
    }

    sql += " ORDER BY ic.integration_name ASC";

    const [rows] = await db.execute<RowDataPacket[]>(sql, params);
    return rows as IntegrationConfig[];
  },

  async getByKey(integrationKey: string): Promise<IntegrationConfig> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT ic.*,
              (SELECT MAX(icr.started_at)
                 FROM integration_connector_run icr
                WHERE icr.integration_key = ic.integration_key) AS last_run_at
         FROM integration_config ic
        WHERE ic.integration_key = ?
        LIMIT 1`,
      [integrationKey],
    );

    const record = (rows as IntegrationConfig[])[0];
    if (!record) throw Object.assign(new Error("Integration not found"), { statusCode: 404 });
    return record;
  },

  async create(input: CreateIntegrationInput, _userId: string): Promise<IntegrationConfig> {
    const [existing] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM integration_config WHERE integration_key = ? LIMIT 1",
      [input.integrationKey],
    );

    if ((existing as RowDataPacket[]).length > 0) {
      throw Object.assign(new Error("Integration key already exists"), { statusCode: 409 });
    }

    const id = randomUUID();
    await db.execute(
      `INSERT INTO integration_config
         (id, integration_key, integration_name, integration_type,
          vendor_name, base_url, auth_type, secret_name, config_json, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.integrationKey,
        input.integrationName,
        input.integrationType,
        input.vendorName ?? null,
        input.baseUrl ?? null,
        input.authType ?? null,
        input.secretName ?? null,
        input.configJson ? JSON.stringify(input.configJson) : null,
        input.notes ?? null,
      ],
    );

    return this.getByKey(input.integrationKey);
  },

  async update(
    integrationKey: string,
    input: UpdateIntegrationInput,
    _userId: string,
  ): Promise<IntegrationConfig> {
    await this.getByKey(integrationKey);

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (input.integrationName !== undefined) { setClauses.push("integration_name = ?"); params.push(input.integrationName); }
    if (input.integrationType !== undefined) { setClauses.push("integration_type = ?"); params.push(input.integrationType); }
    if (input.vendorName !== undefined) { setClauses.push("vendor_name = ?"); params.push(input.vendorName ?? null); }
    if (input.baseUrl !== undefined) { setClauses.push("base_url = ?"); params.push(input.baseUrl ?? null); }
    if (input.authType !== undefined) { setClauses.push("auth_type = ?"); params.push(input.authType ?? null); }
    if (input.secretName !== undefined) { setClauses.push("secret_name = ?"); params.push(input.secretName ?? null); }
    if (input.notes !== undefined) { setClauses.push("notes = ?"); params.push(input.notes ?? null); }
    if (input.activeStatus !== undefined) { setClauses.push("active_status = ?"); params.push(input.activeStatus ? 1 : 0); }
    if (input.configJson !== undefined) { setClauses.push("config_json = ?"); params.push(input.configJson ? JSON.stringify(input.configJson) : null); }

    if (setClauses.length > 0) {
      setClauses.push("updated_at = NOW()");
      params.push(integrationKey);
      await db.execute(
        `UPDATE integration_config SET ${setClauses.join(", ")} WHERE integration_key = ?`,
        params,
      );
    }

    return this.getByKey(integrationKey);
  },

  async listRuns(filters: RunFilters): Promise<PaginatedResult<IntegrationConnectorRun>> {
    const { page, limit, integrationKey, status } = filters;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (integrationKey) { conditions.push("icr.integration_key = ?"); params.push(integrationKey); }
    if (status) { conditions.push("icr.status = ?"); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT icr.*, ic.integration_name, ic.integration_type
         FROM integration_connector_run icr
         LEFT JOIN integration_config ic ON ic.integration_key = icr.integration_key
         ${where}
        ORDER BY icr.started_at DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const [countRows] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
         FROM integration_connector_run icr
         ${where}`,
      params,
    );

    const total = Number((countRows as { total: number }[])[0]?.total ?? 0);
    return { data: rows as IntegrationConnectorRun[], total, page, limit };
  },

  async createRun(
    integrationKey: string,
    triggeredBy: string,
    triggeredUser: string,
  ): Promise<IntegrationConnectorRun> {
    const connector = await this.getByKey(integrationKey);
    if (!connector.active_status) {
      throw Object.assign(new Error("Integration is inactive"), { statusCode: 400 });
    }

    const id = randomUUID();
    await db.execute(
      `INSERT INTO integration_connector_run
         (id, integration_key, triggered_by, triggered_user, status)
       VALUES (?, ?, ?, ?, 'running')`,
      [id, integrationKey, triggeredBy, triggeredUser],
    );

    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_connector_run WHERE id = ? LIMIT 1",
      [id],
    );
    return (rows as IntegrationConnectorRun[])[0];
  },

  async listFieldMaps(integrationKey: string): Promise<IntegrationFieldMap[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_field_map WHERE integration_key = ? AND active_status = 1 ORDER BY source_field ASC",
      [integrationKey],
    );
    return rows as IntegrationFieldMap[];
  },

  async confirmFieldMap(input: ConfirmFieldMapInput, userId: string): Promise<IntegrationFieldMap> {
    await this.getByKey(input.integrationKey);
    await db.execute(
      `INSERT INTO integration_field_map
         (id, integration_key, source_field, target_table, target_column, transform, confirmed_by, confirmed_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         target_table = VALUES(target_table),
         target_column = VALUES(target_column),
         transform = VALUES(transform),
         confirmed_by = VALUES(confirmed_by),
         confirmed_at = NOW(),
         active_status = 1`,
      [
        input.integrationKey,
        input.sourceField,
        input.targetTable,
        input.targetColumn,
        input.transform ?? null,
        userId,
      ],
    );

    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_field_map WHERE integration_key = ? AND source_field = ? LIMIT 1",
      [input.integrationKey, input.sourceField],
    );
    return (rows as IntegrationFieldMap[])[0];
  },

  async confirmSuggestion(suggestionId: string, userId: string): Promise<IntegrationFieldMap> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT *
         FROM integration_field_map_suggestion
        WHERE id = ? AND status = 'pending'
        LIMIT 1`,
      [suggestionId],
    );
    const suggestion = rows[0] as IntegrationFieldMapSuggestion | undefined;

    if (!suggestion) throw Object.assign(new Error("Pending mapping suggestion not found"), { statusCode: 404 });
    if (!suggestion.suggested_table || !suggestion.suggested_column) {
      throw Object.assign(new Error("Suggestion does not contain a complete target mapping"), { statusCode: 400 });
    }

    const mapping = await this.confirmFieldMap({
      integrationKey: suggestion.integration_key,
      sourceField: suggestion.source_field,
      targetTable: suggestion.suggested_table,
      targetColumn: suggestion.suggested_column,
      transform: null,
    }, userId);

    await db.execute(
      "UPDATE integration_field_map_suggestion SET status = 'confirmed' WHERE id = ?",
      [suggestionId],
    );

    return mapping;
  },

  async listSuggestions(integrationKey: string): Promise<IntegrationFieldMapSuggestion[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_field_map_suggestion WHERE integration_key = ? AND status = 'pending' ORDER BY source_field ASC",
      [integrationKey],
    );
    return rows as IntegrationFieldMapSuggestion[];
  },

  async getSchedule(integrationKey: string): Promise<IntegrationSchedule> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_schedule WHERE integration_key = ? LIMIT 1",
      [integrationKey],
    );
    const record = (rows as IntegrationSchedule[])[0];

    if (record) return record;
    return {
      id: "",
      integration_key: integrationKey,
      cron_expression: "0 * * * *",
      enabled: 0,
      last_run_at: null,
      next_run_at: null,
    };
  },

  async upsertSchedule(integrationKey: string, input: UpsertScheduleInput): Promise<IntegrationSchedule> {
    await this.getByKey(integrationKey);
    await db.execute(
      `INSERT INTO integration_schedule (id, integration_key, cron_expression, enabled)
       VALUES (UUID(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cron_expression = VALUES(cron_expression),
         enabled = VALUES(enabled)`,
      [integrationKey, input.cronExpression, input.enabled !== undefined ? (input.enabled ? 1 : 0) : 0],
    );
    return this.getSchedule(integrationKey);
  },
};
