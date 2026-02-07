# Product Backlog — COCO Parking

**Last updated:** February 2025  
**Audience:** Scrum Master, Product Manager, development team.

---

## PM decisions (closed)

The following decisions are **closed**. The Scrum Master should use the **Development tickets** section below to plan sprints and assign work to the development engineer.

| # | Topic | Decision |
|---|--------|----------|
| 1 | Vehicle in parking: remove vs zero-cost exit | **Option B:** Explicit **"Remove vehicle from parking"** action. Do not use "close session at zero cost" for error correction. Reason: clear audit trail, accurate reporting (exits with charge vs removed), and separation of operational exit from error correction. |
| 2 | BarCode menu: format and storage | **Format:** 8-digit numeric code. **Range:** 10000000–99999999. **Storage:** New table `barcodes` (id, code, label optional, created_at). Uniqueness enforced in DB. Menu label: "BarCode" in main sidebar. |
| 3 | Backup strategy | **Periodic:** One full backup every configurable interval (default 12 hours). **On close:** Always run one backup before app exit (non-blocking). **Format:** Compressed (gzip) SQLite dump for full backups. **Retention:** Keep last 7 full backups; path and retention configurable. Incremental strategy deferred to a later refinement if needed. |
| 4 | First install: admin password + dev account | **Confirmed as specified:** First-run flow forces admin password change; hidden developer account created at install, not listed in roles UI; dev credentials stored securely in DB; dev role restricted to recovery/administration only. |

---

## Backlog items (defined)

### 1. Remove vehicle from parking

**Problem:** If a vehicle is registered by mistake, there is no way to correct it; the space remains occupied.

**Decision (PM):** Explicit **"Remove vehicle from parking"** action (no zero-cost exit for this case).

**Acceptance criteria:**

- From the active vehicles view, the user can trigger **"Remove from parking"** for a selected vehicle.
- The action requires confirmation (e.g. dialog: "Remove this vehicle from parking? This cannot be undone.").
- On confirm: the vehicle is removed from the current parking session (space freed), and the record is updated so it is not considered an exit with charge (no till entry, no tariff applied). Optionally mark as "removed" in history for audit.
- No "ghost" spaces: the slot count and list of active vehicles must reflect the removal immediately.
- Only users with permission to manage vehicles can perform this action.

**Notes:** Avoid mixing with normal exit flow; this is for error correction only.

---

### 2. BarCode management (menu "BarCode")

**Problem:** The scanner uses barcodes. If physical codes are lost, new ones must be generated; the original ID is unknown. The system must support recreating and reprinting codes.

**Requirements:**

| Requirement | Description |
|-------------|-------------|
| **Menu** | "BarCode" item in the main (right) sidebar, reachable from main navigation. |
| **Input** | Allow manual entry of a barcode ID or reading via scanner. |
| **Create** | Create new codes: 8 digits, range 10000000–99999999, uniqueness enforced. |
| **Generate & print** | Generate barcode image/file from the stored code and support export for printing (e.g. PNG/PDF). |
| **Delete** | Allow deletion of a barcode (inventory management). |

**Storage:** Table `barcodes`: `id` (PK), `code` (unique, 8-digit), `label` (optional), `created_at`.

**Acceptance criteria (summary):** BarCode menu → create/delete codes; 8-digit numeric, unique; generate barcode asset and export for print; integrate with existing scanner flow so tickets/codes managed here work at entry.

**Notes:** Ensure the current scanner entry flow still works with codes created in this module.

---

### 3. Automatic backup (periodic and on exit)

**Problem:** Today backup depends on the user running it manually; risk of data loss.

**Decision (PM):** Full backup at configurable interval (default 12 h); always run a backup on app close (non-blocking).

**Requirements:**

