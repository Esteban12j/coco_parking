import { useState, useEffect } from "react";
import { Car, Bike, Truck, CircleDot, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VehicleType } from "@/types/parking";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface VehicleEntryFormProps {
  ticketCode?: string;
  existingDebt?: number;
  getPlateDebt?: (plate: string) => Promise<number>;
  registerError?: string | null;
  onSubmit: (data: {
    plate: string;
    vehicleType: VehicleType;
    observations: string;
  }) => void;
  onCancel: () => void;
}

export const VehicleEntryForm = ({
  ticketCode,
  existingDebt: initialDebt = 0,
  getPlateDebt,
  registerError,
  onSubmit,
  onCancel,
}: VehicleEntryFormProps) => {
  const { t } = useTranslation();
  const [plate, setPlate] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [observations, setObservations] = useState("");
  const [existingDebt, setExistingDebt] = useState(initialDebt);

  useEffect(() => {
    if (!getPlateDebt || plate.trim().length < 2) {
      setExistingDebt(initialDebt);
      return;
    }
    let cancelled = false;
    getPlateDebt(plate.trim()).then((debt) => {
      if (!cancelled) setExistingDebt(debt);
    });
    return () => {
      cancelled = true;
    };
  }, [plate, initialDebt, getPlateDebt]);

  const vehicleTypes: {
    type: VehicleType;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { type: "car", label: t("vehicles.car"), icon: <Car className="h-5 w-5" /> },
    { type: "motorcycle", label: t("vehicles.motorcycle"), icon: <Bike className="h-5 w-5" /> },
    { type: "truck", label: t("vehicles.truck"), icon: <Truck className="h-5 w-5" /> },
    { type: "bicycle", label: t("vehicles.bicycle"), icon: <CircleDot className="h-5 w-5" /> },
  ];

  const requiresPlate = vehicleType !== "bicycle";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresPlate && !plate.trim()) return;
    onSubmit({ plate: plate.trim().toUpperCase(), vehicleType, observations });
  };

  return (
    <div className="animate-fade-in bg-card border border-border rounded-xl p-6 max-w-lg mx-auto shadow-sm">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 text-success mb-3">
          <Car className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">{t("vehicles.registerEntry")}</h2>
        {ticketCode && (
          <p className="text-sm text-muted-foreground mt-1">
            {t("common.ticket")}: <span className="font-mono font-medium">{ticketCode}</span>
          </p>
        )}
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
            ⚠️ {t("vehicles.plateDebtWarning")} $
            {existingDebt.toFixed(2)}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="plate">{requiresPlate ? t("vehicles.vehiclePlate") : t("vehicles.vehiclePlateOptional")}</Label>
          <Input
            id="plate"
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder={requiresPlate ? "ABC-123" : t("vehicles.vehiclePlateOptional")}
            className="text-lg font-mono uppercase"
            required={requiresPlate}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("vehicles.vehicleType")}</Label>
          <div className="grid grid-cols-4 gap-2">
            {vehicleTypes.map(({ type, label, icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setVehicleType(type)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                  vehicleType === type
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card hover:bg-accent"
                )}
              >
                {icon}
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observations">{t("vehicles.observations")}</Label>
          <Textarea
            id="observations"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder={t("vehicles.observationsPlaceholder")}
            rows={2}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="coco" className="flex-1">
            {t("vehicles.registerVehicle")}
          </Button>
        </div>
      </form>
    </div>
  );
};
