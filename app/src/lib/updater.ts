import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateManifest = {
  version: string;
  date?: string;
  body?: string;
};

export type UpdateResult =
  | { shouldUpdate: true; manifest: UpdateManifest }
  | { shouldUpdate: false };

export async function checkForUpdate(): Promise<UpdateResult | null> {
  try {
    const update = await check();
    if (update) {
      return {
        shouldUpdate: true,
        manifest: {
          version: update.version,
          date: update.date ?? undefined,
          body: update.body ?? undefined,
        },
      };
    }
    return { shouldUpdate: false };
  } catch {
    return null;
  }
}

export async function installAndRelaunch(): Promise<void> {
  const update = await check();
  if (!update) return;
  await update.downloadAndInstall();
  await relaunch();
}
