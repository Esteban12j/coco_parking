import type { VehicleType } from '@/types/parking';

export const DEFAULT_RATES: Record<VehicleType, number> = {
  car: 50,
  motorcycle: 30,
  truck: 80,
  bicycle: 15,
};

export interface DefaultTariffForCheckout {
  amount: number;
  rateDurationHours: number;
  rateDurationMinutes: number;
}

export function getDefaultRate(vehicleType: VehicleType): number {
  return DEFAULT_RATES[vehicleType];
}

export function getDefaultTariffForCheckout(vehicleType: VehicleType): DefaultTariffForCheckout {
  return {
    amount: DEFAULT_RATES[vehicleType],
    rateDurationHours: 1,
    rateDurationMinutes: 0,
  };
}
