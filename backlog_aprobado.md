# Backlog Aprobado — Contratos: Cobro Extra + Mensualidades + Mora

**Fecha:** 2026-03-09
**Sesión adversarial:** PM Lead · Tech Lead · Security Expert · Data Engineer
**Estado:** APROBADO — listo para implementar

---

## Resumen ejecutivo

El sistema de contratos actual no cobra tiempo extra diario, no registra pagos de mensualidades, y no advierte sobre mora al registrar vehículos. La implementación anterior tenía mismatch de nombres entre capas, campos que nunca llegaban al backend, y un blocker de schema (`vehicle_id NOT NULL`). Este backlog define la implementación correcta desde cero.

---

## Decisiones de arquitectura (inamovibles)

| Decisión | Elección | Razón |
|----------|----------|-------|
| Nombres canónicos TS/Rust | `extraChargeFirst`, `extraChargeRepeat`, `extraInterval` | Ya definidos en `parking.ts` — fuente de verdad |
| Columnas DB contracts | `extra_charge_first`, `extra_charge_repeat`, `extra_interval` | snake_case directo de los nombres TS |
| Pagos de mensualidad | Nueva tabla `contract_payments` | No rompe FK `vehicle_id NOT NULL` de `transactions`; aísla el modelo financiero |
| Mora: fuente de verdad | `date_to < today AND status != 'cancelled'` | Elimina el doble estado incoherente |
| Atomicidad de pagos | `BEGIN IMMEDIATE / COMMIT` en un solo comando Rust | Crash-safe |
| Alerta de mora en entrada | Nuevo campo `contractArrearsWarning?: string` en resultado de `vehiculos_register_entry` | Evita round-trip extra |
| Fórmula cobro extra | `extraChargeFirst + Math.ceil(extraMinutes / extraInterval) * extraChargeRepeat` con margen de 1 minuto | Cobra intervalos iniciados; el margen evita falsos positivos por float |

---

## BLOQUEANTES a resolver primero (no empezar features sin estos)

### B1 — Campos `extra_charge_*` nunca se persisten en la DB
- La tabla `contracts` NO tiene columnas `extra_charge_first/repeat/extra_interval`
- `contracts.rs` no las inserta ni las lee
- Los datos del formulario se descartan silenciosamente

### B2 — `vehicle_id NOT NULL` en `transactions`
- Insertar mensualidades en `transactions` con `vehicle_id = NULL` falla en runtime
- Solución: tabla nueva `contract_payments`

### B3 — SQL injection en `contracts_list`
- `format!("... WHERE status = '{}'", st)` sin lista blanca
- Vector real si hay XSS en campos de usuario o acceso a DevTools

---

## Épicas y tareas

---

### ÉPICA 0 — Deuda técnica y blockers (prerequisito de todo)

**E0-T1: Migration 23 — Agregar columnas a `contracts`**
- Archivo: `app/src-tauri/src/db.rs`
- Agregar con `add_column_if_missing`:
  - `extra_charge_first REAL CHECK (extra_charge_first IS NULL OR extra_charge_first >= 0)`
  - `extra_charge_repeat REAL CHECK (extra_charge_repeat IS NULL OR extra_charge_repeat >= 0)`
  - `extra_interval INTEGER CHECK (extra_interval IS NULL OR extra_interval > 0)`
- Incrementar `SCHEMA_VERSION` a 23

**E0-T2: Migration 23 — Crear tabla `contract_payments`**
- Archivo: `app/src-tauri/src/db.rs` (misma migration)
- Schema:
  ```sql
  CREATE TABLE IF NOT EXISTS contract_payments (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount >= 0),
    method TEXT NOT NULL,
    period_from TEXT NOT NULL,
    period_to TEXT NOT NULL,
    operator_user_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
  );
  CREATE INDEX IF NOT EXISTS idx_contract_payments_contract ON contract_payments(contract_id);
  CREATE INDEX IF NOT EXISTS idx_contract_payments_created ON contract_payments(created_at);
  ```

