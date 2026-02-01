import type { VehicleType } from '@/types/parking';

export const DEFAULT_RATES: Record<VehicleType, number> = {
  car: 50,
  motorcycle: 30,
  truck: 80,
  bicycle: 15,
};

export function getDefaultRate(vehicleType: VehicleType): number {
  return DEFAULT_RATES[vehicleType];
}
