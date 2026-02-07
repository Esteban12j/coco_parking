import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Vehicle, VehicleType, DailyMetrics, TreasuryData, ShiftClosure, PlateConflict, PendingRegisterConflict } from '@/types/parking';
import * as apiCaja from '@/api/caja';
import * as apiMetricas from '@/api/metricas';
import * as apiVehiculos from '@/api/vehiculos';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from '@/i18n';
import { generatePrefixedId } from '@/lib/utils';
import { getDefaultRate } from '@/lib/defaultRates';

function vehicleFromBackend(v: apiVehiculos.VehicleBackend): Vehicle {
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

function normalizeTreasuryData(raw: unknown): TreasuryData | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const hasCamel = typeof r.expectedCash === 'number';
  const hasSnake = typeof r.expected_cash === 'number';
  if (hasCamel) {
    const pb = r.paymentBreakdown as Record<string, unknown> | undefined;
    return {
      expectedCash: Number(r.expectedCash) || 0,
      actualCash: Number(r.actualCash) || 0,
      discrepancy: Number(r.discrepancy) || 0,
      totalTransactions: Number(r.totalTransactions) || 0,
      paymentBreakdown: {
        cash: Number(pb?.cash) || 0,
        card: Number(pb?.card) || 0,
        transfer: Number(pb?.transfer) || 0,
      },
    };
  }
  if (hasSnake) {
    const pb = r.payment_breakdown as Record<string, unknown> | undefined;
    return {
      expectedCash: Number(r.expected_cash) || 0,
      actualCash: Number(r.actual_cash) || 0,
      discrepancy: Number(r.discrepancy) || 0,
      totalTransactions: Number(r.total_transactions) || 0,
      paymentBreakdown: {
        cash: Number(pb?.cash) || 0,
        card: Number(pb?.card) || 0,
        transfer: Number(pb?.transfer) || 0,
      },
    };
  }
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
  const [vehiclesPage, setVehiclesPage] = useState(1);
  const [vehiclesPageSize] = useState(20);

  const vehiclesQuery = useQuery({
    queryKey: ['parking', 'vehicles', vehiclesPage, vehiclesPageSize, 'active'],
    queryFn: async (): Promise<{ items: Vehicle[]; total: number }> => {
      const res = await apiVehiculos.listVehicles({
        limit: vehiclesPageSize,
        offset: (vehiclesPage - 1) * vehiclesPageSize,
        status: 'active',
      });
      if (!res) return { items: [], total: 0 };
      return {
        items: (res.items ?? []).map(vehicleFromBackend),
        total: res.total ?? 0,
      };
    },
    enabled: tauri,
  });

  const metricsQuery = useQuery({
    queryKey: ['parking', 'metrics'],
    queryFn: () => apiMetricas.getDailyMetrics(),
    enabled: tauri,
  });

  const treasuryQuery = useQuery({
    queryKey: ['parking', 'treasury'],
    queryFn: () => {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return apiCaja.getTreasury(localDate);
    },
    enabled: tauri,
    refetchOnWindowFocus: true,
  });

  const shiftClosuresQuery = useQuery({
    queryKey: ['parking', 'shiftClosures'],
    queryFn: () => apiCaja.listShiftClosures({ limit: 50 }),
    enabled: tauri,
  });

  const vehiclesPageData = tauri ? vehiclesQuery.data : null;
  const vehicles = tauri ? (vehiclesPageData?.items ?? []) : localVehicles;
  const totalActiveCount = tauri ? (vehiclesPageData?.total ?? 0) : localVehicles.filter((v) => v.status === 'active').length;
  const metricsData = tauri ? metricsQuery.data : null;
  const treasuryData = tauri ? normalizeTreasuryData(treasuryQuery.data) : null;

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

  const invalidateParkingVehicles = useCallback(() => {
    setVehiclesPage(1);
    queryClient.invalidateQueries({ queryKey: ['parking', 'vehicles'] });
  }, [queryClient]);

  const invalidateParkingTreasury = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['parking', 'treasury'] });
  }, [queryClient]);

  const refetchTreasury = useCallback(() => {
    if (tauri) {
      queryClient.refetchQueries({ queryKey: ['parking', 'treasury'] });
    }
  }, [tauri, queryClient]);

  const invalidateParkingMetrics = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['parking', 'metrics'] });
  }, [queryClient]);

  const invalidateParkingShiftClosures = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['parking', 'shiftClosures'] });
  }, [queryClient]);

  const invalidateParking = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['parking'] });
  }, [queryClient]);

  const registerMutation = useMutation({
    mutationFn: async (args: RegisterArgs) => {
      lastRegisterArgsRef.current = args;
      const v = await apiVehiculos.registerEntry({
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
      invalidateParkingVehicles();
      invalidateParkingMetrics();
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
      customParkingCost?: number;
    }) => {
      const v = await apiVehiculos.processExit({
        ticketCode: args.ticketCode,
        partialPayment: args.payPartial ?? null,
        paymentMethod: args.paymentMethod ?? null,
        customParkingCost: args.customParkingCost ?? null,
      });
      return vehicleFromBackend(v);
    },
    onSuccess: (vehicle) => {
      invalidateParkingVehicles();
      invalidateParkingTreasury();
      invalidateParkingMetrics();
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

  const removeFromParkingMutation = useMutation({
    mutationFn: async (args: { vehicleId: string }) => {
      const v = await apiVehiculos.removeVehicleFromParking({ vehicleId: args.vehicleId });
      return vehicleFromBackend(v);
    },
    onSuccess: () => {
      invalidateParkingVehicles();
      invalidateParkingTreasury();
      invalidateParkingMetrics();
    },
    onError: (err) => {
      toast({
        title: t('vehicles.errorRemoveFromParking'),
        description: String(err),
        variant: 'destructive',
      });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async (args: {
      arqueoCash?: number | null;
      notes?: string | null;
      onSuccess?: () => void;
    }) => {
      const result = await apiCaja.closeShift({
        arqueoCash: args.arqueoCash ?? undefined,
        notes: args.notes ?? undefined,
      });
      return { result, onSuccess: args.onSuccess };
    },
    onSuccess: (data) => {
      invalidateParkingShiftClosures();
      invalidateParkingTreasury();
      toast({
        title: t('till.shiftClosed'),
        description: t('till.reportGenerated'),
      });
      data.onSuccess?.();
    },
    onError: (err) => {
      toast({
        title: t('till.closeShift'),
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
          return await apiVehiculos.getPlateDebt(plate);
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
        id: generatePrefixedId("VH", 25),
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
    (
      ticketCode: string,
      payPartial?: number,
      paymentMethod?: string,
      customParkingCost?: number
    ) => {
      if (tauri) {
        processExitMutation.mutate({
          ticketCode,
          payPartial,
          paymentMethod,
          customParkingCost,
        });
        return null;
      }
      const vehicle = vehicles.find((v) => v.ticketCode === ticketCode && v.status === 'active');
      if (!vehicle) return null;
      const now = new Date();
      const durationMs = now.getTime() - new Date(vehicle.entryTime).getTime();
      const durationMinutes = Math.ceil(durationMs / (1000 * 60));
      const hours = Math.ceil(durationMinutes / 60);
      const defaultCost = hours * getDefaultRate(vehicle.vehicleType);
      const parkingCost =
        customParkingCost !== undefined && customParkingCost >= 0
          ? customParkingCost
          : defaultCost;
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
    async (code: string): Promise<Vehicle | undefined> => {
      if (tauri) {
        try {
          const v = await apiVehiculos.findByTicket(code.trim());
          const activeVehicle = v ? vehicleFromBackend(v) : undefined;
          if (activeVehicle) {
            setScanResult({ type: 'exit', vehicle: activeVehicle });
          } else {
            setScanResult({ type: 'entry' });
          }
          return activeVehicle ?? undefined;
        } catch {
          setScanResult({ type: 'entry' });
          return undefined;
        }
      }
      const activeVehicle = findActiveVehicle(code);
      if (activeVehicle) {
        setScanResult({ type: 'exit', vehicle: activeVehicle });
      } else {
        setScanResult({ type: 'entry' });
      }
      return activeVehicle ?? undefined;
    },
    [tauri, findActiveVehicle]
  );

  const findByPlate = useCallback(
    async (plate: string): Promise<Vehicle | null> => {
      if (tauri) {
        try {
          const v = await apiVehiculos.findByPlate(plate.trim());
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

  const closeShift = useCallback(
    (arqueoCash?: number | null, notes?: string | null, onSuccess?: () => void) => {
      if (!tauri) return;
      closeShiftMutation.mutate({ arqueoCash, notes, onSuccess });
    },
    [tauri, closeShiftMutation]
  );

  const clearScanResult = useCallback(() => setScanResult(null), []);

  const getVehiclesByPlate = useCallback(
    async (plate: string): Promise<Vehicle[]> => {
      if (!tauri) return [];
      try {
        const list = await apiVehiculos.getVehiclesByPlate(plate.trim());
        return (list ?? []).map(vehicleFromBackend);
      } catch {
        return [];
      }
    },
    [tauri]
  );

  const searchVehiclesByPlatePrefix = useCallback(
    async (platePrefix: string): Promise<Vehicle[]> => {
      if (!tauri) return [];
      try {
        const list = await apiVehiculos.searchVehiclesByPlatePrefix(platePrefix.trim());
        return (list ?? []).map(vehicleFromBackend);
      } catch {
        return [];
      }
    },
    [tauri]
  );

  const deleteVehicle = useCallback(
    async (vehicleId: string): Promise<void> => {
      if (tauri) await apiVehiculos.deleteVehicle(vehicleId);
      invalidateParkingVehicles();
      invalidateParkingMetrics();
    },
    [tauri, invalidateParkingVehicles, invalidateParkingMetrics]
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
      await apiVehiculos.resolvePlateConflict(plate, keepVehicleId);
      setPlateConflicts((prev) => prev.filter((c) => c.plate.toUpperCase() !== plate.trim().toUpperCase()));
      invalidateParkingVehicles();
    },
    [tauri, invalidateParkingVehicles]
  );

  useEffect(() => {
    if (!tauri) return;
    apiVehiculos
      .getPlateConflicts()
      .then((list) => {
        const mapped: PlateConflict[] = (list ?? []).map((c) => ({
          plate: c.plate,
          vehicles: c.vehicles.map(vehicleFromBackend),
        }));
        setPlateConflicts(mapped);
      })
      .catch(() => {});
  }, [tauri, vehiclesQuery.dataUpdatedAt]);

  const shiftClosures = tauri ? (shiftClosuresQuery.data ?? []) : [];

  return {
    vehicles,
    activeVehicles,
    totalActiveCount,
    vehiclesPage,
    setVehiclesPage,
    vehiclesPageSize,
    todaysSessions,
    scanResult,
    metrics,
    treasury,
    shiftClosures,
    handleScan,
    registerEntry,
    processExit,
    findByPlate,
    findActiveVehicle: (ticketCode: string) => findActiveVehicle(ticketCode) ?? null,
    getPlateDebt,
    clearScanResult,
    invalidateParking,
    refetchTreasury,
    isLoading: tauri && (vehiclesQuery.isLoading || metricsQuery.isLoading || treasuryQuery.isLoading),
    isTauri: tauri,
    isTreasuryError: tauri && treasuryQuery.isError,
    treasuryError: treasuryQuery.error,
    isMetricsError: tauri && metricsQuery.isError,
    metricsError: metricsQuery.error,
    pendingRegisterConflict,
    clearPendingRegisterConflict,
    registerError,
    clearRegisterError,
    getVehiclesByPlate,
    searchVehiclesByPlatePrefix,
    deleteVehicle,
    removeVehicleFromParking: (vehicleId: string) => removeFromParkingMutation.mutate({ vehicleId }),
    isRemovingFromParking: removeFromParkingMutation.isPending,
    deleteExistingAndRetryRegister,
    plateConflicts,
    resolvePlateConflict,
    closeShift,
    isClosingShift: closeShiftMutation.isPending,
    shiftClosuresLoading: tauri && shiftClosuresQuery.isLoading,
  };
};
