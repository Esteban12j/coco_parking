import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, CalendarDays } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ScannerInput } from "./components/ScannerInput";
import { VehicleEntryForm } from "./components/VehicleEntryForm";
import { ActiveVehiclesGrid } from "./components/ActiveVehiclesGrid";
import { PlateHistorySection } from "./components/PlateHistorySection";
import { CheckoutPanel } from "@/features/caja/components/CheckoutPanel";
import { RegisterConflictDialog } from "./components/RegisterConflictDialog";
import { useParkingStore } from "@/hooks/useParkingStore";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { Vehicle } from "@/types/parking";
import { listen } from "@tauri-apps/api/event";

type ViewMode = "scanner" | "entry" | "checkout" | "manual-search";

export const VehiculosPage = () => {
  const { t } = useTranslation();
  const { hasPermission } = useMyPermissions();
  const canCreateEntry = hasPermission("vehiculos:entries:create");
  const canCheckout = hasPermission("caja:transactions:create");
  const {
    activeVehicles,
    totalActiveCount,
    vehiclesPage,
    setVehiclesPage,
    vehiclesPageSize,
    handleScan,
    registerEntry,
    processExit,
    findByPlate,
    getPlateDebt,
    clearScanResult,
    pendingRegisterConflict,
    clearPendingRegisterConflict,
    registerError,
    clearRegisterError,
    getVehiclesByPlate,
    searchVehiclesByPlatePrefix,
    deleteExistingAndRetryRegister,
    isTauri,
  } = useParkingStore();

  const [viewMode, setViewMode] = useState<ViewMode>("scanner");
  const [currentTicket, setCurrentTicket] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [manualPlate, setManualPlate] = useState("");
  const debouncedManualPlate = useDebouncedValue(manualPlate.trim().toUpperCase(), 350);
  const [searchingByPlate, setSearchingByPlate] = useState(false);
  const [plateSuggestions, setPlateSuggestions] = useState<Vehicle[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionRequestIdRef = useRef(0);
  const handleScanInputRef = useRef<(code: string) => void>(() => {});

  useEffect(() => {
    handleScanInputRef.current = handleScanInput;
  });

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("barcode-scanned", (event) => {
      if (viewModeRef.current !== "scanner") return;
      const code = typeof event.payload === "string" ? event.payload : String(event.payload ?? "").trim();
      if (code) handleScanInputRef.current(code);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (viewMode !== "manual-search" || debouncedManualPlate.length < 2) {
      setPlateSuggestions([]);
      return;
    }
    const id = ++suggestionRequestIdRef.current;
    setLoadingSuggestions(true);
    searchVehiclesByPlatePrefix(debouncedManualPlate)
      .then((list) => {
        if (suggestionRequestIdRef.current !== id) return;
        const activeOnly = list.filter((v) => v.status === "active");
        setPlateSuggestions(activeOnly);
      })
      .finally(() => {
        if (suggestionRequestIdRef.current === id) {
          setLoadingSuggestions(false);
        }
      });
  }, [viewMode, debouncedManualPlate, searchVehiclesByPlatePrefix]);

  const handleScanInput = async (code: string) => {
    setCurrentTicket(code);
    const existing = await handleScan(code);
    if (existing) {
      setSelectedVehicle(existing);
      setViewMode(canCheckout ? "checkout" : "scanner");
    } else {
      setViewMode(canCreateEntry ? "entry" : "scanner");
    }
  };

  const handleEntrySubmit = (data: {
    plate: string;
    vehicleType: Parameters<typeof registerEntry>[1];
    observations: string;
  }) => {
    registerEntry(data.plate, data.vehicleType, data.observations, currentTicket);
    setViewMode("scanner");
    setCurrentTicket("");
    clearScanResult();
  };

  const handleCheckout = (
    partialPayment?: number,
    paymentMethod?: "cash" | "card" | "transfer",
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
      setViewMode("scanner");
      clearScanResult();
    }
  };

  const handleManualSearch = async () => {
    if (!manualPlate.trim()) return;
    setSearchingByPlate(true);
    try {
      const vehicle = await findByPlate(manualPlate.trim());
      if (vehicle) {
        setSelectedVehicle(vehicle);
        setViewMode("checkout");
      } else {
        toast({
          title: t("vehicles.vehicleNotFound"),
          description: t("vehicles.noRecordWithPlate"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("vehicles.vehicleNotFound"),
        description: t("vehicles.noRecordWithPlate"),
        variant: "destructive",
      });
    } finally {
      setSearchingByPlate(false);
      setManualPlate("");
    }
  };

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setViewMode("checkout");
  };

  const handleCancel = () => {
    clearRegisterError();
    setViewMode("scanner");
    setCurrentTicket("");
    setSelectedVehicle(null);
    clearScanResult();
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title={t("vehicles.title")}
        subtitle={t("vehicles.subtitle")}
        actions={
          isTauri ? (
            <Link to="/vehicles/today">
              <Button variant="outline" size="sm">
                <CalendarDays className="h-4 w-4 mr-2" />
                {t("vehicles.vehiclesTodayLink")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      <section className="py-6">
        {viewMode === "scanner" && (
          <div className="space-y-6">
            <ScannerInput onScan={handleScanInput} disabled={!canCreateEntry && !canCheckout} />
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t("vehicles.lostTicket")}
              </span>
              <Button
                variant="link"
                size="sm"
                onClick={() => setViewMode("manual-search")}
              >
                {t("vehicles.searchByPlate")}
              </Button>
            </div>
          </div>
        )}

        {viewMode === "manual-search" && (
          <div className="max-w-md mx-auto space-y-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-center">
              {t("vehicles.manualCheckout")}
            </h3>
            <div className="flex gap-2">
              <Input
                value={manualPlate}
                onChange={(e) =>
                  setManualPlate(e.target.value.toUpperCase())
                }
                placeholder={t("vehicles.enterPlate")}
                className="font-mono uppercase"
              />
              <Button
                variant="coco"
                onClick={() => void handleManualSearch()}
                disabled={searchingByPlate}
              >
                <Search className="h-4 w-4 mr-2" />
                {searchingByPlate ? t("common.loading") : t("common.search")}
              </Button>
            </div>
            {manualPlate.trim().length > 0 && manualPlate.trim().length < 2 && (
              <p className="text-sm text-muted-foreground">
                {t("vehicles.plateHistoryTypeMore")}
              </p>
            )}
            {loadingSuggestions && (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            )}
            {!loadingSuggestions && plateSuggestions.length > 0 && (
              <ul className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                {plateSuggestions.map((v) => (
                  <li key={v.id}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start font-mono h-auto py-2"
                      onClick={() => {
                        setSelectedVehicle(v);
                        setViewMode("checkout");
                        setManualPlate("");
                        setPlateSuggestions([]);
                      }}
                    >
                      {v.plate} — {v.ticketCode}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="w-full"
            >
              {t("vehicles.backToScanner")}
            </Button>
          </div>
        )}

        {viewMode === "entry" && canCreateEntry && (
          <VehicleEntryForm
            ticketCode={currentTicket}
            existingDebt={0}
            getPlateDebt={getPlateDebt}
            registerError={registerError}
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
                disabled={
                  vehiclesPage >= Math.ceil(totalActiveCount / vehiclesPageSize)
                }
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
    </div>
  );
};
