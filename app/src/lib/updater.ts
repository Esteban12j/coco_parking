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

export type CheckUpdateResult =
  | { status: "up-to-date" }
  | { status: "available"; manifest: UpdateManifest }
  | { status: "error"; message: string };

export async function checkForUpdateDetailed(): Promise<CheckUpdateResult> {
  try {
    const update = await check();
    if (update) {
      return {
        status: "available",
        manifest: {
          version: update.version,
          date: update.date ?? undefined,
          body: update.body ?? undefined,
        },
      };
    }
    return { status: "up-to-date" };
  } catch (err) {
    return { status: "error", message: String(err) };
  }
}

export async function installWithProgress(
  onProgress: (percent: number) => void
): Promise<void> {
  const update = await check();
  if (!update) return;

  let received = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
    } else if (event.event === "Progress") {
      received += event.data.chunkLength;
      if (total > 0) {
        onProgress(Math.round((received / total) * 100));
      }
    }
  });

  await relaunch();
}

export async function installAndRelaunch(): Promise<void> {
  const update = await check();
  if (!update) return;
  await update.downloadAndInstall();
  await relaunch();
}