**E0-T3: Fix SQL injection en `contracts_list`**
- Archivo: `app/src-tauri/src/domains/contracts.rs`
- Validar `status` contra lista blanca `["active", "expired", "cancelled"]` antes del `format!()`
- Rechazar con `Err("Invalid status filter".to_string())` si no está en la lista

**E0-T4: Fix mismatch de nombres en frontend**
- Archivo: `app/src/features/contracts/index.tsx`
- Renombrar estados del formulario:
  - `formInitialExtraCharge` → `formExtraChargeFirst`
  - `formExtraCharge` → `formExtraChargeRepeat`
  - `formExtraIntervalMinutes` → `formExtraInterval`
- Corregir `openEdit`: `contract.initialExtraCharge` → `contract.extraChargeFirst`, etc.
- Corregir `handleCreate` y `handleUpdate` para usar nombres correctos

**E0-T5: Fix `contractCharge.ts` — división por cero y margen flotante**
- Archivo: `app/src/lib/contractCharge.ts`
- En `calculateContractExtraCharge`:
  - Si `extraIntervalMinutes <= 0`, retornar solo `initialExtraCharge` (o 0 si extraCharge params son 0)
  - Aplicar margen: `if (usedMinutes <= includedMinutes + 1) return 0`
- Agregar función wrapper:
  ```ts
  export function calculateExtraChargeFromContract(session: ContractSession, contract: Contract): number
  ```
  Que lee `contract.extraChargeFirst ?? 0`, `contract.extraChargeRepeat ?? 0`, `contract.extraInterval ?? 0`

---

### ÉPICA 1 — Extra charge fields en contratos (Must Have)

**E1-T1: Actualizar struct `Contract` en Rust**
- Archivo: `app/src-tauri/src/domains/contracts.rs`
- Agregar al struct `Contract`:
  ```rust
  pub extra_charge_first: Option<f64>,
  pub extra_charge_repeat: Option<f64>,
  pub extra_interval: Option<i64>,
  pub is_in_arrears: bool,  // campo calculado, no columna DB
  ```
- Actualizar `row_to_contract` para leer las 3 columnas nuevas
- Calcular `is_in_arrears`: `date_to < today_str AND status != "cancelled"`

**E1-T2: Actualizar `CreateContractArgs` y `contracts_create`**
- Agregar los 3 campos opcionales a `CreateContractArgs`
- Incluirlos en el `INSERT INTO contracts` SQL
- Incluirlos en el `Contract` retornado

**E1-T3: Actualizar `UpdateContractArgs` y `contracts_update`**
- Agregar los 3 campos opcionales a `UpdateContractArgs`
- Actualizar el `UPDATE contracts SET ...` para incluirlos
- Nota: NO permitir cambiar `status` a través de este comando (ver E3-T2)

**E1-T4: Actualizar `find_active_contract_for_plate`**
- El `SELECT` de `find_active_contract_for_plate` debe incluir las 3 columnas nuevas

**E1-T5: Actualizar API wrapper TypeScript**
- Archivo: `app/src/api/contracts.ts`
- `createContract`: ya tiene `extraChargeFirst`, `extraChargeRepeat`, `extraInterval` — verificar que llegan correctamente
- `updateContract`: agregar los 3 campos opcionales

**E1-T6: Actualizar `Contract` type TypeScript**
- Archivo: `app/src/types/parking.ts`
- Agregar `isInArrears?: boolean` al interface `Contract`
- Los 3 campos `extraChargeFirst/extraChargeRepeat/extraInterval` ya están — verificar que son los únicos (eliminar cualquier alias incorrecto)

---

### ÉPICA 2 — Cobro extra en salida de vehículo con contrato (Should Have)

