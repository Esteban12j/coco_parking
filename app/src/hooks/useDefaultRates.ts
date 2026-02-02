import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeTauri } from "@/lib/tauriInvoke";
import { DEFAULT_RATES } from "@/lib/defaultRates";
import type { VehicleType } from "@/types/parking";
import type { CustomTariff } from "@/types/parking";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const VEHICLE_TYPES: VehicleType[] = ["car", "motorcycle", "truck", "bicycle"];

function tariffsToDefaultRates(tariffs: CustomTariff[]): Record<VehicleType, number> {
  const base = { ...DEFAULT_RATES };
  const defaults = tariffs.filter(
    (t) => !t.plateOrRef || t.plateOrRef.trim() === ""
  );
  for (const t of defaults) {
    if (VEHICLE_TYPES.includes(t.vehicleType as VehicleType)) {
      base[t.vehicleType as VehicleType] = t.amount;
    }
  }
  return base;
}

export function useDefaultRates(): {
  rates: Record<VehicleType, number>;
  isLoading: boolean;
  refetch: () => void;
} {
  const queryClient = useQueryClient();
  const tauri = isTauri();

  const query = useQuery({
    queryKey: ["custom_tariffs"],
    queryFn: () =>
      invokeTauri<CustomTariff[]>("custom_tariffs_list", { search: null }),
    enabled: tauri,
  });

  const rates: Record<VehicleType, number> =
    tauri && query.data
      ? tariffsToDefaultRates(query.data as CustomTariff[])
      : DEFAULT_RATES;

  return {
    rates,
    isLoading: tauri ? query.isLoading : false,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["custom_tariffs"] }),
  };
}
