/**
 * Escapes a string for safe use in an HTML attribute (e.g. title, data-*).
 * Prevents breaking out of the attribute and injecting script or HTML.
 * Use this whenever user- or API-supplied text is placed into an attribute.
 * For React text content (e.g. {value}), React already escapes; this is for attributes only.
 */
export function escapeForAttribute(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