| Requirement | Description |
|-------------|-------------|
| **Periodic backup** | Run full backup every X (configurable, default 12 hours). Lightweight: gzip-compressed SQLite dump. |
| **Backup on exit** | On application close, run one backup automatically without blocking the user from exiting. |
| **Retention** | Keep last 7 full backups (path and count configurable). |

**Acceptance criteria (summary):** Scheduled full backup (interval configurable); backup guaranteed on close; compressed format; retention policy applied; no UI block on exit.

**Notes:** Tech lead may refine retention path and naming (e.g. `backup_YYYY-MM-DD_HH-mm.sqlite.gz`).

---

### 4. First install: mandatory admin password change + hidden developer account

**Problem:** Security on first install and recovery when access is lost.

**Requirements:**

| Requirement | Description |
|-------------|-------------|
| **Mandatory password change** | On **first install**, force the admin user to change their password before using the app. |
| **Hidden developer role** | A developer account: (a) created in DB at install, (b) **not shown** in the roles/users list, (c) allows password recovery from inside the app. |
| **Developer credentials** | Fixed password for that account stored securely in DB: `nXctxh7f7j?cop&YiNLrt#G&jcKFst?afc9e`. Never exposed in list views or logs. |
| **Permissions** | Developer role limited to recovery and administration actions only. |

**Acceptance criteria (summary):** First run → flow that forces admin password change; dev account created at install, not listable in roles UI; can reset user passwords; dev password only in DB, restricted use; document security considerations.

---

## Development tickets for Scrum Master

**Scrum Master — update:** Ticket **1.1 (API: remove vehicle from parking)** is **done**. Ticket **1.2 (Permission: remove-from-parking)** is **done**. Tickets **1.3 (UI: Remove from parking action)** and **1.4 (UI: Confirmation dialog)** are **done**. Ticket **1.5 (Audit/history)** is **done**. Implemented: "Remove from parking" control in the active vehicles grid (1.3) calling the API from 1.1; confirmation dialog (1.4) with title "Remove from parking", irreversible/error-correction message, and Confirm/Cancel before calling the API. For 1.5: the "removed" status was already persisted on the vehicle record; a new report type **"Vehicle exits (completed + removed)"** was added so reports can distinguish removed vehicles from normal exits. The report lists all vehicles with an exit in the date range and includes an **Exit type** column (completed | removed). You can move 1.5 to completed and consider Epic 1 closed.

**Scrum Master — update (ticket 2.2):** Ticket **2.2 (API: CRUD barcodes)** is **done**. Backend: `barcodes_list`, `barcodes_get_by_id`, `barcodes_get_by_code`, `barcodes_create`, `barcodes_delete`; create validates 8-digit and range 10000000–99999999 and returns clear errors for invalid format or duplicate code. Permissions `barcodes:read`, `barcodes:create`, `barcodes:delete` are in place (assign to roles in Roles UI). Frontend API: `api/barcodes.ts` (listBarcodes, getBarcodeById, getBarcodeByCode, createBarcode, deleteBarcode). You can mark 2.2 completed and schedule 2.4, 2.5, 2.6, 2.8 as needed.

**Scrum Master — update (ticket 2.3):** Ticket **2.3 (API: generate barcode image)** is **done**. Implemented: backend command `barcodes_generate_image` in `domains/barcodes.rs`; given a code (8-digit, validated), generates a Code128 barcode PNG (height 80px, compatible with typical scanners). Returns `{ base64: string, path?: string }`: always returns base64 PNG data; if `exportPath` is provided, writes the PNG to that path and includes it in the response. Uses `barcoders` crate with Code128 and image feature. Permission: `barcodes:read`. Frontend API: `generateBarcodeImage({ code, exportPath? })` in `api/barcodes.ts`. You can mark 2.3 completed; ticket 2.7 (Generate and export UI) is now unblocked.

