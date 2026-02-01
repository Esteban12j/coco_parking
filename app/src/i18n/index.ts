export { I18nProvider, useI18n, LOCALE_STORAGE_KEY } from "./context";
export { useTranslation } from "./useTranslation";
export type { Locale, Translations } from "./types";
export { en } from "./locales/en";
export { es } from "./locales/es";

export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
