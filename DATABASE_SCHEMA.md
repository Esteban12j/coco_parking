# Esquema de base de datos — COCO Parking

Documento de referencia: cómo funciona la BD, qué tablas hay, qué datos guardan y cómo se crean o modifican esquemas.

---

## 1. Visión general (mapa mental)

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    INICIO DE LA APP                      │
                    │  (lib.rs setup)                                          │
                    └───────────────────────────┬───────────────────────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │  Ruta: app_data_dir() / "coco_parking.db"                 │
                    │  Ej: ~/.local/share/com.coco.parking/coco_parking.db      │
                    └───────────────────────────┬───────────────────────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │  db::open_pool(db_path)                                   │
                    │    1. Crea pool r2d2 (varias conexiones SQLite)           │
                    │    2. Toma una conexión → run_migrations(conn)              │
                    │    3. Cierra conexión, devuelve pool                       │
                    └───────────────────────────┬───────────────────────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │  run_migrations(conn)                                    │
                    │    • Crea tabla schema_version si no existe               │
                    │    • Lee MAX(version) → si current < 1 → crea tablas       │
                    │      vehicles + transactions + índices → INSERT version 1│
                    │    • (Futuro: si current < 2 → migración 2, etc.)         │
                    └───────────────────────────┬───────────────────────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │  AppState { db: Arc<Pool>, db_path: PathBuf }            │
                    │  Una sola BD: todos los comandos usan state.db.get().     │
                    │  state.db_path es la ruta del archivo (dev_get_db_path).   │
                    └─────────────────────────────────────────────────────────┘
