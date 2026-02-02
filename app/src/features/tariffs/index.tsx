import { useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { invokeTauri } from "@/lib/tauriInvoke";
import { CustomTariff } from "@/types/parking";
import { VehicleType } from "@/types/parking";
import { toast } from "@/hooks/use-toast";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const VEHICLE_TYPE_KEYS: VehicleType[] = ["car", "motorcycle", "truck", "bicycle"];

export const TariffsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tauri = isTauri();
  const [search, setSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTariff, setEditingTariff] = useState<CustomTariff | null>(null);
  const [formVehicleType, setFormVehicleType] = useState<VehicleType>("car");
  const [formName, setFormName] = useState("");
  const [formPlateOrRef, setFormPlateOrRef] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");

  const listQuery = useQuery({
    queryKey: ["custom_tariffs", search],
    queryFn: () =>
      invokeTauri<CustomTariff[]>("custom_tariffs_list", {
        search: search.trim() || null,
      }),
    enabled: tauri,
  });

  const createMutation = useMutation({
    mutationFn: (args: {
      vehicleType: string;
      name?: string | null;
      plateOrRef?: string | null;
      amount: number;
      description?: string | null;
    }) =>
      invokeTauri<CustomTariff>("custom_tariffs_create", {
        vehicleType: args.vehicleType,
        name: args.name?.trim() || null,
        plateOrRef: args.plateOrRef?.trim() || null,
        amount: args.amount,
        description: args.description ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_tariffs"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: t("tariffs.updated") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: {
      id: string;
      vehicleType?: string | null;
      name?: string | null;
      plateOrRef?: string | null;
      amount?: number;
      description?: string | null;
    }) =>
      invokeTauri<CustomTariff>("custom_tariffs_update", {
        id: args.id,
        vehicleType: args.vehicleType ?? null,
        name: args.name?.trim() || null,
        plateOrRef: args.plateOrRef?.trim() || null,
        amount: args.amount ?? null,
        description: args.description ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_tariffs"] });
      setEditDialogOpen(false);
      setEditingTariff(null);
      toast({ title: t("tariffs.updated") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invokeTauri<undefined>("custom_tariffs_delete", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_tariffs"] });
      setDeleteId(null);
      toast({ title: t("tariffs.deleted") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const customTariffs = (listQuery.data ?? []) as CustomTariff[];

  const vehicleLabels: Record<VehicleType, string> = {
    car: t("checkout.car"),
    motorcycle: t("checkout.motorcycle"),
    truck: t("checkout.truck"),
    bicycle: t("checkout.bicycle"),
  };

  function resetForm() {
    setFormVehicleType("car");
    setFormName("");
    setFormPlateOrRef("");
    setFormDescription("");
    setFormAmount("");
  }

  const openEdit = (tariff: CustomTariff) => {
    setEditingTariff(tariff);
    setFormVehicleType((tariff.vehicleType as VehicleType) || "car");
    setFormName(tariff.name ?? "");
    setFormPlateOrRef(tariff.plateOrRef ?? "");
    setFormDescription(tariff.description ?? "");
    setFormAmount(String(tariff.amount));
    setEditDialogOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingTariff) return;
    const amount = parseFloat(String(formAmount).replace(",", "."));
    if (Number.isNaN(amount) || amount < 0) return;
    updateMutation.mutate({
      id: editingTariff.id,
      vehicleType: formVehicleType,
      name: formName.trim() || null,
      plateOrRef: formPlateOrRef.trim() || null,
      amount,
      description: formDescription.trim() || null,
    });
  };

  const handleCreate = () => {
    const amount = parseFloat(String(formAmount).replace(",", "."));
    if (Number.isNaN(amount) || amount < 0) return;
    createMutation.mutate({
      vehicleType: formVehicleType,
      name: formName.trim() || null,
      plateOrRef: formPlateOrRef.trim() || null,
      amount,
      description: formDescription.trim() || null,
    });
  };

  const nameDisplay = (tariff: CustomTariff) =>
    tariff.name?.trim() || tariff.plateOrRef?.trim() || t("tariffs.defaultLabel");

  const isFormValid =
    formAmount.trim() !== "" &&
    !Number.isNaN(parseFloat(String(formAmount).replace(",", "."))) &&
    parseFloat(String(formAmount).replace(",", ".")) >= 0;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("tariffs.title")}</h1>
        <p className="text-muted-foreground">{t("tariffs.subtitle")}</p>
      </div>

      {tauri && (
        <Card>
          <CardHeader>
            <CardTitle>{t("tariffs.allRates")}</CardTitle>
            <CardDescription>{t("tariffs.allRatesNote")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("customTariff.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <Button variant="coco" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t("tariffs.addTariff")}
              </Button>
            </div>
            {listQuery.isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : customTariffs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("customTariff.noResults")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("conflicts.vehicleType")}</TableHead>
                    <TableHead>{t("customTariff.name")}</TableHead>
                    <TableHead>{t("customTariff.plateOrRef")}</TableHead>
                    <TableHead>{t("customTariff.description")}</TableHead>
                    <TableHead className="text-right">{t("customTariff.amount")}</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customTariffs.map((tariff) => (
                    <TableRow key={tariff.id}>
                      <TableCell>{vehicleLabels[tariff.vehicleType as VehicleType] ?? tariff.vehicleType}</TableCell>
                      <TableCell className="font-medium">{nameDisplay(tariff)}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{tariff.plateOrRef?.trim() || "—"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {tariff.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${tariff.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(tariff)}
                            aria-label={t("tariffs.edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(tariff.id)}
                            aria-label={t("tariffs.delete")}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tariffs.addTariff")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t("conflicts.vehicleType")}</Label>
            <Select
              value={formVehicleType}
              onValueChange={(v) => setFormVehicleType(v as VehicleType)}
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
            <Label>{t("customTariff.name")}</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t("customTariff.namePlaceholder")}
            />
            <Label>{t("customTariff.plateOrRef")} ({t("tariffs.optional")})</Label>
            <Input
              value={formPlateOrRef}
              onChange={(e) => setFormPlateOrRef(e.target.value)}
              placeholder={t("customTariff.plateOrRef")}
              className="font-mono"
            />
            <Label>{t("customTariff.description")}</Label>
            <Input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={t("customTariff.description")}
            />
            <Label>{t("customTariff.amount")}</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="coco"
                onClick={handleCreate}
                disabled={!isFormValid || createMutation.isPending}
              >
                {createMutation.isPending ? t("common.loading") : t("tariffs.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tariffs.edit")}</DialogTitle>
          </DialogHeader>
          {editingTariff && (
            <div className="space-y-3">
              <Label>{t("conflicts.vehicleType")}</Label>
              <Select
                value={formVehicleType}
                onValueChange={(v) => setFormVehicleType(v as VehicleType)}
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
              <Label>{t("customTariff.name")}</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("customTariff.namePlaceholder")}
              />
              <Label>{t("customTariff.plateOrRef")} ({t("tariffs.optional")})</Label>
              <Input
                value={formPlateOrRef}
                onChange={(e) => setFormPlateOrRef(e.target.value)}
                placeholder={t("customTariff.plateOrRef")}
                className="font-mono"
              />
              <Label>{t("customTariff.description")}</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("customTariff.description")}
              />
              <Label>{t("customTariff.amount")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="coco"
                  onClick={handleSaveEdit}
                  disabled={!isFormValid || updateMutation.isPending}
                >
                  {updateMutation.isPending ? t("common.loading") : t("tariffs.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tariffs.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("common.loading") : t("tariffs.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
