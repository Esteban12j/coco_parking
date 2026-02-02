import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import { invokeTauri } from "@/lib/tauriInvoke";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HeatmapDayVehicleRow, DayPeriodFilter } from "@/types/parking";

const DAY_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0];

function getDayLabelKey(dow: number): string {
  const keys: Record<number, string> = {
    0: "metrics.heatmapDayVehicle.daySunday",
    1: "metrics.heatmapDayVehicle.dayMonday",
    2: "metrics.heatmapDayVehicle.dayTuesday",
    3: "metrics.heatmapDayVehicle.dayWednesday",
    4: "metrics.heatmapDayVehicle.dayThursday",
    5: "metrics.heatmapDayVehicle.dayFriday",
    6: "metrics.heatmapDayVehicle.daySaturday",
  };
  return keys[dow] ?? "";
}

function getVehicleTypeLabelKey(vt: string): string {
  const known: Record<string, string> = {
    car: "checkout.car",
    motorcycle: "checkout.motorcycle",
    truck: "checkout.truck",
    bicycle: "checkout.bicycle",
  };
  return known[vt] ?? vt;
}

function buildMatrix(
  rows: HeatmapDayVehicleRow[]
): Map<number, Map<string, number>> {
  const matrix = new Map<number, Map<string, number>>();
  for (const r of rows) {
    if (!matrix.has(r.dayOfWeek)) {
      matrix.set(r.dayOfWeek, new Map());
    }
    matrix.get(r.dayOfWeek)!.set(r.vehicleType, r.count);
  }
  return matrix;
}

function getVehicleTypes(rows: HeatmapDayVehicleRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(r.vehicleType);
  return Array.from(set).sort();
}

function getMaxCount(rows: HeatmapDayVehicleRow[]): number {
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.count), 1);
}

function intensityClass(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "bg-secondary";
  const pct = count / maxCount;
  if (pct >= 2 / 3) return "bg-destructive/70";
  if (pct >= 1 / 3) return "bg-warning/70";
  return "bg-success/50";
}

function intensityTextClass(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "text-muted-foreground";
  const pct = count / maxCount;
  if (pct >= 2 / 3) return "text-destructive-foreground";
  return "text-foreground";
}

function getTodayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const isTauriEnv = (): boolean =>
  typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;

export function HeatmapDayVehicle() {
  const { t } = useTranslation();
  const today = getTodayLocalDate();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [period, setPeriod] = useState<DayPeriodFilter>("");
  const isTauri = isTauriEnv();

  const query = useQuery({
    queryKey: ["parking", "heatmapDayVehicle", dateFrom, dateTo, period],
    queryFn: () =>
      invokeTauri<HeatmapDayVehicleRow[]>("metricas_get_heatmap_day_vehicle", {
        date_from: dateFrom,
        date_to: dateTo,
        period: period || null,
      }),
    enabled: isTauri && !!dateFrom && !!dateTo,
    retry: false,
  });

  const rows = query.data ?? [];
  const matrix = buildMatrix(rows);
  const vehicleTypes = getVehicleTypes(rows);
  const maxCount = getMaxCount(rows);

  if (!isTauri) return null;

  return (
    <div className="w-full rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-1">{t("metrics.heatmapDayVehicle.title")}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t("metrics.heatmapDayVehicle.hint")}
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="space-y-2">
          <Label className="text-sm">{t("metrics.heatmapDayVehicle.dateFrom")}</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">{t("metrics.heatmapDayVehicle.dateTo")}</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">{t("metrics.heatmapDayVehicle.period")}</Label>
          <Select
            value={period || "none"}
            onValueChange={(v) => setPeriod((v === "none" ? "" : v) as DayPeriodFilter)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t("metrics.heatmapDayVehicle.periodNoFilter")}
              </SelectItem>
              <SelectItem value="morning">
                {t("metrics.heatmapDayVehicle.periodMorning")}
              </SelectItem>
              <SelectItem value="midday">
                {t("metrics.heatmapDayVehicle.periodMidday")}
              </SelectItem>
              <SelectItem value="afternoon">
                {t("metrics.heatmapDayVehicle.periodAfternoon")}
              </SelectItem>
              <SelectItem value="night">
                {t("metrics.heatmapDayVehicle.periodNight")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {query.isLoading && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("common.loading")}
        </p>
      )}

      {query.isError && (
        <p className="text-sm text-destructive py-8 text-center">
          {query.error instanceof Error ? query.error.message : String(query.error)}
        </p>
      )}

      {!query.isLoading && !query.isError && rows.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("metrics.heatmapDayVehicle.noData")}
        </p>
      )}

      {!query.isLoading && rows.length > 0 && (
        <TooltipProvider delayDuration={200}>
          <div className="flex items-start gap-4">
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh] w-full min-w-0 flex-1">
              <div
                className="grid gap-px w-full h-full min-h-[140px]"
                style={{
                  gridTemplateColumns: `auto repeat(${DAY_ORDER.length}, minmax(14px, 1fr))`,
                  gridTemplateRows: `auto repeat(${vehicleTypes.length}, minmax(14px, 1fr))`,
                  height: "clamp(140px, 45vh, 20vh)",
                  width: "100%",
                }}
              >
                <div className="rounded bg-transparent p-0.5 text-xs font-medium text-muted-foreground min-w-[3rem]" />
                {DAY_ORDER.map((dow) => (
                  <div
                    key={dow}
                    className="rounded bg-muted/50 p-0.5 text-center text-xs font-medium min-w-[14px]"
                  >
                    {t(getDayLabelKey(dow))}
                  </div>
                ))}
                {vehicleTypes.map((vt) => (
                  <Fragment key={vt}>
                    <div className="rounded bg-muted/50 p-0.5 text-xs font-medium flex items-center min-w-[3rem] min-h-[14px]">
                      {t(getVehicleTypeLabelKey(vt))}
                    </div>
                    {DAY_ORDER.map((dow) => {
                      const count = matrix.get(dow)?.get(vt) ?? 0;
                      return (
                        <Tooltip key={`${dow}-${vt}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "w-full h-full min-w-[14px] min-h-[14px] rounded-sm transition-colors cursor-default flex items-center justify-center text-[10px] font-medium leading-none",
                                intensityClass(count, maxCount),
                                intensityTextClass(count, maxCount)
                              )}
                            >
                              {count > 0 ? count : ""}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-sm">
                            <p>{t(getDayLabelKey(dow))} · {t(getVehicleTypeLabelKey(vt))}</p>
                            <p className="font-semibold">{count} {t("metrics.transactionsLabel").toLowerCase()}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 shrink-0 py-1 text-sm text-muted-foreground border-l border-border pl-4">
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-sm bg-secondary shrink-0" />
                {t("metrics.heatmapDayVehicle.legendLow")}
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-sm bg-warning/70 shrink-0" />
                {t("metrics.heatmapDayVehicle.legendMedium")}
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-sm bg-destructive/70 shrink-0" />
                {t("metrics.heatmapDayVehicle.legendHigh")}
              </span>
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

