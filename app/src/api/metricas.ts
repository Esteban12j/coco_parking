import { invokeTauri } from "@/lib/tauriInvoke";
import type { DailyMetrics, PeakHourSlot, HeatmapDayVehicleRow } from "@/types/parking";

export function getDailyMetrics(): Promise<DailyMetrics> {
  return invokeTauri<DailyMetrics>("metricas_get_daily");
}

export function getArrivalsByHour(args: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<PeakHourSlot[]> {
  return invokeTauri<PeakHourSlot[]>("metricas_get_arrivals_by_hour", args);
}

export function getOccupancyByHour(args: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<PeakHourSlot[]> {
  return invokeTauri<PeakHourSlot[]>("metricas_get_occupancy_by_hour", args);
}

export function getPeakHours(args: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<PeakHourSlot[]> {
  return invokeTauri<PeakHourSlot[]>("metricas_get_peak_hours", args);
}

export function getHeatmapDayVehicle(args: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<HeatmapDayVehicleRow[]> {
  return invokeTauri<HeatmapDayVehicleRow[]>("metricas_get_heatmap_day_vehicle", args);
}
