import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { Vehicle, VehicleType, DailyMetrics, TreasuryData, PlateConflict, PendingRegisterConflict } from '@/types/parking';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from '@/i18n';

/** En Tauri la fuente de verdad es el backend (SQLite). En modo web sin backend: solo estado en memoria, sin persistencia. */
const RATES: Record<VehicleType, number> = {
  car: 50,
  motorcycle: 30,
  truck: 80,
  bicycle: 15,
};

// Backend returns ISO strings; frontend expects Date
type VehicleFromBackend = Omit<Vehicle, 'entryTime' | 'exitTime'> & {
  entryTime: string;
  exitTime?: string | null;
};

function vehicleFromBackend(v: VehicleFromBackend): Vehicle {
  return {
    ...v,
    entryTime: new Date(v.entryTime),
    exitTime: v.exitTime ? new Date(v.exitTime) : undefined,
  };
}

const generateTicketCode = () => {
  return `TK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
};

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

/** Maps backend error message to i18n key for register/entry errors. */
function getRegisterErrorKey(msg: string): string | null {
  if (msg.includes('ya está en uso') || msg.includes('already in use')) return 'vehicles.errors.ticketAlreadyInUse';
  if (msg.includes('Esa placa ya tiene') || msg.includes('plate already')) return 'vehicles.errors.plateAlreadyActive';
  if (msg.includes('Placa requerida') || msg.includes('Plate required')) return 'vehicles.errors.plateRequired';
  if (msg.includes('Código de ticket vacío') || msg.includes('Ticket code is empty')) return 'vehicles.errors.ticketEmpty';
  if (msg.includes('ya fue registrada como') || msg.includes('already registered as')) return 'vehicles.errors.plateDifferentType';
  return null;
}

type RegisterArgs = {
  plate: string;
  vehicleType: VehicleType;
  observations?: string;
  ticketCode?: string;
};

export const useParkingStore = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const tauri = isTauri();
  const lastRegisterArgsRef = useRef<RegisterArgs | null>(null);
  const [pendingRegisterConflict, setPendingRegisterConflict] = useState<PendingRegisterConflict | null>(null);
  const [plateConflicts, setPlateConflicts] = useState<PlateConflict[]>([]);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [localVehicles, setLocalVehicles] = useState<Vehicle[]>(() => []);
  const [scanResult, setScanResult] = useState<{ type: 'entry' | 'exit'; vehicle?: Vehicle } | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ['parking', 'vehicles'],
    queryFn: async (): Promise<Vehicle[]> => {
      const list = await invoke<VehicleFromBackend[]>('vehiculos_list_vehicles');
      return (list ?? []).map(vehicleFromBackend);
    },
    enabled: tauri,
  });

  const metricsQuery = useQuery({
    queryKey: ['parking', 'metrics'],
    queryFn: () => invoke<DailyMetrics>('metricas_get_daily'),
    enabled: tauri,
  });

  const treasuryQuery = useQuery({
    queryKey: ['parking', 'treasury'],
    queryFn: () => invoke<TreasuryData>('caja_get_treasury'),
    enabled: tauri,
  });

  const vehicles = tauri ? (vehiclesQuery.data ?? []) : localVehicles; // Tauri: backend (SQLite); web: solo memoria, sin persistencia
  const metricsData = tauri ? metricsQuery.data : null;
  const treasuryData = tauri ? treasuryQuery.data : null;

  // Historia 1.3: en Tauri no hay cálculo duplicado; métricas y tesorería solo desde backend (mismo almacén que vehículos).
  const ZERO_METRICS: DailyMetrics = {
    totalVehicles: 0,
    activeVehicles: 0,
    occupancyRate: 0,
    totalRevenue: 0,
    averageTicket: 0,
    averageStayMinutes: 0,
    turnoverRate: 0,
  };
  const ZERO_TREASURY: TreasuryData = {
    expectedCash: 0,
    actualCash: 0,
    discrepancy: 0,
    totalTransactions: 0,
    paymentBreakdown: { cash: 0, card: 0, transfer: 0 },
  };

  const invalidateParking = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['parking'] });
    queryClient.refetchQueries({ queryKey: ['parking'] });
  }, [queryClient]);

  const registerMutation = useMutation({
    mutationFn: async (args: RegisterArgs) => {
      lastRegisterArgsRef.current = args;
      const v = await invoke<VehicleFromBackend>('vehiculos_register_entry', {
        plate: args.plate,
        vehicleType: args.vehicleType,
        observations: args.observations ?? null,
        ticketCode: args.ticketCode ?? null,
      });
      lastRegisterArgsRef.current = null;
      return vehicleFromBackend(v);
    },
    onSuccess: (vehicle) => {
      setPendingRegisterConflict(null);
      setRegisterError(null);
      invalidateParking();
      setScanResult({ type: 'entry', vehicle });
    },
    onError: (err) => {
      const msg = String(err);
      const key = getRegisterErrorKey(msg);
      const description = key ? t(key) : msg;
      setRegisterError(description);
      if (key === 'vehicles.errors.plateDifferentType' && lastRegisterArgsRef.current) {
        const args = lastRegisterArgsRef.current;
        setPendingRegisterConflict({
          plate: args.plate,
          vehicleType: args.vehicleType,
          observations: args.observations,
          ticketCode: args.ticketCode,
        });
      }
      toast({
        title: t('vehicles.errorRegisteringEntry'),
        description: description || msg,
        variant: 'destructive',
      });
    },
  });

  const processExitMutation = useMutation({
    mutationFn: async (args: {
      ticketCode: string;
      payPartial?: number;
      paymentMethod?: string;
    }) => {
      const v = await invoke<VehicleFromBackend>('vehiculos_process_exit', {
        ticketCode: args.ticketCode,
        partialPayment: args.payPartial ?? null,
        paymentMethod: args.paymentMethod ?? null,
      });
      return vehicleFromBackend(v);
    },
    onSuccess: (vehicle) => {
      invalidateParking();
      setScanResult({ type: 'exit', vehicle });
    },
    onError: (err) => {
      toast({
        title: 'Error al procesar salida',
        description: String(err),
        variant: 'destructive',
      });
    },
  });

  const findActiveVehicle = useCallback(
    (ticketCode: string) => vehicles.find((v) => v.ticketCode === ticketCode && v.status === 'active'),
    [vehicles]
  );

  const getPlateDebt = useCallback(
    async (plate: string): Promise<number> => {
      if (tauri) {
        try {
          return await invoke<number>('vehiculos_get_plate_debt', { plate });
        } catch {
          return 0;
        }
      }
      return vehicles
        .filter((v) => v.plate.toUpperCase() === plate.toUpperCase() && v.debt != null && v.debt > 0)
        .reduce((sum, v) => sum + (v.debt ?? 0), 0);
    },
    [tauri, vehicles]
  );

  const registerEntry = useCallback(
    (plate: string, vehicleType: VehicleType, observations?: string, ticketCode?: string) => {
      if (tauri) {
        registerMutation.mutate({ plate, vehicleType, observations, ticketCode });
        return null;
      }
      const code = ticketCode || generateTicketCode();
      const debt = vehicles
        .filter((v) => v.plate.toUpperCase() === plate.toUpperCase() && v.debt != null && v.debt > 0)
        .reduce((sum, v) => sum + (v.debt ?? 0), 0);
      const newVehicle: Vehicle = {
        id: crypto.randomUUID(),
        ticketCode: code,
        plate: plate.toUpperCase(),
        vehicleType,
        observations,
        entryTime: new Date(),
        status: 'active',
        debt: debt > 0 ? debt : undefined,
      };
      setLocalVehicles((prev) => [...prev, newVehicle]);
      setScanResult({ type: 'entry', vehicle: newVehicle });
      return newVehicle;
    },
    [tauri, vehicles, registerMutation]
  );

  const processExit = useCallback(
    (ticketCode: string, payPartial?: number, paymentMethod?: string) => {
      if (tauri) {
        processExitMutation.mutate({ ticketCode, payPartial, paymentMethod });
        return null;
      }
      const vehicle = vehicles.find((v) => v.ticketCode === ticketCode && v.status === 'active');
      if (!vehicle) return null;
      const now = new Date();
      const durationMs = now.getTime() - new Date(vehicle.entryTime).getTime();
      const durationMinutes = Math.ceil(durationMs / (1000 * 60));
      const hours = Math.ceil(durationMinutes / 60);
      const rate = vehicle.specialRate ?? RATES[vehicle.vehicleType];
      const parkingCost = hours * rate;
      const totalWithDebt = parkingCost + (vehicle.debt ?? 0);
      let finalAmount = totalWithDebt;
      let newDebt = 0;
      if (payPartial !== undefined && payPartial < totalWithDebt) {
        finalAmount = payPartial;
        newDebt = totalWithDebt - payPartial;
      }
      setLocalVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id
            ? {
                ...v,
                exitTime: now,
                status: 'completed' as const,
                totalAmount: finalAmount,
                debt: newDebt,
              }
            : v
        )
      );
      const updatedVehicle: Vehicle = {
        ...vehicle,
        exitTime: now,
        status: 'completed',
        totalAmount: finalAmount,
        debt: newDebt,
      };
      setScanResult({ type: 'exit', vehicle: updatedVehicle });
      return { vehicle: updatedVehicle, duration: durationMinutes, cost: totalWithDebt };
    },
    [tauri, vehicles, processExitMutation]
  );

  const handleScan = useCallback(
    (code: string) => {
      const activeVehicle = findActiveVehicle(code);
      if (activeVehicle) {
        setScanResult({ type: 'exit', vehicle: activeVehicle });
      } else {
        setScanResult({ type: 'entry' });
      }
      return activeVehicle ?? undefined;
    },
    [findActiveVehicle]
  );

  /** En Tauri usa backend (vehiculos_find_by_plate); en web busca en la lista local. */
  const findByPlate = useCallback(
    async (plate: string): Promise<Vehicle | null> => {
      if (tauri) {
        try {
          const v = await invoke<VehicleFromBackend | null>('vehiculos_find_by_plate', { plate: plate.trim() });
          return v ? vehicleFromBackend(v) : null;
        } catch {
          return null;
        }
      }
      return (
        vehicles.find((v) => v.plate.toUpperCase() === plate.toUpperCase() && v.status === 'active') ?? null
      );
    },
    [tauri, vehicles]
  );

  const activeVehicles = vehicles.filter((v) => v.status === 'active');
  const completedVehicles = vehicles.filter((v) => v.status === 'completed' && v.exitTime);
  const todaysSessions = vehicles.filter((v) => {
    if (v.status !== 'completed' || !v.exitTime) return false;
    const today = new Date();
    const exitDate = new Date(v.exitTime);
    return exitDate.toDateString() === today.toDateString();
  });

  // En Tauri: solo datos del backend (mismo almacén). Sin cálculo en frontend. En web: fallback desde lista local.
  const metrics: DailyMetrics =
    tauri
      ? (metricsData ?? ZERO_METRICS)
      : (metricsData ?? {
          totalVehicles: todaysSessions.length + activeVehicles.length,
          activeVehicles: activeVehicles.length,
          occupancyRate: Math.min((activeVehicles.length / 50) * 100, 100),
          totalRevenue: todaysSessions.reduce((sum, v) => sum + (v.totalAmount ?? 0), 0),
          averageTicket:
            todaysSessions.length > 0
              ? todaysSessions.reduce((sum, v) => sum + (v.totalAmount ?? 0), 0) / todaysSessions.length
              : 0,
          averageStayMinutes:
            todaysSessions.length > 0
              ? todaysSessions.reduce((sum, v) => {
                  if (!v.exitTime) return sum;
                  return sum + (new Date(v.exitTime).getTime() - new Date(v.entryTime).getTime()) / (1000 * 60);
                }, 0) / todaysSessions.length
              : 0,
          turnoverRate: activeVehicles.length > 0 ? todaysSessions.length / activeVehicles.length : 0,
        });

  // En web: Caja usa sesiones completadas en memoria (no hay persistencia).
  const treasury: TreasuryData =
    tauri
      ? (treasuryData ?? ZERO_TREASURY)
      : (treasuryData ?? (() => {
          const revenue = completedVehicles.reduce((sum, v) => sum + (v.totalAmount ?? 0), 0);
          return {
            expectedCash: revenue,
            actualCash: revenue,
            discrepancy: 0,
            totalTransactions: completedVehicles.length,
            paymentBreakdown: {
              cash: revenue,
              card: 0,
              transfer: 0,
            },
          };
        })());

  const clearScanResult = useCallback(() => setScanResult(null), []);

  const getVehiclesByPlate = useCallback(
    async (plate: string): Promise<Vehicle[]> => {
      if (!tauri) return [];
      try {
        const list = await invoke<VehicleFromBackend[]>('vehiculos_get_vehicles_by_plate', {
          plate: plate.trim(),
        });
        return (list ?? []).map(vehicleFromBackend);
      } catch {
        return [];
      }
    },
    [tauri]
  );

  const deleteVehicle = useCallback(
    async (vehicleId: string): Promise<void> => {
      if (tauri) await invoke('vehiculos_delete_vehicle', { vehicleId });
      invalidateParking();
    },
    [tauri, invalidateParking]
  );

  const deleteExistingAndRetryRegister = useCallback(
    async (vehicleIdToDelete: string) => {
      const pending = pendingRegisterConflict;
      if (!pending) return;
      setPendingRegisterConflict(null);
      await deleteVehicle(vehicleIdToDelete);
      registerMutation.mutate({
        plate: pending.plate,
        vehicleType: pending.vehicleType,
        observations: pending.observations,
        ticketCode: pending.ticketCode,
      });
    },
    [pendingRegisterConflict, deleteVehicle, registerMutation]
  );

  const clearPendingRegisterConflict = useCallback(() => {
    setPendingRegisterConflict(null);
    setRegisterError(null);
  }, []);

  const clearRegisterError = useCallback(() => setRegisterError(null), []);

  const resolvePlateConflict = useCallback(
    async (plate: string, keepVehicleId: string) => {
      if (!tauri) return;
      await invoke('vehiculos_resolve_plate_conflict', { plate, keepVehicleId });
      setPlateConflicts((prev) => prev.filter((c) => c.plate.toUpperCase() !== plate.trim().toUpperCase()));
      invalidateParking();
    },
    [tauri, invalidateParking]
  );

  useEffect(() => {
    if (!tauri) return;
    invoke<{ plate: string; vehicles: VehicleFromBackend[] }[]>('vehiculos_get_plate_conflicts')
      .then((list) => {
        const mapped: PlateConflict[] = (list ?? []).map((c) => ({
          plate: c.plate,
          vehicles: c.vehicles.map(vehicleFromBackend),
        }));
        setPlateConflicts(mapped);
      })
      .catch(() => {});
  }, [tauri, vehiclesQuery.dataUpdatedAt]);

  return {
    vehicles,
    activeVehicles,
    todaysSessions,
    scanResult,
    metrics,
    treasury,
    handleScan,
    registerEntry,
    processExit,
    findByPlate,
    findActiveVehicle: (ticketCode: string) => findActiveVehicle(ticketCode) ?? null,
    getPlateDebt,
    clearScanResult,
    invalidateParking,
    isLoading: tauri && (vehiclesQuery.isLoading || metricsQuery.isLoading || treasuryQuery.isLoading),
    isTauri: tauri,
    isTreasuryError: tauri && treasuryQuery.isError,
    treasuryError: treasuryQuery.error,
    pendingRegisterConflict,
    clearPendingRegisterConflict,
    registerError,
    clearRegisterError,
    getVehiclesByPlate,
    deleteVehicle,
    deleteExistingAndRetryRegister,
    plateConflicts,
    resolvePlateConflict,
  };
};
