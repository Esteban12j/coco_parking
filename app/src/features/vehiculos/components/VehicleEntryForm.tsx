import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, Bike, Truck, CircleDot, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ObservationTags } from "./ObservationTags";
import { listCustomTariffs } from "@/api/customTariffs";
import type { VehicleType, TariffKind, CustomTariff } from "@/types/parking";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { listen } from "@tauri-apps/api/event";
import { getTariffDisplayName } from "@/lib/tariffDisplay";

const VEHICLE_TYPE_OPTIONS: {
  type: VehicleType;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { type: "car", labelKey: "vehicles.car", icon: <Car className="h-5 w-5" />, color: "border-blue-400" },
  { type: "motorcycle", labelKey: "vehicles.motorcycle", icon: <Bike className="h-5 w-5" />, color: "border-green-400" },
  { type: "truck", labelKey: "vehicles.truck", icon: <Truck className="h-5 w-5" />, color: "border-orange-400" },
  { type: "bicycle", labelKey: "vehicles.bicycle", icon: <CircleDot className="h-5 w-5" />, color: "border-purple-400" },
];

function formatTariffSummary(tariff: CustomTariff): string {
  const h = tariff.rateDurationHours ?? 1;
  const m = tariff.rateDurationMinutes ?? 0;
  const durationParts: string[] = [];
  if (h > 0) durationParts.push(`${h}h`);
  if (m > 0) durationParts.push(`${m}min`);
  const duration = durationParts.join(" ") || "1h";
  let summary = `$${tariff.amount.toLocaleString()} / ${duration}`;
  if (tariff.additionalHourPrice != null && tariff.additionalHourPrice > 0) {
    const aH = tariff.additionalDurationHours ?? 1;
    const aM = tariff.additionalDurationMinutes ?? 0;
    const addParts: string[] = [];
    if (aH > 0) addParts.push(`${aH}h`);
    if (aM > 0) addParts.push(`${aM}min`);
    const addDuration = addParts.join(" ") || "1h";
    summary += ` + $${tariff.additionalHourPrice.toLocaleString()} / ${addDuration}`;
  }
  return summary;
}

function buildTariffLabel(
  tariff: CustomTariff,
  t: (key: string) => string
): string {
  const kind = tariff.tariffKind || "regular";
  const kindLabel =
    kind === "employee"
      ? t("tariffs.kindEmployee")
      : kind === "student"
        ? t("tariffs.kindStudent")
        : t("tariffs.kindRegular");
  const name = getTariffDisplayName(tariff, t);
  const prefix = name ? `${name} (${kindLabel})` : kindLabel;
  return `${prefix} — ${formatTariffSummary(tariff)}`;
}

interface VehicleEntryFormProps {
  existingDebt?: number;
  getPlateDebt?: (plate: string) => Promise<number>;
  getEntrySuggestionsByPlate?: (plate: string) => Promise<{ vehicleType?: VehicleType; tariffKind?: TariffKind; hasContract: boolean; contractIsInArrears: boolean; contractMonthlyAmount?: number; contractClientName?: string }>;
  registerError?: string | null;
  initialPlate?: string;
  initialVehicleType?: VehicleType;
  initialTariffKind?: TariffKind;
  vehicleTypeLocked?: boolean;
  onSubmit: (data: {
    plate: string;
    vehicleType: VehicleType;
    observations: string;
    tariffKind: TariffKind;
    ticketCode: string;
  }) => void;
  onCancel: () => void;
}

