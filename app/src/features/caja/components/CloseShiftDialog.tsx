import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TreasuryData } from "@/types/parking";

type CloseShiftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treasury: TreasuryData;
  onSubmit: (arqueoCash: number | null, notes: string | null) => void;
  isSubmitting: boolean;
};

export const CloseShiftDialog = ({
  open,
  onOpenChange,
  treasury,
  onSubmit,
  isSubmitting,
}: CloseShiftDialogProps) => {
  const { t } = useTranslation();
  const [arqueoCash, setArqueoCash] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setArqueoCash("");
      setNotes("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const arqueo = arqueoCash.trim() ? parseFloat(arqueoCash) : null;
    const notesVal = notes.trim() || null;
    if (arqueo !== null && Number.isNaN(arqueo)) return;
    onSubmit(arqueo, notesVal);
  };

  const expectedTotal =
    treasury.paymentBreakdown.cash +
    treasury.paymentBreakdown.card +
    treasury.paymentBreakdown.transfer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("till.closeShift")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between font-medium">
              <span>{t("till.expectedCash")}</span>
              <span>${expectedTotal.toFixed(2)}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-muted-foreground">
              <span>{t("till.cash")}: ${treasury.paymentBreakdown.cash.toFixed(2)}</span>
              <span>{t("till.card")}: ${treasury.paymentBreakdown.card.toFixed(2)}</span>
              <span>{t("till.transfer")}: ${treasury.paymentBreakdown.transfer.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between text-muted-foreground">
              <span>{t("till.expectedCashOnly")}</span>
              <span className="font-medium">${treasury.paymentBreakdown.cash.toFixed(2)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {treasury.totalTransactions} {t("till.totalTransactions").toLowerCase()}
            </div>
            {treasury.debtTotal > 0 && (
              <div className="mt-2 flex justify-between text-destructive text-sm font-medium border-t border-border pt-2">
                <span>{t("till.debtTotal")}</span>
                <span>${treasury.debtTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground space-y-0.5">
              <div className="flex justify-between">
                <span>{t("till.vehiclesAttended")}</span>
                <span className="font-medium text-foreground">{treasury.vehiclesAttended}</span>
              </div>
              {treasury.vehiclesWithDebt > 0 && (
                <div className="flex justify-between">
                  <span>{t("till.vehiclesWithDebt")}</span>
                  <span className="text-destructive font-medium">{treasury.vehiclesWithDebt}</span>
                </div>
              )}
              {treasury.vehiclesRemoved > 0 && (
                <div className="flex justify-between">
                  <span>{t("till.vehiclesRemoved")}</span>
                  <span>{treasury.vehiclesRemoved}</span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="arqueo">{t("till.arqueoCash")}</Label>
            <p className="text-xs text-muted-foreground">{t("till.arqueoHint")}</p>
            <Input
              id="arqueo"
              type="number"
              step="0.01"
              min="0"
              placeholder={t("till.arqueoCashPlaceholder")}
              value={arqueoCash}
              onChange={(e) => setArqueoCash(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t("till.notes")}</Label>
            <Textarea
              id="notes"
              placeholder={t("till.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={isSubmitting}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="coco" disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t("till.submitCloseShift")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
