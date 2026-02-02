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
import { Input } from "@/components/ui/input";
import { invokeTauri } from "@/lib/tauriInvoke";
import type { PeakHourSlot } from "@/types/parking";
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

function getTodayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

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

  const today = getTodayLocalDate();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const arrivalsQuery = useQuery({
    queryKey: ["parking", "arrivalsByHour", dateFrom, dateTo],
    queryFn: () =>
      invokeTauri<PeakHourSlot[]>("metricas_get_arrivals_by_hour", {
        dateFrom,
        dateTo,
      }),
    enabled: isTauri,
  });

  const occupancyQuery = useQuery({
    queryKey: ["parking", "occupancyByHour", dateFrom, dateTo],
    queryFn: () =>
      invokeTauri<PeakHourSlot[]>("metricas_get_occupancy_by_hour", {
        dateFrom,
        dateTo,
      }),
    enabled: isTauri,
  });

  const exitsQuery = useQuery({
    queryKey: ["parking", "exitsByHour", dateFrom, dateTo],
    queryFn: () =>
      invokeTauri<PeakHourSlot[]>("metricas_get_peak_hours", {
        dateFrom,
        dateTo,
      }),
    enabled: isTauri,
  });

  const arrivalsSlots: PeakHourSlot[] = arrivalsQuery.data ?? [];
  const occupancySlots: PeakHourSlot[] = occupancyQuery.data ?? [];
  const exitsSlots: PeakHourSlot[] = exitsQuery.data ?? [];

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("metrics.title")}</h1>
          <p className="text-muted-foreground">{t("metrics.subtitle")}</p>
          {isTauri && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("metrics.fromBackendNote")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {isTauri && (
            <>
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
        </div>
      </div>

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title={t("metrics.activeVehicles")}
            value={metrics.activeVehicles}
            subtitle={t("metrics.ofSpaces")}
            icon={<Car className="h-5 w-5" />}
            variant="info"
          />
          <MetricCard
            title={t("metrics.occupancy")}
            value={`${metrics.occupancyRate.toFixed(0)}%`}
            icon={<PieChart className="h-5 w-5" />}
            variant={metrics.occupancyRate > 80 ? "warning" : "default"}
          />
          <MetricCard
            title={t("metrics.revenueToday")}
            value={`$${metrics.totalRevenue.toFixed(0)}`}
            subtitle={`${metrics.totalVehicles} ${t("metrics.transactions")}`}
            icon={<DollarSign className="h-5 w-5" />}
            variant="success"
            trend={{ value: 12, isPositive: true }}
          />
          <MetricCard
            title={t("metrics.averageTicket")}
            value={`$${metrics.averageTicket.toFixed(0)}`}
            subtitle={`${Math.round(metrics.averageStayMinutes)} ${t("metrics.minAvg")}`}
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
              {[
                {
                  label: t("metrics.cars"),
                  amount: metrics.totalRevenue * 0.65,
                  color: "bg-info",
                },
                {
                  label: t("metrics.motorcycles"),
                  amount: metrics.totalRevenue * 0.2,
                  color: "bg-success",
                },
                {
                  label: t("metrics.trucks"),
                  amount: metrics.totalRevenue * 0.1,
                  color: "bg-warning",
                },
                {
                  label: t("metrics.bicycles"),
                  amount: metrics.totalRevenue * 0.05,
                  color: "bg-muted-foreground",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3"
                >
                  <div
                    className={cn("w-3 h-3 rounded-full", item.color)}
                  />
                  <span className="flex-1 text-sm">{item.label}</span>
                  <span className="font-medium">
                    ${item.amount.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              {t("metrics.keyMetrics")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">RevPAS</p>
                <p className="text-xl font-bold">
                  ${(metrics.totalRevenue / 50).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{t("metrics.perSpace")}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">{t("metrics.turnover")}</p>
                <p className="text-xl font-bold">
                  {metrics.turnoverRate.toFixed(1)}x
                </p>
                <p className="text-xs text-muted-foreground">{t("metrics.turnoverRate")}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">{t("metrics.avgTime")}</p>
                <p className="text-xl font-bold">
                  {Math.round(metrics.averageStayMinutes)}m
                </p>
                <p className="text-xs text-muted-foreground">{t("metrics.stay")}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">{t("metrics.transactionsLabel")}</p>
                <p className="text-xl font-bold">
                  {metrics.totalVehicles}
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
