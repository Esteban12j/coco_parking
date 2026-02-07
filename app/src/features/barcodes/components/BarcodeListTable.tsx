import { Download, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";
import type { Barcode } from "@/types/parking";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BARCODE_CODE_MIN_LEN = 1;
const BARCODE_CODE_MAX_LEN = 24;
const BARCODE_CODE_DIGITS_ONLY = /^\d+$/;

export function isValidBarcodeCode(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < BARCODE_CODE_MIN_LEN || trimmed.length > BARCODE_CODE_MAX_LEN)
    return false;
  return BARCODE_CODE_DIGITS_ONLY.test(trimmed);
}

interface BarcodeListTableProps {
  barcodes: Barcode[];
  filterCode: string | null;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onGenerateExport: (barcode: Barcode) => void;
  onDelete: (barcode: Barcode) => void;
  canDelete: boolean;
  isExportingId: string | null;
  isDeletingId: string | null;
}

export function BarcodeListTable({
  barcodes,
  filterCode,
  selectedIds,
  onSelectionChange,
  onGenerateExport,
  onDelete,
  canDelete,
  isExportingId,
  isDeletingId,
}: BarcodeListTableProps) {
  const { t } = useTranslation();

  const filtered =
    filterCode?.trim() && isValidBarcodeCode(filterCode.trim())
      ? barcodes.filter((b) => b.code === filterCode.trim())
      : barcodes;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((b) => selectedIds.has(b.id));

  const handleSelectAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    filtered.forEach((b) => (checked ? next.add(b.id) : next.delete(b.id)));
    onSelectionChange(next);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  if (barcodes.length === 0) {
    return (
      <div className="text-center py-12 rounded-lg border border-dashed bg-muted/30">
        <p className="text-muted-foreground">{t("barcodes.noBarcodes")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={handleSelectAll}
                aria-label={t("barcodes.selectAll")}
              />
            </TableHead>
            <TableHead>{t("barcodes.code")}</TableHead>
            <TableHead>{t("barcodes.label")}</TableHead>
            <TableHead>{t("barcodes.createdAt")}</TableHead>
            <TableHead className="w-[180px] text-right">{t("barcodes.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && barcodes.length > 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                {t("common.search")}: no match for code &quot;{filterCode?.trim()}&quot;.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((barcode) => (
              <TableRow
                key={barcode.id}
                className={filterCode?.trim() === barcode.code ? "bg-primary/5" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(barcode.id)}
                    onCheckedChange={(c) => handleSelectOne(barcode.id, c === true)}
                    aria-label={t("barcodes.selectRow")}
                  />
                </TableCell>
                <TableCell className="font-mono font-medium">{barcode.code}</TableCell>
                <TableCell className="text-muted-foreground">
                  {barcode.label ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(barcode.createdAt), "yyyy-MM-dd HH:mm")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateExport(barcode)}
                      disabled={!!isExportingId}
                      title={t("barcodes.generateExport")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(barcode)}
                        disabled={!!isDeletingId}
                        title={t("barcodes.delete")}
                      >
                        {isDeletingId === barcode.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
