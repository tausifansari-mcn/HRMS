import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Copy, CheckCircle2, Lock, ShieldAlert } from "lucide-react";

interface AdminPasswordResetDialogProps {
  employee: {
    id: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    employeeCode?: string;
    employee_code?: string;
    designation?: string | null;
    user_id?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminPasswordResetDialog({
  employee,
  open,
  onOpenChange,
}: AdminPasswordResetDialogProps) {
  const queryClient = useQueryClient();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await hrmsApi.post<{
        success: boolean;
        temporaryPassword: string;
        message: string;
        error?: string;
      }>("/api/auth/admin-reset-password", {
        employeeId: employee!.id,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to reset password");
      }

      return res;
    },
    onSuccess: (data) => {
      setTempPassword(data.temporaryPassword);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Password reset successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reset password");
    },
  });

  const handleReset = () => {
    resetMutation.mutate();
  };

  const handleCopyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setTempPassword(null);
    setCopied(false);
    onOpenChange(false);
  };

  if (!employee) return null;

  const employeeName = employee.name
    ?? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
    ?? "Employee";
  const employeeCode = employee.employeeCode ?? employee.employee_code ?? "—";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Lock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Admin password reset for employee
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee Info */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Name</span>
                <span className="text-sm font-semibold">{employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Employee Code</span>
                <span className="text-sm font-mono">{employeeCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-muted-foreground">Email</span>
                <span className="text-sm">{employee.email}</span>
              </div>
              {employee.designation && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Position</span>
                  <span className="text-sm">{employee.designation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Security Warning */}
          {!tempPassword && (
            <Alert className="border-amber-200 bg-amber-50">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">Security Notice</AlertTitle>
              <AlertDescription className="text-amber-800 text-sm">
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>A temporary password will be generated</li>
                  <li>Employee will be forced to change password on next login</li>
                  <li>Notification email will be sent to employee</li>
                  <li>This action will be logged in audit trail</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Temporary Password Display */}
          {tempPassword && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900">Password Reset Successful</AlertTitle>
              <AlertDescription className="space-y-3">
                <div className="mt-3 rounded-lg border border-green-300 bg-white p-4">
                  <p className="text-xs font-semibold text-green-700 mb-2">TEMPORARY PASSWORD</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-lg font-mono font-bold text-slate-900">
                      {tempPassword}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyPassword}
                      className="flex-shrink-0"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-green-800">
                  ✅ Email sent to <strong>{employee.email}</strong>
                </p>
                <p className="text-xs text-green-700">
                  Employee must change this password on next login.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {resetMutation.isError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                {resetMutation.error?.message || "You don't have permission to reset this employee's password."}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {!tempPassword ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={resetMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {resetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
