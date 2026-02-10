import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Car,
  TrendingUp,
  DollarSign,
  PieChart,
  RefreshCw,
  AlertCircle,
  LogIn,
  LogOut,
  BarChart3,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { useParkingStore } from "@/hooks/useParkingStore";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  getArrivalsByHour,
  getDailyMetrics,
  getOccupancyByHour,
  getPeakHours,
} from "@/api/metricas";
import type { PeakHourSlot } from "@/types/parking";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportsExport } from "./components/ReportsExport";
import { HeatmapDayVehicle } from "./components/HeatmapDayVehicle";

function HourSlotsCard({
  title,
  hint,
  noDataLabel,
  backendOnlyLabel,
  loadingLabel,
  icon,
  isTauri,
  isLoading,
  slots,
}: {
  title: string;
  hint: string;
  noDataLabel: string;
  backendOnlyLabel: string;
  loadingLabel: string;
  icon: React.ReactNode;
  isTauri: boolean;
  isLoading: boolean;
  slots: PeakHourSlot[];
}) {
  const maxCount = Math.max(1, ...slots.map((s) => s.count));
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-semibold mb-1 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">{hint}</p>
      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
        {!isTauri ? (
          <p className="text-sm text-muted-foreground">{backendOnlyLabel}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{noDataLabel}</p>
        ) : (
          slots.map((slot) => {
            const percentage = maxCount > 0 ? Math.round((slot.count / maxCount) * 100) : 0;
            return (
              <div key={slot.hourLabel} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{slot.hourLabel}</span>
                  <span className="font-medium">
                    {slot.count} {percentage > 0 && `(${percentage}%)`}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      percentage > 80 ? "bg-warning" : "bg-info"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { getLocalDateString } from "@/lib/dateTime";

export const MetricasPage = () => {
  const { t } = useTranslation();
  const { hasPermission } = useMyPermissions();
  const canExportReports = hasPermission("metricas:reports:export");
  const {
    metrics,
    isLoading,
    isMetricsError,
    metricsError,
    isTauri,
    invalidateParking,
  } = useParkingStore();

  const today = getLocalDateString();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const metricsForDateQuery = useQuery({
    queryKey: ["parking", "metrics", dateFrom],
    queryFn: () => getDailyMetrics({ date: dateFrom }),
    enabled: isTauri,
  });

  const metricsDisplay =
    isTauri && metricsForDateQuery.data != null ? metricsForDateQuery.data : metrics;

  const arrivalsQuery = useQuery({
    queryKey: ["parking", "arrivalsByHour", dateFrom, dateTo],
    queryFn: () => getArrivalsByHour({ dateFrom, dateTo }),
    enabled: isTauri,
  });

  const occupancyQuery = useQuery({
    queryKey: ["parking", "occupancyByHour", dateFrom, dateTo],
    queryFn: () => getOccupancyByHour({ dateFrom, dateTo }),
    enabled: isTauri,
  });

  const exitsQuery = useQuery({
    queryKey: ["parking", "exitsByHour", dateFrom, dateTo],
    queryFn: () => getPeakHours({ dateFrom, dateTo }),
    enabled: isTauri,
  });

  const arrivalsSlots: PeakHourSlot[] = arrivalsQuery.data ?? [];
  const occupancySlots: PeakHourSlot[] = occupancyQuery.data ?? [];
  const exitsSlots: PeakHourSlot[] = exitsQuery.data ?? [];

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title={t("metrics.title")}
        subtitle={t("metrics.subtitle")}
        extraNote={isTauri ? t("metrics.fromBackendNote") : undefined}
        actions={
          <>
            {isTauri && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm" htmlFor="metrics-date-from">
                    {t("metrics.heatmapDayVehicle.dateFrom")}
                  </Label>
                  <DatePickerField
                    id="metrics-date-from"
                    value={dateFrom}
                    onChange={setDateFrom}
                    placeholder={t("metrics.heatmapDayVehicle.dateFrom")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm" htmlFor="metrics-date-to">
                    {t("metrics.heatmapDayVehicle.dateTo")}
                  </Label>
                  <DatePickerField
                    id="metrics-date-to"
                    value={dateTo}
                    onChange={setDateTo}
                    placeholder={t("metrics.heatmapDayVehicle.dateTo")}
                  />
                </div>
              </>
            )}
            {isTauri && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => invalidateParking()}
                disabled={isLoading}
              >
                <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                <span className="ml-2">{t("common.refresh")}</span>
              </Button>
            )}
          </>
        }
      />

      {isLoading && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      )}
      {isMetricsError && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{metricsError != null ? String(metricsError) : t("common.error")}</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => invalidateParking()}
          >
            {t("common.refresh")}
          </Button>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            title={t("metrics.activeVehicles")}
            value={metrics.activeVehicles}
            subtitle={t("metrics.inParking")}
            icon={<Car className="h-5 w-5" />}
            variant="info"
          />
          <MetricCard
            title={t("metrics.revenueToday")}
            value={`$${metricsDisplay.totalRevenue.toFixed(0)}`}
            subtitle={`${metricsDisplay.totalVehicles} ${t("metrics.transactions")}`}
            icon={<DollarSign className="h-5 w-5" />}
            variant="success"
            trend={{ value: 12, isPositive: true }}
          />
          <MetricCard
            title={t("metrics.averageTicket")}
            value={`$${metricsDisplay.averageTicket.toFixed(0)}`}
            subtitle={`${Math.round(metricsDisplay.averageStayMinutes)} ${t("metrics.minAvg")}`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <HourSlotsCard
            title={t("metrics.arrivalsByHour")}
            hint={t("metrics.arrivalsByHourHint")}
            noDataLabel={t("metrics.arrivalsByHourNoData")}
            backendOnlyLabel={t("metrics.peakHoursFromBackend")}
            loadingLabel={t("common.loading")}
            icon={<LogIn className="h-5 w-5 text-muted-foreground" />}
            isTauri={isTauri}
            isLoading={arrivalsQuery.isLoading}
            slots={arrivalsSlots}
          />
          <HourSlotsCard
            title={t("metrics.occupancyByHour")}
            hint={t("metrics.occupancyByHourHint")}
            noDataLabel={t("metrics.occupancyByHourNoData")}
            backendOnlyLabel={t("metrics.peakHoursFromBackend")}
            loadingLabel={t("common.loading")}
            icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
            isTauri={isTauri}
            isLoading={occupancyQuery.isLoading}
            slots={occupancySlots}
          />
          <HourSlotsCard
            title={t("metrics.exitsByHour")}
            hint={t("metrics.exitsByHourHint")}
            noDataLabel={t("metrics.exitsByHourNoData")}
            backendOnlyLabel={t("metrics.peakHoursFromBackend")}
            loadingLabel={t("common.loading")}
            icon={<LogOut className="h-5 w-5 text-muted-foreground" />}
            isTauri={isTauri}
            isLoading={exitsQuery.isLoading}
            slots={exitsSlots}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-muted-foreground" />
              {t("metrics.revenueBreakdown")}
            </h3>
            <div className="space-y-4">
              {(metricsDisplay.revenueByVehicleType ?? []).map((row) => {
                const labelKey =
                  row.vehicleType === "car"
                    ? "metrics.cars"
                    : row.vehicleType === "motorcycle"
                      ? "metrics.motorcycles"
                      : row.vehicleType === "truck"
                        ? "metrics.trucks"
                        : "metrics.bicycles";
                const color =
                  row.vehicleType === "car"
                    ? "bg-info"
                    : row.vehicleType === "motorcycle"
                      ? "bg-success"
                      : row.vehicleType === "truck"
                        ? "bg-warning"
                        : "bg-muted-foreground";
                return (
                  <div
                    key={row.vehicleType}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={cn("w-3 h-3 rounded-full shrink-0", color)}
                    />
                    <span className="flex-1 text-sm">
                      {t(labelKey)}
                      <span className="text-muted-foreground font-normal ml-1">
                        ({row.count} {t("metrics.vehicles")})
                      </span>
                    </span>
                    <span className="font-medium">
                      ${row.revenue.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              {t("metrics.keyMetrics")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">{t("metrics.turnover")}</p>
                <p className="text-xl font-bold">
                  {metricsDisplay.turnoverRate.toFixed(1)}x
                </p>
                <p className="text-xs text-muted-foreground">{t("metrics.turnoverRate")}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">{t("metrics.avgTime")}</p>
                <p className="text-xl font-bold">
                  {Math.round(metricsDisplay.averageStayMinutes)}m
                </p>
                <p className="text-xs text-muted-foreground">{t("metrics.stay")}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">{t("metrics.transactionsLabel")}</p>
                <p className="text-xl font-bold">
                  {metricsDisplay.totalVehicles}
                </p>
                <p className="text-xs text-muted-foreground">{t("metrics.today")}</p>
              </div>
            </div>
          </div>
        </div>

        {canExportReports && (
          <div className="w-full">
            <ReportsExport />
          </div>
        )}

        {isTauri && (
          <div className="w-full">
            <HeatmapDayVehicle dateFrom={dateFrom} dateTo={dateTo} />
          </div>
        )}

      </div>
    </div>
  );
};
