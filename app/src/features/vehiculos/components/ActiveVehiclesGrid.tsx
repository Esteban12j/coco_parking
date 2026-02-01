import React, { useState, useEffect } from "react";
import { Car, Bike, Truck, CircleDot, Clock, AlertTriangle } from "lucide-react";
import { Vehicle, VehicleType } from "@/types/parking";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface ActiveVehiclesGridProps {
  vehicles: Vehicle[];
  onSelect: (vehicle: Vehicle) => void;
}

const vehicleIconComponents: Record<VehicleType, React.ComponentType<{ className?: string }>> = {
  car: Car,
  motorcycle: Bike,
  truck: Truck,
  bicycle: CircleDot,
};

const formatDuration = (entryTime: Date): string => {
  const now = new Date();
  const diff = now.getTime() - new Date(entryTime).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(
    (diff % (1000 * 60 * 60)) / (1000 * 60)
  );

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const ActiveVehiclesGrid = ({
  vehicles,
  onSelect,
}: ActiveVehiclesGridProps) => {
  const { t } = useTranslation();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-12">
        <Car className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">{t("vehicles.noActiveVehicles")}</p>
        <p className="text-sm text-muted-foreground/70">
          {t("vehicles.scanTicketToRegister")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {vehicles.map((vehicle) => {
        const entry = new Date(vehicle.entryTime);
        const hoursParked =
          (new Date().getTime() - entry.getTime()) / (1000 * 60 * 60);
        const isLongStay = hoursParked > 8;
        const hasDebt = (vehicle.debt || 0) > 0;

        return (
          <button
            key={vehicle.id}
            onClick={() => onSelect(vehicle)}
            className={cn(
              "relative p-4 rounded-lg border bg-card text-left transition-all hover:shadow-md hover:-translate-y-0.5",
              isLongStay ? "border-warning/50" : "border-border",
              hasDebt && "ring-2 ring-destructive/30"
            )}
          >
            <div className="mb-2 flex items-center justify-start">
              {(() => {
                const Icon = vehicleIconComponents[vehicle.vehicleType];
                return <Icon className="h-8 w-8 text-muted-foreground" />;
              })()}
            </div>
            <p className="font-mono font-semibold text-sm truncate">
              {vehicle.plate}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(vehicle.entryTime)}</span>
            </div>
            <div className="absolute top-2 right-2 flex gap-1">
              {isLongStay && (
                <span
                  className="p-1 rounded-full bg-warning/10"
                  title={t("vehicles.longStay")}
                >
                  <Clock className="h-3 w-3 text-warning" />
                </span>
              )}
              {hasDebt && (
                <span
                  className="p-1 rounded-full bg-destructive/10"
                  title={t("vehicles.hasDebt")}
                >
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
