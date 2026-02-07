import { useState } from "react";
import { createBackup, restoreBackup } from "@/api/backup";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Database, Download, Upload, Settings, History, FolderDown } from "lucide-react";
import { useTranslation } from "@/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { generatePrefixedId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
