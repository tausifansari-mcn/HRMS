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
} from "./integration.validation.js";

export const integrationService = {
  async list(filters?: IntegrationListFilters): Promise<IntegrationConfig[]> {
    let sql = "SELECT * FROM integration_config";
    const params: unknown[] = [];

    if (filters?.activeStatus === "active") {
      sql += " WHERE active_status = 1";
    } else if (filters?.activeStatus === "inactive") {
      sql += " WHERE active_status = 0";
    }

    sql += " ORDER BY integration_name ASC";

    const [rows] = await db.execute<RowDataPacket[]>(sql, params);
    return rows as IntegrationConfig[];
  },

  async getByKey(integrationKey: string): Promise<IntegrationConfig> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_config WHERE integration_key = ? LIMIT 1",
      [integrationKey]
    );

    const record = (rows as IntegrationConfig[])[0];
    if (!record) throw new Error("Integration not found");
    return record;
  },

  async create(input: CreateIntegrationInput, _userId: string): Promise<IntegrationConfig> {
    const [existing] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM integration_config WHERE integration_key = ? LIMIT 1",
      [input.integrationKey]
    );

    if ((existing as RowDataPacket[]).length > 0) {
      throw new Error("Integration key already exists");
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
      ]
    );

    return this.getByKey(input.integrationKey);
  },

  async update(
    integrationKey: string,
    input: UpdateIntegrationInput,
    _userId: string
  ): Promise<IntegrationConfig> {
    await this.getByKey(integrationKey); // throws if not found

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (input.integrationName !== undefined) { setClauses.push("integration_name = ?"); params.push(input.integrationName); }
    if (input.integrationType !== undefined) { setClauses.push("integration_type = ?"); params.push(input.integrationType); }
    if (input.vendorName !== undefined)      { setClauses.push("vendor_name = ?");      params.push(input.vendorName ?? null); }
    if (input.baseUrl !== undefined)         { setClauses.push("base_url = ?");         params.push(input.baseUrl ?? null); }
    if (input.authType !== undefined)        { setClauses.push("auth_type = ?");        params.push(input.authType ?? null); }
    if (input.secretName !== undefined)      { setClauses.push("secret_name = ?");      params.push(input.secretName ?? null); }
    if (input.notes !== undefined)           { setClauses.push("notes = ?");            params.push(input.notes ?? null); }
    if (input.activeStatus !== undefined)    { setClauses.push("active_status = ?");    params.push(input.activeStatus ? 1 : 0); }
    if (input.configJson !== undefined)      { setClauses.push("config_json = ?");      params.push(input.configJson ? JSON.stringify(input.configJson) : null); }

    if (setClauses.length > 0) {
      params.push(integrationKey);
      await db.execute(
        `UPDATE integration_config SET ${setClauses.join(", ")} WHERE integration_key = ?`,
        params
      );
    }

    return this.getByKey(integrationKey);
  },

  async listRuns(filters: RunFilters): Promise<PaginatedResult<IntegrationConnectorRun>> {
    const { page, limit, integrationKey, status } = filters;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (integrationKey) { conditions.push("integration_key = ?"); params.push(integrationKey); }
    if (status)         { conditions.push("status = ?");          params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM integration_connector_run ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM integration_connector_run ${where}`,
      params
    );

    const total = (countRows as { total: number }[])[0]?.total ?? 0;

    return {
      data: rows as IntegrationConnectorRun[],
      total,
      page,
      limit,
    };
  },

  async createRun(
    integrationKey: string,
    triggeredBy: string,
    triggeredUser: string
  ): Promise<IntegrationConnectorRun> {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO integration_connector_run
         (id, integration_key, triggered_by, triggered_user, status)
       VALUES (?, ?, ?, ?, 'running')`,
      [id, integrationKey, triggeredBy, triggeredUser]
    );

    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_connector_run WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as IntegrationConnectorRun[])[0];
  },

  async listFieldMaps(integrationKey: string): Promise<IntegrationFieldMap[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_field_map WHERE integration_key = ? AND active_status = 1 ORDER BY source_field ASC",
      [integrationKey]
    );
    return rows as IntegrationFieldMap[];
  },

  async confirmFieldMap(input: ConfirmFieldMapInput, userId: string): Promise<IntegrationFieldMap> {
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
      ]
    );

    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_field_map WHERE integration_key = ? AND source_field = ? LIMIT 1",
      [input.integrationKey, input.sourceField]
    );
    return (rows as IntegrationFieldMap[])[0];
  },

  async listSuggestions(integrationKey: string): Promise<IntegrationFieldMapSuggestion[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM integration_field_map_suggestion WHERE integration_key = ? AND status = 'pending' ORDER BY source_field ASC",
      [integrationKey]
    );
    return rows as IntegrationFieldMapSuggestion[];
  },
};