```

---

## 2. Ubicación del código

| Qué | Dónde |
|-----|--------|
| Apertura de BD y migraciones | `app/src-tauri/src/db.rs` |
| Definición del pool en la app | `app/src-tauri/src/lib.rs` (setup) |
| Estado global (pool + ruta BD) | `app/src-tauri/src/state.rs` → `AppState.db`, `AppState.db_path` |
| Uso de la BD en dominios | `state.db.get()` → conexión para cada comando |

---

## 3. Control de versiones del esquema (migraciones)

Se usa una tabla **`schema_version`** para saber hasta qué versión está aplicado el esquema.

```
┌─────────────────────────┐
│   schema_version        │
├─────────────────────────┤
│ version (INTEGER PK)    │  ← Solo filas: 0, 1, 2, … (una por migración aplicada)
└─────────────────────────┘
```

- **Al arrancar:** se ejecuta `run_migrations(conn)`.
- **Lógica:** se lee `current = MAX(version)` desde `schema_version`.
  - Si `current < 1`: se crean tablas e índices de la migración 1 y se hace `INSERT INTO schema_version (version) VALUES (1)`.
  - Si `current < 2`: se recrea la tabla `vehicles` sin UNIQUE en `ticket_code` para permitir reutilizar la misma tarjeta tras cerrar turno (uniqueness “solo un activo por ticket” se valida en aplicación).
- **Constante en código:** `db.rs` tiene `const SCHEMA_VERSION: i64 = 2` (referencia; la verdad está en `schema_version`).

---

## 4. Tablas y datos que tiene cada una

### 4.1 Tabla `vehicles`

**Propósito:** Registrar cada vehículo que entra al estacionamiento: entrada, salida, estado, monto cobrado y deuda.

| Columna        | Tipo   | Nullable | Descripción |
|----------------|--------|----------|-------------|
| `id`           | TEXT   | PK       | UUID del vehículo (único por registro). |
| `ticket_code`  | TEXT   | NOT NULL | Código de ticket o código de barras (ej. TK1738…). Sin UNIQUE en BD: la misma tarjeta puede reutilizarse tras cerrar turno; en aplicación solo puede haber un registro activo por ticket. |
| `plate`        | TEXT   | NOT NULL | Placa (mayúsculas). Vacía (`""`) para bicicletas/monopatines (no llevan placa). Para auto/moto/camión es obligatoria; en aplicación: solo un activo por placa y, si la placa ya existe (activa o completada), el tipo de vehículo debe coincidir (no se puede registrar un auto con la placa de una moto ni viceversa). |
| `plate_upper`  | TEXT   | SÍ       | Placa normalizada (TRIM + UPPERCASE) para búsqueda indexada. Se rellena en INSERT y en migración 8 para filas existentes. |
| `vehicle_type` | TEXT   | NOT NULL | `car`, `motorcycle`, `truck`, `bicycle`. |
| `observations` | TEXT   | SÍ       | Notas opcionales (daños, accesorios, etc.). |
| `entry_time`   | TEXT   | NOT NULL | Hora de entrada en ISO/RFC3339 (UTC). |
| `exit_time`    | TEXT   | SÍ       | Hora de salida (ISO); NULL si sigue activo. |
| `status`       | TEXT   | NOT NULL | `active` o `completed`. |
| `total_amount` | REAL   | SÍ       | Monto cobrado en la salida; NULL si activo. |
| `debt`         | REAL   | SÍ       | Deuda pendiente (pago parcial); 0 o NULL si no hay. |
| `special_rate` | REAL   | SÍ       | Tarifa especial por hora; NULL = tarifa por tipo. |

**Índices:** `ticket_code`, `plate`, `plate_upper`, `status`, `entry_time`, `(status, exit_time)` (compuesto para consultas “completados hoy” y reportes por fecha).

---

### 4.2 Tabla `transactions`

**Propósito:** Una fila por cada pago registrado al salir un vehículo (monto y método de pago). Es la fuente para Caja y reportes por método.

| Columna     | Tipo | Nullable | Descripción |
|-------------|------|----------|-------------|
| `id`        | TEXT | PK       | UUID de la transacción. |
| `vehicle_id`| TEXT | NOT NULL | FK → `vehicles.id`. |
| `amount`    | REAL | NOT NULL | Monto pagado. |
| `method`    | TEXT | NOT NULL | `cash`, `card` o `transfer`. |
| `created_at`| TEXT | NOT NULL | Fecha/hora del pago (ISO/RFC3339, UTC). |

**Índices:** `vehicle_id`, `created_at`.

**Relación:** `transactions.vehicle_id` → `vehicles.id` (cada transacción pertenece a un vehículo).

---

### 4.3 Tabla `shift_closures`

**Propósito:** Registro de cada cierre de turno: resumen del día (totales por método de pago), arqueo opcional (efectivo contado) y diferencia.

| Columna             | Tipo  | Nullable | Descripción |
|---------------------|-------|----------|-------------|
| `id`                | TEXT  | PK       | UUID del cierre. |
| `closed_at`         | TEXT  | NOT NULL | Fecha/hora del cierre (ISO/RFC3339, UTC). |
| `expected_total`    | REAL  | NOT NULL | Suma de transacciones del día (cash+card+transfer). |
| `cash_total`        | REAL  | NOT NULL | Suma cobrada en efectivo. |
| `card_total`        | REAL  | NOT NULL | Suma cobrada con tarjeta. |
| `transfer_total`    | REAL  | NOT NULL | Suma cobrada por transferencia. |
| `arqueo_cash`       | REAL  | SÍ       | Efectivo contado en caja (arqueo); NULL si no se registró. |
| `discrepancy`       | REAL  | NOT NULL | Diferencia: `arqueo_cash - cash_total` (0 si no hay arqueo). |
| `total_transactions`| INTEGER | NOT NULL | Número de transacciones del día. |
| `notes`             | TEXT  | SÍ       | Notas opcionales del cajero. |

**Índices:** `closed_at`. Quién escribe/lee: ver sección 6.

---

## 5. Diagrama de tablas y relación

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                      vehicles                             │
                    ├──────────────────────────────────────────────────────────┤
                    │ id (PK)              ticket_code    plate    vehicle_type  │
                    │ observations        entry_time     exit_time   status     │
                    │ total_amount        debt           special_rate           │
                    └──────────────────────────────────────────────────────────┘
                                                │
                                                │ 1
                                                │
                                                │ N
                    ┌──────────────────────────────────────────────────────────┐
                    │                    transactions                           │
                    ├──────────────────────────────────────────────────────────┤
                    │ id (PK)    vehicle_id (FK → vehicles.id)                 │
                    │ amount     method (cash/card/transfer)    created_at      │
                    └──────────────────────────────────────────────────────────┘
```

- **1 vehículo** puede tener **varias transacciones** (pagos parciales; hoy normalmente 1 por salida).
- **1 transacción** pertenece a **1 vehículo**.

---

## 6. Quién escribe y quién lee (por tabla)

### `vehicles`

| Operación | Comando / código | Acción |
|-----------|-------------------|--------|
| **INSERT** | `vehiculos_register_entry` | Nueva fila al registrar entrada (ticket, placa, tipo, entry_time, status=active). |
| **UPDATE** | `vehiculos_process_exit` | Rellena exit_time, status=completed, total_amount, debt al procesar salida. |
| **SELECT** | `vehiculos_list_vehicles` | Lista paginada (limit, offset, opcional status); devuelve `{ items, total }`. Orden por entry_time DESC. |
| **SELECT** | `vehiculos_find_by_plate` | Busca activo por placa. |
| **SELECT** | `vehiculos_get_plate_debt` | Suma deuda por placa. |
| **SELECT** | `metricas_get_daily` | Conteos e ingresos por día (activos, completados hoy). |
| **SELECT** | `caja_get_treasury` | Lee **solo** de `transactions`: conteo y suma por método (cash/card/transfer) del día. Una sola fuente. |
| **SELECT** | `dev_get_db_snapshot` | Muestra últimas filas para depuración. |

### `transactions`

