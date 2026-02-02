import { useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/i18n";
import { invokeTauri } from "@/lib/tauriInvoke";
import { CustomTariff, TariffRateUnit } from "@/types/parking";
import type { VehicleType } from "@/types/parking";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const VEHICLE_TYPE_KEYS: VehicleType[] = ["car", "motorcycle", "truck", "bicycle"];

export interface SelectedTariffForCheckout {
  amount: number;
  rateDurationHours: number;
  rateDurationMinutes: number;
}

interface CustomTariffSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (selected: SelectedTariffForCheckout) => void;
  /** When set (e.g. from checkout), only tariffs for this vehicle type are shown/selectable and create form uses this type. */
  fixedVehicleType?: VehicleType;
  /** When set (e.g. from checkout), create form plate field is pre-filled with this value. */
  fixedPlateOrRef?: string;
}

export const CustomTariffSelector = ({
  open,
  onClose,
  onSelect,
  fixedVehicleType,
  fixedPlateOrRef,
}: CustomTariffSelectorProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tauri = isTauri();
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createVehicleType, setCreateVehicleType] = useState<VehicleType>(fixedVehicleType ?? "car");
  const [createName, setCreateName] = useState("");
  const [createPlateOrRef, setCreatePlateOrRef] = useState(fixedPlateOrRef ?? "");
  const [createDescription, setCreateDescription] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createRateUnit, setCreateRateUnit] = useState<TariffRateUnit>("hour");
  const [createDurationHours, setCreateDurationHours] = useState<string>("1");
  const [createDurationMinutes, setCreateDurationMinutes] = useState<string>("0");

  useEffect(() => {
    if (open) {
      if (fixedVehicleType != null) {
        setCreateVehicleType(fixedVehicleType);
      }
      setCreatePlateOrRef(fixedPlateOrRef ?? "");
    }
  }, [open, fixedVehicleType, fixedPlateOrRef]);

  const listQuery = useQuery({
    queryKey: ["custom_tariffs", search],
    queryFn: () =>
      invokeTauri<CustomTariff[]>("custom_tariffs_list", {
        search: search.trim() || null,
      }),
    enabled: tauri && open,
  });

  const createMutation = useMutation({
    mutationFn: (args: {
      vehicleType: string;
      name?: string | null;
      plateOrRef?: string | null;
      amount: number;
      description?: string | null;
      rateUnit?: TariffRateUnit | null;
      rateDurationHours?: number;
      rateDurationMinutes?: number;
    }) =>
      invokeTauri<CustomTariff>("custom_tariffs_create", {
        args: {
          vehicleType: args.vehicleType,
          name: args.name?.trim() || null,
          plateOrRef: args.plateOrRef?.trim() || null,
          amount: args.amount,
          description: args.description ?? null,
          rateUnit: args.rateUnit ?? "hour",
          rateDurationHours: args.rateDurationHours ?? 1,
          rateDurationMinutes: args.rateDurationMinutes ?? 0,
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["custom_tariffs"] });
      setShowCreateForm(false);
      setCreateVehicleType(fixedVehicleType ?? "car");
      setCreateName("");
      setCreatePlateOrRef(fixedPlateOrRef ?? "");
      setCreateDescription("");
      setCreateAmount("");
      setCreateRateUnit("hour");
      setCreateDurationHours("1");
      setCreateDurationMinutes("0");
      const h = data.rateDurationHours ?? 1;
      const m = data.rateDurationMinutes ?? 0;
      onSelect({
        amount: data.amount,
        rateDurationHours: h,
        rateDurationMinutes: m,
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: t("customTariff.createError"),
        description: String(err),
        variant: "destructive",
      });
    },
  });

  const allItems = (listQuery.data ?? []) as CustomTariff[];
  const items =
    fixedVehicleType != null
      ? allItems.filter((t) => t.vehicleType === fixedVehicleType)
      : allItems;

  const vehicleLabels: Record<VehicleType, string> = {
    car: t("checkout.car"),
    motorcycle: t("checkout.motorcycle"),
    truck: t("checkout.truck"),
    bicycle: t("checkout.bicycle"),
  };

  const handleSelect = (tariff: CustomTariff) => {
    const h = tariff.rateDurationHours ?? 1;
    const m = tariff.rateDurationMinutes ?? 0;
    onSelect({
      amount: tariff.amount,
      rateDurationHours: h,
      rateDurationMinutes: m,
    });
    onClose();
  };

  const durationBlockLabel = (h: number | null | undefined, m: number | null | undefined) => {
    const hours = h ?? 0;
    const mins = m ?? 0;
    if (hours === 0 && mins === 0) return "1h";
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}min`);
    return parts.join(" ") || "1h";
  };

  const effectiveCreateVehicleType = fixedVehicleType ?? createVehicleType;

  const handleCreateAndApply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const amountRaw = createAmount.replace(",", ".").trim();
    const amount = parseFloat(amountRaw);
    if (amountRaw === "" || Number.isNaN(amount) || amount < 0) return;
    if (tauri) {
      const h = Math.max(0, parseInt(createDurationHours, 10) || 0);
      const m = Math.max(0, Math.min(59, parseInt(createDurationMinutes, 10) || 0));
      const blockH = h > 0 || m > 0 ? h : 1;
      const blockM = h > 0 || m > 0 ? m : 0;
      createMutation.mutate({
        vehicleType: effectiveCreateVehicleType,
        name: createName.trim() || null,
        plateOrRef: createPlateOrRef.trim() || null,
        amount,
        description: createDescription.trim() || null,
        rateUnit: createRateUnit,
        rateDurationHours: blockH,
        rateDurationMinutes: blockM,
      });
    } else {
      const h = Math.max(0, parseInt(createDurationHours, 10) || 0);
      const m = Math.max(0, Math.min(59, parseInt(createDurationMinutes, 10) || 0));
      const blockH = h > 0 || m > 0 ? h : 1;
      const blockM = h > 0 || m > 0 ? m : 0;
      onSelect({
        amount,
        rateDurationHours: blockH,
        rateDurationMinutes: blockM,
      });
      setCreateAmount("");
      setCreateRateUnit("hour");
      setCreateDurationHours("1");
      setCreateDurationMinutes("0");
      setShowCreateForm(false);
      onClose();
    }
  };

  const canCreate =
    createAmount.trim() !== "" &&
    !Number.isNaN(parseFloat(createAmount.replace(",", "."))) &&
    parseFloat(createAmount.replace(",", ".")) >= 0;

  const nameDisplay = (tariff: CustomTariff) =>
    tariff.name?.trim() || tariff.plateOrRef?.trim() || t("tariffs.defaultLabel");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("customTariff.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {tauri && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("customTariff.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              {listQuery.isLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : items.length === 0 && !showCreateForm ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  {fixedVehicleType != null
                    ? t("customTariff.noResultsForType").replace(
                        "{{type}}",
                        vehicleLabels[fixedVehicleType]
                      )
                    : t("customTariff.noResults")}
                </p>
              ) : items.length > 0 ? (
                <ScrollArea className="max-h-[180px] rounded-md border border-border">
                  <ul className="p-2 space-y-1">
                    {items.map((tariff) => (
                      <li key={tariff.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(tariff)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm",
                            "hover:bg-accent transition-colors"
                          )}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground shrink-0">
                              {vehicleLabels[tariff.vehicleType as VehicleType] ?? tariff.vehicleType}
                            </span>
                            <span className="font-medium truncate">
                              {nameDisplay(tariff)}
                            </span>
                          </span>
                          <span className="font-medium shrink-0">
                            ${tariff.amount.toFixed(2)} / {durationBlockLabel(tariff.rateDurationHours, tariff.rateDurationMinutes)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : null}
            </>
          )}
          {showCreateForm ? (
            <form
              onSubmit={handleCreateAndApply}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              {fixedVehicleType == null ? (
                <>
                  <Label>{t("conflicts.vehicleType")}</Label>
                  <Select
                    value={createVehicleType}
                    onValueChange={(v) => setCreateVehicleType(v as VehicleType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPE_KEYS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {vehicleLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("conflicts.vehicleType")}: {vehicleLabels[fixedVehicleType]}
                </p>
              )}
              <Label>{t("customTariff.name")}</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t("customTariff.namePlaceholder")}
              />
              <Label>{t("customTariff.plateOrRef")} ({t("tariffs.optional")})</Label>
              <Input
                value={createPlateOrRef}
                onChange={(e) => setCreatePlateOrRef(e.target.value)}
                placeholder={t("customTariff.plateOrRef")}
                className="font-mono"
                disabled={!tauri}
              />
              <Label>{t("customTariff.description")}</Label>
              <Input
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder={t("customTariff.description")}
              />
              <Label>{t("customTariff.amount")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <Label>{t("customTariff.rateUnit")}</Label>
              <Select
                value={createRateUnit}
                onValueChange={(v) => setCreateRateUnit(v as TariffRateUnit)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">{t("customTariff.rateUnitHour")}</SelectItem>
                  <SelectItem value="minute">{t("customTariff.rateUnitMinute")}</SelectItem>
                </SelectContent>
              </Select>
              <Label>{t("customTariff.durationBlock")}</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min={0}
                  value={createDurationHours}
                  onChange={(e) => setCreateDurationHours(e.target.value)}
                  placeholder="0"
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{t("customTariff.durationHours")}</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={createDurationMinutes}
                  onChange={(e) => setCreateDurationMinutes(e.target.value)}
                  placeholder="0"
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{t("customTariff.durationMinutes")}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateVehicleType(fixedVehicleType ?? "car");
                    setCreateName("");
                  setCreatePlateOrRef(fixedPlateOrRef ?? "");
                  setCreateDescription("");
                  setCreateAmount("");
                  setCreateRateUnit("hour");
                  setCreateDurationHours("1");
                  setCreateDurationMinutes("0");
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="coco"
                  disabled={!canCreate || createMutation.isPending}
                >
                  {createMutation.isPending
                    ? t("common.loading")
                    : t("customTariff.createAndApply")}
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("customTariff.createHere")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