**Scrum Master — update (ticket 2.5):** Ticket **2.5 (Page: BarCode list)** is **done**. Implemented: BarCode list page at `/barcode` with table (columns: code, label, created_at, actions). Actions per row: Generate/Export (downloads PNG via existing API) and Delete (with confirmation dialog). Manual and scanner input supported via reused `ScannerInput` (placeholder and bottom text for barcodes); on submit: if code exists, list filters to that code; if not and valid 8-digit and user has `barcodes:create`, creates new barcode; otherwise shows error. Clear-filter control when a search filter is active. Permissions: `barcodes:read` for list/export, `barcodes:create` for create, `barcodes:delete` for delete. Components: `features/barcodes/components/BarcodeListTable.tsx`, page in `features/barcodes/index.tsx`; i18n (en/es) for all labels and messages. You can mark 2.5 completed; 2.6 (create flow), 2.7 (generate/export UI), 2.8 (delete) are partially or fully covered by this page—refine with the team if any subtasks remain.

**Scrum Master — update (ticket 2.6):** Ticket **2.6 (BarCode: create flow)** is **done**. Create flow is implemented as an **inline flow** on the BarCode list page: the user scans or types a code in the same input used for search; on submit, if the code does not exist and is valid (1–24 digits, flexible format), the app creates it via `barcodes_create` (user must have `barcodes:create`). Uniqueness and format/length are validated by the API; duplicate or invalid input shows a clear error. **Not implemented:** "Generate next" (server suggests next available code in range). If the product wants that, it can be scheduled as a small follow-up (backend endpoint + UI button). You can mark 2.6 completed.

**Instructions for Scrum Master:** Use these tickets to update the sprint backlog. Each ticket is a single unit of work for the development engineer. Order and split by sprint as needed; dependencies are noted.

---

### Epic 1 — Remove vehicle from parking

| ID | Ticket | Details | Deps |
|----|--------|---------|------|
| 1.1 | **API: remove vehicle from parking** ✅ *Done* | Add backend/API method (e.g. `removeVehicleFromParking(vehicleId or sessionId)`) that: marks the vehicle as removed, frees the slot, does not create a till movement or tariff charge. Ensure DB transaction and slot count update. **Implemented:** `vehiculos_remove_from_parking(vehicle_id?, ticket_code?)` in Rust; `removeVehicleFromParking({ vehicleId?, ticketCode? })` in frontend. Status `removed` added; no transaction row; slot count is derived from active count. | — |
| 1.2 | **Permission: remove-from-parking** ✅ *Done* | Add permission (e.g. `vehicles.remove_from_parking` or reuse existing vehicle-management permission). Enforce in API and in UI (show "Remove from parking" only if allowed). **Implemented:** `vehiculos:entries:remove_from_parking`; API checks it in `vehiculos_remove_from_parking`; UI shows "Remove from parking" in active vehicles grid only when user has this permission. | — |
| 1.3 | **UI: Remove from parking action** ✅ *Done* | In the active vehicles list/grid, add a control (button or row action) "Remove from parking" that calls the API from 1.1. | 1.1, 1.2 |
| 1.4 | **UI: Confirmation dialog** ✅ *Done* | Before calling remove API, show a confirmation dialog: title "Remove from parking", message explaining the action is irreversible and for error correction only, Confirm / Cancel. | 1.3 |
| 1.5 | **Audit/history (optional)** ✅ *Done* | If product requests audit trail: persist a "removed" status or event in history so reports can distinguish removed vehicles from normal exits. Refine with PM if needed. **Implemented:** Vehicle record already stores `status = 'removed'`. New report type "Vehicle exits" shows all exits in date range with column "Exit type" (completed | removed) for distinction in exports. | 1.1 |

---

### Epic 2 — BarCode management

