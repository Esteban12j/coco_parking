import { invokeTauri } from "@/lib/tauriInvoke";

export interface BackupConfig {
  intervalHours: number;
  outputDirectory: string;
  maxRetained: number;
}

export interface BackupConfigUpdate {
  intervalHours?: number;
  outputDirectory?: string;
  maxRetained?: number;
}

export function createBackup(path: string): Promise<{ path: string; sizeBytes: number }> {
  return invokeTauri<{ path: string; sizeBytes: number }>("backup_create", { path });
}

export function restoreBackup(path: string): Promise<void> {
  return invokeTauri("backup_restore", { path }, {
    maxRetries: 2,
    retryDelayMs: 1000,
  });
}

export function getBackupConfig(): Promise<BackupConfig> {
  return invokeTauri<BackupConfig>("backup_config_get", {});
}

export function setBackupConfig(payload: BackupConfigUpdate): Promise<BackupConfig> {
  return invokeTauri<BackupConfig>("backup_config_set", { payload });
}