**E2-T1: Modificar `vehiculos_register_exit` en Rust**
- Archivo: `app/src-tauri/src/domains/vehiculos.rs`
- En el bloque donde se detecta contrato activo:
  - Si el contrato tiene `extra_charge_first IS NOT NULL` Y `extra_charge_repeat IS NOT NULL` Y `extra_interval IS NOT NULL` Y `extra_interval > 0`:
    - Calcular tiempo usado en minutos desde `entry_time` hasta ahora
    - Si `usedMinutes <= (includedHoursPerDay * 60) + 1`: cobrar 0
    - Si no: `extraCharge = extra_charge_first + floor(extraMinutes / extra_interval) * extra_charge_repeat`
  - Si el contrato NO tiene esos campos: cobrar 0 (la mensualidad cubre todo — sin fallback a tarifa regular)
- El `total_amount` del vehículo = cobro extra calculado (puede ser 0)

**E2-T2: Actualizar UI de checkout**
- En el modal de salida de vehículo, si hay contrato activo:
  - Mostrar "$0" si está dentro del tiempo incluido
  - Mostrar el cobro extra con desglose si excede: "Exceso: Xh Ymin = $Z"
  - No mostrar la tarifa regular

---

### ÉPICA 3 — Cobro de mensualidades y gestión de mora (Must Have)

**E3-T1: Nuevo comando `contracts_record_payment`**
- Archivo: `app/src-tauri/src/domains/contracts.rs`
- Permiso requerido: nuevo permiso `CONTRACTS_PAYMENT_CREATE = "contracts:payment:create"` (ver E3-T2)
- Args: `contract_id: String, method: String, amount: Option<f64>`
- Validaciones:
  - `method` en lista blanca: `["cash", "card", "transfer"]`
  - `amount` si está presente: debe ser `>= 0`
  - Contrato no puede estar `cancelled`
- Lógica (en una sola transacción SQLite `BEGIN IMMEDIATE / COMMIT`):
  1. Leer contrato (con lock)
  2. Calcular `period_from` y `period_to` del pago:
     - Si `date_to < today`: `period_from = today`, `period_to = today + 1 mes`
     - Si `date_to >= today`: `period_from = date_to`, `period_to = date_to + 1 mes`
  3. `INSERT INTO contract_payments (id, contract_id, amount, method, period_from, period_to, operator_user_id, created_at)`
  4. `UPDATE contracts SET date_to = period_to, status = 'active' WHERE id = contract_id`
  5. Retornar `Contract` actualizado
- Registrar en `lib.rs` como comando Tauri

**E3-T2: Nuevo permiso y actualización de roles**
- Archivo: `app/src-tauri/src/permissions.rs`
- Agregar: `pub const CONTRACTS_PAYMENT_CREATE: &str = "contracts:payment:create";`
- Agregar al `admin_permissions()` — NO al `operator_permissions()` por defecto
- Agregar a `app/src-tauri/src/db.rs` en `sync_role_permissions_from_code`

**E3-T3: Nuevo comando `contracts_list_payments`**
- Para historial de pagos de un contrato
- Args: `contract_id: String`
- Retorna: `Vec<ContractPayment>` con `{ id, contractId, amount, method, periodFrom, periodTo, createdAt, operatorUserId }`

**E3-T4: API wrappers TypeScript para pagos**
- Archivo: `app/src/api/contracts.ts`
- Agregar: `recordContractPayment(args: { contractId, method, amount? })`
- Agregar: `listContractPayments(contractId: string)`
- Agregar type `ContractPayment` a `parking.ts`

**E3-T5: Sección de cobro en `ContractsPage`**
- Archivo: `app/src/features/contracts/index.tsx`
- Reemplazar `handleChargeContract` (código roto actual) con `handleRecordPayment`
- La tabla de cobro debe mostrar 3 grupos:
  - **Por vencer (próximos 7 días)**: `date_to` entre hoy y hoy+7
  - **Pendiente de pago**: `date_to` pasó (< today), status='active'
  - **En mora**: contratos vencidos con estado calculado