| ID | Ticket | Details | Deps |
|----|--------|---------|------|
| 2.1 | **DB: barcodes table** ✅ *Done* | Create table `barcodes` with columns: `id` (PK), `code` (TEXT or INTEGER, unique, 8-digit), `label` (TEXT, optional), `created_at`. Add migration/seed if applicable. **Implemented:** Migration 16 in `db.rs`: table `barcodes` (id TEXT PK, code TEXT NOT NULL UNIQUE with CHECK 8-digit range 10000000–99999999, label TEXT, created_at TEXT). Included in backup/restore DATA_TABLES. No seed (user-created data). | — |
| 2.2 | **API: CRUD barcodes** ✅ *Done* | Implement API: list barcodes, get by id/code, create (validate 8-digit, range 10000000–99999999, uniqueness), delete. Return clear errors for duplicate or invalid format. **Implemented:** `barcodes_list`, `barcodes_get_by_id`, `barcodes_get_by_code`, `barcodes_create`, `barcodes_delete` in `domains/barcodes.rs`; validation for 8-digit and range; clear errors: "Barcode code must be exactly 8 digits...", "A barcode with this code already exists.", "Barcode not found." Permissions: `barcodes:read`, `barcodes:create`, `barcodes:delete`. Frontend API in `api/barcodes.ts`. | 2.1 |
| 2.3 | **API: generate barcode image** ✅ *Done* | Implement endpoint or utility that, given a code, generates a barcode image (e.g. Code128 or format used by the scanner). Return image (PNG) or base64; consider export path for file. **Implemented:** `barcodes_generate_image` (code, optional exportPath); Code128 PNG, returns base64 + optional path when exported. | — |
| 2.4 | **Sidebar: BarCode menu item** ✅ *Done* | Add "BarCode" to the main sidebar navigation, pointing to the new BarCode feature route. **Implemented:** Nav item "BarCode" in `AppLayout.tsx` (icon Barcode, permission `barcodes:read`), route `/barcode` in `App.tsx`, `ROUTE_REQUIRED_PERMISSION` and fallback in `useMyPermissions.ts`, placeholder `BarcodesPage` in `features/barcodes/index.tsx`, i18n `nav.barcode` and `barcodes.subtitle` (en/es). | — |
| 2.5 | **Page: BarCode list** ✅ *Done* | New page under BarCode: list all barcodes (table or grid) with columns: code, label, created_at, actions (generate/export, delete). Support manual code input and scanner input for search/create. | 2.2, 2.4 |
| 2.6 | **BarCode: create flow** ✅ *Done* | Form or inline flow to create a new code: input 8-digit or "generate next" (server suggests next available in range). Validate uniqueness and range. **Implemented:** Inline create on list page (scan/type code → if not found and valid 1–24 digits → create). API validates uniqueness and format. "Generate next" not implemented; optional follow-up if product requests it. | 2.2, 2.5 |
| 2.7 | **BarCode: generate and export** ✅ *Done* | Button "Generate / Export" per row: call 2.3, show preview and/or offer download (PNG/PDF) for printing. **Implemented:** Click opens preview dialog with barcode image (API 2.3); dialog offers "Download PNG", "Download PDF" (client-side PDF via jsPDF with image + code on A6), and "Close". Toasts on successful export. | 2.3, 2.5 |
| 2.8 | **BarCode: delete** ✅ *Done* | Delete action per row with confirmation; call delete API and refresh list. **Implemented:** Per-row delete button (Trash icon) when user has `barcodes:delete`; confirmation dialog (title + description, Cancel/Delete); on confirm calls `barcodes_delete` API; on success invalidates list query and shows toast; delete button shows loading spinner for the row being deleted. | 2.2, 2.5 |
| 2.9 | **Integration: scanner at entry** ✅ *Done* | Ensure entry flow (scanner/ticket input) accepts codes that exist in `barcodes` and behaves correctly (e.g. lookup by code). No regression to current scanner behavior. **Implemented:** Entry flow normalizes scanned code (trim) before lookup and before setting ticket for registration; lookup uses `vehiculos_find_by_ticket` (unchanged); registration uses same code as `ticket_code`. Codes created in BarCode (8-digit, trimmed) work as tickets at entry and exit. No backend change; no new permission. | 2.2 |

