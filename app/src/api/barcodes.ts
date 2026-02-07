import { invokeTauri } from "@/lib/tauriInvoke";
import type { Barcode } from "@/types/parking";

export function listBarcodes(): Promise<Barcode[]> {
  return invokeTauri<Barcode[]>("barcodes_list", {});
}

export function getBarcodeById(id: string): Promise<Barcode | null> {
  return invokeTauri<Barcode | null>("barcodes_get_by_id", { id });
}

export function getBarcodeByCode(code: string): Promise<Barcode | null> {
  return invokeTauri<Barcode | null>("barcodes_get_by_code", { code });
}

export function createBarcode(args: {
  code: string;
  label?: string | null;
}): Promise<Barcode> {
  return invokeTauri<Barcode>("barcodes_create", args);
}

export function deleteBarcode(id: string): Promise<void> {
  return invokeTauri("barcodes_delete", { id });
}

export interface BarcodeImageResult {
  base64: string;
  path?: string;
}

export function generateBarcodeImage(args: {
  code: string;
  exportPath?: string | null;
}): Promise<BarcodeImageResult> {
  return invokeTauri<BarcodeImageResult>("barcodes_generate_image", {
    code: args.code,
    exportPath: args.exportPath ?? undefined,
  });
}
