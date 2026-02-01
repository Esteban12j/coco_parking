# Análisis Scrum — COCO Parking

**Fecha:** 1 de febrero de 2025  
**Versión del producto:** 0.1.0  
**Alcance:** Análisis general de proyecto como Scrum Master / Product Owner.

---

## 1. Visión del producto

**COCO Parking** es una aplicación de escritorio para la **gestión de un estacionamiento**: registro de entradas/salidas de vehículos, cobro en caja, métricas diarias, roles y permisos, y backup local.

- **Tipo:** Desktop (Tauri 2 + React).
- **Usuarios objetivo:** Operadores de estacionamiento, administradores, posiblemente desarrolladores (consola de desarrollo).
- **Propuesta de valor:** Centralizar en una sola app: escáner de códigos, alta/baja de vehículos, caja, reportes y respaldo, con control de acceso por roles.

---

## 2. Arquitectura y stack

| Capa | Tecnología |
|------|------------|
| **Frontend** | React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind, Radix UI, i18n (es/en) |
| **Backend** | Rust (Tauri 2), comandos `invoke` desde el frontend |
| **Persistencia** | SQLite en backend (`app_data_dir`); frontend en Tauri usa solo backend; localStorage solo en modo web sin backend |
| **Hardware** | Escáner de código de barras vía HID (rdev), evento `barcode-scanned` solo en vista Vehículos |

**Estructura alineada por dominios:**

- **Frontend:** `src/features/{vehiculos,caja,metricas,roles,backup,dev-console}` (páginas y componentes por feature), `hooks/useParkingStore` (TanStack Query + invoke), `types/parking.ts`, `components/layout/AppLayout`, `pages/NotFound`.
- **Backend:** `src-tauri/src/domains/{vehiculos,caja,metricas,roles,backup}`, `db.rs` (pool y migraciones), `state.rs`, `permissions.rs`, `scanner.rs`, `dev.rs`.

Buena separación front/back y naming consistente entre features y dominios.

---

## 3. Dominios y estado actual

| Dominio | Frontend | Backend (Tauri) | Persistencia real | Notas |
|---------|----------|------------------|-------------------|--------|
| **Vehículos** | Completo: VehiculosPage, ScannerInput, VehicleEntryForm, ActiveVehiclesGrid, CheckoutPanel, conflictos de placa; evento `barcode-scanned` | `vehiculos_list_vehicles`, `vehiculos_register_entry`, `vehiculos_process_exit` (persiste en vehicles + insert en transactions), `vehiculos_find_by_plate`, `vehiculos_get_vehicles_by_plate`, `vehiculos_delete_vehicle`, `vehiculos_get_plate_conflicts`, `vehiculos_resolve_plate_conflict`, `vehiculos_get_plate_debt` | **SQLite** (vehicles, transactions) | Historias 1.1 y 1.2 hechas; fuente de verdad backend en Tauri. |
| **Caja** | CajaPage (tesorería, carga/error, desglose por método); CheckoutPanel con método de pago (cash/card/transfer) | `caja_get_treasury` (solo tabla transactions), `caja_get_debug`, `caja_close_shift` (placeholder) | Mismo almacén (SQLite, tabla transactions) | Historias 1.3 y 2.1 hechas; tesorería real desde transacciones del día. |
| **Métricas** | MetricasPage; datos desde useParkingStore → `metricas_get_daily` | `metricas_get_daily` calcula desde vehicles en SQLite | Mismo almacén (SQLite) | Historia 1.3 hecha; pico de horas aún datos mock en UI. |
| **Roles** | Página roles | `roles_list_roles`, `roles_get_current_user`, `roles_get_my_permissions`, `roles_get_permissions_for_user` | En memoria (admin/developer con todos los permisos) | RBAC en `permissions.rs`; sin usuarios persistentes (Épica 4 pendiente). |
| **Backup** | Página backup | `backup_create`, `backup_restore`, `backup_list` | SQLite backup/restore | Épica 5.1 Hecho. |
| **Dev console** | DevConsolePage (ruta dev-console, condicional COCO_DEV) | `dev_list_commands`, `dev_set_current_user`, `dev_get_db_path`, etc. | — | Aislado; solo desarrollo. |

**Conclusión:** Backend persiste en SQLite (vehicles + transactions). En Tauri el flujo entrada → salida → cobro usa backend como fuente única; `vehiculos_process_exit` inserta en `transactions` con método de pago. Caja y métricas leen del mismo almacén (1.3, 2.1, 6.0 hechas). En modo web sin Tauri: estado en memoria/localStorage para demo.

---

## 4. Permisos y seguridad

