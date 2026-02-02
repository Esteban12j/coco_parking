import { invokeTauri } from "@/lib/tauriInvoke";

export function createBackup(args: {
  includeDb: boolean;
}): Promise<{ path: string; sizeBytes: number }> {
  return invokeTauri<{ path: string; sizeBytes: number }>("backup_create", args);
}

export function restoreBackup(path: string): Promise<void> {
  return invokeTauri("backup_restore", { path }, {
    maxRetries: 2,
    retryDelayMs: 1000,
  });
}
