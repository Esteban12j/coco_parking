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
import { invokeTauri } from "@/lib/tauriInvoke";
import type { DebtorEntry, ListDebtorsResult } from "@/types/parking";
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
                    <TableRow key={row.plate}>
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
    </div>
  );
};
