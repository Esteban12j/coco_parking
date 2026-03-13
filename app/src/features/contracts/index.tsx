import { useState, useEffect } from "react";
import { Search, Plus, Pencil, Trash2, FileText, Phone, Calendar, Clock, DollarSign, AlertTriangle, CreditCard, ChevronDown } from "lucide-react";
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
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslation } from "@/i18n";
import {
  listContracts,
  createContract,
  updateContract,
  deleteContract,
  suggestMonthlyAmount,
  recordContractPayment,
  listContractPayments,
} from "@/api/contracts";
import type { Contract, VehicleType, TariffKind } from "@/types/parking";
import { toast } from "@/hooks/use-toast";
import { getContractStatus, isContractInArrears } from "@/lib/contractCharge";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const VEHICLE_TYPE_KEYS: VehicleType[] = ["car", "motorcycle", "truck", "bicycle"];
const TARIFF_KIND_KEYS: TariffKind[] = ["employee", "student"];

const BILLING_PERIOD_OPTIONS = [
  { days: 7,   key: "billingPeriod7" },
  { days: 15,  key: "billingPeriod15" },
  { days: 30,  key: "billingPeriod30" },
  { days: 90,  key: "billingPeriod90" },
  { days: 365, key: "billingPeriod365" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  arrears: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
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
  const [editingContractHasPayments, setEditingContractHasPayments] = useState(false);
  const [paymentContract, setPaymentContract] = useState<Contract | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");

  const [formClientName, setFormClientName] = useState("");
  const [formClientPhone, setFormClientPhone] = useState("");
  const [formPlate, setFormPlate] = useState("");
  const [formVehicleType, setFormVehicleType] = useState<VehicleType>("motorcycle");
  const [formTariffKind, setFormTariffKind] = useState<string>("employee");
  const [formMonthlyAmount, setFormMonthlyAmount] = useState("");
  const [formIncludedHours, setFormIncludedHours] = useState("6");
  const [formDateFrom, setFormDateFrom] = useState("");
  const [formDateTo, setFormDateTo] = useState("");
  const [formBillingPeriodDays, setFormBillingPeriodDays] = useState("30");
  const [formNotes, setFormNotes] = useState("");
  const [formExtraChargeFirst, setFormExtraChargeFirst] = useState("");
  const [formExtraChargeRepeat, setFormExtraChargeRepeat] = useState("");
  const [formExtraInterval, setFormExtraInterval] = useState("");
  const [extraChargesOpen, setExtraChargesOpen] = useState(false);

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
      tariffKind: formTariffKind !== "none" ? formTariffKind as TariffKind : null,
      days: 31,
    }),
    enabled: tauri && dialogOpen && dialogMode === "create" && formTariffKind !== "none",
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

  const paymentMutation = useMutation({
    mutationFn: recordContractPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setPaymentContract(null);
      toast({ title: t("contracts.chargeSuccess") });
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const contracts = (listQuery.data ?? []) as Contract[];
  const today = new Date();

  const contractsDue = contracts.filter((c) => isContractInArrears(c, today));
  const contractsUpcoming = contracts.filter((c) => {
    if (isContractInArrears(c, today) || c.status === "cancelled") return false;
    const dateTo = new Date(c.dateTo + "T00:00:00");
    const diffDays = (dateTo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  });

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
    setFormTariffKind("none");
    setFormMonthlyAmount("");
    setFormIncludedHours("6");
    setFormDateFrom(todayStr());
    setFormBillingPeriodDays("30");
    setFormDateTo(computeNextCutDate(todayStr(), 30));
    setFormNotes("");
    setFormExtraChargeFirst("");
    setFormExtraChargeRepeat("");
    setFormExtraInterval("");
    setExtraChargesOpen(false);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function nextMonthStr() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  function computeNextCutDate(dateFrom: string, days: number): string {
    if (!dateFrom) return "";
    const d = new Date(dateFrom + "T00:00:00");
    d.setDate(d.getDate() + days);
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

  const openEdit = async (contract: Contract) => {
    setEditingContract(contract);
    setDialogMode("edit");
    setEditingContractHasPayments(false);
    if (tauri) {
      try {
        const payments = await listContractPayments(contract.id);
        setEditingContractHasPayments((payments ?? []).length > 0);
      } catch {
        // si falla, el backend lo bloqueará igualmente
      }
    }
    setFormClientName(contract.clientName);
    setFormClientPhone(contract.clientPhone ?? "");
    setFormPlate(contract.plate);
    setFormVehicleType((contract.vehicleType as VehicleType) || "motorcycle");
    // Legacy contracts may have stored "employee" as placeholder when extra charges were intended.
    // If the contract has extra charge fields set, treat it as "none" (manual rate mode).
    const hasExtraCharges =
      contract.extraChargeFirst != null ||
      contract.extraChargeRepeat != null ||
      contract.extraInterval != null;
    setFormTariffKind(hasExtraCharges ? "none" : (contract.tariffKind || "none"));
    setFormMonthlyAmount(String(contract.monthlyAmount));
    setFormIncludedHours(String(contract.includedHoursPerDay));
    setFormDateFrom(contract.dateFrom);
    setFormDateTo(contract.dateTo);
    setFormBillingPeriodDays(String(contract.billingPeriodDays ?? 30));
    setFormNotes(contract.notes ?? "");
    setFormExtraChargeFirst(contract.extraChargeFirst != null ? String(contract.extraChargeFirst) : "");
    setFormExtraChargeRepeat(contract.extraChargeRepeat != null ? String(contract.extraChargeRepeat) : "");
    setFormExtraInterval(contract.extraInterval != null ? String(contract.extraInterval) : "");
    setExtraChargesOpen(contract.extraChargeFirst != null || contract.extraChargeRepeat != null || contract.extraInterval != null);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    const amount = parseFloat(formMonthlyAmount.replace(",", "."));
    if (Number.isNaN(amount) || amount < 0) return;
    const hours = parseFloat(formIncludedHours.replace(",", "."));
    if (Number.isNaN(hours) || hours <= 0) return;
    if (!formClientName.trim() || !formPlate.trim() || !formDateFrom) return;

    const hasTariff = formTariffKind !== "none";
    const extraFirst = !hasTariff && formExtraChargeFirst ? parseFloat(formExtraChargeFirst) : null;
    const extraRepeat = !hasTariff && formExtraChargeRepeat ? parseFloat(formExtraChargeRepeat) : null;
    const extraInterval = !hasTariff && formExtraInterval ? parseInt(formExtraInterval) : null;

    createMutation.mutate({
      clientName: formClientName.trim(),
      clientPhone: formClientPhone.trim() || null,
      plate: formPlate.trim().toUpperCase(),
      vehicleType: formVehicleType,
      tariffKind: hasTariff ? formTariffKind as TariffKind : null,
      monthlyAmount: amount,
      includedHoursPerDay: hours,
      dateFrom: formDateFrom,
      billingPeriodDays: parseInt(formBillingPeriodDays) || 30,
      notes: formNotes.trim() || null,
      extraChargeFirst: extraFirst,
      extraChargeRepeat: extraRepeat,
      extraInterval: extraInterval,
    });
  };

  const handleUpdate = () => {
    if (!editingContract) return;
    const amount = parseFloat(formMonthlyAmount.replace(",", "."));
    if (Number.isNaN(amount) || amount < 0) return;
    const hours = parseFloat(formIncludedHours.replace(",", "."));
    if (Number.isNaN(hours) || hours <= 0) return;

    const hasTariff = formTariffKind !== "none";
    const extraFirst = !hasTariff && formExtraChargeFirst ? parseFloat(formExtraChargeFirst) : null;
    const extraRepeat = !hasTariff && formExtraChargeRepeat ? parseFloat(formExtraChargeRepeat) : null;
    const extraInterval = !hasTariff && formExtraInterval ? parseInt(formExtraInterval) : null;

    updateMutation.mutate({
      id: editingContract.id,
      clientName: formClientName.trim() || null,
      clientPhone: formClientPhone.trim() || null,
      monthlyAmount: amount,
      includedHoursPerDay: hours,
      dateFrom: formDateFrom || null,
      dateTo: formDateTo || null,
      billingPeriodDays: parseInt(formBillingPeriodDays) || 30,
      notes: formNotes.trim() || null,
      extraChargeFirst: extraFirst,
      extraChargeRepeat: extraRepeat,
      extraInterval: extraInterval,
    });
  };

  const handleRecordPayment = () => {
    if (!paymentContract) return;
    paymentMutation.mutate({
      contractId: paymentContract.id,
      method: paymentMethod,
      amount: paymentContract.monthlyAmount,
    });
  };

  const isFormValid = () => {
    const amount = parseFloat(formMonthlyAmount.replace(",", "."));
    const hours = parseFloat(formIncludedHours.replace(",", "."));
    if (formTariffKind === "none") {
      const first = parseFloat(formExtraChargeFirst || "0");
      const repeat = parseFloat(formExtraChargeRepeat || "0");
      const interval = parseInt(formExtraInterval || "0");
      if (Number.isNaN(first) || first < 0) return false;
      if (Number.isNaN(repeat) || repeat < 0) return false;
      if (Number.isNaN(interval) || interval <= 0) return false;
    }
    return (
      formClientName.trim().length > 0 &&
      formPlate.trim().length > 0 &&
      !Number.isNaN(amount) && amount >= 0 &&
      !Number.isNaN(hours) && hours > 0 &&
      !!formDateFrom
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (n: number) =>
    "$" + n.toLocaleString("en", { minimumFractionDigits: 2 });

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader title={t("contracts.title")} subtitle={t("contracts.subtitle")} />

      {(contractsDue.length > 0 || contractsUpcoming.length > 0) && (
        <Card className="my-6 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("contracts.chargeSectionTitle")}
            </CardTitle>
            <CardDescription>{t("contracts.chargeSectionDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contractsDue.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {t("contracts.overdueContracts")} ({contractsDue.length})
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("contracts.clientName")}</TableHead>
                      <TableHead>{t("contracts.plate")}</TableHead>
                      <TableHead>{t("contracts.nextPayment")}</TableHead>
                      <TableHead className="text-right">{t("contracts.monthlyAmount")}</TableHead>
                      <TableHead>{t("contracts.chargeAction")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractsDue.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell>{contract.clientName}</TableCell>
                        <TableCell className="font-mono">{contract.plate}</TableCell>
                        <TableCell>{formatDate(contract.dateTo)}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(contract.monthlyAmount)}</TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => { setPaymentContract(contract); setPaymentMethod("cash"); }}
                          >
                            {t("contracts.chargeNow")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {contractsUpcoming.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-600 mb-2">
                  {t("contracts.upcomingPayments")} ({contractsUpcoming.length})
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("contracts.clientName")}</TableHead>
                      <TableHead>{t("contracts.plate")}</TableHead>
                      <TableHead>{t("contracts.nextPayment")}</TableHead>
                      <TableHead className="text-right">{t("contracts.monthlyAmount")}</TableHead>
                      <TableHead>{t("contracts.chargeAction")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractsUpcoming.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell>{contract.clientName}</TableCell>
                        <TableCell className="font-mono">{contract.plate}</TableCell>
                        <TableCell>{formatDate(contract.dateTo)}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(contract.monthlyAmount)}</TableCell>
                        <TableCell>
                          <Button
                            variant="coco"
                            size="sm"
                            onClick={() => { setPaymentContract(contract); setPaymentMethod("cash"); }}
                          >
                            {t("contracts.chargeNow")}
                          </Button>
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
                  <SelectItem value="arrears">{t("contracts.statusArrears")}</SelectItem>
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
                      <TableHead>{t("contracts.extraCharge")}</TableHead>
                      <TableHead>{t("contracts.nextCutDate")}</TableHead>
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
                          {formatAmount(contract.monthlyAmount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {contract.includedHoursPerDay}h/{t("contracts.day")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {contract.extraChargeFirst != null
                            ? `+${formatAmount(contract.extraChargeFirst)} / ${contract.extraInterval}min`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex flex-col gap-0.5">
                            <span>{formatDate(contract.dateFrom)}</span>
                            <span className="font-medium text-foreground">{formatDate(contract.dateTo)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[contract.status] ?? ""}>
                            {getContractStatus(contract, today)}
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPE_KEYS.map((type) => (
                      <SelectItem key={type} value={type}>{vehicleLabels[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("tariffs.tariffKind")}</Label>
                <Select
                  value={formTariffKind}
                  onValueChange={(v) => {
                    setFormTariffKind(v);
                    setFormMonthlyAmount("");
                    if (v !== "none") {
                      setFormExtraChargeFirst("");
                      setFormExtraChargeRepeat("");
                      setFormExtraInterval("");
                    }
                  }}
                  disabled={dialogMode === "edit"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("contracts.tariffKindNone")}</SelectItem>
                    {TARIFF_KIND_KEYS.map((kind) => (
                      <SelectItem key={kind} value={kind}>{tariffKindLabels[kind]}</SelectItem>
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
                {dialogMode === "create" && formTariffKind !== "none" && suggestQuery.data != null && (
                  <p className="text-xs text-muted-foreground">
                    {t("contracts.suggestedAmount")}: {formatAmount(suggestQuery.data)}
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
                  step={1}
                  value={formIncludedHours}
                  onChange={(e) => setFormIncludedHours(e.target.value)}
                  placeholder="6"
                  inputMode="numeric"
                />
              </div>
            </div>

            {formTariffKind === "none" && (
              <Collapsible open={extraChargesOpen} onOpenChange={setExtraChargesOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    <span>{t("contracts.extraChargesSection")}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${extraChargesOpen ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <p className="text-xs text-muted-foreground mb-3">{t("contracts.extraChargesHint")}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t("contracts.initialExtraCharge")}</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={formExtraChargeFirst}
                        onChange={(e) => setFormExtraChargeFirst(e.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("contracts.extraCharge")}</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={formExtraChargeRepeat}
                        onChange={(e) => setFormExtraChargeRepeat(e.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("contracts.extraIntervalMinutes")}</Label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={formExtraInterval}
                        onChange={(e) => setFormExtraInterval(e.target.value)}
                        placeholder="30"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("contracts.dateFrom")}
                </Label>
                <DatePickerField
                  id="contract-date-from"
                  value={formDateFrom}
                  onChange={(v) => {
                    setFormDateFrom(v);
                    if (dialogMode === "create") {
                      setFormDateTo(computeNextCutDate(v, parseInt(formBillingPeriodDays) || 30));
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("contracts.billingFrequency")}</Label>
                <Select
                  value={formBillingPeriodDays}
                  disabled={dialogMode === "edit" && editingContractHasPayments}
                  onValueChange={(v) => {
                    setFormBillingPeriodDays(v);
                    if (dialogMode === "create") {
                      setFormDateTo(computeNextCutDate(formDateFrom, parseInt(v) || 30));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.days} value={String(opt.days)}>
                        {t(`contracts.${opt.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dialogMode === "edit" && editingContractHasPayments && (
                  <p className="text-xs text-muted-foreground">
                    {t("contracts.billingPeriodLocked")}
                  </p>
                )}
              </div>
            </div>

            {dialogMode === "create" && formDateFrom && (
              <p className="text-xs text-muted-foreground -mt-1">
                {t("contracts.nextCutPreview").replace("{{date}}", formatDate(formDateTo))}
              </p>
            )}

            {dialogMode === "edit" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("contracts.nextCutDate")}
                </Label>
                <DatePickerField
                  id="contract-date-to"
                  value={formDateTo}
                  onChange={setFormDateTo}
                />
              </div>
            )}

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
              disabled={!isFormValid() || createMutation.isPending || updateMutation.isPending}
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

      <AlertDialog open={!!paymentContract} onOpenChange={(o) => !o && setPaymentContract(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("contracts.chargeNow")}</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentContract?.clientName} — {paymentContract?.plate} — {paymentContract && formatAmount(paymentContract.monthlyAmount)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label>{t("checkout.paymentMethod")}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("checkout.cash")}</SelectItem>
                <SelectItem value="card">{t("checkout.card")}</SelectItem>
                <SelectItem value="transfer">{t("checkout.transfer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRecordPayment}
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? t("common.loading") : t("contracts.confirmCharge")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
