import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dateTime";
import { Vehicle } from "@/types/parking";
import { PlateConflict } from "@/types/parking";
import { useTranslation } from "@/i18n";

const vehicleTypeLabelKey: Record<string, string> = {
  car: "vehicles.car",
  motorcycle: "vehicles.motorcycle",
  truck: "vehicles.truck",
  bicycle: "vehicles.bicycle",
};

interface PlateConflictsModalProps {
  conflicts: PlateConflict[];
  onResolve: (plate: string, keepVehicleId: string) => void;
}

export function PlateConflictsModal({ conflicts, onResolve }: PlateConflictsModalProps) {
  const { t } = useTranslation();
  const open = conflicts.length > 0;
  const current = conflicts[0];

  if (!current) return null;

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("conflicts.title")}</DialogTitle>
          <DialogDescription>{t("conflicts.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t("conflicts.conflictsRemaining")}: <strong>{conflicts.length}</strong>
          </p>
          <p className="text-sm font-medium">
            {t("conflicts.plate")}: <span className="font-mono">{current.plate}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t("conflicts.keepThisOne")}:
          </p>
          <ul className="space-y-2">
            {current.vehicles.map((v: Vehicle) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span>
                  {t(vehicleTypeLabelKey[v.vehicleType] ?? v.vehicleType)} ·{" "}
                  {formatDateTime(v.entryTime)} · {t(`conflicts.${v.status}`)}
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onResolve(current.plate, v.id)}
                >
                  {t("conflicts.keepThisOne")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
