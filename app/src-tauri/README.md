# Backend (Tauri)

Domains aligned with frontend `src/features/`: `vehiculos`, `caja`, `metricas`, `roles`, `backup`.

## Prerrequisitos en Linux (Ubuntu/Debian/WSL)

Para compilar Tauri en Linux necesitas `pkg-config` y las librerías de desarrollo (GTK, WebKit, etc.):

```bash
sudo apt update
sudo apt install -y pkg-config \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Si el error es solo *"The pkg-config command could not be found"*, instala primero: `sudo apt install -y pkg-config`. El paquete `libwebkit2gtk-4.1-dev` suele traer glib/gobject/gio; si siguen fallando, añade: `libglib2.0-dev`.

### Si ves `libEGL` / `MESA` / `ZINK` al ejecutar `tauri dev`

Es un problema de drivers gráficos. La ventana de Tauri puede no abrirse o quedar en blanco; si entonces abres `http://localhost:5173` en el navegador, verás "Sin backend (memoria)" y los datos no se guardan.

- **WSL2:** Necesitas WSLg (Windows 11 recomendado). Comprueba que tengas `winget install Microsoft.WSL` con la actualización que incluye WSLg. Si la ventana no abre, prueba a ejecutar la app en **Windows** (misma carpeta en disco, desde PowerShell/CMD con Node y Rust instalados) o en una **máquina Linux nativa**.
- **Linux sin GPU / headless:** Instala drivers Mesa: `sudo apt install -y libegl1-mesa libgl1-mesa-glx mesa-utils`. Si usas entorno gráfico mínimo, puede hacer falta un display virtual (Xvfb) o ejecutar en un equipo con escritorio.
- **Forzar renderizado por software (evitar EGL/GPU):** Prueba lanzar la app con Mesa en modo software; a veces la ventana de Tauri pasa a abrirse bien y el backend se conecta:
  ```bash
  cd app
  LIBGL_ALWAYS_SOFTWARE=1 npm run tauri:dev
  ```
  Si con eso la ventana abre y en el sidebar ves **"SQLite"** (no "Sin backend (memoria)"), los datos ya se guardan en la BD.

## Structure

- `lib.rs` – entry, command registration, setup (DB + scanner)
- `main.rs` – desktop entry point
- `db.rs` – SQLite pool, schema, migrations (vehicles + transactions)
- `permissions.rs` – granular permission IDs (`domain:resource:action`)
- `state.rs` – `AppState`: current user + permissions + DB pool
- `domains/` – one module per domain (vehiculos, caja, metricas, roles, backup)

## Persistence (SQLite)

Data is stored in the app data directory: `data_dir/${bundle_identifier}/coco_parking.db`.

- **Linux**: `~/.local/share/com.cocoparking.app/coco_parking.db` (o `$XDG_DATA_HOME/com.cocoparking.app/coco_parking.db`)
- **vehicles** – entries/exits (id, ticket_code, plate, vehicle_type, observations, entry_time, exit_time, status, total_amount, debt, special_rate)
- **transactions** – one row per exit payment (id, vehicle_id, amount, method: cash/card/transfer, created_at)
- **schema_version** – versión de migraciones (version)

Listados, caja y métricas leen de esta base. El frontend usa `invoke` para `vehiculos_list_vehicles`, `vehiculos_register_entry`, `vehiculos_process_exit`, `vehiculos_find_by_plate`, `vehiculos_get_plate_debt`, `caja_get_treasury`, `metricas_get_daily`.

### Cómo ver qué hay en las tablas (verificar que la app registra)

**Opción A – Desde la app (no necesitas instalar nada)**

1. Abre la app con `npm run tauri dev` y usa la **ventana de la app** (no la pestaña del navegador).
2. Entra en **Dev Console** (sidebar) y haz **Log in as developer**.
3. Ver la ruta del archivo de BD: en la sección "Database (single source)" se muestra la ruta, o ejecuta el comando **`dev_get_db_path`** con argumentos `{}` y Run.
4. Ver datos:
   - **`dev_get_db_snapshot`** (argumentos `{}`) → devuelve `vehiclesCount`, `transactionsCount`, `lastVehicles` (últimos 20), `lastTransactions` (últimas 20).
   - **`caja_get_debug`** (argumentos `{}`) → devuelve conteos de hoy, suma del día y últimas 5 transacciones.

Con eso puedes comprobar que la app está leyendo y escribiendo en las 2 tablas sin instalar SQLite.

**Opción B – Desde la terminal con SQLite (opcional)**

Si quieres abrir el archivo y hacer consultas tú mismo:

