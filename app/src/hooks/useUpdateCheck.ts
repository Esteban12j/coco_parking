import { useState, useEffect } from "react";
import type { UpdateManifest } from "@/lib/updater";
import { checkForUpdate } from "@/lib/updater";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

export function useUpdateCheck(): {
  updateAvailable: UpdateManifest | null;
  dismissUpdate: () => void;
  checking: boolean;
} {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateManifest | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isTauri()) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    checkForUpdate().then((result) => {
      if (cancelled) return;
      setChecking(false);
      if (result?.shouldUpdate && result.manifest) {
        setUpdateAvailable(result.manifest);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissUpdate = () => setUpdateAvailable(null);

  return { updateAvailable, dismissUpdate, checking };
}
