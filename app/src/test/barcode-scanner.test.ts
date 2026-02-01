/**
 * Tests for barcode scanner (pistol) flow using mocks.
 * The real scanner is captured by Tauri/Rust; here we mock the event and assert
 * that the frontend reacts correctly when a scan is "received".
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { listen } from "@tauri-apps/api/event";
import { emitBarcodeScanned, clearBarcodeListeners } from "./mocks/tauri";

beforeEach(() => {
  clearBarcodeListeners();
});

describe("barcode-scanner mock", () => {
  it("listen('barcode-scanned') registers callback and emitBarcodeScanned calls it", async () => {
    const callback = vi.fn();
    const unlisten = await listen<string>("barcode-scanned", callback);
    expect(typeof unlisten).toBe("function");

    emitBarcodeScanned("TK123");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ payload: "TK123" }));

    emitBarcodeScanned("CODE-456");
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ payload: "CODE-456" }));

    unlisten();
    emitBarcodeScanned("AFTER");
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("multiple listeners all receive emitBarcodeScanned", async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    await listen("barcode-scanned", cb1);
    await listen("barcode-scanned", cb2);

    emitBarcodeScanned("MULTI");
    expect(cb1).toHaveBeenCalledWith(expect.objectContaining({ payload: "MULTI" }));
    expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ payload: "MULTI" }));
  });
});
