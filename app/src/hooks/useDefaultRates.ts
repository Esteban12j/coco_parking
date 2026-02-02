import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeTauri } from "@/lib/tauriInvoke";
import {
  getDefaultTariffForCheckout,
  type DefaultTariffForCheckout as DefaultTariff,
} from "@/lib/defaultRates";
import type { VehicleType } from "@/types/parking";
import type { CustomTariff } from "@/types/parking";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const VEHICLE_TYPES: VehicleType[] = ["car", "motorcycle", "truck", "bicycle"];

function tariffsToDefaultTariffs(tariffs: CustomTariff[]): Record<VehicleType, DefaultTariff> {
  const base: Record<VehicleType, DefaultTariff> = {
    car: getDefaultTariffForCheckout("car"),
    motorcycle: getDefaultTariffForCheckout("motorcycle"),
    truck: getDefaultTariffForCheckout("truck"),
    bicycle: getDefaultTariffForCheckout("bicycle"),
  };
  const defaults = tariffs.filter(
    (t) => !t.plateOrRef || t.plateOrRef.trim() === ""
  );
  for (const t of defaults) {
    if (VEHICLE_TYPES.includes(t.vehicleType as VehicleType)) {
      const h = t.rateDurationHours ?? 1;
      const m = t.rateDurationMinutes ?? 0;
      base[t.vehicleType as VehicleType] = {
        amount: t.amount,
        rateDurationHours: h > 0 || m > 0 ? h : 1,
        rateDurationMinutes: h > 0 || m > 0 ? m : 0,
      };
    }
  }
  return base;
}

export function useDefaultRates(): {
  rates: Record<VehicleType, number>;
  defaultTariffs: Record<VehicleType, DefaultTariff>;
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

  const defaultTariffs: Record<VehicleType, DefaultTariff> =
    tauri && query.data
      ? tariffsToDefaultTariffs(query.data as CustomTariff[])
      : VEHICLE_TYPES.reduce(
          (acc, type) => {
            acc[type] = getDefaultTariffForCheckout(type);
            return acc;
          },
          {} as Record<VehicleType, DefaultTariff>
        );

  const rates: Record<VehicleType, number> = VEHICLE_TYPES.reduce(
    (acc, type) => {
      acc[type] = defaultTariffs[type].amount;
      return acc;
    },
    {} as Record<VehicleType, number>
  );

  return {
    rates,
    defaultTariffs,
    isLoading: tauri ? query.isLoading : false,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["custom_tariffs"] }),
  };
}
