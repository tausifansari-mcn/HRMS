import type {
  CreateProcessInput,
  ProcessFilters,
  ProcessMaster,
  UpdateProcessInput
} from "./process.types.js";
import { getProcessRepository } from "./process.repository.js";

export const processService = {
  async list(filters: ProcessFilters): Promise<ProcessMaster[]> {
    const repository = getProcessRepository();
    return repository.list(filters);
  },

  async getById(id: string): Promise<ProcessMaster> {
    const repository = getProcessRepository();

    const process = await repository.getById(id);

    if (!process) {
      throw new Error("Process not found");
    }

    return process;
  },

  async create(
    input: CreateProcessInput,
    userId: string
  ): Promise<ProcessMaster> {
    const repository = getProcessRepository();

    const existing = await repository.list({
      search: input.processCode,
      activeStatus: "all"
    });

    const duplicate = existing.find(
      (item) =>
        item.process_code.toLowerCase() === input.processCode.toLowerCase()
    );

    if (duplicate) {
      throw new Error("Process code already exists");
    }

    return repository.create(input, userId);
  },

  async update(
    id: string,
    input: UpdateProcessInput,
    userId: string
  ): Promise<ProcessMaster> {
    const repository = getProcessRepository();

    const existing = await repository.getById(id);

    if (!existing) {
      throw new Error("Process not found");
    }

    return repository.update(id, input, userId);
  },

  async updateStatus(
    id: string,
    activeStatus: boolean,
    userId: string
  ): Promise<ProcessMaster> {
    const repository = getProcessRepository();

    const existing = await repository.getById(id);

    if (!existing) {
      throw new Error("Process not found");
    }

    return repository.updateStatus(id, activeStatus, userId);
  }
};
