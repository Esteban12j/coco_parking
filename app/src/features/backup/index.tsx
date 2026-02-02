import { useState } from "react";
import { invokeTauri } from "@/lib/tauriInvoke";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Database, Download, Upload } from "lucide-react";
import { useTranslation } from "@/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { generatePrefixedId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  return (
    typeof window !== "undefined" &&
    !!(window as unknown as { __TAURI__?: unknown }).__TAURI__
  );
}

export const BackupPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { hasPermission } = useMyPermissions();
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestorePath, setPendingRestorePath] = useState<string | null>(null);

  const canExport = hasPermission("backup:create");
  const canRestore = hasPermission("backup:restore");
  const tauri = isTauri();

  const handleExport = async () => {
    if (!tauri || !canExport) return;
    setExporting(true);
    try {
      const path = await save({
        defaultPath: `${generatePrefixedId("DB", 25)}.db`,
        filters: [{ name: "SQLite", extensions: ["db"] }],
      });
      if (!path) {
        setExporting(false);
        return;
      }
      await invokeTauri<{ path: string; sizeBytes: number }>("backup_create", {
        path,
      });
      toast({
        title: t("backup.exportSuccess"),
        description: path,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("backup.error"),
        description: String(err),
      });
    } finally {
      setExporting(false);
    }
  };

  const handleRestoreClick = async () => {
    if (!tauri || !canRestore) return;
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "SQLite", extensions: ["db"] }],
      });
      if (typeof path === "string") {
        setPendingRestorePath(path);
        setRestoreDialogOpen(true);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("backup.error"),
        description: String(err),
      });
    }
  };

  const handleRestoreConfirm = async () => {
    if (!pendingRestorePath) return;
    setRestoring(true);
    try {
      await invokeTauri("backup_restore", { path: pendingRestorePath }, { maxRetries: 2, retryDelayMs: 1000 });
      toast({
        title: t("backup.restoreSuccess"),
      });
      setRestoreDialogOpen(false);
      setPendingRestorePath(null);
      window.location.reload();
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("backup.error"),
        description: String(err),
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleRestoreCancel = () => {
    setRestoreDialogOpen(false);
    setPendingRestorePath(null);
  };

  if (!tauri) {
    return (
      <div className="container mx-auto px-4 py-6">
        <PageHeader title={t("backup.title")} subtitle={t("backup.subtitle")} />
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("backup.inDevelopment")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader title={t("backup.title")} subtitle={t("backup.subtitle")} />
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <Download className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-lg mb-1">{t("backup.exportButton")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("backup.exportDescription")}
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={!canExport || exporting}
            className="mt-auto"
          >
            {exporting ? "..." : t("backup.exportButton")}
          </Button>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-lg mb-1">{t("backup.restoreButton")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("backup.restoreDescription")}
            </p>
          </div>
          <Button
            onClick={handleRestoreClick}
            disabled={!canRestore || restoring}
            variant="secondary"
            className="mt-auto"
          >
            {restoring ? "..." : t("backup.restoreButton")}
          </Button>
        </div>
      </div>
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backup.restoreConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("backup.restoreConfirmDetail")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRestoreCancel}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              disabled={restoring}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoring ? "..." : t("backup.restoreButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