export const VehicleEntryForm = ({
  existingDebt: initialDebt = 0,
  getPlateDebt,
  getEntrySuggestionsByPlate,
  registerError,
  initialPlate = "",
  initialVehicleType,
  initialTariffKind,
  vehicleTypeLocked = false,
  onSubmit,
  onCancel,
}: VehicleEntryFormProps) => {
  const { t } = useTranslation();
  const tariffsQuery = useQuery({
    queryKey: ["custom_tariffs"],
    queryFn: () => listCustomTariffs(null),
  });
  const allTariffs: CustomTariff[] = tariffsQuery.data ?? [];
  const tariffsLoading = tariffsQuery.isLoading;

  const [plate, setPlate] = useState(initialPlate);
  const [ticketCode, setTicketCode] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>(initialVehicleType ?? "car");
  const [selectedTariffId, setSelectedTariffId] = useState<string>("");
  const [observationTags, setObservationTags] = useState<string[]>([]);
  const [extraObservations, setExtraObservations] = useState("");
  const [existingDebt, setExistingDebt] = useState(initialDebt);
  const [hasContract, setHasContract] = useState(false);
  const [contractTariffKind, setContractTariffKind] = useState<TariffKind | undefined>();
  const [contractIsInArrears, setContractIsInArrears] = useState(false);
  const [contractMonthlyAmount, setContractMonthlyAmount] = useState<number | undefined>();
  const [chargeMode, setChargeMode] = useState<"tariff" | "contract">("tariff");
  const ticketInputRef = useRef<HTMLInputElement>(null);
  const lastSearchedPlateRef = useRef<string>("");

  const tariffsForVehicleType = useMemo(
    () => allTariffs.filter(
      (tariff) => tariff.vehicleType === vehicleType && (!tariff.plateOrRef || tariff.plateOrRef.trim() === "")
    ),
    [allTariffs, vehicleType]
  );

  useEffect(() => {
    if (initialTariffKind && tariffsForVehicleType.length > 0) {
      const matchingTariff = tariffsForVehicleType.find((tariff) => (tariff.tariffKind || "regular") === initialTariffKind);
      if (matchingTariff) {
        setSelectedTariffId(matchingTariff.id);
        return;
      }
    }
    const defaultRegular = tariffsForVehicleType.find((tariff) => (tariff.tariffKind || "regular") === "regular");
    setSelectedTariffId(defaultRegular?.id ?? tariffsForVehicleType[0]?.id ?? "");
  }, [tariffsForVehicleType, initialTariffKind]);

  const requiresPlate = vehicleType !== "bicycle";

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("barcode-scanned", (event) => {
      const code = typeof event.payload === "string" ? event.payload : String(event.payload ?? "").trim();
      if (code) {
        setTicketCode(code);
      }
    })
      .then((fn) => { unlisten = fn; })
      .catch(() => {});
    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    if (!getPlateDebt || plate.trim().length < 2) {
      setExistingDebt(initialDebt);
      return;
    }
    let cancelled = false;
    getPlateDebt(plate.trim()).then((debt) => {
      if (!cancelled) setExistingDebt(debt);
    });
    return () => { cancelled = true; };
  }, [plate, initialDebt, getPlateDebt]);

  useEffect(() => {
    if (initialPlate && getEntrySuggestionsByPlate && !vehicleTypeLocked) {
      handlePlateBlur();
    }
  }, [initialPlate, getEntrySuggestionsByPlate, vehicleTypeLocked]);

  const handlePlateBlur = async () => {
    const trimmedPlate = plate.trim().toUpperCase();
    if (!getEntrySuggestionsByPlate || trimmedPlate.length < 2 || lastSearchedPlateRef.current === trimmedPlate) {
      return;
    }
    lastSearchedPlateRef.current = trimmedPlate;
    try {
      const suggestions = await getEntrySuggestionsByPlate(trimmedPlate);
      if (suggestions.vehicleType && !vehicleTypeLocked) {
        setVehicleType(suggestions.vehicleType);
      }
      // Detectar si el vehículo tiene contrato
      setHasContract(suggestions.hasContract);
      setContractIsInArrears(suggestions.contractIsInArrears ?? false);
      setContractMonthlyAmount(suggestions.contractMonthlyAmount);
      if (suggestions.hasContract) {
        setChargeMode("contract");
        setContractTariffKind(suggestions.tariffKind);
      } else {
        setChargeMode("tariff");
        setContractTariffKind(undefined);
      }
      if (suggestions.tariffKind && tariffsForVehicleType.length > 0) {
        const matchingTariff = tariffsForVehicleType.find((tariff) => (tariff.tariffKind || "regular") === suggestions.tariffKind);
        if (matchingTariff) {
          setSelectedTariffId(matchingTariff.id);
        }
      }
    } catch (error) {
      // Ignore errors, just don't update
    }
  };

  const handleToggleTag = (tag: string) => {
    setObservationTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const selectedTariff = useMemo(
    () => tariffsForVehicleType.find((t) => t.id === selectedTariffId) ?? null,
    [tariffsForVehicleType, selectedTariffId]
  );

  const plateValid = requiresPlate ? plate.trim().length > 0 : true;
  const barcodeValid = ticketCode.trim().length > 0;
  const chargeValid = chargeMode === "contract" || (selectedTariffId.length > 0 && selectedTariff != null);
  const isFormValid = plateValid && barcodeValid && chargeValid;

  const buildObservationsText = (): string => {
    const parts: string[] = [];
    if (observationTags.length > 0) parts.push(observationTags.join(", "));
    if (extraObservations.trim()) parts.push(extraObservations.trim());
    return parts.join(" | ");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    const tariffKind = chargeMode === "contract" 
      ? (contractTariffKind || "regular") as TariffKind
      : (selectedTariff?.tariffKind || "regular") as TariffKind;
    onSubmit({
      plate: plate.trim().toUpperCase(),
      vehicleType,
      observations: buildObservationsText(),
      tariffKind,
      ticketCode: ticketCode.trim(),
    });
  };

  const getTypeLabel = (labelKey: string): string => {
    const translated = t(labelKey);
    return translated !== labelKey ? translated : labelKey.split(".").pop() ?? labelKey;
  };

  return (
    <div className="animate-fade-in bg-card border border-border rounded-xl p-6 max-w-lg mx-auto shadow-sm">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 text-success mb-3">
          <Car className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">{t("vehicles.registerEntry")}</h2>
      </div>

      {registerError && (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert className="h-4 w-4" />
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{registerError}</AlertDescription>
        </Alert>
      )}

      {existingDebt > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30">
          <p className="text-sm font-medium text-warning">
            {t("vehicles.plateDebtWarning")} ${existingDebt.toFixed(2)}
          </p>
        </div>
      )}

      {contractIsInArrears && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm font-medium text-destructive">
            {t("vehicles.contractArrearsWarning")}{contractMonthlyAmount != null ? ` $${contractMonthlyAmount.toFixed(2)}` : ""}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="plate">
            {requiresPlate ? `${t("vehicles.vehiclePlate")} *` : `${t("vehicles.vehiclePlate")} (${t("common.optional")})`}
          </Label>
          <Input
            id="plate"
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            onBlur={handlePlateBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handlePlateBlur();
              }
            }}
            placeholder="ABC-123"
            className="text-lg font-mono uppercase"
            required={requiresPlate}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>{t("vehicles.vehicleType")} *</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VEHICLE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => !vehicleTypeLocked && setVehicleType(opt.type)}
                disabled={vehicleTypeLocked}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center",
                  vehicleType === opt.type
                    ? `${opt.color} bg-primary/10 text-foreground ring-1 ring-primary`
                    : vehicleTypeLocked
                    ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                    : "border-border bg-card hover:bg-accent"
                )}
              >
                {opt.icon}
                <span className="text-xs font-medium leading-tight">
                  {getTypeLabel(opt.labelKey)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {hasContract && (
            <>
              <Label>{t("vehicles.chargeMode")} *</Label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setChargeMode("contract")}
                  className={cn(
                    "px-4 py-2.5 rounded-lg border-2 transition-all font-medium",
                    chargeMode === "contract"
                      ? "border-primary bg-primary/10 ring-1 ring-primary text-foreground"
                      : "border-border bg-card hover:bg-accent text-muted-foreground"
                  )}
                >
                  {t("vehicles.contractMode")}
                </button>
                <button
                  type="button"
                  onClick={() => setChargeMode("tariff")}
                  className={cn(
                    "px-4 py-2.5 rounded-lg border-2 transition-all font-medium",
                    chargeMode === "tariff"
                      ? "border-primary bg-primary/10 ring-1 ring-primary text-foreground"
                      : "border-border bg-card hover:bg-accent text-muted-foreground"
                  )}
                >
                  {t("vehicles.selectTariff")}
                </button>
              </div>
            </>
          )}
          {chargeMode === "contract" ? (
            <div className="p-4 rounded-lg border border-border bg-success/5">
              <p className="text-sm font-medium text-foreground">
                {t("vehicles.contractApplied")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("vehicles.contractInfo")}
              </p>
            </div>
          ) : (
            <>
              <Label htmlFor="tariffSelect">{t("vehicles.selectTariff")} *</Label>
              {tariffsLoading ? (
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              ) : tariffsForVehicleType.length === 0 ? (
                <p className="text-sm text-destructive">{t("vehicles.noTariffsAvailable")}</p>
              ) : (
                <div className="space-y-1">
                  {tariffsForVehicleType.map((tariff) => (
                    <button
                      key={tariff.id}
                      type="button"
                      onClick={() => setSelectedTariffId(tariff.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all",
                        selectedTariffId === tariff.id
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border bg-card hover:bg-accent"
                      )}
                    >
                      <span className="text-sm font-medium">{buildTariffLabel(tariff, t)}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("vehicles.observations")}</Label>
          <ObservationTags
            vehicleType={vehicleType}
            selectedTags={observationTags}
            onToggleTag={handleToggleTag}
          />
          <Textarea
            value={extraObservations}
            onChange={(e) => setExtraObservations(e.target.value)}
            placeholder={t("vehicles.observationsPlaceholder")}
            rows={2}
            className="mt-2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ticketCode">{t("vehicles.ticketCodeLabel")} *</Label>
          <Input
            ref={ticketInputRef}
            id="ticketCode"
            type="text"
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value)}
            placeholder={t("vehicles.ticketCodePlaceholder")}
            className="font-mono"
            required
          />
          <p className="text-xs text-muted-foreground">{t("vehicles.ticketCodeHint")}</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="coco" className="flex-1" disabled={!isFormValid}>
            {t("vehicles.registerVehicle")}
          </Button>
        </div>
      </form>
    </div>
  );
};