- **Modelo:** Permisos granulares por recurso y acción (`vehiculos:entries:read`, `caja:transactions:create`, etc.) en `permissions.rs`.
- **Estado:** `AppState` con `current_user_id` y mapa `user_permissions`; por defecto usuario `admin` con todos los permisos.
- **Comandos:** Los comandos Tauri comprueban permisos antes de ejecutar; frontend no restringe rutas por rol en el análisis realizado.

**Recomendación Scrum:** Incluir en el backlog “Proteger rutas/acciones en frontend según permisos del usuario actual” y “Definir usuarios/roles persistentes”.

---

## 5. Calidad y pruebas

- **Tests frontend:** Vitest + Testing Library; `useParkingStore.test.ts`, `barcode-scanner.test.ts`, `example.test.ts`, `i18n.test.tsx`; mocks de Tauri en `test/mocks/tauri.ts`.
- **Tests backend:** `db::tests` en `db.rs` (persistencia); módulo `tests` en `scanner.rs`.
- **Lint:** ESLint (frontend); Rust: `cargo build` / `cargo clippy`.
- **Tipos:** TypeScript en frontend (`types/parking.ts`); estructuras Serde en Rust.

Punto positivo: pruebas en lógica crítica (store, escáner, i18n, persistencia). Pendiente: cobertura medida y pruebas E2E/integración con Tauri (historia 6.3).

---

## 6. Backlog sugerido (épicas e historias)

Priorización orientativa para los próximos sprints.

### Épica 1: Fuente única de verdad y persistencia

- **US 1.1:** Como sistema, persistir vehículos (entradas/salidas) en el backend (SQLite o archivo) para que no dependan de localStorage.
- **US 1.2:** Como operador, que listado de vehículos activos y búsqueda por matrícula vengan del backend.
- **US 1.3:** Como sistema, que caja y métricas lean datos del mismo almacén que vehículos (evitar duplicación front/back).

### Épica 2: Caja y cierre de turno

- **US 2.1:** Como cajero, ver tesorería real (esperado vs ingresado) según transacciones del día.
- **US 2.2:** Como cajero, cerrar turno con resumen y posible arqueo.
- **US 2.3:** Registrar método de pago (efectivo/tarjeta/transferencia) por transacción.

### Épica 3: Métricas y reportes

- **US 3.1:** Como admin, ver métricas diarias calculadas desde datos persistentes.
- **US 3.2:** Exportar reportes (CSV/PDF) con filtros de fecha.

### Épica 4: Roles y usuarios

- **US 4.1:** Gestionar usuarios y asignación de roles de forma persistente.
- **US 4.2:** Ocultar o deshabilitar en frontend acciones para las que el usuario no tenga permiso (según permisos del backend).

### Épica 5: Backup

- **US 5.1:** Backup real de datos (export/import) con ruta seleccionable.
- **US 5.2:** Eliminada (sincronización Drive no forma parte del producto).

### Épica 6: Robustez y operación

- **US 6.1:** Manejo de errores y reintentos en llamadas a Tauri.
- **US 6.2:** Documentar requisitos de permisos en Linux para el escáner (`input` group).
- **US 6.3:** Tests E2E o de integración para flujo entrada → salida → caja.

---

## 7. Deuda técnica y riesgos

| Elemento | Severidad | Descripción |
|----------|-----------|-------------|
| **Datos solo en frontend** | Resuelto (1.1, 1.2) | Backend persiste en SQLite; en Tauri la fuente de verdad es el backend. localStorage solo en modo web sin backend. |
| **Duplicación de lógica** | Resuelto (1.3) | Caja y métricas leen solo del backend (mismo almacén); no hay cálculo de tesorería/métricas solo en frontend en Tauri. |
| **Caja/Métricas sin datos reales** | Resuelto (1.3, 2.1) | `caja_get_treasury` y `metricas_get_daily` usan SQLite; pantalla Caja muestra datos desde transacciones del día. |
| **Sin persistencia de usuarios** | Media | Solo admin/developer en memoria; no hay CRUD de usuarios ni asignación persistente (Épica 4). |
| **Cierre de turno / backup** | Media | `caja_close_shift` implementado; backup real implementado (Épicas 2, 5.1). |
| **Escáner en Linux** | Baja | Dependencia de grupo `input` o permisos; documentar en README (historia 6.2). |
| **Tests E2E** | Baja | No hay tests E2E para flujo entrada → salida → caja (historia 6.3). |

---

## 8. Recomendaciones Scrum

### Sprints y priorización

- **Sprint 0 (opcional):** Definir y priorizar backlog con stakeholders; acordar “Definition of Done” (tests, revisión, documentación mínima).
- **Primeros sprints:** Centrarse en **Épica 1** (persistencia y una sola fuente de verdad). Sin esto, caja, métricas y reportes seguirán desalineados.
- **Después:** Caja (Épica 2) y métricas (Épica 3); luego roles (Épica 4) y backup (Épica 5).

### Definition of Done sugerida

