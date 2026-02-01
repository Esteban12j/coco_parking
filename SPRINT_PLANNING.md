# Planificación de Sprints — COCO Parking

**Fecha:** 1 de febrero de 2025  
**Base:** ANALISIS_SCRUM.md + PRODUCT_BACKLOG.md

---

## Sprint 0 (opcional): Alineación y preparación

**Objetivo:** Dejar listos backlog, Definition of Done y decisiones clave para no rehacer trabajo.

**Duración sugerida:** 1 semana (o 1–2 sesiones de refinamiento).

### Entregables de Sprint 0

| # | Tarea | Responsable | Hecho cuando… |
|---|--------|-------------|----------------|
| 1 | Revisar y priorizar **Product Backlog** con stakeholders (PO) | PO / SM | Backlog aceptado y ordenado; épica 1 como foco. |
| 2 | Aprobar **Definition of Done** (DEFINITION_OF_DONE.md) | Equipo | DoD acordada y visible para todo el equipo. |
| 3 | **Decisión:** Almacenamiento backend (SQLite vs archivo vs otro) | Tech lead / PO | Decisión documentada; si SQLite, esquema inicial definido. |
| 4 | **Decisión:** Migración desde localStorage (sí/no, cuándo) | Equipo / PO | Criterio claro para no bloquear Épica 1. |
| 5 | Estimar capacidad del equipo para Sprint 1 (días/puntos) | SM / Equipo | Compromiso realista para Sprint 1. |

**Nota:** Si el equipo ya tiene estas decisiones y el DoD aceptado, Sprint 0 puede acortarse o integrarse en la primera planificación de Sprint 1.

---

## Sprint 1: Persistencia backend (Épica 1 — parte 1)

**Objetivo:** Que el backend persista entradas y salidas de vehículos y sea la fuente de verdad para el listado.

**Duración sugerida:** 2 semanas.

### Historias objetivo (desde PRODUCT_BACKLOG.md)

| ID | Historia | Puntos | Notas |
|----|----------|--------|--------|
| **1.1** | Persistir vehículos (entradas/salidas) en el backend | 8 | Incluye elegir almacén (SQLite/archivo), implementar escritura/lectura en comandos existentes. |
| **1.2** | Listado y búsqueda por matrícula desde backend | 5 | Depende de 1.1; frontend debe consumir `vehiculos_list_vehicles` y búsqueda desde backend. |

**Objetivo mínimo de Sprint 1:** Entregar 1.1 + 1.2 (o 1.1 completo y parte de 1.2 si la capacidad es menor).

**Avance (1 feb 2025):** Historias 1.1 y 1.2 **Hecho**. 1.1: Backend persiste entradas/salidas en SQLite (`app_data_dir/coco_parking.db`); `vehiculos_register_entry` y `vehiculos_process_exit` persisten y devuelven datos; `vehiculos_process_exit` inserta en `transactions` con método de pago; reinicio no pierde datos; tests de persistencia en `db::tests`. 1.2: Listado principal viene de `vehiculos_list_vehicles` (persistidos); búsqueda por matrícula usa `vehiculos_find_by_plate` en backend; frontend en Tauri consume solo backend para listado y búsqueda (sin localStorage para el listado principal).

### Tareas técnicas sugeridas (para desglose en el tablero)

- [x] Definir esquema de datos / tablas (entradas, salidas, matrícula, timestamps).
- [x] Implementar capa de persistencia en Rust (módulo `db` o dominio `vehiculos` con almacén).
- [x] Modificar `register_entry` y `register_exit` para persistir y leer del almacén.
- [x] Modificar `vehiculos_list_vehicles` para devolver datos desde persistencia.
- [x] Añadir endpoint o comando de búsqueda por matrícula (o extender listado con filtro).
- [x] Actualizar frontend: listado y búsqueda consumen backend; reducir o eliminar dependencia de localStorage para listado principal.
- [x] Tests unitarios/integración para persistencia y listado.
- [x] Documentar comandos y esquema según DoD.

### Criterios de éxito del sprint

- Reiniciar la app no pierde vehículos registrados.
- Listado de vehículos activos y búsqueda por matrícula funcionan con datos del backend.
- Tests pasan; DoD cumplida en cada ítem entregado.

---

## Sprint 2: Una sola fuente para caja y métricas (Épica 1 — cierre + Épica 2 inicio)

**Objetivo:** Caja y métricas leen del mismo almacén que vehículos; tesorería real en pantalla Caja.

### Historias objetivo

| ID | Historia | Puntos | Estado |
|----|----------|--------|--------|
| **1.3** | Caja y métricas desde mismo almacén | 5 | **Hecho** |
| **2.1** | Tesorería real (esperado vs ingresado) | 5 | **Hecho** |

**Avance (1 feb 2025):** 1.3 y 2.1 **Hecho**. 1.3: `caja_get_treasury` y `metricas_get_daily` usan `AppState.db` (SQLite); en Tauri no hay cálculo de tesorería ni métricas en frontend (solo backend). 2.1: Pantalla Caja muestra total esperado e ingresado desde transacciones del día; datos vía `caja_get_treasury`; estado de carga/error y nota “según transacciones del día” visibles; desglose por método de pago (cash/card/transfer). CheckoutPanel permite elegir método de pago y `vehiculos_process_exit` persiste en `transactions`.

### Tareas técnicas (Sprint 2)

- [x] Comandos caja y métricas leen de mismo pool SQLite que vehículos.
- [x] Frontend Caja y Métricas consumen solo datos del store (useParkingStore → invoke).
- [x] Pantalla Caja: esperado, ingresado, desglose por método, carga/error.
- [ ] Cierre de turno (2.2) y método de pago por transacción en UI ya soportado en backend (2.3 parcial).

---

## Vista general de sprints (orientativa)

| Sprint | Foco | Historias | Estado |
|--------|------|-----------|--------|
| 0 | Alineación, DoD, decisiones | — | Opcional / integrado |
| 1 | Persistencia + listado/búsqueda | 1.1, 1.2 | **Hecho** |
| 2 | Caja/métricas mismo almacén + tesorería | 1.3, 2.1 | **Hecho** |
| 3 | Cierre de turno + método de pago | 2.2, 2.3 | Previsto |
| 4 | Métricas y reportes | 3.1, 3.2 | Previsto |
| 5 | Roles y usuarios persistentes + UI por permisos | 4.1, 4.2 | Previsto |
| 6+ | Backup, robustez | Épicas 5 y 6 | Previsto |
| * | Arquitectura datos y rendimiento (Épica 7) | A criterio de SM/PO | Ver ARQUITECTURA_DATOS_PERFORMANCE.md y PRODUCT_BACKLOG Épica 7. |

---

## Riesgos y mitigación

- **Scope creep:** Mantener foco en Épica 1 en Sprint 1–2; no añadir pantallas nuevas sin cerrar flujo core.
- **Decisiones tardías:** Cerrar en Sprint 0 almacenamiento y política de migración desde localStorage.
- **Bloqueos:** SM debe facilitar desbloqueo (ej. permisos escáner).

---

*Documento vivo: actualizar tras cada planificación y retrospectiva.*
