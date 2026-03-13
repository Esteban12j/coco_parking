import { invokeTauri } from "@/lib/tauriInvoke";
import type { Contract, ContractPayment, TariffKind } from "@/types/parking";

export function listContracts(args: {
  status?: string | null;
  search?: string | null;
}): Promise<Contract[]> {
  return invokeTauri<Contract[]>("contracts_list", args);
}

export function createContract(args: {
  clientName: string;
  clientPhone?: string | null;
  plate: string;
  vehicleType: string;
  tariffKind?: TariffKind | null;
  monthlyAmount?: number | null;
  includedHoursPerDay?: number | null;
  dateFrom: string;
  notes?: string | null;
  extraChargePerInterval?: number | null;
  extraInterval?: number | null;
  billingPeriodDays?: number;
  endDate?: string | null;
}): Promise<Contract> {
  return invokeTauri<Contract>("contracts_create", { args });
}

export function updateContract(args: {
  id: string;
  clientName?: string | null;
  clientPhone?: string | null;
  monthlyAmount?: number | null;
  includedHoursPerDay?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  notes?: string | null;
  extraChargePerInterval?: number | null;
  extraInterval?: number | null;
  billingPeriodDays?: number;
  endDate?: string | null;
}): Promise<Contract> {
  return invokeTauri<Contract>("contracts_update", { args });
}

export function deleteContract(id: string): Promise<void> {
  return invokeTauri("contracts_delete", { id });
}

export function getContractByPlate(plate: string): Promise<Contract | null> {
  return invokeTauri<Contract | null>("contracts_get_by_plate", { plate });
}

export function suggestMonthlyAmount(args: {
  vehicleType: string;
  tariffKind?: TariffKind | null;
  days?: number | null;
}): Promise<number> {
  return invokeTauri<number>("contracts_suggest_monthly", args);
}

export function recordContractPayment(args: {
  contractId: string;
  method: string;
  amount?: number | null;
}): Promise<Contract> {
  return invokeTauri<Contract>("contracts_record_payment", { args });
}

export function listContractPayments(contractId: string): Promise<ContractPayment[]> {
  return invokeTauri<ContractPayment[]>("contracts_list_payments", { contractId });
}

export function getContractAnyByPlate(plate: string): Promise<import("@/types/parking").Contract | null> {
  return invokeTauri<import("@/types/parking").Contract | null>("contracts_get_any_by_plate", { plate });
}
