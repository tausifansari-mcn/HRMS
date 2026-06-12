import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { hrmsApi } from '@/lib/hrmsApi';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { BarChart3, ChevronDown, ChevronRight, Download, Play, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportMeta {
  id: string;
  report_code: string;
  report_name: string;
  report_category: string;
  query_key: string;
  admin_only: number;
  active_status: number;
}

interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  count: number;
}

// ── CSV export helper ─────────────────────────────────────────────────────────

function downloadCsv(columns: string[], rows: Record<string, unknown>[], filename: string) {
  const header = columns.join(',');
  const body = rows
    .map((r) => columns.map((c) => JSON.stringify(r[c] ?? '')).join(','))
    .join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Category badge colours ─────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  branch:     'bg-blue-100 text-blue-700',
  user:       'bg-purple-100 text-purple-700',
  process:    'bg-orange-100 text-orange-700',
  employee:   'bg-green-100 text-green-700',
  payroll:    'bg-yellow-100 text-yellow-700',
  attendance: 'bg-pink-100 text-pink-700',
  kpi:        'bg-red-100 text-red-700',
  custom:     'bg-slate-100 text-slate-700',
};

function CategoryBadge({ cat }: { cat: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize', CATEGORY_COLOR[cat] ?? 'bg-slate-100 text-slate-700')}>
      {cat}
    </span>
  );
}

// ── Collapsible category section ──────────────────────────────────────────────

function CategorySection({
  category,
  reports,
  selected,
  onSelect,
}: {
  category: string;
  reports: ReportMeta[];
  selected: ReportMeta | null;
  onSelect: (r: ReportMeta) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <CategoryBadge cat={category} />
          <span className="text-xs text-slate-400">({reports.length})</span>
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && (
        <div className="pb-1">
          {reports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r)}
              className={cn(
                'w-full px-4 py-2 text-left text-sm transition-colors',
                selected?.id === r.id
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              {r.report_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NativeMasterReports() {
  const { toast } = useToast();

  const [selected, setSelected] = useState<ReportMeta | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({
    branch: '',
    ccCode: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });
  const [result, setResult] = useState<ReportResult | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['report-master-list'],
    queryFn: () => hrmsApi.get<{ data: ReportMeta[] }>('/api/reports'),
    staleTime: 5 * 60_000,
  });

  const { data: branchData } = useQuery({
    queryKey: ['branches-for-filter'],
    queryFn: () => hrmsApi.get<{ data: { id: string; branch_name: string }[] }>('/api/org/branches'),
    staleTime: 5 * 60_000,
  });

  const reports = reportsData?.data ?? [];
  const branches = branchData?.data ?? [];

  // ── Group by category ─────────────────────────────────────────────────────────

  const grouped = reports.reduce<Record<string, ReportMeta[]>>((acc, r) => {
    acc[r.report_category] = acc[r.report_category] ?? [];
    acc[r.report_category].push(r);
    return acc;
  }, {});

  // ── Run report mutation ──────────────────────────────────────────────────────

  const runMut = useMutation({
    mutationFn: () =>
      hrmsApi.post<{ data: ReportResult }>(`/api/reports/${selected!.report_code}/run`, {
        filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v.trim() !== '')),
      }),
    onSuccess: (res) => {
      setResult(res.data);
      toast({ title: `${selected!.report_name} loaded`, description: `${res.data.count} rows` });
    },
    onError: (err: Error) => {
      toast({ title: 'Report failed', description: err.message, variant: 'destructive' });
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Master Reports</h1>
            <p className="text-sm text-slate-500">Built-in reports across branches, users, processes and employees</p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          {/* ── Left panel ─────────────────────────────────────────────────── */}
          <Card className="w-64 shrink-0 sticky top-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reportsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              )}
              {Object.entries(grouped).map(([cat, reps]) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  reports={reps}
                  selected={selected}
                  onSelect={(r) => { setSelected(r); setResult(null); }}
                />
              ))}
              {!reportsLoading && reports.length === 0 && (
                <p className="px-4 py-6 text-xs text-slate-400">No reports found. Run migration 049.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Main panel ─────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">
            {!selected && (
              <Card>
                <CardContent className="py-16 text-center">
                  <BarChart3 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Select a report from the left panel to begin</p>
                </CardContent>
              </Card>
            )}

            {selected && (
              <>
                {/* Report title + filters */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-base">{selected.report_name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <CategoryBadge cat={selected.report_category} />
                          <span className="text-xs text-slate-400 font-mono">{selected.report_code}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => runMut.mutate()}
                          disabled={runMut.isPending}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          {runMut.isPending
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
                            : <><Play className="h-4 w-4 mr-2" />Run Report</>
                          }
                        </Button>
                        {result && result.rows.length > 0 && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              downloadCsv(
                                result.columns,
                                result.rows as Record<string, unknown>[],
                                `${selected.report_code}_${new Date().toISOString().slice(0, 10)}.csv`
                              )
                            }
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Branch</Label>
                        <Select
                          value={filters.branch || '__all__'}
                          onValueChange={(v) => setFilters(f => ({ ...f, branch: v === '__all__' ? '' : v }))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="All branches" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All branches</SelectItem>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CC Code</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="e.g. MCN-BLR"
                          value={filters.ccCode}
                          onChange={(e) => setFilters(f => ({ ...f, ccCode: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select
                          value={filters.status || '__all__'}
                          onValueChange={(v) => setFilters(f => ({ ...f, status: v === '__all__' ? '' : v }))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All statuses</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="resigned">Resigned</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Date From</Label>
                        <Input
                          type="date"
                          className="h-8 text-sm"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Results table */}
                {result && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-slate-600">Results</CardTitle>
                        <Badge variant="secondary">{result.count} rows</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {result.rows.length === 0 ? (
                        <p className="px-6 py-8 text-center text-sm text-slate-400">No data returned for the selected filters.</p>
                      ) : (
                        <div className="overflow-auto max-h-[60vh]">
                          <Table className="smarthr-table">
                            <TableHeader>
                              <TableRow>
                                {result.columns.map((col) => (
                                  <TableHead key={col} className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                                    {col.replace(/_/g, ' ')}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.rows.map((row, ri) => (
                                <TableRow key={ri} className="hover:bg-gray-50 transition-colors">
                                  {result.columns.map((col) => {
                                    const val = (row as Record<string, unknown>)[col];
                                    const display = val === null || val === undefined ? '—' : String(val);
                                    return (
                                      <TableCell key={col} className="text-sm whitespace-nowrap max-w-xs truncate">
                                        {display}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
