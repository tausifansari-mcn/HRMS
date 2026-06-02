import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle2, Clock, Send } from "lucide-react";

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type WeekOffPreference = {
  id: string;
  employee_id: string;
  preferred_day: number;
  alternate_day: number | null;
  approved: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

export default function NativeWeekOffPreferences() {
  const qc = useQueryClient();
  const [preferredDay, setPreferredDay] = useState<number>(0);
  const [alternateDay, setAlternateDay] = useState<number | string>("");

  // Query my preference
  const { data: myPreference, refetch } = useQuery({
    queryKey: ["my-week-off-preference"],
    queryFn: async () => {
      try {
        const res = await hrmsApi.get<WeekOffPreference>("/api/roster-master/week-off-preferences/me");
        return res;
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
  });

  // Submit preference
  const submitPreference = useMutation({
    mutationFn: async (data: { preferred_day: number; alternate_day?: number }) => {
      return await hrmsApi.post("/api/roster-master/week-off-preferences", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-week-off-preference"] });
    },
  });

  const handleSubmit = () => {
    submitPreference.mutate({
      preferred_day: preferredDay,
      alternate_day: alternateDay !== "" ? Number(alternateDay) : undefined,
    });
  };

  const getDayName = (dayNum: number) => {
    return DAYS.find((d) => d.value === dayNum)?.label || `Day ${dayNum}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-green-600 to-teal-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-10 w-10" />
            <div>
              <h1 className="text-3xl font-black">Week-Off Preferences</h1>
              <p className="mt-1 text-sm opacity-90">
                Submit your preferred weekly off day for roster planning
              </p>
            </div>
          </div>
        </div>

        {/* Current Preference Status */}
        {myPreference && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Your Current Preference</CardTitle>
                  <CardDescription>
                    Submitted on {new Date(myPreference.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge variant={myPreference.approved ? "default" : "secondary"}>
                  {myPreference.approved ? (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Approved
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Pending Approval
                    </div>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-medium text-muted-foreground">Preferred Day</div>
                  <div className="mt-2 text-2xl font-bold">
                    {getDayName(myPreference.preferred_day)}
                  </div>
                </div>
                {myPreference.alternate_day !== null && (
                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-medium text-muted-foreground">Alternate Day</div>
                    <div className="mt-2 text-2xl font-bold">
                      {getDayName(myPreference.alternate_day)}
                    </div>
                  </div>
                )}
              </div>

              {myPreference.approved && myPreference.approved_at && (
                <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
                  ✓ Approved on {new Date(myPreference.approved_at).toLocaleDateString()}
                </div>
              )}

              {!myPreference.approved && (
                <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-700">
                  ⏳ Your preference is pending manager approval. You can update it before approval.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submit/Update Preference */}
        <Card>
          <CardHeader>
            <CardTitle>{myPreference ? "Update Preference" : "Submit Preference"}</CardTitle>
            <CardDescription>
              Choose your preferred weekly off day. Your manager will review and approve.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preferred Day */}
            <div>
              <Label>Preferred Week-Off Day *</Label>
              <Select
                value={preferredDay.toString()}
                onValueChange={(v) => setPreferredDay(Number(v))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-sm text-muted-foreground">
                This will be your regular weekly off day (subject to operational requirements)
              </p>
            </div>

            {/* Alternate Day */}
            <div>
              <Label>Alternate Week-Off Day (Optional)</Label>
              <Select value={alternateDay.toString()} onValueChange={setAlternateDay}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select alternate day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {DAYS.filter((d) => d.value !== preferredDay).map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-sm text-muted-foreground">
                If your preferred day is not available, this day can be considered
              </p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={submitPreference.isPending}
              className="w-full"
              size="lg"
            >
              <Send className="mr-2 h-5 w-5" />
              {submitPreference.isPending ? "Submitting..." : "Submit Preference"}
            </Button>

            {submitPreference.isSuccess && (
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
                ✓ Preference submitted successfully! Your manager will review it.
              </div>
            )}
            {submitPreference.isError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                Error: {(submitPreference.error as any)?.message || "Failed to submit preference"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Important Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="mt-0.5 text-blue-600">ℹ️</div>
              <div>
                Week-off preferences are subject to operational requirements and team capacity. Your
                manager will review and approve based on process needs.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="mt-0.5 text-blue-600">ℹ️</div>
              <div>
                You can update your preference at any time before approval. Once approved, changes
                require manager re-approval.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="mt-0.5 text-blue-600">ℹ️</div>
              <div>
                Approved preferences will be applied to future roster generation automatically.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
