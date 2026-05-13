import { supabaseAdmin } from "../../db/supabaseAdmin.js";
import type {
  CreateProcessInput,
  ProcessFilters,
  ProcessMaster,
  ProcessRepository,
  UpdateProcessInput
} from "./process.types.js";

function mapCreateInput(input: CreateProcessInput, userId: string) {
  return {
    process_code: input.processCode.trim(),
    process_name: input.processName.trim(),
    department_id: input.departmentId || null,
    process_type: input.processType || null,
    branch_name: input.branchName || null,
    location_name: input.locationName || null,
    process_owner_employee_id: input.processOwnerEmployeeId || null,
    process_manager_employee_id: input.processManagerEmployeeId || null,
    description: input.description || null,
    created_by: userId,
    updated_by: userId,
    active_status: true,
    metadata: {}
  };
}

function mapUpdateInput(input: UpdateProcessInput, userId: string) {
  return {
    ...(input.processName !== undefined && {
      process_name: input.processName.trim()
    }),
    ...(input.departmentId !== undefined && {
      department_id: input.departmentId || null
    }),
    ...(input.processType !== undefined && {
      process_type: input.processType || null
    }),
    ...(input.branchName !== undefined && {
      branch_name: input.branchName || null
    }),
    ...(input.locationName !== undefined && {
      location_name: input.locationName || null
    }),
    ...(input.processOwnerEmployeeId !== undefined && {
      process_owner_employee_id: input.processOwnerEmployeeId || null
    }),
    ...(input.processManagerEmployeeId !== undefined && {
      process_manager_employee_id: input.processManagerEmployeeId || null
    }),
    ...(input.activeStatus !== undefined && {
      active_status: input.activeStatus
    }),
    ...(input.description !== undefined && {
      description: input.description || null
    }),
    updated_by: userId
  };
}

export const processRepositorySupabase: ProcessRepository = {
  async list(filters: ProcessFilters): Promise<ProcessMaster[]> {
    let query = supabaseAdmin
      .from("process_master")
      .select("*")
      .order("process_name", { ascending: true });

    if (filters.departmentId) {
      query = query.eq("department_id", filters.departmentId);
    }

    if (filters.activeStatus === "active") {
      query = query.eq("active_status", true);
    }

    if (filters.activeStatus === "inactive") {
      query = query.eq("active_status", false);
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      query = query.or(
        `process_code.ilike.%${search}%,process_name.ilike.%${search}%,process_type.ilike.%${search}%,branch_name.ilike.%${search}%,location_name.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as ProcessMaster[];
  },

  async getById(id: string): Promise<ProcessMaster | null> {
    const { data, error } = await supabaseAdmin
      .from("process_master")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data || null) as ProcessMaster | null;
  },

  async create(
    input: CreateProcessInput,
    userId: string
  ): Promise<ProcessMaster> {
    const payload = mapCreateInput(input, userId);

    const { data, error } = await supabaseAdmin
      .from("process_master")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as ProcessMaster;
  },

  async update(
    id: string,
    input: UpdateProcessInput,
    userId: string
  ): Promise<ProcessMaster> {
    const payload = mapUpdateInput(input, userId);

    const { data, error } = await supabaseAdmin
      .from("process_master")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as ProcessMaster;
  },

  async updateStatus(
    id: string,
    activeStatus: boolean,
    userId: string
  ): Promise<ProcessMaster> {
    const { data, error } = await supabaseAdmin
      .from("process_master")
      .update({
        active_status: activeStatus,
        updated_by: userId
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as ProcessMaster;
  }
};