| Operación | Comando / código | Acción |
|-----------|-------------------|--------|
| **INSERT** | `vehiculos_process_exit` | Una fila por cada salida cobrada (vehicle_id, amount, method, created_at). |
| **SELECT** | `caja_get_treasury` | Conteo y suma por método (cash/card/transfer) del día (created_at LIKE 'YYYY-MM-DD%'). |
| **SELECT** | `caja_get_debug` | Conteos y últimas 5 transacciones para depuración. |
| **SELECT** | `dev_get_db_snapshot` | Últimas filas para depuración. |

### `shift_closures`

| Operación | Comando / código | Acción |
|-----------|-------------------|--------|
| **INSERT** | `caja_close_shift` | Una fila por cada cierre de turno (resumen, arqueo opcional, discrepancy, notes). |
| **SELECT** | `caja_list_shift_closures` | Historial de cierres ordenados por `closed_at` DESC. |

### `schema_version`

| Operación | Código | Acción |
|-----------|--------|--------|
| **CREATE + INSERT** | `run_migrations` en `db.rs` | Crea tabla e inserta 0; cada migración inserta su número (1, 2, …). |
| **SELECT** | `run_migrations` | `MAX(version)` para decidir qué migraciones ejecutar. |

---

## 7. Cómo añadir nuevas tablas o cambiar el esquema

Pasos para una **nueva migración** (por ejemplo, versión 2):

1. **En `db.rs`:**
   - Aumentar la constante de referencia si quieres: `const SCHEMA_VERSION: i64 = 2;`
   - Después del bloque `if current < 1 { ... }`, añadir:

   ```rust
   if current < 2 {
       conn.execute_batch(
           r#"
           CREATE TABLE IF NOT EXISTS mi_tabla (
               id TEXT PRIMARY KEY,
               ...
           );
           CREATE INDEX IF NOT EXISTS idx_mi_tabla_... ON mi_tabla(...);
           "#,
       ).map_err(|e| e.to_string())?;
       conn.execute("INSERT INTO schema_version (version) VALUES (2)", [])
           .map_err(|e| e.to_string())?;
   }
   ```

2. **Conexión:** Los comandos que necesiten la nueva tabla obtienen la conexión igual: `state.db.get()` (desde `AppState`).

3. **Orden:** Las migraciones se ejecutan en orden (1, 2, 3…) según `current < N`. No borres migraciones antiguas; solo añade nuevas.

4. **Backup:** Antes de desplegar una migración que cambie datos o tablas importantes, conviene tener backup/restore real (cuando se implemente en el dominio backup).

### Cómo manejar DROP de una tabla que tiene FK (sin perder datos del cliente)

Si una migración necesita **recrear** una tabla que es referenciada por otra (ej. `transactions` → `vehicles(id)`):

- **No borrar datos del cliente.** No hacer `DROP TABLE transactions` ni borrar filas para “arreglar” la migración.
- **En SQLite:** desactivar temporalmente la comprobación de FK **solo durante esa migración**, hacer el DROP/recrear, y volver a activar FK. Así no se pierde ningún dato.
- **Pasos típicos:**  
  1. `PRAGMA foreign_keys = OFF;`  
  2. Crear tabla nueva, copiar datos, `DROP` tabla antigua, `ALTER ... RENAME` (o equivalente).  
  3. `PRAGMA foreign_keys = ON;`  
  4. `INSERT INTO schema_version (version) VALUES (N);`
- **Alcance:** `PRAGMA foreign_keys` solo afecta a esa conexión y a esa transacción; al terminar la migración las FK vuelven a estar activas y los datos siguen siendo coherentes (los `vehicle_id` en `transactions` siguen apuntando a `vehicles.id` tras el rename).
- Ver migración 2 en `db.rs` como ejemplo (recrear `vehicles` sin UNIQUE en `ticket_code` manteniendo `transactions`).

---

## 8. Resumen rápido (cheat sheet)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Dónde está el archivo de BD? | En el directorio de datos de la app: `app_data_dir() / "coco_parking.db"`. |
| ¿Cómo se crean las tablas? | En `db.rs`, función `run_migrations`, según `schema_version`. |
| ¿Cómo obtengo una conexión en un comando? | `let conn = state.db.get().map_err(\|e\| e.to_string())?;` |
| ¿Qué guarda `vehicles`? | Entradas/salidas: ticket, placa, tipo, horas, estado, monto cobrado, deuda. |
| ¿Qué guarda `transactions`? | Pagos: vehicle_id, monto, método (cash/card/transfer), fecha. |
| ¿Quién escribe en `transactions`? | Solo `vehiculos_process_exit` (al cobrar una salida). |
| ¿Cómo añado una tabla nueva? | Añadir un bloque `if current < 2 { CREATE TABLE... ; INSERT schema_version 2 }` en `run_migrations`. |

Con esto tienes el mapa mental: **inicio → open_pool → run_migrations → schema_version + vehicles + transactions**, y de ahí quién escribe/lee cada tabla y cómo extender el esquema.
