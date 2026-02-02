# Windows Installation Verification Checklist — COCO Parking

**Purpose:** QA checklist to verify that the Windows installer works correctly and the end user can install and use the application.  
**Story:** 15.2 — Verificación de instalación en Windows.  
**Tester:** ________________  **Date:** ________________  **Build/Installer:** ________________

---

## System Requirements (document for release)

| Requirement | Minimum |
|-------------|---------|
| **OS** | Windows 10 (64-bit) or Windows 11 (64-bit) |
| **Architecture** | x86_64 |
| **WebView2** | Microsoft Edge WebView2 Runtime (usually preinstalled on Windows 10/11; installer can offer to install if missing) |
| **Disk** | Sufficient space for app and SQLite database (recommend ≥ 200 MB free) |
| **Permissions** | User account with normal write access (e.g. `%APPDATA%`, `%LOCALAPPDATA%`) |

Document any additional findings (e.g. antivirus, corporate policies) in **Test results** below.

---

## Checklist

Mark **Pass** / **Fail** / **N/A** and add short notes where needed.

### 1. Install from installer

| Step | Action | Pass | Fail | N/A | Notes |
|------|--------|------|------|-----|-------|
| 1.1 | Download installer artifact (NSIS `.exe` or MSI `.msi`) from CI or build output | ☐ | ☐ | ☐ | |
| 1.2 | Run installer (double-click or right‑click → Run as administrator if required) | ☐ | ☐ | ☐ | |
| 1.3 | Complete installation wizard (accept path or change; shortcuts if offered) | ☐ | ☐ | ☐ | |
| 1.4 | Installation finishes without errors; app appears in Start Menu / Desktop if configured | ☐ | ☐ | ☐ | |
| 1.5 | Uninstall (optional): app can be uninstalled via Settings → Apps or Add/Remove Programs | ☐ | ☐ | ☐ | |

### 2. Start application

| Step | Action | Pass | Fail | N/A | Notes |
|------|--------|------|------|-----|-------|
| 2.1 | Launch COCO Parking from Start Menu or desktop shortcut | ☐ | ☐ | ☐ | |
| 2.2 | Main window opens; no crash or blank screen | ☐ | ☐ | ☐ | |
| 2.3 | If not logged in, login screen is shown (or redirect to `/login`) | ☐ | ☐ | ☐ | |

### 3. Login

| Step | Action | Pass | Fail | N/A | Notes |
|------|--------|------|------|-----|-------|
| 3.1 | Enter valid user credentials (existing user from DB or first-run default if applicable) | ☐ | ☐ | ☐ | |
| 3.2 | Submit login; user is authenticated and redirected to main app (e.g. Vehicles) | ☐ | ☐ | ☐ | |
| 3.3 | Invalid credentials show an error and do not grant access | ☐ | ☐ | ☐ | |

### 4. Basic flow — Entry (vehicle registration)

| Step | Action | Pass | Fail | N/A | Notes |
|------|--------|------|------|-----|-------|
| 4.1 | Open Vehicles (or equivalent entry) screen | ☐ | ☐ | ☐ | |
| 4.2 | Register a new vehicle entry (plate, type, etc.); save | ☐ | ☐ | ☐ | |
| 4.3 | Entry appears in the list / “Vehículos de hoy” or equivalent | ☐ | ☐ | ☐ | |

### 5. Basic flow — Exit and Till (Caja)

| Step | Action | Pass | Fail | N/A | Notes |
|------|--------|------|------|-----|-------|
| 5.1 | Open Till (Caja) or vehicle exit flow; select a vehicle session to close | ☐ | ☐ | ☐ | |
| 5.2 | Complete payment (amount, method if applicable); confirm exit | ☐ | ☐ | ☐ | |
| 5.3 | Session is closed and till balance/transaction reflects the payment | ☐ | ☐ | ☐ | |
| 5.4 | Caja screen shows correct totals or movement (income, transactions) | ☐ | ☐ | ☐ | |

### 6. Permissions (roles)

| Step | Action | Pass | Fail | N/A | Notes |
|------|--------|------|------|-----|-------|
| 6.1 | With current user role: navigate to allowed sections (e.g. Vehicles, Caja); access is granted | ☐ | ☐ | ☐ | |
| 6.2 | Restricted sections (e.g. Roles, Backup, Metrics if restricted) are hidden or show “no permission” as designed | ☐ | ☐ | ☐ | |
| 6.3 | If Roles screen is available: role list and permissions behave as expected | ☐ | ☐ | ☐ | |

### 7. Shift close (cierre de turno)

| Step | Action | Pass | Fail | N/A | Notes |
|------|--------|------|------|-----|-------|
| 7.1 | Open Caja (Till); locate “Cierre de turno” or equivalent action | ☐ | ☐ | ☐ | |
| 7.2 | Perform shift close; summary or confirmation is shown | ☐ | ☐ | ☐ | |
| 7.3 | After close, state is consistent (e.g. new shift or totals reset as per design) | ☐ | ☐ | ☐ | |

### 8. Backup — Export / Restore (optional)

| Step | Action | Pass | Fail | N/A | Notes |
|------|--------|------|------|-----|-------|
| 8.1 | Open Backup section (if permitted) | ☐ | ☐ | ☐ | |
| 8.2 | Export backup to a file; file is created in chosen path | ☐ | ☐ | ☐ | |
| 8.3 | Restore from backup (e.g. from exported file); data is restored and app remains stable | ☐ | ☐ | ☐ | |

---

## Test results summary

- **Environment:** Windows _____ (10 / 11), _____-bit, Installer type: _____
- **Overall:** ☐ All critical items passed  ☐ Some failed (list below)
- **Blockers:** ____________________________________________________________
- **Notes:** ____________________________________________________________

---

## Sign-off and Scrum Master

When this checklist has been executed and results documented:

1. **QA:** Fill in tester name, date, build/installer version, and test results summary.
2. **Scrum Master:** Mark story **15.2** (Verificación de instalación en Windows) as **Done** in the sprint/board. Update `PRODUCT_BACKLOG.md` — set 15.2 Estado to **Hecho** and add a short note with the document name (`docs/WINDOWS_INSTALLATION_CHECKLIST.md`) and system requirements summary (e.g. Windows 10/11 x64, WebView2). If any system requirements differ from the table above, document them in the backlog or in this file.

**Reference:** Product Backlog — Épica 15, story 15.2.