---

### Epic 3 — Automatic backup

| ID | Ticket | Details | Deps |
|----|--------|---------|------|
| 3.1 | **Config: backup interval and path** ✅ *Done* | Add settings for backup: interval in hours (default 12), output directory, max retained full backups (default 7). Persist in app config or DB. **Implemented:** Persisted in DB table `drive_config` (key-value). Backend: `backup_config_get`, `backup_config_set`; defaults: interval 12 h, max retained 7; empty output directory resolved to app data dir + `backups`. Permissions: `backup:config:read`, `backup:config:modify`. Frontend API: `getBackupConfig()`, `setBackupConfig(payload)` in `api/backup.ts` with types `BackupConfig`, `BackupConfigUpdate`. | — |
| 3.2 | **Service: full backup (compressed)** ✅ *Done* | Implement full backup: dump SQLite (or copy DB file) and gzip. Save to configured path with naming convention (e.g. `backup_YYYY-MM-DD_HH-mm.sqlite.gz`). **Implemented:** Backend command `backup_run_full` (no args): reads backup output directory from `drive_config`, creates dir if needed, copies DB to temp file via SQLite backup API, compresses with gzip to `backup_YYYY-MM-DD_HH-mm.sqlite.gz`, returns path and size. Permission `backup:create`. Frontend API: `runFullBackup()` in `api/backup.ts`. | — |
| 3.3 | **Scheduler: periodic backup** ✅ *Done* | Run full backup every X hours (from config). Use a timer/scheduler that works with Tauri (e.g. setInterval or Tauri plugin). On run: call 3.2 and apply retention (delete oldest if count > 7). **Implemented:** Backend scheduler in `domains/backup.rs`: `spawn_backup_scheduler(app)` started from `lib.rs` setup. Dedicated OS thread: reads `backup_interval_hours` from config (default 12), sleeps that long, then runs full backup (same logic as 3.2) and applies retention (keeps last `backup_max_retained` files, deletes oldest). Retention applied after every full backup (manual and scheduled). Tickets **3.4 (Backup on app close)** and **3.5 (UI: backup settings)** remain. | 3.1, 3.2 |
| 3.4 | **Backup on app close** ✅ *Done* | On application close event: trigger one backup (reuse 3.2). Ensure it is non-blocking (e.g. fire-and-forget with short timeout or background write) so user can exit. **Implemented:** `trigger_backup_on_exit(app)` in `domains/backup.rs` spawns a background thread that runs full backup (same as 3.2: `run_full_backup_with_retention`). Registered in `lib.rs` via `.on_window_event()` on `WindowEvent::CloseRequested`; handler calls `trigger_backup_on_exit(window.app_handle().clone())` and does not prevent close, so exit is non-blocking. | 3.2 |
| 3.5 | **UI: backup settings (optional)** ✅ *Done* | If product wants user-editable interval/path: add a settings section for backup (interval, path, retention). Otherwise use defaults and env/config only. **Implemented:** Settings section on Backup page: interval (hours), output directory, max retained; uses `getBackupConfig` / `setBackupConfig`; visible when user has `backup:config:read`, editable and Save when `backup:config:modify`. i18n en/es. | 3.1 |

---

### Epic 4 — First install: admin password change + developer account

