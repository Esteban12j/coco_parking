import type { Contract } from "@/types/parking";

export interface ContractSession {
  entryTime: Date;
  exitTime: Date;
}

export function isContractInArrears(contract: Contract, today: Date): boolean {
  if (contract.status === "cancelled") return false;
  if (contract.status === "arrears") return true;
  return new Date(contract.dateTo + "T00:00:00") < today;
}

export function calculateContractExtraCharge(
  session: ContractSession,
  contract: Contract,
  initialExtraCharge: number,
  extraCharge: number,
  extraIntervalMinutes: number,
): number {
  const usedMinutes =
    (session.exitTime.getTime() - session.entryTime.getTime()) / 60000;
  const includedMinutes = contract.includedHoursPerDay * 60;

  if (usedMinutes <= includedMinutes + 1) return 0;
  if (extraIntervalMinutes <= 0) return initialExtraCharge;

  const extraMinutes = usedMinutes - includedMinutes;
  return initialExtraCharge + Math.ceil(extraMinutes / extraIntervalMinutes) * extraCharge;
}

export function calculateExtraChargeFromContract(
  session: ContractSession,
  contract: Contract,
): number {
  const first = contract.extraChargeFirst ?? 0;
  const repeat = contract.extraChargeRepeat ?? 0;
  const interval = contract.extraInterval ?? 0;

  if (interval <= 0) return 0;

  return calculateContractExtraCharge(session, contract, first, repeat, interval);
}

export function getContractStatus(contract: Contract, today: Date): string {
  if (contract.status === "cancelled") return "Cancelado";
  if (isContractInArrears(contract, today)) return "En mora";
  return "Activo";
}
