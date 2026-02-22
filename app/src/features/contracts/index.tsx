import { useState, useEffect } from "react";
import { Search, Plus, Pencil, Trash2, FileText, Phone, Calendar, Clock, DollarSign } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslation } from "@/i18n";
import {
  listContracts,
  createContract,
  updateContract,
  deleteContract,
  suggestMonthlyAmount,
} from "@/api/contracts";
import type { Contract, VehicleType, TariffKind } from "@/types/parking";
import { toast } from "@/hooks/use-toast";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const VEHICLE_TYPE_KEYS: VehicleType[] = ["car", "motorcycle", "truck", "bicycle"];
const TARIFF_KIND_KEYS: TariffKind[] = ["employee", "student"];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

type DialogMode = "create" | "edit";

export const ContractsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tauri = isTauri();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const [formClientName, setFormClientName] = useState("");
  const [formClientPhone, setFormClientPhone] = useState("");
  const [formPlate, setFormPlate] = useState("");
  const [formVehicleType, setFormVehicleType] = useState<VehicleType>("motorcycle");
  const [formTariffKind, setFormTariffKind] = useState<TariffKind>("employee");
  const [formMonthlyAmount, setFormMonthlyAmount] = useState("");
  const [formIncludedHours, setFormIncludedHours] = useState("6");
  const [formDateFrom, setFormDateFrom] = useState("");
  const [formDateTo, setFormDateTo] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const listQuery = useQuery({
    queryKey: ["contracts", statusFilter, search],
    queryFn: () => listContracts({
      status: statusFilter === "all" ? null : statusFilter || null,
      search: search.trim() || null,
    }),
    enabled: tauri,
  });

  const suggestQuery = useQuery({
    queryKey: ["contracts_suggest_monthly", formVehicleType, formTariffKind],
    queryFn: () => suggestMonthlyAmount({
      vehicleType: formVehicleType,
      tariffKind: formTariffKind,
      days: 31,
    }),
    enabled: tauri && dialogOpen && dialogMode === "create",
  });

  useEffect(() => {
    if (dialogMode === "create" && suggestQuery.data != null && !formMonthlyAmount) {
      setFormMonthlyAmount(String(suggestQuery.data));
    }
  }, [suggestQuery.data, dialogMode, formMonthlyAmount]);

  const createMutation = useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      closeDialog();
      toast({ title: t("contracts.created") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      closeDialog();
      toast({ title: t("contracts.updated") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setDeleteId(null);
      toast({ title: t("contracts.deleted") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const contracts = (listQuery.data ?? []) as Contract[];

  const vehicleLabels: Record<VehicleType, string> = {
    car: t("checkout.car"),
    motorcycle: t("checkout.motorcycle"),
    truck: t("checkout.truck"),
    bicycle: t("checkout.bicycle"),
  };

  const tariffKindLabels: Record<string, string> = {
    employee: t("tariffs.kindEmployee"),
    student: t("tariffs.kindStudent"),
    regular: t("tariffs.kindRegular"),
  };

  function resetForm() {
    setFormClientName("");
    setFormClientPhone("");
    setFormPlate("");
    setFormVehicleType("motorcycle");
    setFormTariffKind("employee");
    setFormMonthlyAmount("");
    setFormIncludedHours("6");
    setFormDateFrom(todayStr());
    setFormDateTo(nextMonthStr());
    setFormNotes("");
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function nextMonthStr() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingContract(null);
  }

  const openCreate = () => {
    resetForm();
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openEdit = (contract: Contract) => {
    setEditingContract(contract);
    setDialogMode("edit");
    setFormClientName(contract.clientName);
    setFormClientPhone(contract.clientPhone ?? "");
    setFormPlate(contract.plate);
    setFormVehicleType((contract.vehicleType as VehicleType) || "motorcycle");
    setFormTariffKind((contract.tariffKind as TariffKind) || "employee");
    setFormMonthlyAmount(String(contract.monthlyAmount));
    setFormIncludedHours(String(contract.includedHoursPerDay));
    setFormDateFrom(contract.dateFrom);
    setFormDateTo(contract.dateTo);
    setFormNotes(contract.notes ?? "");
    setDialogOpen(true);
  };

  const handleCreate = () => {
    const amount = parseFloat(formMonthlyAmount.replace(",", "."));
    if (Number.isNaN(amount) || amount < 0) return;
    const hours = parseFloat(formIncludedHours.replace(",", "."));
    if (Number.isNaN(hours) || hours <= 0) return;
    if (!formClientName.trim() || !formPlate.trim() || !formDateFrom || !formDateTo) return;

    createMutation.mutate({
      clientName: formClientName.trim(),
      clientPhone: formClientPhone.trim() || null,
      plate: formPlate.trim().toUpperCase(),
      vehicleType: formVehicleType,
      tariffKind: formTariffKind,
      monthlyAmount: amount,
      includedHoursPerDay: hours,
      dateFrom: formDateFrom,
      dateTo: formDateTo,
      notes: formNotes.trim() || null,
    });
  };

  const handleUpdate = () => {
    if (!editingContract) return;
    const amount = parseFloat(formMonthlyAmount.replace(",", "."));
    if (Number.isNaN(amount) || amount < 0) return;
    const hours = parseFloat(formIncludedHours.replace(",", "."));
    if (Number.isNaN(hours) || hours <= 0) return;

    updateMutation.mutate({
      id: editingContract.id,
      clientName: formClientName.trim() || null,
      clientPhone: formClientPhone.trim() || null,
      monthlyAmount: amount,
      includedHoursPerDay: hours,
      dateFrom: formDateFrom || null,
      dateTo: formDateTo || null,
      notes: formNotes.trim() || null,
    });
  };

  const isFormValid = () => {
    const amount = parseFloat(formMonthlyAmount.replace(",", "."));
    const hours = parseFloat(formIncludedHours.replace(",", "."));
    return (
      formClientName.trim().length > 0 &&
      formPlate.trim().length > 0 &&
      !Number.isNaN(amount) && amount >= 0 &&
      !Number.isNaN(hours) && hours > 0 &&
      !!formDateFrom && !!formDateTo
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader title={t("contracts.title")} subtitle={t("contracts.subtitle")} />

      {tauri && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("contracts.allContracts")}
            </CardTitle>
            <CardDescription>{t("contracts.allContractsNote")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("contracts.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("contracts.statusActive")}</SelectItem>
                  <SelectItem value="expired">{t("contracts.statusExpired")}</SelectItem>
                  <SelectItem value="cancelled">{t("contracts.statusCancelled")}</SelectItem>
                  <SelectItem value="all">{t("contracts.statusAll")}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="coco" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t("contracts.addContract")}
              </Button>
            </div>

            {listQuery.isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : contracts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("contracts.noResults")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("contracts.clientName")}</TableHead>
                      <TableHead>{t("contracts.plate")}</TableHead>
                      <TableHead>{t("conflicts.vehicleType")}</TableHead>
                      <TableHead>{t("tariffs.tariffKind")}</TableHead>
                      <TableHead className="text-right">{t("contracts.monthlyAmount")}</TableHead>
                      <TableHead>{t("contracts.includedHours")}</TableHead>
                      <TableHead>{t("contracts.period")}</TableHead>
                      <TableHead>{t("contracts.status")}</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">
                          <div>
                            <span>{contract.clientName}</span>
                            {contract.clientPhone && (
                              <span className="block text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" />
                                {contract.clientPhone}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-medium">{contract.plate}</TableCell>
                        <TableCell>{vehicleLabels[contract.vehicleType as VehicleType] ?? contract.vehicleType}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            contract.tariffKind === "employee"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                              : "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200"
                          }>
                            {tariffKindLabels[contract.tariffKind] ?? contract.tariffKind}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${contract.monthlyAmount.toLocaleString("en", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {contract.includedHoursPerDay}h/{t("contracts.day")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(contract.dateFrom)} — {formatDate(contract.dateTo)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[contract.status] ?? ""}>
                            {contract.status === "active" ? t("contracts.statusActive") :
                             contract.status === "expired" ? t("contracts.statusExpired") :
                             t("contracts.statusCancelled")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(contract)} aria-label={t("tariffs.edit")}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(contract.id)} aria-label={t("tariffs.delete")}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? t("contracts.addContract") : t("contracts.editContract")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("contracts.clientName")}</Label>
                <Input
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder={t("contracts.clientNamePlaceholder")}
                  disabled={dialogMode === "edit"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("contracts.clientPhone")}</Label>
                <Input
                  value={formClientPhone}
                  onChange={(e) => setFormClientPhone(e.target.value)}
                  placeholder="300 123 4567"
                  type="tel"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("contracts.plate")}</Label>
              <Input
                value={formPlate}
                onChange={(e) => setFormPlate(e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className="font-mono uppercase"
                disabled={dialogMode === "edit"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("conflicts.vehicleType")}</Label>
                <Select
                  value={formVehicleType}
                  onValueChange={(v) => {
                    setFormVehicleType(v as VehicleType);
                    setFormMonthlyAmount("");
                  }}
                  disabled={dialogMode === "edit"}
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
              </div>
              <div className="space-y-1.5">
                <Label>{t("tariffs.tariffKind")}</Label>
                <Select
                  value={formTariffKind}
                  onValueChange={(v) => {
                    setFormTariffKind(v as TariffKind);
                    setFormMonthlyAmount("");
                  }}
                  disabled={dialogMode === "edit"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARIFF_KIND_KEYS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {tariffKindLabels[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  {t("contracts.monthlyAmount")}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formMonthlyAmount}
                  onChange={(e) => setFormMonthlyAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                />
                {dialogMode === "create" && suggestQuery.data != null && (
                  <p className="text-xs text-muted-foreground">
                    {t("contracts.suggestedAmount")}: ${suggestQuery.data.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {t("contracts.includedHoursPerDay")}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  value={formIncludedHours}
                  onChange={(e) => setFormIncludedHours(e.target.value)}
                  placeholder="6"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("contracts.dateFrom")}
                </Label>
                <Input
                  type="date"
                  value={formDateFrom}
                  onChange={(e) => setFormDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("contracts.dateTo")}
                </Label>
                <Input
                  type="date"
                  value={formDateTo}
                  onChange={(e) => setFormDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("contracts.notes")}</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={t("contracts.notesPlaceholder")}
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="coco"
              onClick={dialogMode === "create" ? handleCreate : handleUpdate}
              disabled={
                !isFormValid() ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {(createMutation.isPending || updateMutation.isPending)
                ? t("common.loading")
                : t("tariffs.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("contracts.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("contracts.confirmDeleteDescription")}</AlertDialogDescription>
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