- Por cada contrato en los últimos dos grupos: botón "Cobrar" con selector de método de pago
- El botón llama a `recordContractPayment` y luego invalida la query

**E3-T6: Job de sincronización de mora al startup**
- Archivo: `app/src-tauri/src/db.rs` (al final de `run_migrations`)
- Actualizar contratos con `date_to < today AND status = 'active'` a `status = 'arrears'`
- Esto es idempotente y garantiza consistencia entre `status` y `date_to`
- Con este job, la fuente de verdad de mora es `status = 'arrears'`

---

### ÉPICA 4 — Alerta de mora al registrar entrada (Must Have)

**E4-T1: Modificar resultado de `vehiculos_register_entry`**
- Archivo: `app/src-tauri/src/domains/vehiculos.rs`
- Crear struct de retorno:
  ```rust
  pub struct RegisterEntryResult {
    pub vehicle: Vehicle,
    pub contract_arrears_warning: Option<String>,
  }
  ```
- En el handler, después de registrar el vehículo, llamar `find_active_contract_for_plate` (o buscar cualquier contrato, incluyendo con `status='arrears'`):
  - Si encuentra contrato con `status='arrears'` o `date_to < today`: poblar `contract_arrears_warning = Some(format!("Contrato en mora: {}", client_name))`
  - Nota: buscar también contratos `status='arrears'` (no solo `status='active'`)
- Actualizar la función `find_active_contract_for_plate` o crear `find_contract_with_arrears_for_plate` que incluya contratos morosos

**E4-T2: Actualizar tipo de retorno en frontend**
- Archivo: `app/src/types/parking.ts`
- Agregar interface `RegisterEntryResult { vehicle: Vehicle; contractArrearsWarning?: string | null }`
- Archivo: `app/src/api/vehiculos.ts`
- Actualizar `registerEntry` para retornar `RegisterEntryResult`

**E4-T3: Mostrar alerta en UI de registro de entrada**
- Donde se procesa el resultado de `registerEntry`:
  - Si `result.contractArrearsWarning` existe: mostrar alert modal o toast destructivo prominente con el mensaje
  - El alert debe ser no-bloqueante (el operador decide si deja entrar o no)
  - Registrar en el campo `observations` del vehículo que el operador fue avisado de la mora

---

## Tests obligatorios (TDD — escribir antes del código)

### Tests TypeScript (Vitest)
Archivo: `app/src/test/contractCharge.test.ts`

| Test | Caso | Resultado esperado |
|------|------|-------------------|
| `calculateContractExtraCharge` | extraIntervalMinutes = 0 | retorna extraChargeFirst (sin división) |
| `calculateContractExtraCharge` | usedMinutes = includedMinutes | retorna 0 |
| `calculateContractExtraCharge` | usedMinutes = includedMinutes + 1 (margen) | retorna 0 |
| `calculateContractExtraCharge` | usedMinutes = includedMinutes + 2 | retorna extraChargeFirst |
| `calculateContractExtraCharge` | 30 min exceso, intervalo 30 | extraChargeFirst + 1 * extraChargeRepeat |
| `calculateContractExtraCharge` | 31 min exceso, intervalo 30 | extraChargeFirst + 2 * extraChargeRepeat (ceil) |
| `calculateContractExtraCharge` | 60 min exceso, intervalo 30 | extraChargeFirst + 2 * extraChargeRepeat |
| `calculateExtraChargeFromContract` | contract sin campos extra | retorna 0 |
| `isContractInArrears` | status='arrears', dateTo futuro | true |
| `isContractInArrears` | status='active', dateTo pasado | true |
| `isContractInArrears` | status='active', dateTo = hoy | false |
| `isContractInArrears` | status='cancelled', dateTo pasado | false |

### Tests Rust (en `contracts.rs` y `vehiculos.rs`)

