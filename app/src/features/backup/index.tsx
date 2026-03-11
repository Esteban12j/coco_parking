import { useState } from "react";
import { createBackup, restoreBackup } from "@/api/backup";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Database, Download, Upload, Settings, History, FolderDown, RefreshCw, CheckCircle2, AlertCircle, ArrowDownToLine } from "lucide-react";
import { useTranslation } from "@/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { generatePrefixedId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { checkForUpdateDetailed, installWithProgress } from "@/lib/updater";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BackupSettingsSection } from "./components/BackupSettingsSection";
import { BackupHistorySection } from "./components/BackupHistorySection";
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

  type UpdateState =
    | { phase: "idle" }
    | { phase: "checking" }
    | { phase: "up-to-date" }
    | { phase: "available"; version: string }
    | { phase: "downloading"; percent: number }
    | { phase: "installing" }
    | { phase: "error"; message: string };
  const [updateState, setUpdateState] = useState<UpdateState>({ phase: "idle" });

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
      await createBackup(path);
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
      await restoreBackup(pendingRestorePath);
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

  const handleCheckUpdate = async () => {
    setUpdateState({ phase: "checking" });
    const result = await checkForUpdateDetailed();
    if (result.status === "up-to-date") {
      setUpdateState({ phase: "up-to-date" });
    } else if (result.status === "available") {
      setUpdateState({ phase: "available", version: result.manifest.version });
    } else {
      setUpdateState({ phase: "error", message: result.message });
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateState({ phase: "downloading", percent: 0 });
    try {
      await installWithProgress((percent) => {
        setUpdateState({ phase: "downloading", percent });
      });
      setUpdateState({ phase: "installing" });
    } catch (err) {
      setUpdateState({ phase: "error", message: String(err) });
    }
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
      <div className="max-w-2xl">
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="settings" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{t("backup.settingsTitle")}</p>
                  <p className="text-sm font-normal text-muted-foreground">
                    {t("backup.settingsDescription")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              <BackupSettingsSection embedded />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="history" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <History className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{t("backup.historyTitle")}</p>
                  <p className="text-sm font-normal text-muted-foreground">
                    {t("backup.historyDescription")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              <BackupHistorySection embedded />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="updates" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <RefreshCw className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{t("backup.updatesTitle")}</p>
                  <p className="text-sm font-normal text-muted-foreground">
                    {t("backup.updatesDescription")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              <div className="space-y-4">
                {updateState.phase === "idle" || updateState.phase === "up-to-date" || updateState.phase === "error" ? (
                  <Button
                    variant="outline"
                    onClick={handleCheckUpdate}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t("backup.checkForUpdates")}
                  </Button>
                ) : null}

                {updateState.phase === "checking" && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {t("backup.checking")}
                  </p>
                )}

                {updateState.phase === "up-to-date" && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("backup.upToDate")}
                  </p>
                )}

                {updateState.phase === "available" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <ArrowDownToLine className="h-4 w-4 text-primary" />
                      {t("backup.updateAvailable")} <span className="font-mono">{updateState.version}</span>
                    </p>
                    <Button onClick={handleInstallUpdate} variant="coco" className="w-fit gap-2">
                      <Download className="h-4 w-4" />
                      {t("backup.installUpdate")}
                    </Button>
                  </div>
                )}

                {updateState.phase === "downloading" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t("backup.downloadProgress").replace("{{percent}}", String(updateState.percent))}
                    </p>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden w-48">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${updateState.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {updateState.phase === "installing" && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {t("backup.installing")}
                  </p>
                )}

                {updateState.phase === "error" && (
                  <p className="text-sm text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{t("backup.updateError")} {updateState.message}</span>
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="export-restore" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FolderDown className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{t("backup.exportRestoreTitle")}</p>
                  <p className="text-sm font-normal text-muted-foreground">
                    {t("backup.exportRestoreDescription")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col gap-3">
                  <Download className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">{t("backup.exportButton")}</h3>
                    <p className="text-sm text-muted-foreground">{t("backup.exportDescription")}</p>
                  </div>
                  <Button
                    onClick={handleExport}
                    disabled={!canExport || exporting}
                    className="mt-auto"
                  >
                    {exporting ? "..." : t("backup.exportButton")}
                  </Button>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col gap-3">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">{t("backup.restoreButton")}</h3>
                    <p className="text-sm text-muted-foreground">{t("backup.restoreDescription")}</p>
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
