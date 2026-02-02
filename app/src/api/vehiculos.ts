import { invokeTauri } from "@/lib/tauriInvoke";
import type {
  VehicleType,
  DebtDetailByPlateResult,
  ListDebtorsResult,
} from "@/types/parking";

export interface VehicleBackend {
  id: string;
  ticketCode: string;
  plate: string;
  vehicleType: VehicleType;
  observations?: string | null;
  entryTime: string;
  exitTime?: string | null;
  status: "active" | "completed";
  totalAmount?: number | null;
  debt?: number | null;
  specialRate?: number | null;
}

export interface ListVehiclesResponse {
  items: VehicleBackend[];
  total: number;
}

export interface PlateConflictBackend {
  plate: string;
  vehicles: VehicleBackend[];
}

export function listVehicles(args: {
  limit: number;
  offset: number;
  status: "active" | "completed";
}): Promise<ListVehiclesResponse> {
  return invokeTauri<ListVehiclesResponse>("vehiculos_list_vehicles", args);
}

export function listVehiclesByDate(args: {
  date: string;
  limit: number;
  offset: number;
}): Promise<ListVehiclesResponse> {
  return invokeTauri<ListVehiclesResponse>("vehiculos_list_vehicles_by_date", args);
}

export function registerEntry(args: {
  plate: string;
  vehicleType: VehicleType;
  observations?: string | null;
  ticketCode?: string | null;
}): Promise<VehicleBackend> {
  return invokeTauri<VehicleBackend>("vehiculos_register_entry", args);
}

export function processExit(args: {
  ticketCode: string;
  partialPayment?: number | null;
  paymentMethod?: string | null;
  customParkingCost?: number | null;
}): Promise<VehicleBackend> {
  return invokeTauri<VehicleBackend>("vehiculos_process_exit", args);
}

export function getPlateDebt(plate: string): Promise<number> {
  return invokeTauri<number>("vehiculos_get_plate_debt", { plate });
}

export function findByTicket(ticketCode: string): Promise<VehicleBackend | null> {
  return invokeTauri<VehicleBackend | null>("vehiculos_find_by_ticket", {
    ticketCode,
  });
}

export function findByPlate(plate: string): Promise<VehicleBackend | null> {
  return invokeTauri<VehicleBackend | null>("vehiculos_find_by_plate", {
    plate,
  });
}

export function getVehiclesByPlate(plate: string): Promise<VehicleBackend[]> {
  return invokeTauri<VehicleBackend[]>("vehiculos_get_vehicles_by_plate", {
    plate,
  });
}

export function searchVehiclesByPlatePrefix(
  platePrefix: string
): Promise<VehicleBackend[]> {
  return invokeTauri<VehicleBackend[]>("vehiculos_search_vehicles_by_plate_prefix", {
    platePrefix,
  });
}

export function deleteVehicle(vehicleId: string): Promise<void> {
  return invokeTauri("vehiculos_delete_vehicle", { vehicleId });
}

export function resolvePlateConflict(
  plate: string,
  keepVehicleId: string
): Promise<void> {
  return invokeTauri("vehiculos_resolve_plate_conflict", { plate, keepVehicleId });
}

export function getPlateConflicts(): Promise<PlateConflictBackend[]> {
  return invokeTauri<PlateConflictBackend[]>("vehiculos_get_plate_conflicts");
}

export function getTotalDebt(): Promise<number> {
  return invokeTauri<number>("vehiculos_get_total_debt");
}

export function listDebtors(args: {
  limit: number;
  offset: number;
}): Promise<ListDebtorsResult> {
  return invokeTauri<ListDebtorsResult>("vehiculos_list_debtors", args);
}

export function getDebtDetailByPlate(
  plate: string
): Promise<DebtDetailByPlateResult> {
  return invokeTauri<DebtDetailByPlateResult>("vehiculos_get_debt_detail_by_plate", {
    plate,
  });
}
