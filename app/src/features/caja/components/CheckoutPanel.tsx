import { useState, useEffect } from "react";
import {
  Clock,
  Car,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Tag,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Vehicle, VehicleType, TariffKind, PaymentMethod } from "@/types/parking";
import { SelectedTariffForCheckout } from "./CustomTariffSelector";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { calculateTwoTierCost, getDefaultTariffForCheckout } from "@/lib/defaultRates";
import { calculateExtraChargeFromContract } from "@/lib/contractCharge";
import { useDefaultRates } from "@/hooks/useDefaultRates";
import { CustomTariffSelector } from "./CustomTariffSelector";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import * as apiContracts from "@/api/contracts";
import { useQuery } from "@tanstack/react-query";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

interface CheckoutPanelProps {
  vehicle: Vehicle;
  onCheckout: (
    partialPayment?: number,
    paymentMethod?: PaymentMethod,
    customParkingCost?: number
  ) => void;
  onCancel: () => void;
}

export const CheckoutPanel = ({
  vehicle,
  onCheckout,
  onCancel,
}: CheckoutPanelProps) => {
  const { t } = useTranslation();
  const tauri = isTauri();
  const { getTariffForKind } = useDefaultRates();
  const { hasPermission } = useMyPermissions();
  const canDebtPayment = hasPermission("caja:debt_payment:create");

  const vehicleTariffKind = (vehicle.tariffKind || "regular") as TariffKind;
  const defaultTariff = getTariffForKind(vehicle.vehicleType, vehicleTariffKind);

  const contractQuery = useQuery({
    queryKey: ["contract_any_by_plate", vehicle.plate],
    queryFn: () => apiContracts.getContractAnyByPlate(vehicle.plate),
    enabled: tauri && !!vehicle.plate,
  });
  const activeContract = contractQuery.data;
  const contractInArrears = activeContract?.isInArrears ?? false;

  const vehicleLabels: Record<VehicleType, string> = {
    car: t("checkout.car"),
    motorcycle: t("checkout.motorcycle"),
    truck: t("checkout.truck"),
    bicycle: t("checkout.bicycle"),
  };

  const [elapsed, setElapsed] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [showPartial, setShowPartial] = useState(false);
  const [selectedCustomTariff, setSelectedCustomTariff] = useState<SelectedTariffForCheckout | null>(null);
  const [customTariffSelectorOpen, setCustomTariffSelectorOpen] = useState(false);

  useEffect(() => {
    const calculateElapsed = () => {
      const now = new Date();
      const entry = new Date(vehicle.entryTime);
      const diff = now.getTime() - entry.getTime();
      setElapsed({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [vehicle.entryTime]);

  const totalMinutes = elapsed.hours * 60 + elapsed.minutes + elapsed.seconds / 60;

  const baseDurationHours = defaultTariff.rateDurationHours + (defaultTariff.rateDurationMinutes / 60);

  const defaultCostResult = activeContract
    ? (() => {
        const includedMinutes = activeContract.includedHoursPerDay * 60;
        if (totalMinutes <= includedMinutes + 1) {
          return { parkingCost: 0, baseCost: 0, additionalCost: 0, additionalHours: 0 };
        }
        // Use contract's own extra charge rates if defined (tariffKind === "none")
        const hasContractRates = (activeContract.extraInterval ?? 0) > 0;
        if (hasContractRates) {
          const entryTime = new Date(vehicle.entryTime);
          const nowTime = new Date(entryTime.getTime() + totalMinutes * 60000);
          const cost = calculateExtraChargeFromContract(
            { entryTime, exitTime: nowTime },
            activeContract,
          );
          return { parkingCost: cost, baseCost: 0, additionalCost: cost, additionalHours: 0 };
        }
        // Fallback: use the vehicle's default tariff additional rate
        const overstayHours = (totalMinutes - includedMinutes) / 60;
        const periodH = ((defaultTariff.additionalDurationHours ?? 1) + ((defaultTariff.additionalDurationMinutes ?? 0) / 60)) || 1;
        const additionalBlocks = Math.ceil(overstayHours / periodH);
        const rate = defaultTariff.additionalHourPrice ?? (defaultTariff.amount / baseDurationHours);
        return {
          parkingCost: additionalBlocks * rate,
          baseCost: 0,
          additionalCost: additionalBlocks * rate,
          additionalHours: additionalBlocks,
        };
      })()
    : calculateTwoTierCost(
        totalMinutes,
        defaultTariff.amount,
        baseDurationHours,
        defaultTariff.additionalHourPrice,
        (defaultTariff.additionalDurationHours ?? 1) + ((defaultTariff.additionalDurationMinutes ?? 0) / 60),
      );

  const customCostResult = selectedCustomTariff != null
    ? (() => {
        const customBaseH = (selectedCustomTariff.rateDurationHours ?? 1) + ((selectedCustomTariff.rateDurationMinutes ?? 0) / 60);
        const customPeriodH = (selectedCustomTariff.additionalDurationHours ?? 1) + ((selectedCustomTariff.additionalDurationMinutes ?? 0) / 60);
        return calculateTwoTierCost(
          totalMinutes,
          selectedCustomTariff.amount,
          customBaseH,
          selectedCustomTariff.additionalHourPrice,
          customPeriodH,
        );
      })()
    : null;

  const parkingCost = customCostResult?.parkingCost ?? defaultCostResult.parkingCost;
  const totalWithDebt = parkingCost + (vehicle.debt || 0);

  const timeParkedLabel = `${elapsed.hours}h ${elapsed.minutes}min`;

  const handleCheckout = () => {
    const costToSend = parkingCost;
    if (paymentMethod === "debt") {
      onCheckout(0, "debt", costToSend);
    } else if (showPartial && partialAmount) {
      onCheckout(parseFloat(partialAmount), paymentMethod, costToSend);
    } else {
      onCheckout(undefined, paymentMethod, costToSend);
    }
  };

  const paymentMethods: { method: PaymentMethod; label: string; icon: React.ReactNode; show: boolean }[] = [
    { method: "cash", label: t("till.cash"), icon: <Banknote className="h-4 w-4" />, show: true },
    { method: "card", label: t("till.card"), icon: <CreditCard className="h-4 w-4" />, show: true },
    { method: "transfer", label: t("till.transfer"), icon: <ArrowRightLeft className="h-4 w-4" />, show: true },
    { method: "contract", label: t("checkout.contractAccount"), icon: <FileText className="h-4 w-4" />, show: !!activeContract },
    { method: "debt", label: t("checkout.deferDebt"), icon: <AlertTriangle className="h-4 w-4" />, show: canDebtPayment },
  ];

  const tariffKindLabels: Record<TariffKind, string> = {
    regular: t("checkout.regularTariff"),
    employee: t("checkout.employeeTariff"),
    student: t("checkout.studentTariff"),
  };

  return (
    <div className="animate-fade-in bg-card border border-border rounded-xl p-6 max-w-lg mx-auto shadow-sm">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-info/10 text-info mb-3">
          <Clock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">{t("checkout.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("common.ticket")}: <span className="font-mono font-medium">{vehicle.ticketCode}</span>
        </p>
      </div>

      <div className="bg-secondary/50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Car className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-mono font-semibold text-lg">{vehicle.plate}</p>
              <p className="text-sm text-muted-foreground">
                {vehicleLabels[vehicle.vehicleType]}
                {vehicleTariffKind !== "regular" && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    {tariffKindLabels[vehicleTariffKind]}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{t("common.time")}</p>
            <p className="font-mono font-semibold">
              {String(elapsed.hours).padStart(2, "0")}:
              {String(elapsed.minutes).padStart(2, "0")}:
              {String(elapsed.seconds).padStart(2, "0")}
            </p>
          </div>
        </div>
        {activeContract && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("checkout.contractActive")} — {activeContract.clientName}
              <span className="ml-1 font-mono">({activeContract.includedHoursPerDay}h {t("checkout.includedPerDay")})</span>
            </p>
            {contractInArrears && (
              <p className="text-xs font-medium text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {t("checkout.contractArrears")} ${activeContract.monthlyAmount.toFixed(2)} — {t("checkout.contractArrearsHint")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={selectedCustomTariff === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCustomTariff(null)}
          >
            {t("checkout.useDefaultRate")}
          </Button>
          <Button
            type="button"
            variant={selectedCustomTariff !== null ? "default" : "outline"}
            size="sm"
            onClick={() => setCustomTariffSelectorOpen(true)}
          >
            <Tag className="h-3.5 w-3.5 mr-1" />
            {t("checkout.useCustomRate")}
          </Button>
        </div>
      </div>

      <CustomTariffSelector
        open={customTariffSelectorOpen}
        onClose={() => setCustomTariffSelectorOpen(false)}
        onSelect={(selected) => {
          setSelectedCustomTariff(selected);
          setCustomTariffSelectorOpen(false);
        }}
        fixedVehicleType={vehicle.vehicleType}
        fixedPlateOrRef={vehicle.plate}
      />

      <div className="space-y-3 mb-6 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 items-baseline text-sm max-w-md">
        <span className="text-muted-foreground">{t("checkout.timeParked")}</span>
        <span className="font-mono font-medium text-right">{timeParkedLabel}</span>

        {selectedCustomTariff === null ? (
          <>
            <span className="text-muted-foreground">{t("checkout.tariff")}</span>
            <span className="font-medium text-right">
              {tariffKindLabels[vehicleTariffKind]}
            </span>

            {activeContract ? (
              <span className="text-muted-foreground col-span-2 bg-muted/50 rounded px-2 py-1.5 font-mono flex justify-between items-baseline gap-2">
                <span>{t("checkout.contractCoverage")}</span>
                <span className="font-semibold">
                  {totalMinutes <= activeContract.includedHoursPerDay * 60 + 1
                    ? t("checkout.coveredByContract")
                    : (activeContract.extraInterval ?? 0) > 0
                      ? `${(totalMinutes - activeContract.includedHoursPerDay * 60).toFixed(0)}min extra = $${parkingCost.toFixed(2)}`
                      : `${defaultCostResult.additionalHours}h × $${(defaultTariff.additionalHourPrice ?? 0).toFixed(2)} = $${parkingCost.toFixed(2)}`
                  }
                </span>
              </span>
            ) : (
              <>
                <span className="text-muted-foreground">{t("checkout.basePeriod")}</span>
                <span className="font-medium text-right">
                  {baseDurationHours}h = ${defaultTariff.amount.toFixed(2)}
                </span>
                {defaultCostResult.additionalHours > 0 && (
                  <>
                    <span className="text-muted-foreground">{t("checkout.additionalHours")}</span>
                    <span className="font-medium text-right">
                      {defaultCostResult.additionalHours}h × ${(defaultTariff.additionalHourPrice ?? 0).toFixed(2)} = ${defaultCostResult.additionalCost.toFixed(2)}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground col-span-2 bg-muted/50 rounded px-2 py-1.5 font-mono flex justify-between items-baseline gap-2">
                  <span>{t("checkout.totalFormula")}</span>
                  <span className="font-semibold">
                    ${defaultCostResult.baseCost.toFixed(2)} + ${defaultCostResult.additionalCost.toFixed(2)} = ${parkingCost.toFixed(2)}
                  </span>
                </span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="text-muted-foreground">{t("checkout.tariff")}</span>
            <span className="font-medium text-right">
              ${selectedCustomTariff.amount.toFixed(2)} / {selectedCustomTariff.rateDurationHours ?? 1}h
            </span>
            <span className="text-muted-foreground col-span-2 bg-muted/50 rounded px-2 py-1.5 font-mono flex justify-between items-baseline gap-2">
              <span>{t("checkout.tariffFormulaCustom")}</span>
              <span className="font-semibold">${parkingCost.toFixed(2)}</span>
            </span>
          </>
        )}
        <span className="text-muted-foreground">{t("checkout.parkingCost")}</span>
        <span className="font-medium text-right">${parkingCost.toFixed(2)}</span>
      </div>

      {(vehicle.debt ?? 0) > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 items-baseline text-sm text-warning mb-3 max-w-md">
          <span>{t("checkout.pendingDebt")}</span>
          <span className="font-medium text-right">+ ${(vehicle.debt ?? 0).toFixed(2)}</span>
        </div>
      )}

      <div className="border-t border-border pt-3 flex justify-between items-center max-w-md">
        <span className="font-semibold">{t("checkout.totalToPay")}</span>
        <span className="price-display text-foreground">${totalWithDebt.toFixed(2)}</span>
      </div>

      <div className="space-y-3 mb-6 mt-6">
        <Label>{t("checkout.paymentMethod")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {paymentMethods.filter((m) => m.show).map(({ method, label, icon }) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                paymentMethod === method
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-accent",
                method === "debt" && "border-warning/50"
              )}
            >
              {icon}
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {paymentMethod !== "debt" && paymentMethod !== "contract" && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowPartial(!showPartial)}
            className="text-sm text-info hover:underline"
          >
            {showPartial ? t("checkout.hidePartialPayment") : t("checkout.payPartially")}
          </button>
          {showPartial && (
            <div className="mt-3 space-y-2">
              <Label htmlFor="partial">{t("checkout.amountToPay")}</Label>
              <Input
                id="partial"
                type="number"
                step={0.01}
                inputMode="decimal"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder={`Max: $${totalWithDebt.toFixed(2)}`}
                min={0}
                max={totalWithDebt}
              />
              {partialAmount && parseFloat(partialAmount) < totalWithDebt && (
                <p className="text-xs text-warning">
                  {t("checkout.remainingDebt")} ${(totalWithDebt - parseFloat(partialAmount)).toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {paymentMethod === "debt" && (
        <div className="mb-6 p-3 rounded-lg bg-warning/10 border border-warning/30">
          <p className="text-sm text-warning">{t("checkout.deferDebtWarning")}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="coco" onClick={handleCheckout} className="flex-1">
          {paymentMethod === "debt" ? t("checkout.registerDebt") : t("checkout.charge")}
        </Button>
      </div>
    </div>
  );
};
