import { useState } from "react";
import { DollarSign, Users, TrendingUp, Wallet, RefreshCw, AlertCircle, History } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { useParkingStore } from "@/hooks/useParkingStore";
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
import { CloseShiftDialog } from "./components/CloseShiftDialog";

function formatClosedAt(iso: string): string {
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

export const CajaPage = () => {
  const { t } = useTranslation();
  const [closeShiftDialogOpen, setCloseShiftDialogOpen] = useState(false);
  const {
    treasury,
    shiftClosures,
    shiftClosuresLoading,
    isLoading,
    isTreasuryError,
    treasuryError,
    isTauri,
    invalidateParking,
    closeShift,
    isClosingShift,
  } = useParkingStore();
  const totalBreakdown =
    treasury.paymentBreakdown.cash +
    treasury.paymentBreakdown.card +
    treasury.paymentBreakdown.transfer;
  const pct = (v: number) => (totalBreakdown > 0 ? (v / totalBreakdown) * 100 : 0);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("till.title")}</h1>
          <p className="text-muted-foreground">{t("till.subtitle")}</p>
          {isTauri && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("till.fromBackendNote")}
            </p>
          )}
        </div>
        {isTauri && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => invalidateParking()}
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
      {isTreasuryError && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{String(treasuryError ?? t("common.error"))}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title={t("till.expectedCash")}
            value={`$${treasury.expectedCash.toFixed(2)}`}
            icon={<DollarSign className="h-5 w-5" />}
            variant="info"
          />
          <MetricCard
            title={t("till.actualCash")}
            value={`$${treasury.actualCash.toFixed(2)}`}
            icon={<Wallet className="h-5 w-5" />}
            variant="info"
          />
          <MetricCard
            title={t("till.totalTransactions")}
            value={treasury.totalTransactions}
            icon={<Users className="h-5 w-5" />}
          />
          <MetricCard
            title={t("till.discrepancy")}
            value={`$${treasury.discrepancy.toFixed(2)}`}
            icon={<TrendingUp className="h-5 w-5" />}
            variant={treasury.discrepancy !== 0 ? "warning" : "success"}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">
            {t("till.paymentBreakdown")}
          </h3>
          <div className="space-y-4">
            {[
              {
                method: t("till.cash"),
                amount: treasury.paymentBreakdown.cash,
                percentage: pct(treasury.paymentBreakdown.cash),
              },
              {
                method: t("till.card"),
                amount: treasury.paymentBreakdown.card,
                percentage: pct(treasury.paymentBreakdown.card),
              },
              {
                method: t("till.transfer"),
                amount: treasury.paymentBreakdown.transfer,
                percentage: pct(treasury.paymentBreakdown.transfer),
              },
            ].map((item) => (
              <div key={item.method} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{item.method}</span>
                  <span className="text-sm text-muted-foreground">
                    ${item.amount.toFixed(2)} ({item.percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <h3 className="font-semibold mb-2">{t("till.closeShift")}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("till.closeShiftDescription")}
          </p>
          {isTauri && (
            <>
              <Button
                variant="coco"
                size="lg"
                onClick={() => setCloseShiftDialogOpen(true)}
                disabled={isLoading}
              >
                {t("till.closeShift")}
              </Button>
              <CloseShiftDialog
                open={closeShiftDialogOpen}
                onOpenChange={setCloseShiftDialogOpen}
                treasury={treasury}
                onSubmit={(arqueoCash, notes) =>
                  closeShift(arqueoCash, notes, () => setCloseShiftDialogOpen(false))
                }
                isSubmitting={isClosingShift}
              />
            </>
          )}
        </div>

        {isTauri && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("till.closureHistory")}
            </h3>
            {shiftClosuresLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : shiftClosures.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("till.noClosuresYet")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("till.closedAt")}</TableHead>
                    <TableHead className="text-right">{t("till.expectedCash")}</TableHead>
                    <TableHead className="text-right">{t("till.expectedCashOnly")}</TableHead>
                    <TableHead className="text-right">{t("till.arqueoCash")}</TableHead>
                    <TableHead className="text-right">{t("till.discrepancy")}</TableHead>
                    <TableHead className="text-right">{t("till.totalTransactions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftClosures.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{formatClosedAt(c.closedAt)}</TableCell>
                      <TableCell className="text-right">
                        ${c.expectedTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${c.cashTotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.arqueoCash != null ? `$${c.arqueoCash.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        ${c.discrepancy.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{c.totalTransactions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
