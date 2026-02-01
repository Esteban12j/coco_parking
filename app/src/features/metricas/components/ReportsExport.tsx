import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FileDown, FileText, ChevronDown, ChevronRight } from "lucide-react";
import type {
  ReportTypeKey,
  ReportColumnDef,
  ReportData,
  ReportFilters,
} from "@/types/parking";
import { cn } from "@/lib/utils";

const REPORT_TYPES: { value: ReportTypeKey; labelKey: string }[] = [
  { value: "transactions", labelKey: "metrics.reports.typeTransactions" },
  { value: "completed_vehicles", labelKey: "metrics.reports.typeCompletedVehicles" },
  { value: "shift_closures", labelKey: "metrics.reports.typeShiftClosures" },
  { value: "transactions_with_vehicle", labelKey: "metrics.reports.typeTransactionsWithVehicle" },
];

function formatDateLocal(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildCsvFromReportData(
  data: ReportData,
  getColumnLabel: (key: string) => string
): string {
  const header = data.columns.map((c) => getColumnLabel(c.key)).join(",");
  const escape = (v: string | number | null): string => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = data.rows.map((row) =>
    data.columns.map((col) => escape(row[col.key] ?? null)).join(",")
  );
  return [header, ...lines].join("\n");
}

function getColumnLabelKey(key: string): string {
  return `metrics.reports.column.${key}`;
}

function triggerDownloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const ReportsExport = () => {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState<ReportTypeKey>("transactions");
  const today = formatDateLocal(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [columnDefs, setColumnDefs] = useState<ReportColumnDef[]>([]);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const isTauri = typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;

  const fetchColumnDefs = useCallback(async (typeKey: ReportTypeKey) => {
    if (!isTauri) return;
    try {
      const cols = await invoke<ReportColumnDef[]>("reportes_get_column_definitions", {
        reportType: typeKey,
      });
      setColumnDefs(cols ?? []);
      setSelectedColumnKeys((cols ?? []).map((c) => c.key));
    } catch {
      setColumnDefs([]);
      setSelectedColumnKeys([]);
    }
  }, [isTauri]);

  useEffect(() => {
    if (isTauri && open) {
      fetchColumnDefs(reportType);
    }
  }, [isTauri, open, reportType, fetchColumnDefs]);

  const handlePreview = useCallback(async () => {
    if (!isTauri) return;
    setError(null);
    setLoading(true);
    try {
      const data = await invoke<ReportData>("reportes_fetch", {
        reportType,
        filters: {
          dateFrom: dateFrom,
          dateTo: dateTo,
          paymentMethod: paymentMethod ?? null,
          vehicleType: vehicleType ?? null,
        },
        selectedColumns: selectedColumnKeys.length > 0 ? selectedColumnKeys : null,
      });
      setReportData(data ?? { columns: [], rows: [] });
    } catch (e) {
      setError(String(e));
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [isTauri, reportType, dateFrom, dateTo, paymentMethod, vehicleType, selectedColumnKeys]);

  const handleExportCsv = useCallback(() => {
    if (!reportData || reportData.rows.length === 0) return;
    const csv = buildCsvFromReportData(reportData, (key) => t(getColumnLabelKey(key)));
    const filename = `report-${reportType}-${dateFrom}-${dateTo}.csv`;
    triggerDownloadCsv(csv, filename);
  }, [reportData, reportType, dateFrom, dateTo, t]);

  const handleExportPdf = useCallback(() => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Report</title>
      <style>table{border-collapse:collapse;width:100%;}th,td{border:1px solid #333;padding:6px;text-align:left;}th{background:#eee;}</style>
      </head><body>${printContent}</body></html>
    `);
    win.document.close();
    win.print();
    win.close();
  }, []);

  const toggleColumn = (key: string, checked: boolean) => {
    setSelectedColumnKeys((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  const showPaymentFilter =
    reportType === "transactions" || reportType === "transactions_with_vehicle";
  const showVehicleFilter =
    reportType === "completed_vehicles" || reportType === "transactions_with_vehicle";

  if (!isTauri) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-border bg-card p-6">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left font-semibold"
          >
            {open ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <FileDown className="h-5 w-5 text-muted-foreground" />
            {t("metrics.reports.title")}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>{t("metrics.reports.reportType")}</Label>
                <Select
                  value={reportType}
                  onValueChange={(v) => setReportType(v as ReportTypeKey)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(({ value, labelKey }) => (
                      <SelectItem key={value} value={value}>
                        {t(labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("metrics.reports.dateFrom")}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("metrics.reports.dateTo")}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              {showPaymentFilter && (
                <div className="space-y-2">
                  <Label>{t("metrics.reports.paymentMethod")}</Label>
                  <Select
                    value={paymentMethod ?? "all"}
                    onValueChange={(v) => setPaymentMethod(v === "all" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("metrics.reports.all")}</SelectItem>
                      <SelectItem value="cash">{t("till.cash")}</SelectItem>
                      <SelectItem value="card">{t("till.card")}</SelectItem>
                      <SelectItem value="transfer">{t("till.transfer")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {showVehicleFilter && (
                <div className="space-y-2">
                  <Label>{t("metrics.reports.vehicleType")}</Label>
                  <Select
                    value={vehicleType ?? "all"}
                    onValueChange={(v) => setVehicleType(v === "all" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("metrics.reports.all")}</SelectItem>
                      <SelectItem value="car">{t("checkout.car")}</SelectItem>
                      <SelectItem value="motorcycle">{t("checkout.motorcycle")}</SelectItem>
                      <SelectItem value="truck">{t("checkout.truck")}</SelectItem>
                      <SelectItem value="bicycle">{t("checkout.bicycle")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("metrics.reports.columns")}</Label>
              <div className="flex flex-wrap gap-4">
                {columnDefs.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedColumnKeys.includes(col.key)}
                      onCheckedChange={(checked) =>
                        toggleColumn(col.key, !!checked)
                      }
                    />
                    {t(getColumnLabelKey(col.key))}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handlePreview} disabled={loading || selectedColumnKeys.length === 0}>
                {loading ? t("common.loading") : t("metrics.reports.preview")}
              </Button>
              {reportData && (
                <>
                  <Button variant="outline" onClick={handleExportCsv}>
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("metrics.reports.exportCsv")}
                  </Button>
                  <Button variant="outline" onClick={handleExportPdf}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t("metrics.reports.exportPdf")}
                  </Button>
                </>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {reportData && (
              <div className="space-y-2">
                <Label>{t("metrics.reports.preview")}</Label>
                <ScrollArea className="w-full rounded-md border">
                  <div ref={printRef} className="min-w-[600px]">
                    {reportData.rows.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">
                        {t("metrics.reports.noData")}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {reportData.columns.map((col) => (
                              <TableHead key={col.key}>
                                {t(getColumnLabelKey(col.key))}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.rows.map((row, idx) => (
                            <TableRow key={idx}>
                              {reportData.columns.map((col) => (
                                <TableCell key={col.key}>
                                  {row[col.key] ?? ""}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
