import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, RefreshCw } from "lucide-react";
import { useTranslation } from "@/i18n";
import { listVehiclesByDate, type VehicleBackend } from "@/api/vehiculos";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { formatDateTime, getLocalDateString } from "@/lib/dateTime";
import { Vehicle } from "@/types/parking";

function vehicleFromBackend(v: VehicleBackend): Vehicle {
  return {
    ...v,
    entryTime: new Date(v.entryTime),
    exitTime: v.exitTime ? new Date(v.exitTime) : undefined,
  };
}

function isTauriEnv(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

const PAGE_SIZE = 50;

export const VehiclesTodayPage = () => {
  const { t } = useTranslation();
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [page, setPage] = useState(1);
  const isTauri = isTauriEnv();

  const query = useQuery({
    queryKey: ["parking", "vehiclesByDate", selectedDate, page],
    queryFn: async (): Promise<{ items: Vehicle[]; total: number }> => {
      const res = await listVehiclesByDate({
        date: selectedDate,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      if (!res) return { items: [], total: 0 };
      return {
        items: (res.items ?? []).map(vehicleFromBackend),
        total: res.total ?? 0,
      };
    },
    enabled: isTauri && !!selectedDate,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const vehicleTypeLabel = (type: Vehicle["vehicleType"]): string =>
    t(`vehicles.${type}` as "vehicles.car");
  const statusLabel = (status: "active" | "completed" | "removed"): string =>
    status === "active"
      ? t("conflicts.active")
      : status === "completed"
        ? t("conflicts.completed")
        : t("vehicles.removed");

  if (!isTauri) {
    return (
      <div className="container mx-auto px-4 py-6">
        <PageHeader title={t("vehicles.vehiclesTodayTitle")} subtitle={t("vehicles.vehiclesTodaySubtitle")} />
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("vehicles.vehiclesTodayNoData")}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title={t("vehicles.vehiclesTodayTitle")}
        subtitle={t("vehicles.vehiclesTodaySubtitle")}
        actions={
          <>
            <div className="space-y-2">
              <Label className="text-sm">{t("vehicles.vehiclesTodayDateLabel")}</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
              disabled={query.isLoading}
            >
              <RefreshCw className={query.isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              <span className="ml-2">{t("common.refresh")}</span>
            </Button>
          </>
        }
      />

      {query.isLoading && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("common.loading")}
        </p>
      )}

      {query.error && (
        <p className="text-sm text-destructive py-8 text-center">
          {query.error instanceof Error ? query.error.message : String(query.error)}
        </p>
      )}

      {!query.isLoading && !query.error && items.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Car className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">{t("vehicles.vehiclesTodayNoData")}</p>
        </div>
      )}

      {!query.isLoading && items.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <span className="text-sm text-muted-foreground">
              {total} {t("vehicles.vehiclesTodayCountLabel")}
            </span>
          </div>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
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
                    <TableCell>{vehicleTypeLabel(row.vehicleType)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.entryTime)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.exitTime)}
                    </TableCell>
                    <TableCell>{statusLabel(row.status)}</TableCell>
                    <TableCell className="text-right">{amountOrDebt}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t("common.prev")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("vehicles.pageOfFormat")
                  .replace("{{current}}", String(page))
                  .replace("{{total}}", String(totalPages))}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
