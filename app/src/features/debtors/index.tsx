import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileWarning, RefreshCw, AlertCircle } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { invokeTauri } from "@/lib/tauriInvoke";
import type {
  DebtorEntry,
  DebtDetailByPlateResult,
  ListDebtorsResult,
} from "@/types/parking";
import { useParkingStore } from "@/hooks/useParkingStore";

const DEBTORS_PAGE_SIZE = 20;

function formatSinceWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export const DebtorsPage = () => {
  const { t } = useTranslation();
  const { isTauri } = useParkingStore();
  const [page, setPage] = useState(1);
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);

  const totalDebtQuery = useQuery({
    queryKey: ["parking", "totalDebt"],
    queryFn: () => invokeTauri<number>("vehiculos_get_total_debt"),
    enabled: isTauri,
  });

  const debtorsQuery = useQuery({
    queryKey: ["parking", "debtors", page, DEBTORS_PAGE_SIZE],
    queryFn: (): Promise<ListDebtorsResult> =>
      invokeTauri("vehiculos_list_debtors", {
        limit: DEBTORS_PAGE_SIZE,
        offset: (page - 1) * DEBTORS_PAGE_SIZE,
      }),
    enabled: isTauri,
  });

  const debtDetailQuery = useQuery({
    queryKey: ["parking", "debtDetail", selectedPlate],
    queryFn: (): Promise<DebtDetailByPlateResult> =>
      invokeTauri("vehiculos_get_debt_detail_by_plate", {
        plate: selectedPlate ?? "",
      }),
    enabled: isTauri && selectedPlate !== null && selectedPlate.length > 0,
  });

  const totalDebt = totalDebtQuery.data ?? 0;
  const debtors = debtorsQuery.data?.items ?? [];
  const totalDebtors = debtorsQuery.data?.total ?? 0;
  const isLoading = totalDebtQuery.isLoading || debtorsQuery.isLoading;
  const isError = totalDebtQuery.isError || debtorsQuery.isError;
  const errorMessage =
    totalDebtQuery.error != null
      ? String(totalDebtQuery.error)
      : debtorsQuery.error != null
        ? String(debtorsQuery.error)
        : null;
  const totalPages = Math.max(1, Math.ceil(totalDebtors / DEBTORS_PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const refetch = () => {
    totalDebtQuery.refetch();
    debtorsQuery.refetch();
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("debtors.title")}</h1>
          <p className="text-muted-foreground">{t("debtors.subtitle")}</p>
          {isTauri && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("debtors.fromBackendNote")}
            </p>
          )}
        </div>
        {isTauri && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            <span className="ml-2">{t("common.refresh")}</span>
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      )}
      {isError && errorMessage && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-4">
          <MetricCard
            title={t("debtors.totalOutstandingDebt")}
            value={`$${totalDebt.toFixed(2)}`}
            icon={<FileWarning className="h-5 w-5" />}
            variant={totalDebt > 0 ? "warning" : "info"}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">{t("debtors.title")}</h3>
          {isTauri && (
            <p className="text-xs text-muted-foreground mb-3">
              {t("debtors.clickPlateToViewDetail")}
            </p>
          )}
          {debtors.length === 0 && !isLoading ? (
            <p className="text-sm text-muted-foreground">{t("debtors.noDebtors")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("debtors.plate")}</TableHead>
                    <TableHead className="text-right">{t("debtors.totalDebt")}</TableHead>
                    <TableHead>{t("debtors.sinceWhen")}</TableHead>
                    <TableHead className="text-right">{t("debtors.sessionsWithDebt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtors.map((row: DebtorEntry) => (
                    <TableRow
                      key={row.plate}
                      className={isTauri ? "cursor-pointer hover:bg-muted/50" : undefined}
                      onClick={() => isTauri && setSelectedPlate(row.plate)}
                    >
                      <TableCell className="font-medium">{row.plate}</TableCell>
                      <TableCell className="text-right">
                        ${row.totalDebt.toFixed(2)}
                      </TableCell>
                      <TableCell>{formatSinceWhen(row.oldestExitTime ?? null)}</TableCell>
                      <TableCell className="text-right">{row.sessionsWithDebt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("vehicles.pageOfFormat")
                      .replace("{{current}}", String(page))
                      .replace("{{total}}", String(totalPages))}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!canPrev}
                    >
                      {t("common.prev")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={!canNext}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={selectedPlate !== null} onOpenChange={(open) => !open && setSelectedPlate(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("debtors.detailTitle")}</DialogTitle>
            <DialogDescription>
              {selectedPlate != null
                ? t("debtors.detailSubtitle").replace("{{plate}}", selectedPlate)
                : ""}
            </DialogDescription>
          </DialogHeader>
          {debtDetailQuery.isLoading && (
            <p className="text-sm text-muted-foreground py-4">{t("common.loading")}</p>
          )}
          {debtDetailQuery.error != null && (
            <p className="text-sm text-destructive py-4">{String(debtDetailQuery.error)}</p>
          )}
          {debtDetailQuery.data != null && !debtDetailQuery.isLoading && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">{t("debtors.sessionsWithDebt")}</h4>
                {debtDetailQuery.data.sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("debtors.noSessions")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("debtors.ticket")}</TableHead>
                        <TableHead>{t("debtors.entryTime")}</TableHead>
                        <TableHead>{t("debtors.exitTime")}</TableHead>
                        <TableHead className="text-right">{t("debtors.debt")}</TableHead>
                        <TableHead className="text-right">{t("debtors.totalAmount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debtDetailQuery.data.sessions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-sm">{s.ticketCode}</TableCell>
                          <TableCell>{formatSinceWhen(s.entryTime)}</TableCell>
                          <TableCell>{formatSinceWhen(s.exitTime ?? null)}</TableCell>
                          <TableCell className="text-right">${s.debt.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {s.totalAmount != null ? `$${s.totalAmount.toFixed(2)}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div>
                <h4 className="font-medium mb-2">{t("debtors.payments")}</h4>
                {debtDetailQuery.data.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("debtors.noPayments")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("debtors.whenPaid")}</TableHead>
                        <TableHead className="text-right">{t("debtors.amount")}</TableHead>
                        <TableHead>{t("debtors.method")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debtDetailQuery.data.transactions.map((tx, idx) => (
                        <TableRow key={`${tx.createdAt}-${idx}`}>
                          <TableCell>{formatSinceWhen(tx.createdAt)}</TableCell>
                          <TableCell className="text-right">${tx.amount.toFixed(2)}</TableCell>
                          <TableCell className="capitalize">{tx.method}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
