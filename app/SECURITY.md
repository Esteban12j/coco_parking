# Security — COCO Parking

This document describes the project’s stance on **SQL injection** and **HTML/XSS** prevention.

## Backend: SQL injection

- **Policy:** All database access uses **parameterized queries only**. No user or external input is ever concatenated into SQL strings.
- **Implementation:** The backend uses **rusqlite** with `params!`, `rusqlite::params!`, and `params_from_iter` for every `execute` and `query_map` call. Placeholders are used for all dynamic values (e.g. `?1`, `?2`).
- **Scope:** Applies to all domains: vehicles, caja, metricas, roles, auth, backup, reportes.

If you add new SQL in this project, keep using prepared statements and parameters. Do not build SQL via string concatenation or formatting with user input.

## Frontend: XSS and HTML injection

- **Policy:** User-provided text (e.g. plates, observations, notes) must never be interpreted as HTML. It must be treated as plain text when rendered.
- **Implementation:**
  - **React text content:** Any user-derived value rendered in JSX as a child (e.g. `{vehicle.plate}`, `{row.plate}`) is automatically escaped by React. We rely on this for all user-facing text.
  - **No raw HTML from user input:** We do **not** use `dangerouslySetInnerHTML` with any user or API-supplied data. The only use of `dangerouslySetInnerHTML` in the codebase is in the chart UI component, which injects **internal theme CSS** from a fixed config, not user input.
  - **Attributes:** When placing user-provided text into attributes (e.g. `title`, `data-*`), use the shared `escapeForAttribute` helper from `@/lib/escape` so that quotes and special characters cannot break out of the attribute context.

If you add new UI that displays user or backend-supplied strings, keep using React text nodes or `escapeForAttribute` for attributes; do not use `dangerouslySetInnerHTML` with that content.

## Optional: Content Security Policy (CSP)

The Tauri webview can enforce a **Content Security Policy** via `app.security.csp` in `src-tauri/tauri.conf.json`. A restrictive CSP reduces the impact of XSS by limiting script and resource origins. When enabled, it is tailored to the app’s needs (e.g. `default-src`, `connect-src` for IPC, `script-src`, `style-src`, `img-src`).

## Summary

| Risk           | Mitigation                                      |
|----------------|--------------------------------------------------|
| SQL injection  | Parameterized queries only (rusqlite placeholders). |
| XSS in DOM     | React text escaping; no `dangerouslySetInnerHTML` with user data. |
| XSS in attrs   | `escapeForAttribute()` for user text in attributes. |
| CSP            | Optional CSP in Tauri config for webview.        |
