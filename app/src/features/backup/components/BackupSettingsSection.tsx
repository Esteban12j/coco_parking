import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { getBackupConfig, setBackupConfig } from "@/api/backup";
import { FolderOpen, Settings } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BACKUP_CONFIG_QUERY_KEY = ["backup", "config"];
const BACKUP_LIST_QUERY_KEY = ["backup", "list"];

interface BackupSettingsSectionProps {
  embedded?: boolean;
}

export function BackupSettingsSection({ embedded = false }: BackupSettingsSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useMyPermissions();

  const canReadConfig = hasPermission("backup:config:read");
  const canModifyConfig = hasPermission("backup:config:modify");

  const [intervalHours, setIntervalHours] = useState<string>("12");
  const [outputDirectory, setOutputDirectory] = useState<string>("");
  const [maxRetained, setMaxRetained] = useState<string>("7");

  const configQuery = useQuery({
    queryKey: BACKUP_CONFIG_QUERY_KEY,
    queryFn: getBackupConfig,
    enabled: canReadConfig,
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setIntervalHours(String(configQuery.data.intervalHours));
    setOutputDirectory(configQuery.data.outputDirectory ?? "");
    setMaxRetained(String(configQuery.data.maxRetained));
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { intervalHours?: number; outputDirectory?: string; maxRetained?: number }) =>
      setBackupConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUP_CONFIG_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BACKUP_LIST_QUERY_KEY });
      toast({ title: t("backup.settingsSaved") });
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        title: t("backup.settingsError"),
        description: String(err),
      });
    },
  });

  const handleSelectDirectory = async () => {
    try {
      const folder = await open({ directory: true, multiple: false });
      if (typeof folder === "string") setOutputDirectory(folder);
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("backup.settingsError"),
        description: String(err),
      });
    }
  };

  const handleSave = () => {
    const interval = parseInt(intervalHours, 10);
    const retained = parseInt(maxRetained, 10);
    if (Number.isNaN(interval) || interval < 1) {
      toast({
        variant: "destructive",
        title: t("backup.settingsError"),
        description: t("backup.intervalHoursHint"),
      });
      return;
    }
    if (Number.isNaN(retained) || retained < 1) {
      toast({
        variant: "destructive",
        title: t("backup.settingsError"),
        description: t("backup.maxRetainedHint"),
      });
      return;
    }
    saveMutation.mutate({
      intervalHours: interval,
      outputDirectory: outputDirectory.trim() || undefined,
      maxRetained: retained,
    });
  };

  if (!canReadConfig) return null;

  const isLoading = configQuery.isLoading;
  const isSaving = saveMutation.isPending;

  const content = (
    <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="backup-interval">{t("backup.intervalHours")}</Label>
          <Input
            id="backup-interval"
            type="number"
            min={1}
            value={intervalHours}
            onChange={(e) => setIntervalHours(e.target.value)}
            disabled={!canModifyConfig || isLoading}
          />
          <p className="text-xs text-muted-foreground">{t("backup.intervalHoursHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="backup-output-dir">{t("backup.outputDirectory")}</Label>
          <div className="flex gap-2">
            <Input
              id="backup-output-dir"
              type="text"
              value={outputDirectory}
              onChange={(e) => setOutputDirectory(e.target.value)}
              disabled={!canModifyConfig || isLoading}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleSelectDirectory}
              disabled={!canModifyConfig || isLoading}
              title={t("backup.selectDirectory")}
              aria-label={t("backup.selectDirectory")}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("backup.outputDirectoryHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="backup-max-retained">{t("backup.maxRetained")}</Label>
          <Input
            id="backup-max-retained"
            type="number"
            min={1}
            value={maxRetained}
            onChange={(e) => setMaxRetained(e.target.value)}
            disabled={!canModifyConfig || isLoading}
          />
          <p className="text-xs text-muted-foreground">{t("backup.maxRetainedHint")}</p>
        </div>
        {canModifyConfig && (
          <Button onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? "..." : t("backup.saveSettings")}
          </Button>
        )}
    </div>
  );

  if (embedded) return content;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{t("backup.settingsTitle")}</CardTitle>
        </div>
        <CardDescription>{t("backup.settingsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {content}
      </CardContent>
    </Card>
  );
}
