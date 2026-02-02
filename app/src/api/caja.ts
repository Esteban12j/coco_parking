import { invokeTauri } from "@/lib/tauriInvoke";
import type { TreasuryData, ShiftClosure } from "@/types/parking";

export function getTreasury(date: string): Promise<TreasuryData> {
  return invokeTauri<TreasuryData>("caja_get_treasury", { date });
}

export function listShiftClosures(args: { limit: number }): Promise<ShiftClosure[]> {
  return invokeTauri<ShiftClosure[]>("caja_list_shift_closures", args);
}

export function closeShift(args: {
  arqueoCash?: number;
  notes?: string;
}): Promise<ShiftClosure> {
  return invokeTauri<ShiftClosure>("caja_close_shift", args);
}
