import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ALPHANUMERIC =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generatePrefixedId(prefix: string, totalLength: number): string {
  const suffixLen = Math.max(0, totalLength - prefix.length);
  const bytes = new Uint8Array(suffixLen);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => ALPHANUMERIC[b % ALPHANUMERIC.length]).join("");
  return prefix + suffix;
}
