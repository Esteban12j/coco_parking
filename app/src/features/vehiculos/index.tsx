import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, CalendarDays, Plus } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { VehicleEntryForm } from "./components/VehicleEntryForm";
import { ActiveVehiclesGrid } from "./components/ActiveVehiclesGrid";
import { PlateHistorySection } from "./components/PlateHistorySection";
import { CheckoutPanel } from "@/features/caja/components/CheckoutPanel";
import { RegisterConflictDialog } from "./components/RegisterConflictDialog";
import { useParkingStore } from "@/hooks/useParkingStore";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { useDefaultRates } from "@/hooks/useDefaultRates";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import type { Vehicle, TariffKind, VehicleType } from "@/types/parking";
import { listen } from "@tauri-apps/api/event";

type ViewMode = "search" | "entry" | "checkout" | "active-detail";

export const VehiculosPage = () => {
  const { t } = useTranslation();
  const { hasPermission } = useMyPermissions();
  const canCreateEntry = hasPermission("vehiculos:entries:create");
  const canCheckout = hasPermission("caja:transactions:create");
  const canRemoveFromParking = hasPermission("vehiculos:entries:remove_from_parking");
  useDefaultRates();
  const {
    activeVehicles,
    totalActiveCount,
    vehiclesPage,
    setVehiclesPage,
    vehiclesPageSize,
    handleScan,
    registerEntry,
    processExit,
    removeVehicleFromParking,
    isRemovingFromParking,
    findByPlate,
    getPlateDebt,
    clearScanResult,
    pendingRegisterConflict,
    clearPendingRegisterConflict,
    registerError,
    clearRegisterError,
    getVehiclesByPlate,
    getEntrySuggestionsByPlate,
    searchVehiclesByPlatePrefix,
    deleteExistingAndRetryRegister,
    isTauri,
  } = useParkingStore();

  const [viewMode, setViewMode] = useState<ViewMode>("search");
  const [currentTicket, setCurrentTicket] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [plateSearch, setPlateSearch] = useState("");
  const [vehicleToRemove, setVehicleToRemove] = useState<Vehicle | null>(null);
  const [prefillPlate, setPrefillPlate] = useState("");
  const [prefillVehicleType, setPrefillVehicleType] = useState<VehicleType | undefined>();
  const [prefillTariffKind, setPrefillTariffKind] = useState<TariffKind | undefined>();
  const debouncedPlate = useDebouncedValue(plateSearch.trim().toUpperCase(), 300);
  const [searchingByPlate, setSearchingByPlate] = useState(false);
  const [plateSuggestions, setPlateSuggestions] = useState<Vehicle[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionRequestIdRef = useRef(0);
  const handleScanInputRef = useRef<(code: string) => void>(() => {});

  useEffect(() => {
    handleScanInputRef.current = handleScanInput;
    handlePlateSearchRef.current = handlePlateSearch;
  });

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const handlePlateSearchRef = useRef<(value: string) => void>(() => {});

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("barcode-scanned", (event) => {
      if (viewModeRef.current !== "search") return;
      const code = typeof event.payload === "string" ? event.payload : String(event.payload ?? "").trim();
      if (code) {
        setPlateSearch(code);
        handlePlateSearchRef.current(code);
      }
    })
      .then((fn) => { unlisten = fn; })
      .catch(() => {});
    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    if (viewMode !== "search" || debouncedPlate.length < 2) {
      setPlateSuggestions([]);
      return;
    }
    const id = ++suggestionRequestIdRef.current;
    setLoadingSuggestions(true);
    searchVehiclesByPlatePrefix(debouncedPlate)
      .then((list) => {
        if (suggestionRequestIdRef.current !== id) return;
        setPlateSuggestions(list);
      })
      .finally(() => {
        if (suggestionRequestIdRef.current === id) setLoadingSuggestions(false);
      });
  }, [viewMode, debouncedPlate, searchVehiclesByPlatePrefix]);

  const handleScanInput = async (code: string) => {
    const normalized = code.trim();
    if (!normalized) return;
    setCurrentTicket(normalized);
    const existing = await handleScan(normalized);
    if (existing) {
      setSelectedVehicle(existing);
      setViewMode(canCheckout ? "checkout" : "search");
    } else {
      setViewMode(canCreateEntry ? "entry" : "search");
    }
  };

  const handlePlateSearch = async (overrideValue?: string) => {
    const plate = (overrideValue ?? plateSearch).trim().toUpperCase();
    if (!plate) return;
    setSearchingByPlate(true);
    try {
      const activeVehicle = await findByPlate(plate);
      if (activeVehicle) {
        setSelectedVehicle(activeVehicle);
        setViewMode(canCheckout ? "checkout" : "search");
        setPlateSearch("");
      } else {
        const vehicleByTicket = await handleScan(plate);
        if (vehicleByTicket) {
          setSelectedVehicle(vehicleByTicket);
          setViewMode(canCheckout ? "checkout" : "search");
          setPlateSearch("");
        } else {
          const suggestions = await getEntrySuggestionsByPlate(plate);
          setPrefillPlate(plate);
          setPrefillVehicleType(suggestions.vehicleType);
          setPrefillTariffKind(suggestions.tariffKind);
          setViewMode("entry");
        }
      }
    } catch {
      setPrefillPlate(plate);
      setPrefillVehicleType(undefined);
      setPrefillTariffKind(undefined);
      setViewMode("entry");
    } finally {
      setSearchingByPlate(false);
    }
  };

  const handleNewVehicle = () => {
    setPrefillPlate("");
    setPrefillVehicleType(undefined);
    setPrefillTariffKind(undefined);
    setCurrentTicket("");
    setViewMode("entry");
  };

  const handleEntrySubmit = (data: {
    plate: string;
    vehicleType: Parameters<typeof registerEntry>[1];
    observations: string;
    tariffKind: TariffKind;
    ticketCode: string;
  }) => {
    const ticket = data.ticketCode || currentTicket || undefined;
    registerEntry(data.plate, data.vehicleType, data.observations, ticket, data.tariffKind);
    setViewMode("search");
    setCurrentTicket("");
    setPrefillPlate("");
    setPrefillVehicleType(undefined);
    setPrefillTariffKind(undefined);
    setPlateSearch("");
    clearScanResult();
  };

  const handleCheckout = (
    partialPayment?: number,
    paymentMethod?: "cash" | "card" | "transfer" | "contract" | "debt",
    customParkingCost?: number
  ) => {
    if (selectedVehicle) {
      processExit(
        selectedVehicle.ticketCode,
        partialPayment,
        paymentMethod,
        customParkingCost
      );
      setSelectedVehicle(null);
      setViewMode("search");
      setPlateSearch("");
      clearScanResult();
    }
  };

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setViewMode("checkout");
  };

  const handleCancel = () => {
    clearRegisterError();
    setViewMode("search");
    setCurrentTicket("");
    setSelectedVehicle(null);
    setPrefillPlate("");
    setPrefillVehicleType(undefined);
    setPrefillTariffKind(undefined);
    setPlateSearch("");
    clearScanResult();
  };

  const handleSuggestionClick = (vehicle: Vehicle) => {
    if (vehicle.status === "active") {
      setSelectedVehicle(vehicle);
      setViewMode("checkout");
    } else {
      setPrefillPlate(vehicle.plate);
      setPrefillVehicleType(vehicle.vehicleType);
      setPrefillTariffKind(vehicle.tariffKind as TariffKind);
      setViewMode("entry");
    }
    setPlateSearch("");
    setPlateSuggestions([]);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title={t("vehicles.title")}
        subtitle={t("vehicles.subtitle")}
        actions={
          <div className="flex gap-2">
            {canCreateEntry && (
              <Button variant="coco" size="sm" onClick={handleNewVehicle}>
                <Plus className="h-4 w-4 mr-2" />
                {t("vehicles.addVehicle")}
              </Button>
            )}
            {isTauri && (
              <Link to="/vehicles/today">
                <Button variant="outline" size="sm">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {t("vehicles.vehiclesTodayLink")}
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <section className="py-6">
        {viewMode === "search" && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex gap-2">
              <Input
                value={plateSearch}
                onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
                placeholder={t("vehicles.searchByPlatePlaceholder")}
                className="font-mono uppercase text-lg"
                onKeyDown={(e) => { if (e.key === "Enter") void handlePlateSearch(plateSearch); }}
                autoFocus
              />
              <Button
                variant="coco"
                onClick={() => void handlePlateSearch(plateSearch)}
                disabled={searchingByPlate || !plateSearch.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                {searchingByPlate ? t("common.loading") : t("common.search")}
              </Button>
            </div>

            {plateSearch.trim().length > 0 && plateSearch.trim().length < 2 && (
              <p className="text-sm text-muted-foreground">{t("vehicles.plateHistoryTypeMore")}</p>
            )}
            {loadingSuggestions && (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            )}
            {!loadingSuggestions && plateSuggestions.length > 0 && (
              <ul className="border border-border rounded-lg divide-y divide-border max-h-60 overflow-y-auto">
                {plateSuggestions.map((v) => (
                  <li key={v.id}>
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-center justify-between"
                      onClick={() => handleSuggestionClick(v)}
                    >
                      <div>
                        <span className="font-mono font-semibold">{v.plate}</span>
                        <span className="text-xs text-muted-foreground ml-2">{v.vehicleType}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {v.status === "active" ? t("vehicles.active") : t("vehicles.completed")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {viewMode === "entry" && canCreateEntry && (
          <VehicleEntryForm
            existingDebt={0}
            getPlateDebt={getPlateDebt}
            getEntrySuggestionsByPlate={getEntrySuggestionsByPlate}
            registerError={registerError}
            initialPlate={prefillPlate}
            initialVehicleType={prefillVehicleType}
            initialTariffKind={prefillTariffKind}
            vehicleTypeLocked={!!prefillVehicleType}
            onSubmit={handleEntrySubmit}
            onCancel={handleCancel}
          />
        )}

        {viewMode === "checkout" && selectedVehicle && canCheckout && (
          <CheckoutPanel
            vehicle={selectedVehicle}
            onCheckout={handleCheckout}
            onCancel={handleCancel}
          />
        )}
      </section>

      <section className="space-y-4 mt-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">
            {t("vehicles.vehiclesInParking")}
          </h2>
          <span className="text-sm text-muted-foreground">
            {totalActiveCount} {t("vehicles.active")}
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <ActiveVehiclesGrid
            vehicles={activeVehicles}
            onSelect={handleVehicleSelect}
            canRemoveFromParking={canRemoveFromParking}
            onRemoveFromParking={
              canRemoveFromParking
                ? (vehicle) => setVehicleToRemove(vehicle)
                : undefined
            }
            isRemovingFromParking={isRemovingFromParking}
          />
          {isTauri && totalActiveCount > vehiclesPageSize && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVehiclesPage((p) => Math.max(1, p - 1))}
                disabled={vehiclesPage <= 1}
              >
                {t("common.prev")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("vehicles.pageOfFormat")
                  .replace("{{current}}", String(vehiclesPage))
                  .replace("{{total}}", String(Math.ceil(totalActiveCount / vehiclesPageSize)))}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVehiclesPage((p) => p + 1)}
                disabled={vehiclesPage >= Math.ceil(totalActiveCount / vehiclesPageSize)}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </div>
      </section>

      <PlateHistorySection
        searchVehiclesByPlatePrefix={searchVehiclesByPlatePrefix}
        isTauri={isTauri}
      />

      <RegisterConflictDialog
        pending={pendingRegisterConflict}
        getVehiclesByPlate={getVehiclesByPlate}
        onDeleteAndRegister={(id) => void deleteExistingAndRetryRegister(id)}
        onCancel={clearPendingRegisterConflict}
      />

      <AlertDialog open={!!vehicleToRemove} onOpenChange={(o) => !o && setVehicleToRemove(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vehicles.removeFromParkingConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("vehicles.removeFromParkingConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (vehicleToRemove) {
                  removeVehicleFromParking(vehicleToRemove.id);
                  setVehicleToRemove(null);
                }
              }}
              disabled={isRemovingFromParking}
            >
              {isRemovingFromParking ? t("common.loading") : t("vehicles.removeFromParkingConfirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
