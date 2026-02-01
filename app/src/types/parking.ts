export type VehicleType = 'car' | 'motorcycle' | 'truck' | 'bicycle';

export interface Vehicle {
  id: string;
  ticketCode: string;
  plate: string;
  vehicleType: VehicleType;
  observations?: string;
  entryTime: Date;
  exitTime?: Date;
  status: 'active' | 'completed';
  totalAmount?: number;
  debt?: number;
  specialRate?: number;
}

export interface ParkingSession {
  id: string;
  vehicle: Vehicle;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  amount?: number;
  paymentMethod?: 'cash' | 'card' | 'transfer';
  operatorId?: string;
}

export interface DailyMetrics {
  totalVehicles: number;
  activeVehicles: number;
  occupancyRate: number;
  totalRevenue: number;
  averageTicket: number;
  averageStayMinutes: number;
  turnoverRate: number;
}

/** Tesorería: una sola fuente, tabla transactions. */
export interface TreasuryData {
  expectedCash: number;
  actualCash: number;
  discrepancy: number;
  totalTransactions: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    transfer: number;
  };
}

/** Registro persistido de cierre de turno (resumen, arqueo opcional, diferencia). */
export interface ShiftClosure {
  id: string;
  closedAt: string;
  expectedTotal: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  arqueoCash: number | null;
  discrepancy: number;
  totalTransactions: number;
  notes: string | null;
}

export type UserRole = 'operator' | 'admin' | 'developer';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  roleId: string;
  roleName: string;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

/** Conflicto de placa: misma placa con más de un tipo de vehículo (datos incongruentes). */
export interface PlateConflict {
  plate: string;
  vehicles: Vehicle[];
}

/** Datos del registro que falló por conflicto de placa; para que el cliente elija eliminar el erróneo y reintentar. */
export interface PendingRegisterConflict {
  plate: string;
  vehicleType: VehicleType;
  observations?: string;
  ticketCode?: string;
}

export type ReportTypeKey =
  | 'transactions'
  | 'completed_vehicles'
  | 'shift_closures'
  | 'transactions_with_vehicle';

export interface ReportColumnDef {
  key: string;
  label: string;
}

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  paymentMethod?: string | null;
  vehicleType?: string | null;
}

export interface ReportData {
  columns: ReportColumnDef[];
  rows: Record<string, string | number | null>[];
}
