# Backlog Aprobado — Rediseño Formulario de Contratos

**Fecha:** 2026-03-13
**Propuesta original:** Unificar campos de cobro extra + auto-calcular `date_to`
**Estado:** ✅ COMPLETADO — 2026-03-13

---

## Decisiones del Consejo

### Decisión 1 — `extra_charge_first` + `extra_charge_repeat`: NO UNIFICAR (renombrar en UI)

**Consenso:** PM Lead + Tech Lead + Security Expert coinciden en no eliminar los campos del schema.

**Por qué no unificar:**
- Son conceptualmente distintos: `extra_charge_first` es un cargo de activación fijo; `extra_charge_repeat` es la tarifa por intervalo.
- Eliminarlos o unificarlos en DB rompería contratos con `first != repeat`.
- Security: vector de fraude si el cobro cambia silenciosamente.
- Finance: investigar si la fórmula actual cobra el primer intervalo doble (ver TASK-7).

**Acción aprobada:** Renombrar solo en la UI del formulario:
| Campo DB | Label actual (confuso) | Label nuevo |
|---|---|---|
| `extra_charge_first` | "Cobro inicial" | "Cargo fijo por exceso" |
| `extra_charge_repeat` | "Cobro por intervalo" | "Tarifa por cada intervalo extra" |
| `extra_interval` | sin cambio | "Duración del intervalo (min)" |

Opcionalmente: checkbox "mismo precio para todos los intervalos" que sincronice `extra_charge_first = extra_charge_repeat` en la UI.

---

### Decisión 2 — Auto-calcular `date_to`: IMPLEMENTAR (solo en creación)

**Consenso:** Todos aprueban con condiciones de seguridad.

**Reglas:**
- `date_to` se calcula en creación como `date_from + billing_period_days`. El backend debe calcularlo; no recibirlo del frontend.
- En **edición**, `date_to` sigue siendo editable manualmente (para correcciones).
- `billing_period_days` NO es editable en contratos con pagos registrados (bloquear en backend).

---

## Tareas del Backlog (ordenadas por prioridad)

### TASK-1 — [SEGURIDAD] Proteger edición de `billing_period_days` en contratos activos
**Prioridad:** Crítica
**Por qué:** Vector de fraude: cambiar `billing_period_days` extiende `date_to` sin pago.
**Cambios:**
- En `contracts_update` (Rust): si el contrato tiene pagos en `contract_payments`, rechazar cambio de `billing_period_days` con error explícito.
- En el formulario React: deshabilitar el campo `billingPeriodDays` si el contrato tiene pagos registrados.

---

### TASK-2 — [SEGURIDAD] Agregar `updated_at` y `updated_by` a tabla `contracts`
**Prioridad:** Alta
**Por qué:** Sin auditoría no se detectan extensiones fraudulentas.
**Cambios:**
- Migration 27: `ALTER TABLE contracts ADD COLUMN updated_at TEXT; ALTER TABLE contracts ADD COLUMN updated_by TEXT;`
- En `contracts_update` (Rust): setear `updated_at = NOW()`, `updated_by = operador_user_id`.

---

### TASK-3 — [UX] Auto-calcular `date_to` en CREACIÓN de contrato
**Prioridad:** Alta
**Por qué:** El operador no debe ingresar `date_to` manualmente; es un campo derivado.
**Cambios:**
- Backend: eliminar `date_to` de `CreateContractArgs`; calcularlo internamente con `date_from + billing_period_days`.
- Frontend: eliminar `dateTo` del payload en `handleCreate`. Mostrar `date_to` calculada como campo read-only en el formulario de creación.
- En formulario de edición: mantener `date_to` editable (DatePicker) para correcciones manuales.

---

### TASK-4 — [BUGFIX FINANCIERO] Corregir `period_from` en `contracts_record_payment` cuando hay mora
**Prioridad:** Alta
**Por qué:** Actualmente usa `today` como `period_from` cuando hay mora, creando un gap en el historial de pagos.
**Cambios (`contracts.rs`):**
```rust
// ANTES (incorrecto — crea gap):
let period_from = if contract.date_to < today { today.clone() } else { contract.date_to.clone() };

// DESPUÉS (correcto — historial continuo):
let period_from = contract.date_to.clone();
```

---

### TASK-5 — [UX] Renombrar labels del formulario de contratos (sin cambio de schema)
**Prioridad:** Media
**Por qué:** Reduce confusión del operador sin riesgo técnico.
**Cambios:**
- `extra_charge_first` → label "Cargo fijo por exceso (al superar horas incluidas)"
- `extra_charge_repeat` → label "Tarifa por intervalo extra"
- Agregar checkbox "Mismo precio para todos los intervalos" que sincronice ambos campos.
- Colapsar la sección de horas extra en un accordión/collapsible (no visible por defecto).

---

### TASK-6 — [PERFORMANCE] Agregar índice compuesto en `contracts`
**Prioridad:** Media
**Por qué:** Las queries de mora (`status, date_to`) escanean tabla completa.
**Cambios:**
- En migration 27 (junto a TASK-2): `CREATE INDEX IF NOT EXISTS idx_contracts_status_date_to ON contracts(status, date_to);`

---

### TASK-7 — [DATOS] Auditar contratos con `extra_charge_first != extra_charge_repeat`
**Estado:** ✅ Completado
**Resultado:** 0 contratos con valores distintos (5 contratos totales, 2 con extra charges — ambos con first = repeat).
**Conclusión:** La unificación futura en un solo campo es segura con los datos actuales.

---

### TASK-8 — [DATOS] Agregar campos de reportes financieros (diferido)
**Prioridad:** Baja
**Campos a agregar en migration futura:**
- `cancelled_at TEXT`
- `cancellation_reason TEXT`
- `last_payment_date TEXT`

---

## Orden de implementación sugerido

```
Sprint actual:
  TASK-4  (bugfix financiero — 30min)
  TASK-2 + TASK-6  (migration 27 — 1h)
  TASK-1  (proteger billing_period_days — 1h)

Sprint siguiente:
  TASK-3  (auto-calcular date_to en creación — 2h)
  TASK-5  (renombrar labels UI — 1h)
  TASK-7  (auditoría de datos — 15min)

Diferido:
  TASK-8
```

---

## Lo que NO se aprobó

- ❌ **Eliminar `extra_charge_first` / `extra_charge_repeat` del schema** — riesgo con contratos legacy.
- ❌ **Auto-recalcular `date_to` en edición de contratos activos** — vector de fraude confirmado.
- ❌ **Unificar campos en un solo campo DB ahora** — diferido hasta TASK-7.
