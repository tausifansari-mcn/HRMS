import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import { toast } from "sonner";

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  verified: boolean;
  uploaded_at: string;
}

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const res = await hrmsApi.get<{ data: EmployeeDocument[] }>(`/api/employee-docs/${employeeId}`);
      return res.data ?? [];
    },
    enabled: !!employeeId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      file,
      documentType,
    }: {
      employeeId: string;
      file: File;
      documentType: string;
    }) => {
      // Phase 1: binary still goes to Supabase Storage; metadata persisted to MySQL
      const { supabase: sb } = await import("@/integrations/supabase/client");
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `${employeeId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await (sb as any).storage
        .from("employee-documents")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const publicUrl = (sb as any).storage
        .from("employee-documents")
        .getPublicUrl(fileName).data.publicUrl;

      const res = await hrmsApi.post<{ data: EmployeeDocument }>(`/api/employee-docs/${employeeId}`, {
        document_type: documentType,
        document_name: file.name,
        file_url: publicUrl,
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", variables.employeeId] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to upload document: " + error.message);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      fileUrl,
      employeeId,
    }: {
      documentId: string;
      fileUrl: string;
      employeeId: string;
    }) => {
      await hrmsApi.delete(`/api/employee-docs/${employeeId}/${documentId}`);
      // Phase 1: also clean up Supabase Storage binary if it is a Supabase URL
      if (fileUrl && fileUrl.includes("supabase")) {
        try {
          const { supabase: sb } = await import("@/integrations/supabase/client");
          const path = fileUrl.split("/employee-documents/")[1];
          if (path) await (sb as any).storage.from("employee-documents").remove([path]);
        } catch {
          // non-fatal — metadata is deleted, storage cleanup best-effort
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", variables.employeeId] });
      toast.success("Document deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete document: " + error.message);
    },
  });
}
