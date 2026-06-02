import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import { format } from "date-fns";

export interface Asset {
  id: string;
  name: string;
  type: "laptop" | "monitor" | "phone" | "accessory";
  serialNumber: string;
  purchaseDate: string;
  cost: number;
  status: "available" | "assigned" | "maintenance" | "retired";
  notes?: string;
  assignedTo?: {
    name: string;
    avatar?: string;
  };
}

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const res = await hrmsApi.get<{ data: any[] }>("/api/assets-mgmt");
      return (res.data ?? []).map((a: any): Asset => ({
        id: a.id,
        name: a.asset_name,
        type: (a.asset_category ?? "accessory").toLowerCase() as Asset["type"],
        serialNumber: a.serial_number ?? "",
        purchaseDate: a.purchase_date
          ? format(new Date(a.purchase_date), "MMM d, yyyy")
          : "Unknown",
        cost: Number(a.purchase_cost ?? 0),
        status: a.status as Asset["status"],
        notes: a.notes ?? undefined,
        assignedTo: a.current_assignment
          ? { name: a.current_assignment.employee_name ?? String(a.current_assignment.employee_id) }
          : undefined,
      }));
    },
  });
}

export function useAssetStats() {
  return useQuery({
    queryKey: ["asset-stats"],
    queryFn: async () => {
      const res = await hrmsApi.get<{ data: any[] }>("/api/assets-mgmt");
      const all = res.data ?? [];
      return {
        total: all.length,
        available: all.filter((a: any) => a.status === "available").length,
        assigned: all.filter((a: any) => a.status === "assigned").length,
        maintenance: all.filter(
          (a: any) => a.status === "maintenance" || a.status === "repair"
        ).length,
        laptops: all.filter(
          (a: any) => (a.asset_category ?? "").toLowerCase() === "laptop"
        ).length,
        monitors: all.filter(
          (a: any) => (a.asset_category ?? "").toLowerCase() === "monitor"
        ).length,
        phones: all.filter(
          (a: any) => (a.asset_category ?? "").toLowerCase() === "phone"
        ).length,
      };
    },
  });
}

export interface CreateAssetData {
  name: string;
  category: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_cost?: number;
  vendor?: string;
  warranty_end_date?: string;
  notes?: string;
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAssetData) => {
      const prefix = data.category.substring(0, 3).toUpperCase();
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      const asset_code = `${prefix}-${randomNum}`;

      const res = await hrmsApi.post<{ data: any }>("/api/assets-mgmt", {
        asset_code,
        asset_name: data.name,
        asset_category: data.category,
        serial_number: data.serial_number,
        purchase_date: data.purchase_date,
        purchase_cost: data.purchase_cost,
        notes: data.notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export interface UpdateAssetData {
  id: string;
  name?: string;
  category?: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_cost?: number;
  vendor?: string;
  notes?: string;
  status?: "available" | "assigned" | "maintenance" | "retired";
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateAssetData) => {
      return hrmsApi.put<{ data: any }>(`/api/assets-mgmt/${id}`, {
        asset_name: data.name,
        status: data.status,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => hrmsApi.delete<{ data: any }>(`/api/assets-mgmt/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export interface AssignAssetData {
  assetId: string;
  employeeId: string;
  notes?: string;
}

export function useAssignAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assetId, employeeId, notes }: AssignAssetData) => {
      return hrmsApi.post(`/api/assets-mgmt/${assetId}/assign`, {
        employee_id: employeeId,
        notes: notes ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export function useReturnAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      return hrmsApi.post(`/api/assets-mgmt/${assetId}/return`, { condition: "good" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export interface AssetAssignment {
  id: string;
  assignedDate: string;
  returnedDate: string | null;
  notes: string | null;
  employee: {
    name: string;
    avatar?: string;
  };
}

export function useAssetHistory(assetId: string | null) {
  return useQuery({
    queryKey: ["asset-history", assetId],
    queryFn: async (): Promise<AssetAssignment[]> => {
      if (!assetId) return [];

      // TODO: dedicated GET /api/assets-mgmt/:id/history endpoint not yet implemented.
      // Returning empty array until the backend exposes assignment history.
      return [];
    },
    enabled: !!assetId,
  });
}
