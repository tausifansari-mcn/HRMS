import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the service
vi.mock("../src/db/mysql", () => ({
  db: {
    execute: vi.fn(),
    executeRun: vi.fn(),
    end: vi.fn(),
  },
}));

import { db } from "../src/db/mysql";
import { PerformanceFeedbackService } from "../src/modules/performance-feedback/performance-feedback.service";

const mockDb = db as unknown as {
  execute: ReturnType<typeof vi.fn>;
  executeRun: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

describe("PerformanceFeedbackService - Cycle Management", () => {
  let service: PerformanceFeedbackService;

  beforeEach(() => {
    service = new PerformanceFeedbackService();
    vi.clearAllMocks();
  });

  describe("createCycle", () => {
    it("should create a feedback cycle successfully", async () => {
      const cycleData = {
        cycle_name: "Q2 2026 Test Cycle",
        period: "2026-Q2",
        start_date: "2026-04-01",
        end_date: "2026-06-30",
        deadline: "2026-07-07",
      };

      const mockInsertResult = { insertId: "cycle-123" };
      const mockCycle = {
        cycle_id: "cycle-123",
        cycle_name: "Q2 2026 Test Cycle",
        period: "2026-Q2",
        start_date: "2026-04-01",
        end_date: "2026-06-30",
        deadline: "2026-07-07",
        status: "draft",
        feedback_type: "360",
        appraisal_cycle_id: null,
        created_by: "user-1",
        created_at: "2026-05-31T00:00:00Z",
        updated_at: "2026-05-31T00:00:00Z",
      };

      mockDb.execute
        .mockResolvedValueOnce([mockInsertResult, []]) // INSERT
        .mockResolvedValueOnce([[mockCycle], []]); // SELECT

      const result = await service.createCycle(cycleData, "user-1");

      expect(result).toBeDefined();
      expect(result.cycle_id).toBe("cycle-123");
      expect(result.cycle_name).toBe("Q2 2026 Test Cycle");
      expect(result.status).toBe("draft");
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });

    it("should create cycle with optional appraisal_cycle_id", async () => {
      const cycleData = {
        cycle_name: "Q3 2026 Test Cycle",
        period: "2026-Q3",
        start_date: "2026-07-01",
        end_date: "2026-09-30",
        deadline: "2026-10-07",
        appraisal_cycle_id: "appr-123",
      };

      const mockInsertResult = { insertId: "cycle-456" };
      const mockCycle = {
        cycle_id: "cycle-456",
        cycle_name: "Q3 2026 Test Cycle",
        period: "2026-Q3",
        start_date: "2026-07-01",
        end_date: "2026-09-30",
        deadline: "2026-10-07",
        status: "draft",
        feedback_type: "360",
        appraisal_cycle_id: "appr-123",
        created_by: "user-1",
        created_at: "2026-05-31T00:00:00Z",
        updated_at: "2026-05-31T00:00:00Z",
      };

      mockDb.execute
        .mockResolvedValueOnce([mockInsertResult, []])
        .mockResolvedValueOnce([[mockCycle], []]);

      const result = await service.createCycle(cycleData, "user-1");

      expect(result.cycle_id).toBe("cycle-456");
      expect(result.appraisal_cycle_id).toBe("appr-123");
    });
  });

  describe("getCycles", () => {
    it("should get all cycles without filters", async () => {
      const mockCycles = [
        {
          cycle_id: "cycle-1",
          cycle_name: "Q1 2026",
          period: "2026-Q1",
          status: "active",
        },
        {
          cycle_id: "cycle-2",
          cycle_name: "Q2 2026",
          period: "2026-Q2",
          status: "draft",
        },
      ];

      mockDb.execute.mockResolvedValueOnce([mockCycles, []]);

      const cycles = await service.getCycles({});

      expect(Array.isArray(cycles)).toBe(true);
      expect(cycles.length).toBe(2);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM performance_feedback_cycle"),
        []
      );
    });

    it("should filter cycles by status", async () => {
      const mockCycles = [
        {
          cycle_id: "cycle-1",
          cycle_name: "Q1 2026",
          status: "draft",
        },
      ];

      mockDb.execute.mockResolvedValueOnce([mockCycles, []]);

      const cycles = await service.getCycles({ status: "draft" });

      expect(Array.isArray(cycles)).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("AND status = ?"),
        ["draft"]
      );
    });

    it("should filter cycles by period", async () => {
      const mockCycles = [
        {
          cycle_id: "cycle-4",
          cycle_name: "Q4 2026",
          period: "2026-Q4",
        },
      ];

      mockDb.execute.mockResolvedValueOnce([mockCycles, []]);

      const cycles = await service.getCycles({ period: "2026-Q4" });

      expect(Array.isArray(cycles)).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("AND period LIKE ?"),
        ["%2026-Q4%"]
      );
    });
  });

  describe("getCycleById", () => {
    it("should get cycle by ID", async () => {
      const mockCycle = {
        cycle_id: "cycle-123",
        cycle_name: "Test Cycle",
        status: "active",
      };

      mockDb.execute.mockResolvedValueOnce([[mockCycle], []]);

      const cycle = await service.getCycleById("cycle-123");

      expect(cycle).toBeDefined();
      expect(cycle?.cycle_id).toBe("cycle-123");
      expect(mockDb.execute).toHaveBeenCalledWith(
        "SELECT * FROM performance_feedback_cycle WHERE cycle_id = ?",
        ["cycle-123"]
      );
    });

    it("should return null for non-existent cycle", async () => {
      mockDb.execute.mockResolvedValueOnce([[], []]);

      const cycle = await service.getCycleById("non-existent");

      expect(cycle).toBeNull();
    });
  });

  describe("updateCycle", () => {
    it("should update cycle name", async () => {
      mockDb.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      await service.updateCycle("cycle-123", {
        cycle_name: "Updated Cycle Name",
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        "UPDATE performance_feedback_cycle SET cycle_name = ? WHERE cycle_id = ?",
        ["Updated Cycle Name", "cycle-123"]
      );
    });

    it("should update multiple fields", async () => {
      mockDb.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      await service.updateCycle("cycle-123", {
        start_date: "2027-04-15",
        end_date: "2027-07-15",
        deadline: "2027-07-22",
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        "UPDATE performance_feedback_cycle SET start_date = ?, end_date = ?, deadline = ? WHERE cycle_id = ?",
        ["2027-04-15", "2027-07-15", "2027-07-22", "cycle-123"]
      );
    });

    it("should do nothing when no fields provided", async () => {
      await service.updateCycle("cycle-123", {});

      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe("closeCycle", () => {
    it("should close cycle (set status to closed)", async () => {
      mockDb.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      await service.closeCycle("cycle-123");

      expect(mockDb.execute).toHaveBeenCalledWith(
        "UPDATE performance_feedback_cycle SET status = 'closed' WHERE cycle_id = ?",
        ["cycle-123"]
      );
    });
  });
});
