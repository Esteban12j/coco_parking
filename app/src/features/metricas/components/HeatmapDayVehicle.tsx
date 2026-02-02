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
      <h3 className="font-semibold mb-1">{t("metrics.heatmapDayVehicle.title")}</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {t("metrics.heatmapDayVehicle.hint")}
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="space-y-2">
          <Label>{t("metrics.heatmapDayVehicle.dateFrom")}</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("metrics.heatmapDayVehicle.dateTo")}</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("metrics.heatmapDayVehicle.period")}</Label>
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
          <div className="overflow-x-auto">
            <div className="min-w-[400px] inline-block">
              <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${vehicleTypes.length}, minmax(2rem, 1fr))` }}>
                <div className="rounded bg-transparent p-1 text-xs font-medium text-muted-foreground" />
                {vehicleTypes.map((vt) => (
                  <div
                    key={vt}
                    className="rounded bg-muted/50 p-1 text-center text-xs font-medium"
                  >
                    {t(getVehicleTypeLabelKey(vt))}
                  </div>
                ))}
                {DAY_ORDER.map((dow) => (
                  <Fragment key={dow}>
                    <div className="rounded bg-muted/50 p-1 text-xs font-medium flex items-center">
                      {t(getDayLabelKey(dow))}
                    </div>
                    {vehicleTypes.map((vt) => {
                      const count = matrix.get(dow)?.get(vt) ?? 0;
                      return (
                        <Tooltip key={`${dow}-${vt}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "aspect-square rounded min-h-[2rem] flex items-center justify-center text-xs font-medium transition-colors",
                                intensityClass(count, maxCount),
                                count > 0 ? "text-primary-foreground" : "text-muted-foreground"
                              )}
                            >
                              {count > 0 ? count : ""}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
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
          </div>

          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-secondary" />
              {t("metrics.heatmapDayVehicle.legendLow")}
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-success/50" />
              {t("metrics.heatmapDayVehicle.legendLow")} / {t("metrics.heatmapDayVehicle.legendMedium")}
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-warning/70" />
              {t("metrics.heatmapDayVehicle.legendMedium")}
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-destructive/70" />
              {t("metrics.heatmapDayVehicle.legendHigh")}
            </span>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

