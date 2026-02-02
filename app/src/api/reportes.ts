import { invokeTauri } from "@/lib/tauriInvoke";
import type {
  ReportColumnDef,
  ReportData,
  ReportFilters,
  ReportTypeKey,
} from "@/types/parking";

export function getColumnDefinitions(
  reportType: ReportTypeKey
): Promise<ReportColumnDef[]> {
  return invokeTauri<ReportColumnDef[]>("reportes_get_column_definitions", {
    reportType,
  });
}

export function fetchReport(args: {
  reportType: ReportTypeKey;
  filters: ReportFilters;
}): Promise<ReportData> {
  return invokeTauri<ReportData>("reportes_fetch", args);
}

export function writeCsv(args: {
  reportType: ReportTypeKey;
  filters: ReportFilters;
  path: string;
}): Promise<void> {
  return invokeTauri("reportes_write_csv", args);
}
