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
import { useTranslation } from "@/i18n";
import type { UpdateManifest } from "@/lib/updater";
import { installAndRelaunch } from "@/lib/updater";

type UpdateAvailableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: UpdateManifest;
  onDismiss: () => void;
};

export function UpdateAvailableDialog({
  open,
  onOpenChange,
  manifest,
  onDismiss,
}: UpdateAvailableDialogProps) {
  const { t } = useTranslation();

  const handleUpdateNow = async () => {
    await installAndRelaunch();
  };

  const handleLater = () => {
    onDismiss();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("update.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("update.description")} {manifest.version}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLater}>{t("update.later")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdateNow}>{t("update.updateNow")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