| Test | Descripción |
|------|-------------|
| `contracts_create_con_extra_charge_fields` | Crea contrato con los 3 campos, verifica que se devuelven correctamente |
| `contracts_update_extra_charge_fields` | Actualiza los 3 campos, verifica persistencia |
| `contracts_record_payment_extiende_date_to` | Pago de contrato vencido → date_to se extiende un mes |
| `contracts_record_payment_es_atomico` | Si la inserción en contract_payments falla, el contrato no se actualiza |
| `contracts_record_payment_registra_periodo` | El pago contiene period_from y period_to correctos |
| `vehiculos_exit_con_contrato_dentro_de_horas` | Vehículo con contrato, dentro del tiempo → total_amount = 0 |
| `vehiculos_exit_con_contrato_excedido` | Vehículo con contrato, excedido 31 min, intervalo 30 → calcula correctamente |
| `vehiculos_exit_con_contrato_sin_extra_charge` | Contrato sin campos de extra charge → total_amount = 0 |
| `vehiculos_entry_con_contrato_en_mora` | Entrada de vehículo con placa en mora → result.contract_arrears_warning tiene valor |

---

## Orden de implementación

```
E0-T3 (SQL injection fix)           → inmediato, riesgo activo
E0-T1 (migration contratos)         →
E0-T2 (tabla contract_payments)     → migration 23 (juntos)
E1-T1 (struct Rust + is_in_arrears) →
E1-T2 (create Rust)                 →
E1-T3 (update Rust)                 →
E1-T4 (find_active_contract)        →
E3-T2 (nuevo permiso)               →
E3-T1 (comando record_payment)      →
E3-T6 (job mora al startup)         →
E0-T4 (fix nombres en index.tsx)    → solo frontend, puede ir en paralelo
E0-T5 (fix contractCharge.ts)       →
E1-T5 (API wrapper TS)              →
E1-T6 (Contract type)               →
E2-T1 (vehiculos exit lógica)       →
E4-T1 (vehiculos entry resultado)   →
E3-T3 (list payments comando)       →
E3-T4 (API wrappers pagos)          →
E3-T5 (sección cobro en UI)         →
E4-T2 (tipos TS)                    →
E4-T3 (alerta mora en UI)           →
E2-T2 (UI checkout contrato)        →
Tests TypeScript                    → antes de cada feature TS
Tests Rust                          → antes de cada feature Rust
```

---

## Scope excluido (no implementar en este ciclo)

- Configuración de fecha de gracia antes de mora (hardcodear 0 días por ahora)
- Cobro por exceso acumulado multi-sesión en el mismo día
- Reportes diferenciados de ingresos de contratos vs. regulares
- Bloqueo automático de entrada para contratos en mora
- Notificaciones automáticas de vencimiento

---

## Archivos a modificar

**Rust:**
- `app/src-tauri/src/db.rs` — migrations 23
- `app/src-tauri/src/domains/contracts.rs` — struct, CRUD, comando pago
- `app/src-tauri/src/domains/vehiculos.rs` — exit logic, entry result
- `app/src-tauri/src/permissions.rs` — nuevo permiso
- `app/src-tauri/src/lib.rs` — registrar nuevo comando

**TypeScript:**
- `app/src/types/parking.ts` — Contract type, RegisterEntryResult, ContractPayment
- `app/src/api/contracts.ts` — nuevas funciones
- `app/src/api/vehiculos.ts` — tipo de retorno
- `app/src/lib/contractCharge.ts` — fix división por cero, función wrapper
- `app/src/features/contracts/index.tsx` — fix nombres, sección cobro
- `app/src/test/contractCharge.test.ts` — tests

**Eliminar:**
- `app/src/test/contractCharge.test.ts` (reemplazar por versión correcta)
- Toda referencia a `initialExtraCharge`, `extraCharge` (como campo de Contract), `extraIntervalMinutes`
