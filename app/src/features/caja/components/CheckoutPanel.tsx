import { useState, useEffect } from "react";
import {
  Clock,
  Car,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Vehicle, VehicleType } from "@/types/parking";
import { SelectedTariffForCheckout } from "./CustomTariffSelector";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { getDefaultRate } from "@/lib/defaultRates";
import { useDefaultRates } from "@/hooks/useDefaultRates";
import { CustomTariffSelector } from "./CustomTariffSelector";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

interface CheckoutPanelProps {
  vehicle: Vehicle;
  onCheckout: (
    partialPayment?: number,
    paymentMethod?: "cash" | "card" | "transfer",
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
  const { rates: defaultRates } = useDefaultRates();
  const hourlyRate =
    tauri && defaultRates?.[vehicle.vehicleType] != null
      ? defaultRates[vehicle.vehicleType]
      : getDefaultRate(vehicle.vehicleType);
  const vehicleLabels: Record<VehicleType, string> = {
    car: t("checkout.car"),
    motorcycle: t("checkout.motorcycle"),
    truck: t("checkout.truck"),
    bicycle: t("checkout.bicycle"),
  };
  const [elapsed, setElapsed] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "transfer"
  >("cash");
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [showPartial, setShowPartial] = useState(false);
  const [selectedCustomTariff, setSelectedCustomTariff] = useState<SelectedTariffForCheckout | null>(null);
  const [customTariffSelectorOpen, setCustomTariffSelectorOpen] = useState(false);

  useEffect(() => {
    const calculateElapsed = () => {
      const now = new Date();
      const entry = new Date(vehicle.entryTime);
      const diff = now.getTime() - entry.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor(
        (diff % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setElapsed({ hours, minutes, seconds });
    };
    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [vehicle.entryTime]);

  const totalMinutes = elapsed.hours * 60 + elapsed.minutes;
  const hoursCharged = Math.max(1, Math.ceil(totalMinutes / 60));
  const defaultParkingCost = hoursCharged * hourlyRate;
  const blockMinutes =
    selectedCustomTariff != null
      ? Math.max(
          1,
          (selectedCustomTariff.rateDurationHours ?? 0) * 60 +
            (selectedCustomTariff.rateDurationMinutes ?? 0)
        )
      : 0;
  const parkingCost =
    selectedCustomTariff != null && blockMinutes > 0
      ? Math.ceil(totalMinutes / blockMinutes) * selectedCustomTariff.amount
      : defaultParkingCost;
  const totalWithDebt = parkingCost + (vehicle.debt || 0);

  const handleCheckout = () => {
    const costToSend = selectedCustomTariff != null ? parkingCost : undefined;
    if (showPartial && partialAmount) {
      onCheckout(parseFloat(partialAmount), paymentMethod, costToSend);
    } else {
      onCheckout(undefined, paymentMethod, costToSend);
    }
  };

  return (
    <div className="animate-fade-in bg-card border border-border rounded-xl p-6 max-w-lg mx-auto shadow-sm">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-info/10 text-info mb-3">
          <Clock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">{t("checkout.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("common.ticket")}:{" "}
          <span className="font-mono font-medium">{vehicle.ticketCode}</span>
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
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {t("checkout.useDefaultRate")}
          </span>
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
          {selectedCustomTariff != null && (() => {
            const h = selectedCustomTariff.rateDurationHours ?? 0;
            const m = selectedCustomTariff.rateDurationMinutes ?? 0;
            const parts: string[] = [];
            if (h > 0) parts.push(`${h}h`);
            if (m > 0) parts.push(`${m}min`);
            const blockLabel = parts.length > 0 ? parts.join(" ") : "1h";
            return (
              <span className="text-sm font-medium">
                ${selectedCustomTariff.amount.toFixed(2)} / {blockLabel} → ${parkingCost.toFixed(2)}
              </span>
            );
          })()}
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
      <div className="space-y-3 mb-6">
        {selectedCustomTariff === null && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("checkout.hourlyRate")}</span>
              <span className="font-medium">${hourlyRate.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("checkout.hoursCharged")}</span>
              <span className="font-medium">
                {hoursCharged} hr{hoursCharged > 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("checkout.parkingCost")}</span>
          <span className="font-medium">${parkingCost.toFixed(2)}</span>
        </div>
        {vehicle.debt && vehicle.debt > 0 && (
          <div className="flex justify-between text-sm text-warning">
            <span>{t("checkout.pendingDebt")}</span>
            <span className="font-medium">+ ${vehicle.debt.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-border pt-3">
          <div className="flex justify-between items-center">
            <span className="font-semibold">{t("checkout.totalToPay")}</span>
            <span className="price-display text-foreground">
              ${totalWithDebt.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <Label>{t("checkout.paymentMethod")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              method: "cash" as const,
              label: t("till.cash"),
              icon: <Banknote className="h-4 w-4" />,
            },
            {
              method: "card" as const,
              label: t("till.card"),
              icon: <CreditCard className="h-4 w-4" />,
            },
            {
              method: "transfer" as const,
              label: t("till.transfer"),
              icon: <ArrowRightLeft className="h-4 w-4" />,
            },
          ].map(({ method, label, icon }) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                paymentMethod === method
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-accent"
              )}
            >
              {icon}
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

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
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              placeholder={`Max: $${totalWithDebt.toFixed(2)}`}
              min={0}
              max={totalWithDebt}
            />
            {partialAmount &&
              parseFloat(partialAmount) < totalWithDebt && (
                <p className="text-xs text-warning">
                  {t("checkout.remainingDebt")} $
                  {(
                    totalWithDebt - parseFloat(partialAmount)
                  ).toFixed(2)}
                </p>
              )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          variant="coco"
          onClick={handleCheckout}
          className="flex-1"
        >
          {t("checkout.charge")}
        </Button>
      </div>
    </div>
  );
};
