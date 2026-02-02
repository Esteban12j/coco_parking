import { useState, useCallback, useRef, useEffect } from "react";
import {
  getColumnDefinitions,
  fetchReport,
} from "@/api/reportes";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useTranslation } from "@/i18n";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
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
import { cn, generatePrefixedId } from "@/lib/utils";
import { useMyPermissions } from "@/hooks/useMyPermissions";

const REPORT_ID_LENGTH = 25;

function generateReportId(): string {
  return generatePrefixedId("HR", REPORT_ID_LENGTH);
}

const REPORT_TYPES: { value: ReportTypeKey; labelKey: string }[] = [
  { value: "transactions", labelKey: "metrics.reports.typeTransactions" },
  { value: "completed_vehicles", labelKey: "metrics.reports.typeCompletedVehicles" },
  { value: "shift_closures", labelKey: "metrics.reports.typeShiftClosures" },
  { value: "transactions_with_vehicle", labelKey: "metrics.reports.typeTransactionsWithVehicle" },
  { value: "debtors", labelKey: "metrics.reports.typeDebtors" },
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

export const ReportsExport = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { hasPermission } = useMyPermissions();
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
      const cols = await getColumnDefinitions(typeKey);
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
      const data = await fetchReport({
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

  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportCsv = useCallback(async () => {
    if (!isTauri || !reportData) return;
    if (reportType !== "debtors" && reportData.rows.length === 0) return;
    const filename = `${generateReportId()}.csv`;
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (path == null) return;
    setExportingCsv(true);
    try {
      const getColumnLabel = (key: string) => t(getColumnLabelKey(key));
      const csvContent = buildCsvFromReportData(reportData, getColumnLabel);
      const bytes = new TextEncoder().encode(csvContent);
      await writeFile(path, bytes);
      toast({
        title: t("metrics.reports.exportCsv"),
        description: t("metrics.reports.savedSuccess"),
      });
    } catch (e) {
      toast({
        title: t("common.error"),
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setExportingCsv(false);
    }
  }, [
    isTauri,
    reportData,
    reportType,
    dateFrom,
    dateTo,
    t,
    toast,
  ]);

  const handleExportPdf = useCallback(async () => {
    if (!isTauri || !reportData) return;
    if (reportType !== "debtors" && reportData.rows.length === 0) return;
    const filename = `${generateReportId()}.pdf`;
    let path: string | null = null;
    try {
      path = await save({
        defaultPath: filename,
      });
    } catch (dialogError) {
      toast({
        title: t("common.error"),
        description: String(dialogError),
        variant: "destructive",
      });
      return;
    }
    if (path == null) return;
    setExportingPdf(true);
    try {
      const headers = reportData.columns.map((c) => t(getColumnLabelKey(c.key)));
      const body = reportData.rows.map((row) =>
        reportData.columns.map((col) => {
          const v = row[col.key];
          return v === null || v === undefined ? "" : String(v);
        })
      );
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      autoTable(doc, {
        head: [headers],
        body,
        margin: { top: 10 },
      });
      const arrayBuffer = doc.output("arraybuffer");
      await writeFile(path, new Uint8Array(arrayBuffer));
      toast({
        title: t("metrics.reports.exportPdf"),
        description: t("metrics.reports.savedSuccess"),
      });
    } catch (e) {
      toast({
        title: t("common.error"),
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  }, [
    isTauri,
    reportData,
    reportType,
    dateFrom,
    dateTo,
    t,
    toast,
  ]);

  const toggleColumn = (key: string, checked: boolean) => {
    setSelectedColumnKeys((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  const reportTypesFiltered = hasPermission("caja:debtors:read")
    ? REPORT_TYPES
    : REPORT_TYPES.filter((r) => r.value !== "debtors");
  const showDateFilters = reportType !== "debtors";
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
                    {reportTypesFiltered.map(({ value, labelKey }) => (
                      <SelectItem key={value} value={value}>
                        {t(labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showDateFilters && (
                <>
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
                </>
              )}
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
                  <Button
                    variant="outline"
                    onClick={() => void handleExportCsv()}
                    disabled={exportingCsv || (reportType !== "debtors" && reportData.rows.length === 0)}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {exportingCsv ? t("common.loading") : t("metrics.reports.exportCsv")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleExportPdf()}
                    disabled={exportingPdf || (reportType !== "debtors" && reportData.rows.length === 0)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {exportingPdf ? t("common.loading") : t("metrics.reports.exportPdf")}
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
