/**
 * Mocks for Tauri APIs used in tests.
 * - invoke: backend commands (DB, etc.) – mock returns to avoid real I/O.
 * - event listen: barcode-scanned (pistol scanner) – simulate scans in tests.
 */

import { vi } from "vitest";

const barcodeListeners: Array<(event: { payload: string }) => void> = [];

export const mockInvoke = vi.fn();

function listenImpl(
  eventName: string,
  callback: (event: { payload: string }) => void
): Promise<() => void> {
  if (eventName === "barcode-scanned") {
    barcodeListeners.push(callback);
    return Promise.resolve(() => {
      const i = barcodeListeners.indexOf(callback);
      if (i >= 0) barcodeListeners.splice(i, 1);
    });
  }
  return Promise.resolve(() => {});
}

/**
 * Simulate a barcode scan from the pistol scanner (only in tests).
 * Use in tests that need to assert behaviour when the scanner fires.
 */
export function emitBarcodeScanned(payload: string): void {
  barcodeListeners.forEach((cb) => cb({ payload }));
}

export function clearBarcodeListeners(): void {
  barcodeListeners.length = 0;
}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenImpl,
}));