| ID | Ticket | Details | Deps |
|----|--------|---------|------|
| 4.1 | **First-run flag** ✅ *Done* | Persist a "first run completed" or "admin password changed" flag (DB or config). On app start, if not set, redirect to first-run flow instead of normal login/dashboard. **Implemented:** Flag stored in `drive_config` table (key `first_run_completed`, value `"1"` when done). Backend: `first_run_get_status` and `first_run_set_completed` (no auth required so app can decide before login). Frontend: `api/firstRun.ts`, `useFirstRunStatus` hook; `AuthGate` waits for session + first-run status, then redirects to `/first-run` when flag not set; route `/first-run` with placeholder page (ticket 4.2 will replace with admin password change form). | — |
| 4.2 | **First-run: force admin password change** ✅ *Done* | First-run screen: require admin to set a new password (current default + new + confirm). On success, set flag from 4.1 and proceed to app. **Implemented:** Backend command `first_run_change_admin_password(current_password, new_password)` in `domains/first_run.rs`: verifies current password against admin user (`user_admin`), validates new password length ≥ 4, updates hash and returns. No auth required (first-run is pre-login). Frontend: `/first-run` form with current password, new password, confirm password; client-side validation for match and min length; on success calls API then `first_run_set_completed` and navigates to `/login`. i18n en/es for all labels and messages. | 4.1 |
| 4.3 | **Seed: developer account** ✅ *Done* | On install/migration, create hidden developer user in DB with fixed password (stored hashed). Role "developer" with restricted permissions (recovery/admin only). Do not expose password in code or logs. **Implemented:** Migration 18 adds `users.hidden`; `seed_developer_role_and_user` creates role `developer` and user `developer` (hidden=1). Password hash is set at **build time** via env `COCO_DEV_PASSWORD` (build.rs hashes and embeds; password never in source or logs). Developer permissions: backup list/create/restore/config, dev console. Login with username `developer` and the password set when building. | — |
| 4.4 | **Roles UI: hide developer** ✅ *Done* | In the roles/users list, filter out the developer account so it never appears in the UI. Ensure no API returns it in "list users" for admin UI. **Implemented:** `roles_list_users` filters with `WHERE COALESCE(u.hidden, 0) = 0`. | 4.3 |
| 4.5 | **Dev: password reset** | Developer-only flow (e.g. from dev console or hidden route): allow resetting another user's password. Protect by developer login only. | 4.3 |
| 4.6 | **Security doc** | Short note in security/docs: dev account purpose, that it is hidden, and that permissions are restricted to recovery/administration. | — |

---

## Summary for planning

| # | Theme | Status |
|---|--------|--------|
| 1 | Remove vehicle from parking | Defined; tickets 1.1–1.5. |
| 2 | BarCode menu: CRUD, generate, export | Defined; tickets 2.1–2.9. |
| 3 | Automatic backup (periodic + on close) | Defined; tickets 3.1–3.5. |
| 4 | First install: admin password + dev account | Defined; tickets 4.1–4.6. |

---

## Next steps for Scrum Master

**Update (ticket 2.4 completed):** Epic 2 ticket **2.4 (Sidebar: BarCode menu item)** is **done**. The main sidebar now includes a "BarCode" item pointing to `/barcode`. Route is protected by `barcodes:read`; users need that permission to see the item and access the page. A placeholder BarCode page is in place; ticket **2.5 (Page: BarCode list)** will replace it with the full list/CRUD UI.

**Update (ticket 2.2 completed):** Epic 2 ticket **2.2 (API: CRUD barcodes)** is **done**. Implemented: list, get by id, get by code, create (with 8-digit range validation and uniqueness), delete. Clear error messages for invalid format and duplicate code. Permissions `barcodes:read`, `barcodes:create`, `barcodes:delete` added; assign to roles as needed. Tickets **2.5**, **2.6**, **2.8** (list page, create flow, delete UI) are now unblocked.

**Update (ticket 2.5 completed):** Epic 2 ticket **2.5 (Page: BarCode list)** is **done**. The BarCode page now shows a full list (table with code, label, created_at, actions). Scanner/manual input supports search (filter by code) and create (when code not found and user has permission). Generate/Export and Delete actions are implemented with confirmation for delete. Mark 2.5 done; 2.6, 2.7, 2.8 may be considered largely done by this implementation—refine with the team.

