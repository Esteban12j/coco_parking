import { useCallback, useState } from "react";
import { jsPDF } from "jspdf";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import type { Barcode } from "@/types/parking";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileImage, FileText } from "lucide-react";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildPdfBytes(base64: string, code: string): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a6" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const imgW = 70;
  const imgH = 25;
  const x = (pageW - imgW) / 2;
  const y = (pageH - imgH) / 2;
  const dataUrl = `${PNG_DATA_URL_PREFIX}${base64}`;
  doc.addImage(dataUrl, "PNG", x, y, imgW, imgH);
  doc.setFontSize(10);
  doc.text(code, pageW / 2, y + imgH + 8, { align: "center" });
  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}

function downloadPngFallback(base64: string, filename: string): void {
  const link = document.createElement("a");
  link.href = `${PNG_DATA_URL_PREFIX}${base64}`;
  link.download = filename;
  link.click();
}

function downloadPdfFallback(base64: string, code: string, filename: string): void {
  const bytes = buildPdfBytes(base64, code);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface BarcodeExportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barcode: Barcode | null;
  imageBase64: string | null;
  isTauri: boolean;
  onDownloadPng: (barcode: Barcode, base64: string) => void;
  onDownloadPdf: (barcode: Barcode, base64: string) => void;
}

export function BarcodeExportPreview({
  open,
  onOpenChange,
  barcode,
  imageBase64,
  isTauri,
  onDownloadPng,
  onDownloadPdf,
}: BarcodeExportPreviewProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [savingPng, setSavingPng] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

  const handleDownloadPng = useCallback(async () => {
    if (!barcode || !imageBase64) return;
    const filename = `barcode-${barcode.code}.png`;
    if (isTauri) {
      let path: string | null = null;
      try {
        path = await save({
          defaultPath: filename,
          filters: [{ name: "PNG", extensions: ["png"] }],
        });
      } catch (e) {
        toast({ title: t("common.error"), description: String(e), variant: "destructive" });
        return;
      }
      if (path == null) return;
      setSavingPng(true);
      try {
        await writeFile(path, base64ToUint8Array(imageBase64));
        onDownloadPng(barcode, imageBase64);
        toast({ title: t("barcodes.exportSuccess") });
      } catch (e) {
        toast({ title: t("common.error"), description: String(e), variant: "destructive" });
      } finally {
        setSavingPng(false);
      }
    } else {
      downloadPngFallback(imageBase64, filename);
      onDownloadPng(barcode, imageBase64);
      toast({ title: t("barcodes.exportSuccess") });
    }
  }, [barcode, imageBase64, isTauri, onDownloadPng, t, toast]);

  const handleDownloadPdf = useCallback(async () => {
    if (!barcode || !imageBase64) return;
    const filename = `barcode-${barcode.code}.pdf`;
    if (isTauri) {
      let path: string | null = null;
      try {
        path = await save({
          defaultPath: filename,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
      } catch (e) {
        toast({ title: t("common.error"), description: String(e), variant: "destructive" });
        return;
      }
      if (path == null) return;
      setSavingPdf(true);
      try {
        await writeFile(path, buildPdfBytes(imageBase64, barcode.code));
        onDownloadPdf(barcode, imageBase64);
        toast({ title: t("barcodes.exportSuccess") });
      } catch (e) {
        toast({ title: t("common.error"), description: String(e), variant: "destructive" });
      } finally {
        setSavingPdf(false);
      }
    } else {
      downloadPdfFallback(imageBase64, barcode.code, filename);
      onDownloadPdf(barcode, imageBase64);
      toast({ title: t("barcodes.exportSuccess") });
    }
  }, [barcode, imageBase64, isTauri, onDownloadPdf, t, toast]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!barcode) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("barcodes.previewTitle")}</DialogTitle>
          <DialogDescription>
            {t("barcodes.previewDescription").replace("{{code}}", barcode.code)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {imageBase64 ? (
            <div className="rounded border bg-muted/30 p-4">
              <img
                src={`${PNG_DATA_URL_PREFIX}${imageBase64}`}
                alt={barcode.code}
                className="max-h-32 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="h-32 w-48 animate-pulse rounded bg-muted" />
          )}
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadPng()}
            disabled={!imageBase64 || savingPng}
            className="gap-2"
          >
            <FileImage className="h-4 w-4" />
            {savingPng ? t("common.loading") : t("barcodes.downloadPng")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadPdf()}
            disabled={!imageBase64 || savingPdf}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {savingPdf ? t("common.loading") : t("barcodes.downloadPdf")}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            {t("barcodes.previewClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