- Código en rama revisado (PR).
- Tests unitarios o de integración donde aplique.
- Sin regresiones conocidas en flujo entrada/salida.
- Documentación de comandos Tauri o de API cuando se añadan/alteren.
- Comportamiento verificado en al menos un SO (Windows/macOS/Linux según prioridad).

### Stakeholders y roles

- **Product Owner:** Define prioridad de épicas e historias (p. ej. caja vs. reportes vs. backup).
- **Scrum Master:** Facilita ritmo, elimina bloqueos (p. ej. decisión de base de datos o formato de backup).
- **Desarrollo:** Unificar criterio de “dónde vive la verdad” (backend vs. frontend) antes de seguir ampliando features.

### Riesgos de proceso

- **Scope creep:** Muchas pantallas (backup, roles, métricas) con poca profundidad; conviene cerrar el flujo core (vehículos + caja + persistencia) antes de ampliar.
- **Decisiones pendientes:** Elegir almacenamiento backend (SQLite, archivo JSON, etc.) y política de backup para no rehacer trabajo.

---

## 9. Resumen ejecutivo

| Aspecto | Valoración breve |
|---------|------------------|
| **Visión** | Clara: estacionamiento desktop con caja, métricas, roles y backup. |
| **Arquitectura** | Sólida: Tauri 2 + React, dominios alineados (vehiculos, caja, metricas, roles, backup, dev), permisos en `permissions.rs`. |
| **Estado funcional** | Flujo core cerrado: entrada/salida/cobro con persistencia en SQLite; listado y búsqueda desde backend; caja y métricas desde mismo almacén; tesorería real en pantalla Caja (historias 1.1, 1.2, 1.3, 2.1, 6.0 hechas). |
| **Principal brecha** | Usuarios/roles persistentes (Épica 4); tests E2E (6.3). Backup real implementado (5.1); Drive eliminado del producto. |
| **Próximo paso recomendado** | Planificar Sprint 3: historias 2.2 (cierre de turno) y 2.3 (método de pago ya soportado en backend; reforzar en UI si hace falta); o iniciar Épica 3 (métricas/export) o Épica 4 (roles persistentes). |

---

## 10. Análisis de Arquitectura de Datos y Rendimiento (para SM/PO)

**Notificación al profesional Scrum:** Se ha realizado un **análisis de arquitectura de datos y rendimiento** (perfil: alta disponibilidad, escalabilidad, eficiencia de recursos). El documento detallado está en **[ARQUITECTURA_DATOS_PERFORMANCE.md](./ARQUITECTURA_DATOS_PERFORMANCE.md)**.

**Resumen para priorización:**

- **Áreas analizadas:** Modelado de datos y escalabilidad, optimización del data-flow Frontend–Backend, estrategia de caché, auditoría de consultas (queries lentas o costosas).
- **Hallazgos principales:** Listado de vehículos sin paginación; consultas de Caja y Métricas que pueden consolidarse; búsqueda por placa con `UPPER()` impide uso de índice; invalidación global de queries tras cada mutación.
- **Recomendación:** Incluir en el backlog una **épica o historias de “Arquitectura de datos y rendimiento”** (paginación, proyecciones, consultas consolidadas, invalidación selectiva). **Puede ser prioridad alta** si el equipo o el negocio prevén crecimiento rápido de registros o múltiples puestos; **prioridad media** si el volumen se mantiene bajo a corto plazo.
- **Decisión de prioridad:** Corresponderá al **profesional Scrum / Product Owner** decidir si esta épica o estas historias pasan a ser prioridad y en qué sprint se planifican. En PRODUCT_BACKLOG.md se ha añadido la **Épica 7** y historias sugeridas para facilitar la decisión.

---

*Documento generado a partir del análisis del repositorio COCO Parking. Puede usarse como base para refinamiento de backlog, planificación de sprints y alineación con stakeholders.*

---

## Artefactos Scrum derivados

A partir de este análisis se han generado los siguientes artefactos operativos:

| Artefacto | Archivo | Uso |
|-----------|---------|-----|
| **Product Backlog** | [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md) | Historias refinadas con criterios de aceptación y puntos. |
| **Definition of Done** | [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md) | Condiciones para considerar un ítem "Hecho" en cada sprint. |
| **Planificación de sprints** | [SPRINT_PLANNING.md](./SPRINT_PLANNING.md) | Sprint 0 (alineación), Sprint 1 (persistencia) y vista de sprints siguientes. |
| **Arquitectura de datos y rendimiento** | [ARQUITECTURA_DATOS_PERFORMANCE.md](./ARQUITECTURA_DATOS_PERFORMANCE.md) | Análisis para escalabilidad, data-flow, caché y auditoría de queries; base para épica/historias de rendimiento (prioridad a criterio de SM/PO). |