1. **Instalar sqlite3** (solo una vez):
   - **Linux/WSL:** `sudo apt install sqlite3`
   - **Windows:** descarga desde [sqlite.org](https://www.sqlite.org/download.html) o usa `winget install SQLite.SQLite`
   - **macOS:** suele venir; si no, `brew install sqlite`
2. **Usar SIEMPRE la ruta que muestra la app** (así evitas abrir otro archivo vacío):
   - Con la app abierta (ventana Tauri), entra en **Dev Console** → **Log in as developer**.
   - Arriba verás **"Database (single source)"** con la ruta, o ejecuta el comando **`dev_get_db_path`** con `{}` y copia el resultado.
   - Esa es la ruta real que usa la app. Si abres otra (por ejemplo la de Linux cuando la app corre en Windows), el archivo puede estar vacío.
   - Rutas típicas por SO: **Linux** `~/.local/share/com.cocoparking.app/coco_parking.db` · **Windows** `C:\Users\TU_USUARIO\AppData\Roaming\com.cocoparking.app\coco_parking.db` · Si usas sqlite3 desde **WSL** y la app corre en Windows, en WSL la ruta sería: `/mnt/c/Users/TU_USUARIO/AppData/Roaming/com.cocoparking.app/coco_parking.db`.
3. **Abrir y consultar:**

```bash
# Abrir la base (usa la ruta que te dio dev_get_db_path)
sqlite3 ~/.local/share/com.cocoparking.app/coco_parking.db

# Dentro de sqlite3:
.tables                    # listar tablas (vehicles, transactions, schema_version)
SELECT COUNT(*) FROM vehicles;
SELECT COUNT(*) FROM transactions;
SELECT * FROM vehicles ORDER BY entry_time DESC LIMIT 10;
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;
.quit
```

**Script rápido (desde la raíz del repo):**

Con la app ejecutada al menos una vez (para que exista el archivo):

```bash
./scripts/inspect-db.sh
```

Requiere `sqlite3`. Muestra tablas, últimos 20 vehicles, últimos 20 transactions, resumen y tesorería del día. Para otra ruta: `COCO_PARKING_DB=/ruta/a/coco_parking.db ./scripts/inspect-db.sh`.

### Reset de BD (solo pruebas)

Si necesitas **empezar de cero** (datos de prueba, migración fallida en dev): borra el archivo de BD y vuelve a iniciar la app. La app creará un archivo nuevo y ejecutará las migraciones desde cero.

**Cierra la app antes de borrar.** Luego:

```bash
# Linux (ruta típica)
rm ~/.local/share/com.cocoparking.app/coco_parking.db

# Windows (PowerShell; sustituye TU_USUARIO)
Remove-Item "$env:APPDATA\com.cocoparking.app\coco_parking.db" -ErrorAction SilentlyContinue

# macOS (ruta típica)
rm ~/Library/Application\ Support/com.cocoparking.app/coco_parking.db
```

Después inicia de nuevo: `npm run tauri:dev`. La BD se creará vacía con el esquema actual.

Para confirmar la ruta que usa tu instalación: abre la app → Dev Console → ejecuta `dev_get_db_path` con `{}` y usa esa ruta en `rm` (o equivalente).

## Usage from frontend

```ts
import { invoke } from "@tauri-apps/api/core";
const vehicles = await invoke<Vehicle[]>("vehiculos_list_vehicles");
```

## Barcode scanner (pistol / HID)

The backend captures keyboard input via `rdev` and detects barcode scans by timing: a short burst of keys + Enter is treated as a scan. It emits a `barcode-scanned` event with the string; only the Vehicles page (scanner view) consumes it, so the code never goes to other inputs.

- **scanner.rs** – listens in a background thread, buffers keys, on Enter emits to frontend.

### Linux: permissions for `/dev/input/*`

On Linux, `rdev` reads from `/dev/input/*`. The user running the app must be in the **`input`** group so the process can access input devices.

**Steps:**

1. Add the user to the `input` group (one-time, requires admin):
   ```bash
   sudo usermod -aG input "$USER"
   ```
2. Log out and log back in (or reboot). Group membership is applied at login.
3. Verify: `groups` (or `id -nG`) should list `input`.
4. Run the app; the scanner listener will then be able to read keyboard events.

**Troubleshooting:**

- **Scanner does not trigger:** Ensure the user is in `input` and you have logged out/in after adding it. Run `groups` to confirm.
- **Permission denied on `/dev/input/*`:** Same as above. For testing only you can run with elevated permissions (e.g. `sudo -E npm run tauri:dev`); not recommended for normal use.
- **`[scanner] rdev listen error` in console:** Usually indicates missing read access to input devices; add the user to `input` and re-login.

For deployment and installer notes (offline, new devices), see the **app README** section “Barcode scanner (Linux)”.

## Dev console

Only in **debug** or with **`COCO_DEV=1`**: `dev_login_as_developer`, `dev_get_current_user_id`, `dev_set_current_user`, `dev_list_commands`, **`dev_get_db_path`**, **`dev_get_db_snapshot`**. In release they return an error unless `COCO_DEV=1`.

**Una sola fuente de datos:** Toda la app (Till, métricas, vehículos, Dev Console) usa el mismo archivo SQLite. La ruta se muestra en Dev Console y se puede obtener con **`dev_get_db_path`** (argumentos `{}`). Para inspeccionar con `sqlite3`: usa esa ruta.

**Ver datos:** En Dev Console ejecuta **`dev_get_db_snapshot`** (argumentos `{}`) para ver vehicles/transactions. **`caja_get_debug`** (argumentos `{}`) devuelve filtro de hoy, conteos, suma y últimas transacciones.
