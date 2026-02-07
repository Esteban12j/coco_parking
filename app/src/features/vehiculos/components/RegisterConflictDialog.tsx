import { useEffect, useState } from "react";
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
import { formatDateTime } from "@/lib/dateTime";
import { Vehicle } from "@/types/parking";
import { PendingRegisterConflict } from "@/types/parking";
import { useTranslation } from "@/i18n";

const vehicleTypeLabelKey: Record<string, string> = {
  car: "vehicles.car",
  motorcycle: "vehicles.motorcycle",
  truck: "vehicles.truck",
  bicycle: "vehicles.bicycle",
};

interface RegisterConflictDialogProps {
  pending: PendingRegisterConflict | null;
  getVehiclesByPlate: (plate: string) => Promise<Vehicle[]>;
  onDeleteAndRegister: (vehicleId: string) => void;
  onCancel: () => void;
}

export function RegisterConflictDialog({
  pending,
  getVehiclesByPlate,
  onDeleteAndRegister,
  onCancel,
}: RegisterConflictDialogProps) {
  const { t } = useTranslation();
  const [existingVehicles, setExistingVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pending?.plate) {
      setExistingVehicles([]);
      return;
    }
    setLoading(true);
    getVehiclesByPlate(pending.plate)
      .then(setExistingVehicles)
      .finally(() => setLoading(false));
  }, [pending?.plate, getVehiclesByPlate]);

  const open = !!pending;
  const newTypeKey = pending ? vehicleTypeLabelKey[pending.vehicleType] ?? pending.vehicleType : "";

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("conflicts.registerConflictTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("conflicts.registerConflictMessage")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          {pending && (
            <p className="text-sm text-muted-foreground">
              {t("conflicts.plate")}: <strong className="font-mono">{pending.plate}</strong> →{" "}
              {t("conflicts.deleteAndRegister")} ({t(newTypeKey)})
            </p>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : existingVehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron registros con esa placa. Puede cancelar e intentar de nuevo.
            </p>
          ) : (
            <ul className="space-y-2">
              {existingVehicles.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm"
                >
                  <span>
                    {t(vehicleTypeLabelKey[v.vehicleType] ?? v.vehicleType)} · {v.plate} ·{" "}
                    {formatDateTime(v.entryTime)} · {t(`conflicts.${v.status}`)}
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteAndRegister(v.id)}
                  >
                    {t("conflicts.deleteAndRegister")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("conflicts.cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
