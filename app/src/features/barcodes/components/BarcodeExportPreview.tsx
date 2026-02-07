import { useCallback } from "react";
import { jsPDF } from "jspdf";
import { useTranslation } from "@/i18n";
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

function downloadPngFromBase64(base64: string, filename: string): void {
  const link = document.createElement("a");
  link.href = `${PNG_DATA_URL_PREFIX}${base64}`;
  link.download = filename;
  link.click();
}

function downloadPdfFromBase64(base64: string, code: string, filename: string): void {
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
  doc.save(filename);
}

interface BarcodeExportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barcode: Barcode | null;
  imageBase64: string | null;
  onDownloadPng: (barcode: Barcode, base64: string) => void;
  onDownloadPdf: (barcode: Barcode, base64: string) => void;
}

export function BarcodeExportPreview({
  open,
  onOpenChange,
  barcode,
  imageBase64,
  onDownloadPng,
  onDownloadPdf,
}: BarcodeExportPreviewProps) {
  const { t } = useTranslation();

  const handleDownloadPng = useCallback(() => {
    if (!barcode || !imageBase64) return;
    downloadPngFromBase64(imageBase64, `barcode-${barcode.code}.png`);
    onDownloadPng(barcode, imageBase64);
  }, [barcode, imageBase64, onDownloadPng]);

  const handleDownloadPdf = useCallback(() => {
    if (!barcode || !imageBase64) return;
    downloadPdfFromBase64(imageBase64, barcode.code, `barcode-${barcode.code}.pdf`);
    onDownloadPdf(barcode, imageBase64);
  }, [barcode, imageBase64, onDownloadPdf]);

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
            onClick={handleDownloadPng}
            disabled={!imageBase64}
            className="gap-2"
          >
            <FileImage className="h-4 w-4" />
            {t("barcodes.downloadPng")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={!imageBase64}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {t("barcodes.downloadPdf")}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            {t("barcodes.previewClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
