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
| 2.3 | **API: generate barcode image** | Implement endpoint or utility that, given a code, generates a barcode image (e.g. Code128 or format used by the scanner). Return image (PNG) or base64; consider export path for file. | — |
| 2.4 | **Sidebar: BarCode menu item** | Add "BarCode" to the main sidebar navigation, pointing to the new BarCode feature route. | — |
| 2.5 | **Page: BarCode list** | New page under BarCode: list all barcodes (table or grid) with columns: code, label, created_at, actions (generate/export, delete). Support manual code input and scanner input for search/create. | 2.2, 2.4 |
| 2.6 | **BarCode: create flow** | Form or inline flow to create a new code: input 8-digit or "generate next" (server suggests next available in range). Validate uniqueness and range. | 2.2, 2.5 |
| 2.7 | **BarCode: generate and export** | Button "Generate / Export" per row: call 2.3, show preview and/or offer download (PNG/PDF) for printing. | 2.3, 2.5 |
| 2.8 | **BarCode: delete** | Delete action per row with confirmation; call delete API and refresh list. | 2.2, 2.5 |
| 2.9 | **Integration: scanner at entry** | Ensure entry flow (scanner/ticket input) accepts codes that exist in `barcodes` and behaves correctly (e.g. lookup by code). No regression to current scanner behavior. | 2.2 |

---

### Epic 3 — Automatic backup

| ID | Ticket | Details | Deps |
|----|--------|---------|------|
| 3.1 | **Config: backup interval and path** | Add settings for backup: interval in hours (default 12), output directory, max retained full backups (default 7). Persist in app config or DB. | — |
| 3.2 | **Service: full backup (compressed)** | Implement full backup: dump SQLite (or copy DB file) and gzip. Save to configured path with naming convention (e.g. `backup_YYYY-MM-DD_HH-mm.sqlite.gz`). | — |
| 3.3 | **Scheduler: periodic backup** | Run full backup every X hours (from config). Use a timer/scheduler that works with Tauri (e.g. setInterval or Tauri plugin). On run: call 3.2 and apply retention (delete oldest if count > 7). | 3.1, 3.2 |
| 3.4 | **Backup on app close** | On application close event: trigger one backup (reuse 3.2). Ensure it is non-blocking (e.g. fire-and-forget with short timeout or background write) so user can exit. | 3.2 |
| 3.5 | **UI: backup settings (optional)** | If product wants user-editable interval/path: add a settings section for backup (interval, path, retention). Otherwise use defaults and env/config only. | 3.1 |

---

### Epic 4 — First install: admin password change + developer account

| ID | Ticket | Details | Deps |
|----|--------|---------|------|
| 4.1 | **First-run flag** | Persist a "first run completed" or "admin password changed" flag (DB or config). On app start, if not set, redirect to first-run flow instead of normal login/dashboard. | — |
| 4.2 | **First-run: force admin password change** | First-run screen: require admin to set a new password (current default + new + confirm). On success, set flag from 4.1 and proceed to app. | 4.1 |
| 4.3 | **Seed: developer account** | On install/migration, create hidden developer user in DB with fixed password (stored hashed). Role "developer" with restricted permissions (recovery/admin only). Do not expose password in code or logs. | — |
| 4.4 | **Roles UI: hide developer** | In the roles/users list, filter out the developer account so it never appears in the UI. Ensure no API returns it in "list users" for admin UI. | 4.3 |
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

**Update (ticket 2.2 completed):** Epic 2 ticket **2.2 (API: CRUD barcodes)** is **done**. Implemented: list, get by id, get by code, create (with 8-digit range validation and uniqueness), delete. Clear error messages for invalid format and duplicate code. Permissions `barcodes:read`, `barcodes:create`, `barcodes:delete` added; assign to roles as needed. Tickets **2.4**, **2.5**, **2.6**, **2.8** (sidebar, list page, create flow, delete UI) are now unblocked.

1. **Prioritize** epics with the PM (e.g. 1 → 4 → 2 → 3 or as business dictates).
2. **Sprint planning:** Assign tickets by dependency (e.g. 1.1–1.2 and 2.1–2.2 in sprint 1; then 1.3–1.5, 2.4–2.9 in sprint 2).
3. **Refine** any ticket with the development engineer (e.g. exact API shapes, file paths, barcode format).
4. **Update** this document when tickets are split or new subtasks are added so the backlog stays the single source of truth.