**Update (ticket 2.6 completed):** Epic 2 ticket **2.6 (BarCode: create flow)** is **done**. Create is implemented inline on the BarCode list page (scan/type code → create when not found and valid 1–24 digits). Uniqueness and format validated by API. "Generate next" (server-suggested code) was not implemented; schedule as follow-up if the product wants it.

**Scrum Master — update (ticket 2.9):** Ticket **2.9 (Integration: scanner at entry)** is **done**. The entry flow (Vehicles page scanner/ticket input) now normalizes the scanned code (trim) and uses it for: (1) lookup via `vehiculos_find_by_ticket` (existing vehicle → checkout), (2) entry form ticket display, (3) registration as `ticket_code`. Codes that exist in the `barcodes` table (8-digit, stored trimmed) are accepted and behave correctly: same code is used for lookup and for new entry, so tickets generated from the BarCode module work at entry and at exit. Current scanner behavior is unchanged (hardware event and manual input still drive the same flow). You can mark 2.9 completed and consider Epic 2 (BarCode management) closed.

**Scrum Master — update (ticket 2.8):** Ticket **2.8 (BarCode: delete)** is **done**. Delete is implemented: per-row delete button (Trash) when user has `barcodes:delete`; confirmation dialog with title and description; on confirm the app calls `barcodes_delete` API, invalidates the barcodes list (refresh), shows success toast, and the delete button shows a loading spinner for the row in progress. You can mark 2.8 completed.

**Scrum Master — update (ticket 2.7):** Ticket **2.7 (BarCode: generate and export)** is **done**. The "Generate / Export" button per row calls the API from 2.3 to generate the barcode image, then opens a preview dialog showing the barcode. The dialog offers: **Download PNG** (same as before), **Download PDF** (client-side PDF via jsPDF: A6 page with centered barcode image and code text, for printing), and **Close**. Success toasts shown on export. Components: `BarcodeExportPreview.tsx` in `features/barcodes/components/`; i18n keys added for preview title, description, downloadPng, downloadPdf, previewClose (en/es). You can mark 2.7 completed.

**Scrum Master — update (ticket 3.1):** Ticket **3.1 (Config: backup interval and path)** is **done**. Implemented: backup settings stored in DB table `drive_config` (keys: `backup_interval_hours`, `backup_output_directory`, `backup_max_retained`). Defaults: interval 12 hours, max retained 7, output directory resolved to app data dir + `backups` when not set. Backend commands: `backup_config_get` (returns resolved config), `backup_config_set` (partial update, validates interval and max_retained ≥ 1). New permissions: `backup:config:read`, `backup:config:modify` (add to admin and assign in Roles as needed). Frontend: `api/backup.ts` exposes `getBackupConfig()` and `setBackupConfig(payload)` with TypeScript types. Ticket **3.5 (UI: backup settings)** can use these APIs to build the settings section. You can mark 3.1 completed.

**Scrum Master — update (ticket 3.2):** Ticket **3.2 (Service: full backup compressed)** is **done**. Implemented: backend command `backup_run_full` (no arguments). It uses the configured backup output directory (from `drive_config`, default app data dir + `backups`), creates the directory if missing, copies the SQLite DB to a temporary file via the existing backup API, compresses it with gzip, and writes the result as `backup_YYYY-MM-DD_HH-mm.sqlite.gz`. Returns the full path and size in bytes. Permission: `backup:create`. Frontend: `runFullBackup()` in `api/backup.ts`. Tickets **3.3 (Scheduler)** and **3.4 (Backup on app close)** can call this command. You can mark 3.2 completed.

