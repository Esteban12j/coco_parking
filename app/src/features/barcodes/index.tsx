import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import * as api from "@/api/barcodes";
import { ScannerInput } from "@/features/vehiculos/components/ScannerInput";
import { BarcodeListTable, isValidBarcodeCode } from "@/features/barcodes/components/BarcodeListTable";
import { BarcodeExportPreview } from "@/features/barcodes/components/BarcodeExportPreview";
import { base64ToUint8Array, buildMultiPagePdfBytes } from "@/features/barcodes/utils/barcodeExport";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ChevronDown } from "lucide-react";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

function pathJoin(dir: string, file: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${file}` : `${dir}${sep}${file}`;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [barcodeToDelete, setBarcodeToDelete] = useState<Barcode | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [previewBarcode, setPreviewBarcode] = useState<Barcode | null>(null);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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
        setPreviewBarcode(barcode);
        setPreviewBase64(result.base64);
        setPreviewOpen(true);
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

  const handlePreviewOpenChange = useCallback((open: boolean) => {
    setPreviewOpen(open);
    if (!open) {
      setPreviewBarcode(null);
      setPreviewBase64(null);
    }
  }, []);

  const handleDownloadPng = useCallback(() => {
    toast({ title: t("barcodes.exportSuccess") });
  }, [t, toast]);

  const handleDownloadPdf = useCallback(() => {
    toast({ title: t("barcodes.exportSuccess") });
  }, [t, toast]);

  const handleDeleteClick = useCallback((barcode: Barcode) => {
    setBarcodeToDelete(barcode);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!barcodeToDelete) return;
    setDeletingId(barcodeToDelete.id);
    deleteMutation.mutate(barcodeToDelete.id);
  }, [barcodeToDelete, deleteMutation]);

  const barcodes = barcodesQuery.data ?? [];
  const filteredBarcodes =
    filterCode?.trim() && isValidBarcodeCode(filterCode.trim())
      ? barcodes.filter((b) => b.code === filterCode.trim())
      : barcodes;

  const selectedBarcodes = barcodes.filter((b) => selectedIds.has(b.id));

  const exportAsPngToFolder = useCallback(
    async (toExport: Barcode[]) => {
      if (!tauri || toExport.length === 0) return;
      let folder: string | string[] | null = null;
      try {
        folder = await open({ directory: true, multiple: false });
      } catch (e) {
        toast({ title: t("common.error"), description: String(e), variant: "destructive" });
        return;
      }
      if (typeof folder !== "string") return;
      setBulkExporting(true);
      let ok = 0;
      let err = 0;
      try {
        for (const barcode of toExport) {
          try {
            const result = await api.generateBarcodeImage({ code: barcode.code });
            const filePath = pathJoin(folder, `barcode-${barcode.code}.png`);
            await writeFile(filePath, base64ToUint8Array(result.base64));
            ok++;
          } catch {
            err++;
          }
        }
        if (ok > 0) {
        toast({
          title: t("barcodes.exportBulkSuccess").replace("{{count}}", String(ok)),
        });
      }
      if (err > 0) {
          toast({
            title: t("barcodes.exportBulkError"),
            variant: "destructive",
          });
        }
      } finally {
        setBulkExporting(false);
      }
    },
    [tauri, t, toast]
  );

  const exportAsPdfFile = useCallback(
    async (toExport: Barcode[]) => {
      if (!tauri || toExport.length === 0) return;
      let filePath: string | null = null;
      try {
        filePath = await save({
          defaultPath: "barcodes.pdf",
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
      } catch (e) {
        toast({ title: t("common.error"), description: String(e), variant: "destructive" });
        return;
      }
      if (filePath == null) return;
      setBulkExporting(true);
      try {
        const items: { base64: string; code: string }[] = [];
        let err = 0;
        for (const barcode of toExport) {
          try {
            const result = await api.generateBarcodeImage({ code: barcode.code });
            items.push({ base64: result.base64, code: barcode.code });
          } catch {
            err++;
          }
        }
        if (items.length > 0) {
          try {
            await writeFile(filePath, buildMultiPagePdfBytes(items));
            toast({
              title: t("barcodes.exportBulkSuccess").replace("{{count}}", String(items.length)),
            });
          } catch (e) {
            toast({ title: t("common.error"), description: String(e), variant: "destructive" });
          }
        }
        if (err > 0) {
          toast({ title: t("barcodes.exportBulkError"), variant: "destructive" });
        }
      } finally {
        setBulkExporting(false);
      }
    },
    [tauri, t, toast]
  );

  return (
    <div className="container mx-auto py-4 space-y-6">
      <PageHeader title={t("nav.barcode")} subtitle={t("barcodes.subtitle")} />

      <ScannerInput
        placeholder={t("barcodes.searchOrCreatePlaceholder")}
        bottomText={t("barcodes.scannerReady")}
        onScan={handleScanOrInput}
        disabled={!tauri}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {filterCode !== null && (
          <Button variant="ghost" size="sm" onClick={() => setFilterCode(null)}>
            {t("barcodes.clearFilter")}
          </Button>
        )}
        <div className="flex flex-1 justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0 || bulkExporting || !tauri}
                className="gap-1"
              >
                {t("barcodes.exportSelected")}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => void exportAsPngToFolder(selectedBarcodes)}
              >
                {t("barcodes.exportAsPngFolder")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void exportAsPdfFile(selectedBarcodes)}
              >
                {t("barcodes.exportAsPdfFile")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={filteredBarcodes.length === 0 || bulkExporting || !tauri}
                className="gap-1"
              >
                {t("barcodes.exportAll")}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => void exportAsPngToFolder(filteredBarcodes)}
              >
                {t("barcodes.exportAsPngFolder")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void exportAsPdfFile(filteredBarcodes)}
              >
                {t("barcodes.exportAsPdfFile")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <BarcodeListTable
        barcodes={barcodes}
        filterCode={filterCode}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onGenerateExport={handleGenerateExport}
        onDelete={handleDeleteClick}
        canDelete={canDelete}
        isExportingId={exportingId}
        isDeletingId={deletingId}
      />

      <BarcodeExportPreview
        open={previewOpen}
        onOpenChange={handlePreviewOpenChange}
        barcode={previewBarcode}
        imageBase64={previewBase64}
        isTauri={tauri}
        onDownloadPng={handleDownloadPng}
        onDownloadPdf={handleDownloadPdf}
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
