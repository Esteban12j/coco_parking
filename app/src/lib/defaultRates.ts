import type { VehicleType, TariffKind } from '@/types/parking';

export const DEFAULT_RATES: Record<VehicleType, number> = {
  car: 4000,
  motorcycle: 2500,
  truck: 5000,
  bicycle: 1000,
};

export const DEFAULT_ADDITIONAL_RATES: Record<VehicleType, number> = {
  car: 1000,
  motorcycle: 500,
  truck: 1500,
  bicycle: 500,
};

export interface DefaultTariffForCheckout {
  amount: number;
  rateDurationHours: number;
  rateDurationMinutes: number;
  additionalHourPrice?: number;
  additionalDurationHours?: number;
  additionalDurationMinutes?: number;
  tariffKind: TariffKind;
}

export function getDefaultRate(vehicleType: VehicleType): number {
  return DEFAULT_RATES[vehicleType];
}

export function getDefaultTariffForCheckout(vehicleType: VehicleType, tariffKind: TariffKind = 'regular'): DefaultTariffForCheckout {
  return {
    amount: DEFAULT_RATES[vehicleType],
    rateDurationHours: 1,
    rateDurationMinutes: 0,
    additionalHourPrice: DEFAULT_ADDITIONAL_RATES[vehicleType],
    tariffKind,
  };
}

export function calculateTwoTierCost(
  totalMinutes: number,
  basePrice: number,
  baseDurationHours: number,
  additionalHourPrice?: number,
  additionalPeriodHours?: number,
): { parkingCost: number; baseCost: number; additionalCost: number; additionalHours: number } {
  const hours = Math.max(totalMinutes / 60, 0);
  if (hours <= baseDurationHours) {
    return { parkingCost: basePrice, baseCost: basePrice, additionalCost: 0, additionalHours: 0 };
  }
  const overflowHours = hours - baseDurationHours;
  const periodH = (additionalPeriodHours ?? 1) > 0 ? additionalPeriodHours! : 1;
  const additionalBlocks = Math.ceil(overflowHours / periodH);
  const rate = additionalHourPrice ?? (basePrice / baseDurationHours);
  const additionalCost = additionalBlocks * rate;
  return {
    parkingCost: basePrice + additionalCost,
    baseCost: basePrice,
    additionalCost,
    additionalHours: additionalBlocks,
  };
}

export const OBSERVATION_PRESETS: Record<VehicleType, string[]> = {
  motorcycle: ['Casco', 'Dos cascos', 'Casco + capa', 'Casco + maleta', 'Llaves'],
  car: ['Llaves'],
  truck: ['Llaves'],
  bicycle: ['Llaves'],
};

export const FREQUENT_OBSERVATIONS = ['Casco', 'Dos cascos', 'Casco + capa', 'Casco + maleta', 'Llaves'];
