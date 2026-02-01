# i18n – Multi-language support

## Usage

- **Switch language**: Use the dropdown in the sidebar (Languages icon). Choice is stored in `localStorage` under `coco-parking-locale`.
- **In components**: `const { t, locale, setLocale } = useTranslation();` then `t("nav.vehicles")` (dot path to the string in the dictionary).

## Adding a new language

1. **Extend the type** in `types.ts`: add the new code to `Locale`, e.g. `export type Locale = "en" | "es" | "fr";`.
2. **Create a new locale file** in `locales/`, e.g. `locales/fr.ts`, copying the structure from `en.ts` or `es.ts` and translating the values.
3. **Register the locale** in `context.tsx`: import the new dictionary and add it to the `dictionaries` object and to `getStoredLocale()` validation (e.g. `if (stored === "fr") return "fr";`).
4. **Add the option in the UI**: In `AppLayout.tsx`, add a new `<SelectItem value="fr">Français</SelectItem>` (and optionally export `SUPPORTED_LOCALES` from `index.ts` and use it to build the options).

Keys are grouped by feature: `app`, `common`, `nav`, `vehicles`, `till`, `metrics`, `roles`, `backup`, `drive`, `devConsole`, `checkout`, `notFound`. Use the same keys in every locale file.
