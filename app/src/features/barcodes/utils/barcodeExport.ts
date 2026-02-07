import { jsPDF } from "jspdf";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const A6_IMG_W = 70;
const A6_IMG_H = 25;

function addBarcodePage(doc: jsPDF, base64: string, code: string, isFirst: boolean): void {
  if (!isFirst) doc.addPage([105, 148], "p");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const x = (pageW - A6_IMG_W) / 2;
  const y = (pageH - A6_IMG_H) / 2;
  const dataUrl = `${PNG_DATA_URL_PREFIX}${base64}`;
  doc.addImage(dataUrl, "PNG", x, y, A6_IMG_W, A6_IMG_H);
  doc.setFontSize(10);
  doc.text(code, pageW / 2, y + A6_IMG_H + 8, { align: "center" });
}

export function buildMultiPagePdfBytes(
  items: { base64: string; code: string }[]
): Uint8Array {
  if (items.length === 0) {
    const doc = new jsPDF({ unit: "mm", format: "a6" });
    return new Uint8Array(doc.output("arraybuffer"));
  }
  const doc = new jsPDF({ unit: "mm", format: "a6" });
  items.forEach((item, i) => addBarcodePage(doc, item.base64, item.code, i === 0));
  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
