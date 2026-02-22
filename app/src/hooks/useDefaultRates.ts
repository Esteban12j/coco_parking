import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCustomTariffs } from "@/api/customTariffs";
import {
  getDefaultTariffForCheckout,
  type DefaultTariffForCheckout as DefaultTariff,
} from "@/lib/defaultRates";
import type { VehicleType, TariffKind } from "@/types/parking";
import type { CustomTariff } from "@/types/parking";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const VEHICLE_TYPES: VehicleType[] = ["car", "motorcycle", "truck", "bicycle"];

type TariffKey = `${VehicleType}_${TariffKind}`;

function makeTariffKey(vehicleType: VehicleType, tariffKind: TariffKind): TariffKey {
  return `${vehicleType}_${tariffKind}` as TariffKey;
}

function tariffsToDefaultTariffs(tariffs: CustomTariff[]): Record<VehicleType, DefaultTariff> {
  const base: Record<VehicleType, DefaultTariff> = {
    car: getDefaultTariffForCheckout("car"),
    motorcycle: getDefaultTariffForCheckout("motorcycle"),
    truck: getDefaultTariffForCheckout("truck"),
    bicycle: getDefaultTariffForCheckout("bicycle"),
  };
  const defaults = tariffs.filter(
    (t) => (!t.plateOrRef || t.plateOrRef.trim() === "") && (t.tariffKind === "regular" || !t.tariffKind)
  );
  for (const t of defaults) {
    if (VEHICLE_TYPES.includes(t.vehicleType as VehicleType)) {
      const h = t.rateDurationHours ?? 1;
      const m = t.rateDurationMinutes ?? 0;
      const addH = t.additionalDurationHours ?? 1;
      const addM = t.additionalDurationMinutes ?? 0;
      base[t.vehicleType as VehicleType] = {
        amount: t.amount,
        rateDurationHours: h > 0 || m > 0 ? h : 1,
        rateDurationMinutes: h > 0 || m > 0 ? m : 0,
        additionalHourPrice: t.additionalHourPrice ?? undefined,
        additionalDurationHours: addH > 0 || addM > 0 ? addH : 1,
        additionalDurationMinutes: addH > 0 || addM > 0 ? addM : 0,
        tariffKind: "regular",
      };
    }
  }
  return base;
}

function tariffsToAllKinds(tariffs: CustomTariff[]): Map<TariffKey, DefaultTariff> {
  const map = new Map<TariffKey, DefaultTariff>();
  const defaults = tariffs.filter((t) => !t.plateOrRef || t.plateOrRef.trim() === "");
  for (const t of defaults) {
    const vt = t.vehicleType as VehicleType;
    const kind = (t.tariffKind || "regular") as TariffKind;
    if (!VEHICLE_TYPES.includes(vt)) continue;
    const h = t.rateDurationHours ?? 1;
    const m = t.rateDurationMinutes ?? 0;
    const addH = t.additionalDurationHours ?? 1;
    const addM = t.additionalDurationMinutes ?? 0;
    map.set(makeTariffKey(vt, kind), {
      amount: t.amount,
      rateDurationHours: h > 0 || m > 0 ? h : 1,
      rateDurationMinutes: h > 0 || m > 0 ? m : 0,
      additionalHourPrice: t.additionalHourPrice ?? undefined,
      additionalDurationHours: addH > 0 || addM > 0 ? addH : 1,
      additionalDurationMinutes: addH > 0 || addM > 0 ? addM : 0,
      tariffKind: kind,
    });
  }
  return map;
}

export function useDefaultRates(): {
  rates: Record<VehicleType, number>;
  defaultTariffs: Record<VehicleType, DefaultTariff>;
  allTariffs: CustomTariff[];
  getTariffForKind: (vehicleType: VehicleType, tariffKind: TariffKind) => DefaultTariff;
  isLoading: boolean;
  refetch: () => void;
} {
  const queryClient = useQueryClient();
  const tauri = isTauri();

  const query = useQuery({
    queryKey: ["custom_tariffs"],
    queryFn: () => listCustomTariffs(null),
    enabled: tauri,
  });

  const allTariffs: CustomTariff[] = (tauri && query.data ? query.data : []) as CustomTariff[];

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

  const allKindsMap = tauri && query.data ? tariffsToAllKinds(query.data as CustomTariff[]) : new Map<TariffKey, DefaultTariff>();

  const getTariffForKind = (vehicleType: VehicleType, tariffKind: TariffKind): DefaultTariff => {
    const key = makeTariffKey(vehicleType, tariffKind);
    const found = allKindsMap.get(key);
    if (found) return found;
    if (tariffKind === "regular") return defaultTariffs[vehicleType];
    return getDefaultTariffForCheckout(vehicleType, tariffKind);
  };

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
    allTariffs,
    getTariffForKind,
    isLoading: tauri ? query.isLoading : false,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["custom_tariffs"] }),
  };
}
