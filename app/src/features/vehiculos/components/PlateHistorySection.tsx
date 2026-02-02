import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Vehicle, VehicleType } from "@/types/parking";
import type { DebtDetailByPlateResult } from "@/types/parking";

function formatDateTime(iso: string | Date | null | undefined): string {
  if (iso == null) return "—";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

interface PlateHistorySectionProps {
  getVehiclesByPlate: (plate: string) => Promise<Vehicle[]>;
  isTauri: boolean;
}

export const PlateHistorySection = ({
  getVehiclesByPlate,
  isTauri,
}: PlateHistorySectionProps) => {
  const { t } = useTranslation();
  const [plateInput, setPlateInput] = useState("");
  const [searchResult, setSearchResult] = useState<Vehicle[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlateForDebtDetail, setSelectedPlateForDebtDetail] = useState<
    string | null
  >(null);

  const handleSearch = useCallback(async () => {
    const plate = plateInput.trim();
    if (!plate) return;
    setIsSearching(true);
    setSearchResult(null);
    try {
      const list = await getVehiclesByPlate(plate);
      setSearchResult(list);
    } finally {
      setIsSearching(false);
    }
  }, [plateInput, getVehiclesByPlate]);

  const debtDetailQuery = useQuery({
    queryKey: ["parking", "debtDetail", selectedPlateForDebtDetail],
    queryFn: (): Promise<DebtDetailByPlateResult> =>
      invokeTauri("vehiculos_get_debt_detail_by_plate", {
        plate: selectedPlateForDebtDetail ?? "",
      }),
    enabled:
      isTauri &&
      selectedPlateForDebtDetail !== null &&
      selectedPlateForDebtDetail.length > 0,
  });

  const vehicleTypeLabel = (type: VehicleType): string =>
    t(`vehicles.${type}` as "vehicles.car");

  const statusLabel = (status: "active" | "completed"): string =>
    status === "active" ? t("conflicts.active") : t("conflicts.completed");

  if (!isTauri) return null;

  return (
    <section className="space-y-4 mt-10 pt-8 border-t border-border">
      <h2 className="text-lg font-semibold">
        {t("vehicles.plateHistorySectionTitle")}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={plateInput}
          onChange={(e) =>
            setPlateInput(e.target.value.toUpperCase().trim())
          }
          placeholder={t("vehicles.plateHistoryPlaceholder")}
          className="font-mono uppercase w-40"
          onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
        />
        <Button
          variant="coco"
          onClick={() => void handleSearch()}
          disabled={isSearching}
        >
          <Search className="h-4 w-4 mr-2" />
          {isSearching ? t("common.loading") : t("common.search")}
        </Button>
      </div>

      {searchResult !== null && (
        <div className="bg-card border border-border rounded-xl p-4 overflow-x-auto">
          {searchResult.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("vehicles.plateHistoryEmpty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.ticket")}</TableHead>
                  <TableHead>{t("debtors.plate")}</TableHead>
                  <TableHead>{t("vehicles.vehicleType")}</TableHead>
                  <TableHead>{t("debtors.entryTime")}</TableHead>
                  <TableHead>{t("debtors.exitTime")}</TableHead>
                  <TableHead>{t("conflicts.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("vehicles.plateHistoryAmountOrDebt")}
                  </TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResult.map((row) => {
                  const hasDebt = (row.debt ?? 0) > 0;
                  const amountOrDebt =
                    row.status === "completed" && row.totalAmount != null
                      ? `$${row.totalAmount.toFixed(2)}`
                      : hasDebt
                        ? `$${(row.debt ?? 0).toFixed(2)}`
                        : "—";
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm">
                        {row.ticketCode}
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {row.plate}
                      </TableCell>
                      <TableCell>
                        {vehicleTypeLabel(row.vehicleType)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.entryTime)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.exitTime)}
                      </TableCell>
                      <TableCell>
                        {statusLabel(row.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        {amountOrDebt}
                      </TableCell>
                      <TableCell>
                        {hasDebt && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-primary"
                            onClick={() =>
                              setSelectedPlateForDebtDetail(row.plate)
                            }
                          >
                            <FileText className="h-3.5 w-3 mr-1 inline" />
                            {t("vehicles.plateHistoryViewDebtDetail")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog
        open={selectedPlateForDebtDetail !== null}
        onOpenChange={(open) => !open && setSelectedPlateForDebtDetail(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("debtors.detailTitle")}</DialogTitle>
            <DialogDescription>
              {selectedPlateForDebtDetail != null
                ? t("debtors.detailSubtitle").replace(
                    "{{plate}}",
                    selectedPlateForDebtDetail
                  )
                : ""}
            </DialogDescription>
          </DialogHeader>
          {debtDetailQuery.isLoading && (
            <p className="text-sm text-muted-foreground py-4">
              {t("common.loading")}
            </p>
          )}
          {debtDetailQuery.error != null && (
            <p className="text-sm text-destructive py-4">
              {String(debtDetailQuery.error)}
            </p>
          )}
          {debtDetailQuery.data != null && !debtDetailQuery.isLoading && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">
                  {t("debtors.sessionsWithDebt")}
                </h4>
                {debtDetailQuery.data.sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("debtors.noSessions")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("debtors.ticket")}</TableHead>
                        <TableHead>{t("debtors.entryTime")}</TableHead>
                        <TableHead>{t("debtors.exitTime")}</TableHead>
                        <TableHead className="text-right">
                          {t("debtors.debt")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("debtors.totalAmount")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debtDetailQuery.data.sessions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-sm">
                            {s.ticketCode}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(s.entryTime)}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(s.exitTime ?? null)}
                          </TableCell>
                          <TableCell className="text-right">
                            ${s.debt.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {s.totalAmount != null
                              ? `$${s.totalAmount.toFixed(2)}`
                              : "—"}
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
                  <p className="text-sm text-muted-foreground">
                    {t("debtors.noPayments")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("debtors.whenPaid")}</TableHead>
                        <TableHead className="text-right">
                          {t("debtors.amount")}
                        </TableHead>
                        <TableHead>{t("debtors.method")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debtDetailQuery.data.transactions.map((tx, idx) => (
                        <TableRow key={`${tx.createdAt}-${idx}`}>
                          <TableCell>
                            {formatDateTime(tx.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            ${tx.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="capitalize">
                            {tx.method}
                          </TableCell>
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
    </section>
  );
};
