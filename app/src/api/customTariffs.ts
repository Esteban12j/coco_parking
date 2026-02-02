import { invokeTauri } from "@/lib/tauriInvoke";
import type { CustomTariff } from "@/types/parking";

export function listCustomTariffs(search: string | null): Promise<CustomTariff[]> {
  return invokeTauri<CustomTariff[]>("custom_tariffs_list", { search });
}

export function createCustomTariff(args: {
  vehicleType: string;
  name?: string | null;
  plateOrRef?: string | null;
  description?: string | null;
  amount: number;
  rateUnit?: string | null;
  rateDurationHours?: number | null;
  rateDurationMinutes?: number | null;
}): Promise<CustomTariff> {
  return invokeTauri<CustomTariff>("custom_tariffs_create", args);
}

export function updateCustomTariff(args: {
  id: string;
  vehicleType?: string;
  name?: string | null;
  plateOrRef?: string | null;
  description?: string | null;
  amount?: number;
  rateUnit?: string | null;
  rateDurationHours?: number | null;
  rateDurationMinutes?: number | null;
}): Promise<CustomTariff> {
  return invokeTauri<CustomTariff>("custom_tariffs_update", args);
}

export function deleteCustomTariff(id: string): Promise<void> {
  return invokeTauri("custom_tariffs_delete", { id });
}