**Scrum Master — update (ticket 3.3):** Ticket **3.3 (Scheduler: periodic backup)** is **done**. Implemented: periodic backup scheduler in backend (`domains/backup.rs`). On app startup, `spawn_backup_scheduler(app)` is called from `lib.rs` setup. A dedicated OS thread runs in a loop: reads `backup_interval_hours` from config (default 12), sleeps for that duration, then runs a full backup (same logic as 3.2) and applies retention. Retention: after every full backup (manual or scheduled), backup files in the output directory matching `backup_*.sqlite.gz` are listed, sorted by name (oldest first), and the oldest are deleted so that at most `backup_max_retained` (default 7) remain. Manual "Export backup" (3.2) also applies retention. You can mark 3.3 completed. Tickets **3.4 (Backup on app close)** and **3.5 (UI: backup settings)** remain.

**Scrum Master — update (ticket 3.4):** Ticket **3.4 (Backup on app close)** is **done**. On window close (`WindowEvent::CloseRequested`), the app triggers one full backup in a fire-and-forget background thread via `trigger_backup_on_exit(app_handle)`. The same backup logic as 3.2 is used (`run_full_backup_with_retention`). The close is not blocked: the handler does not call `prevent_close()`, so the user can exit immediately while the backup runs in the background. You can mark 3.4 completed. Ticket **3.5 (UI: backup settings)** remains optional.

**Scrum Master — update (ticket 3.5):** Ticket **3.5 (UI: backup settings)** is **done**. A backup settings section was added to the Backup page (`/backup`). It shows: **Interval (hours)** (number, min 1), **Output directory** (text; empty = default app data/backups), **Backups to keep** (number, min 1). The section is visible to users with `backup:config:read`; users with `backup:config:modify` can edit and save. The UI uses `getBackupConfig()` and `setBackupConfig()` from `api/backup.ts`. Component: `features/backup/components/BackupSettingsSection.tsx`. i18n keys added for en/es. You can mark 3.5 completed and consider Epic 3 (Automatic backup) closed.

**Scrum Master — update (ticket 4.1):** Ticket **4.1 (First-run flag)** is **done**. The app persists a "first run completed" flag in the DB (`drive_config.first_run_completed`). Backend commands: `first_run_get_status` (returns `{ completed: boolean }`) and `first_run_set_completed` (sets the flag); both are callable without authentication so the app can decide routing before login. On startup (Tauri), the frontend loads session and first-run status in parallel; if the flag is not set, the user is redirected to `/first-run` instead of `/login`. A placeholder first-run page at `/first-run` shows title/description and a "Continue to login" button that sets the flag and navigates to login (ticket **4.2** will replace this with the admin password change form). i18n keys: `firstRun.title`, `firstRun.description`, `firstRun.continueToLogin` (en/es). You can mark 4.1 completed. Ticket **4.2 (First-run: force admin password change)** is now unblocked.

**Scrum Master — update (ticket 4.2):** Ticket **4.2 (First-run: force admin password change)** is **done**. First-run screen now requires the admin to change the default password: form with current password (default), new password, and confirm password. Backend: `first_run_change_admin_password(current_password, new_password)` verifies the current password against the seeded admin user (`user_admin`), validates new password length (≥ 4), hashes and updates the admin password; no auth required. On success the frontend sets the first-run-completed flag and redirects to `/login`. Client-side validation for password match and min length; API errors (e.g. invalid current password) shown via alert and toast. i18n: `firstRun.currentPassword`, `firstRun.newPassword`, `firstRun.confirmPassword`, `firstRun.submit`, `firstRun.passwordsDoNotMatch`, `firstRun.passwordMinLength`, `firstRun.passwordChanged` (en/es). You can mark 4.2 completed.

1. **Prioritize** epics with the PM (e.g. 1 → 4 → 2 → 3 or as business dictates).
2. **Sprint planning:** Assign tickets by dependency (e.g. 1.1–1.2 and 2.1–2.2 in sprint 1; then 1.3–1.5, 2.4–2.9 in sprint 2).
3. **Refine** any ticket with the development engineer (e.g. exact API shapes, file paths, barcode format).
4. **Update** this document when tickets are split or new subtasks are added so the backlog stays the single source of truth.
