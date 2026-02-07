import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/barcodes";
import { ScannerInput } from "@/features/vehiculos/components/ScannerInput";
import { BarcodeListTable, isValidBarcodeCode } from "@/features/barcodes/components/BarcodeListTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { useToast } from "@/hooks/use-toast";
import type { Barcode } from "@/types/parking";
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

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

function downloadPngFromBase64(base64: string, filename: string): void {
  const link = document.createElement("a");
  link.href = `data:image/png;base64,${base64}`;
  link.download = filename;
  link.click();
}

export const BarcodesPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tauri = isTauri();
  const { hasPermission } = useMyPermissions();
  const canCreate = hasPermission("barcodes:create");
  const canDelete = hasPermission("barcodes:delete");

  const [filterCode, setFilterCode] = useState<string | null>(null);
  const [barcodeToDelete, setBarcodeToDelete] = useState<Barcode | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const barcodesQuery = useQuery({
    queryKey: ["barcodes"],
    queryFn: () => api.listBarcodes(),
    enabled: tauri,
  });

  const createMutation = useMutation({
    mutationFn: (args: { code: string; label?: string | null }) =>
      api.createBarcode(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      toast({ title: t("barcodes.createSuccess") });
    },
    onError: (err: unknown) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBarcode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      setBarcodeToDelete(null);
      setDeletingId(null);
      toast({ title: t("barcodes.deleteSuccess") });
    },
    onError: (err: unknown) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
      setDeletingId(null);
    },
  });

  const handleScanOrInput = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      if (!isValidBarcodeCode(trimmed)) {
        toast({
          title: t("common.error"),
          description: t("barcodes.invalidCodeFormat"),
          variant: "destructive",
        });
        return;
      }

      const existing = await api.getBarcodeByCode(trimmed);
      if (existing) {
        setFilterCode(trimmed);
        return;
      }

      if (canCreate) {
        createMutation.mutate({ code: trimmed });
        setFilterCode(null);
      } else {
        setFilterCode(trimmed);
        toast({
          title: t("common.error"),
          description: t("barcodes.noPermissionToCreate"),
          variant: "destructive",
        });
      }
    },
    [canCreate, createMutation, t, toast]
  );

  const handleGenerateExport = useCallback(
    async (barcode: Barcode) => {
      setExportingId(barcode.id);
      try {
        const result = await api.generateBarcodeImage({ code: barcode.code });
        downloadPngFromBase64(result.base64, `barcode-${barcode.code}.png`);
        toast({ title: t("barcodes.exportSuccess") });
      } catch (err) {
        toast({
          title: t("common.error"),
          description: String(err),
          variant: "destructive",
        });
      } finally {
        setExportingId(null);
      }
    },
    [t, toast]
  );

  const handleDeleteClick = useCallback((barcode: Barcode) => {
    setBarcodeToDelete(barcode);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!barcodeToDelete) return;
    setDeletingId(barcodeToDelete.id);
    deleteMutation.mutate(barcodeToDelete.id);
  }, [barcodeToDelete, deleteMutation]);

  const barcodes = barcodesQuery.data ?? [];

  return (
    <div className="container mx-auto py-4 space-y-6">
      <PageHeader title={t("nav.barcode")} subtitle={t("barcodes.subtitle")} />

      <ScannerInput
        placeholder={t("barcodes.searchOrCreatePlaceholder")}
        bottomText={t("barcodes.scannerReady")}
        onScan={handleScanOrInput}
        disabled={!tauri}
      />

      {filterCode !== null && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setFilterCode(null)}>
            {t("barcodes.clearFilter")}
          </Button>
        </div>
      )}

      <BarcodeListTable
        barcodes={barcodes}
        filterCode={filterCode}
        onGenerateExport={handleGenerateExport}
        onDelete={handleDeleteClick}
        canDelete={canDelete}
        isExportingId={exportingId}
        isDeletingId={deletingId}
      />

      <AlertDialog open={!!barcodeToDelete} onOpenChange={(o) => !o && setBarcodeToDelete(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("barcodes.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("barcodes.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              {t("barcodes.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
