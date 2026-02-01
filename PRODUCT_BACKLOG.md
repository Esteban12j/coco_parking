# Product Backlog — COCO Parking

**Última actualización:** 1 de febrero de 2025  
**Fuente:** Análisis Scrum (ANALISIS_SCRUM.md), Consultoría Datos (CONSULTORIA_DATOS.md)  
**Prioridad:** 1 = más alta.

**Avance:** Historias 1.1, 1.2, 1.3, 2.1, 2.2 y 6.0 **Hecho**. 1.1: Backend persiste entradas/salidas en SQLite; `vehiculos_register_entry` y `vehiculos_process_exit` persisten; `vehiculos_process_exit` inserta en tabla `transactions` con método de pago; reinicio no pierde datos. 1.2: `vehiculos_list_vehicles` y `vehiculos_find_by_plate` en backend; frontend Tauri consume solo backend para listado y búsqueda. 1.3: `caja_get_treasury` y `metricas_get_daily` usan AppState.db (SQLite); en Tauri no hay cálculo de tesorería/métricas en frontend. 2.1: Pantalla Caja muestra esperado/ingresado desde transacciones; datos vía `caja_get_treasury`; carga/error y nota “según transacciones del día”; desglose por método de pago; CheckoutPanel permite elegir método y backend persiste en `transactions`. 2.2: Tabla `shift_closures` (migración 4); `caja_close_shift(arqueo_cash?, notes?)` persiste resumen; `caja_list_shift_closures(limit?)` para historial; pantalla Caja: diálogo cierre con arqueo opcional, sección historial de cierres. 6.0: Caja usa una sola fuente (store → backend); sin query duplicada; tesorería desde tabla `transactions`.

**Resumen de lo desarrollado (revisión 1 feb 2025):**

| Área | Implementado |
|------|--------------|
| **Backend** | SQLite en `app_data_dir/coco_parking.db`; migraciones en `db.rs` (incl. shift_closures v4); dominios vehiculos (list, register, process_exit, find_by_plate, get_vehicles_by_plate, delete, plate_conflicts, resolve_conflict, get_plate_debt), caja (get_treasury, get_debug, close_shift con persistencia, list_shift_closures), metricas (get_daily), roles (list, current_user, my_permissions, permissions_for_user — en memoria), backup/drive (placeholders), dev_*; scanner HID → evento `barcode-scanned`. |
| **Frontend** | Rutas: vehicles, till, metrics, roles, backup, drive, dev-console; useParkingStore (TanStack Query: vehicles, metrics, treasury, shiftClosures; mutaciones register/processExit/closeShift); VehiculosPage (escáner, entrada, listado, checkout, conflictos de placa); CajaPage (tesorería, carga/error, desglose, diálogo cierre de turno con arqueo, historial de cierres); MetricasPage (datos desde backend); CheckoutPanel (método de pago cash/card/transfer); i18n es/en. |
| **Tests** | Frontend: useParkingStore.test.ts, barcode-scanner.test.ts, example.test.ts, i18n.test.tsx; Backend: db::tests, scanner tests. |

**Nota para Scrum (consultoría datos, 1 feb 2025):** Se realizó una revisión de conexiones a BD, tablas, sincronización y acceso a Caja/Métricas. Cambios aplicados: (1) Backend: `TreasuryData` incluye `dataSource` (`transactions` | `vehiclesLegacy`) cuando Caja usa fallback desde `vehicles`. (2) Frontend: Pantalla Caja usa **una sola fuente** — solo datos del store (`useParkingStore`), sin query duplicada ni fallback entre query y store; se muestra aviso cuando los datos vienen de `vehiclesLegacy`. (3) Documento **CONSULTORIA_DATOS.md** con recomendaciones y nueva historia 6.0. **Actualizar tablero** si se incorpora la historia 6.0 (Caja y métricas: una sola fuente y robustez).

**Nota para Scrum (arquitectura datos y rendimiento, 1 feb 2025):** Se ha realizado un **análisis de arquitectura de datos y rendimiento** (escalabilidad, data-flow, caché, auditoría de queries). Ver **[ARQUITECTURA_DATOS_PERFORMANCE.md](./ARQUITECTURA_DATOS_PERFORMANCE.md)**. Se ha añadido la **Épica 7** (Arquitectura de datos y rendimiento) con historias 7.1–7.4. **La prioridad de esta épica corresponde al profesional Scrum / PO** — puede ser prioridad si se decide que escalabilidad y rendimiento son críticos en los próximos sprints.

Las historias están ordenadas por épica y prioridad dentro de la épica. Los puntos son orientativos (Fibonacci: 1, 2, 3, 5, 8).

---

## Épica 1: Fuente única de verdad y persistencia

**Objetivo:** Los datos de vehículos y operaciones viven en el backend; frontend solo consume y presenta.

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|------|----------|--------|---------|--------|--------------------------|-----|--------|
| 1.1  | Persistencia backend | sistema | persistir entradas y salidas de vehículos en el backend (SQLite o archivo) | que no dependan de localStorage y haya una sola fuente de verdad | • Backend escribe/lee entradas y salidas en almacén persistente.<br>• Comandos `register_entry`, `register_exit` persisten y devuelven datos guardados.<br>• Reinicio de app no pierde datos. | 8 | **Hecho** |
| 1.2  | Listado desde backend | operador | que el listado de vehículos activos y la búsqueda por matrícula vengan del backend | tener datos consistentes en cualquier sesión o ventana | • `vehiculos_list_vehicles` devuelve vehículos realmente persistidos.<br>• Búsqueda por matrícula usa backend y devuelve resultados correctos.<br>• Frontend consume estos datos y deja de usar solo localStorage para el listado principal. | 5 | **Hecho** |
| 1.3  | Caja y métricas desde mismo almacén | sistema | que caja y métricas lean del mismo almacén que vehículos | evitar duplicación y desalineación front/back | • Comandos de caja y métricas usan el mismo almacén que vehículos.<br>• No hay cálculo duplicado de tesorería o métricas solo en frontend. | 5 | **Hecho** |

---

## Épica 2: Caja y cierre de turno

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|------|----------|--------|---------|--------|--------------------------|-----|--------|
| 2.1  | Tesorería real | cajero | ver tesorería real (esperado vs ingresado) según transacciones del día | conciliar y controlar caja | • Pantalla Caja muestra total esperado e ingresado a partir de transacciones persistidas.<br>• Datos provienen del backend. | 5 | **Hecho** |
| 2.2  | Cierre de turno | cajero | cerrar turno con resumen y posible arqueo | dejar registrado el cierre y la diferencia | • Comando/flujo de cierre de turno persiste resumen (total, método de pago, arqueo).<br>• Se puede consultar historial de cierres. | 5 | **Hecho** |
| 2.3  | Método de pago por transacción | cajero | registrar método de pago (efectivo/tarjeta/transferencia) por transacción | tener trazabilidad y reportes por tipo de pago | • Cada transacción de salida permite elegir método de pago.<br>• Se persiste y se refleja en tesorería y reportes. | 3 | |

---

## Épica 3: Métricas y reportes

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts |
|------|----------|--------|---------|--------|--------------------------|-----|
| 3.1  | Métricas desde datos persistentes | admin | ver métricas diarias calculadas desde datos persistentes | tomar decisiones con datos fiables | • `metricas_get_daily` (o equivalente) calcula desde el almacén persistente.<br>• Pantalla Métricas muestra datos coherentes con vehículos y caja. | 3 |
| 3.2  | Exportar reportes | admin | exportar reportes (CSV/PDF) con filtros de fecha | analizar y compartir datos | • Exportación CSV/PDF con rango de fechas.<br>• Contenido alineado con datos persistidos. | 5 |

---

## Épica 4: Roles y usuarios

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts |
|------|----------|--------|---------|--------|--------------------------|-----|
| 4.1  | Usuarios y roles persistentes | admin | gestionar usuarios y asignación de roles de forma persistente | tener equipos y permisos estables | • CRUD de usuarios y asignación de roles persistidos en backend.<br>• Login/identificación usa esos usuarios (o al menos admin puede gestionarlos). | 8 |
| 4.2  | UI según permisos | operador/cajero | que en frontend se oculten o deshabiliten acciones para las que no tengo permiso | no ver opciones que no puedo usar | • Rutas o acciones restringidas según permisos devueltos por backend.<br>• Botones/links deshabilitados u ocultos cuando no hay permiso. | 5 |

---

## Épica 5: Backup y Drive

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts |
|------|----------|--------|---------|--------|--------------------------|-----|
| 5.1  | Backup real | admin | hacer backup real de datos (export/import) con ruta seleccionable | recuperar ante fallos | • Backup exporta datos del almacén a archivo en ruta elegida.<br>• Restore importa desde archivo y deja datos consistentes. | 5 |
| 5.2  | Sincronización Drive | admin | sincronizar con Google Drive (o similar) según configuración | respaldo en la nube | • Configuración de carpeta/credenciales y sincronización funcional según diseño acordado. | 8 |

---

## Épica 6: Robustez y operación

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|------|----------|--------|---------|--------|--------------------------|-----|--------|
| 6.0  | Caja y métricas: una sola fuente y robustez | cajero/admin | que Caja y Métricas usen una sola fuente de datos y se indique el origen cuando sea fallback | conciliar y confiar en los datos | • Caja en frontend usa solo datos del store (sin query duplicada).<br>• Tesorería indica origen (`transactions` vs `vehiclesLegacy`) cuando se use fallback.<br>• Pantalla Caja muestra aviso cuando datos vengan de `vehiclesLegacy`.<br>• Opcional: en error al cargar métricas/tesorería, mostrar mensaje de error en lugar de solo ceros. | 3 | **Hecho** (consultoría 1 feb 2025) |
| 6.1  | Errores y reintentos Tauri | operador | que las llamadas a Tauri tengan manejo de errores y reintentos | no perder operaciones por fallos puntuales | • Errores de invoke mostrados al usuario de forma clara.<br>• Reintentos configurables donde aplique (ej. red/Drive). | 3 | |
| 6.2  | Documentar permisos escáner | desarrollador/admin | documentar requisitos de permisos en Linux para el escáner (grupo `input`) | facilitar despliegue | • README o docs con pasos para grupo `input` y troubleshooting. | 1 | |
| 6.3  | Tests E2E/integración | equipo | tests E2E o de integración para flujo entrada → salida → caja | evitar regresiones en el flujo core | • Al menos un test automatizado que cubra entrada, salida y caja (con Tauri/WebDriver o similar). | 5 | |

---

## Épica 7: Arquitectura de datos y rendimiento (prioridad a criterio de SM/PO)

**Objetivo:** Escalabilidad, menor latencia y uso eficiente de recursos (BD, CPU, RAM, intercambio Frontend–Backend). Base: [ARQUITECTURA_DATOS_PERFORMANCE.md](./ARQUITECTURA_DATOS_PERFORMANCE.md).

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|------|----------|--------|---------|--------|--------------------------|-----|--------|
| 7.1  | Paginación del listado de vehículos | sistema / operador | que el listado de vehículos sea paginado (o con límite) en backend y frontend | soportar crecimiento masivo sin degradar rendimiento | • Backend: `vehiculos_list_vehicles` acepta `limit` (y opcionalmente `offset` o cursor).<br>• Frontend: listado paginado o virtualizado; no cargar todos los registros a la vez. | 5 | |
| 7.2  | Optimización de consultas Caja y Métricas | sistema | que Caja y Métricas obtengan sus datos en menos consultas a la BD | reducir latencia y carga en SQLite | • `caja_get_treasury`: una sola query agregada (COUNT + SUM por método).<br>• `metricas_get_daily`: reducir a 1–2 consultas con agregaciones. | 3 | |
| 7.3  | Invalidación selectiva y proyecciones | sistema | que tras una mutación solo se invaliden/refetch las queries afectadas y que el listado pueda pedir solo campos necesarios | minimizar latencia y desperdicio de JSON | • Invalidación selectiva: tras entrada/salida no refetch todo `['parking']`; solo vehicles (y treasury/métricas según corresponda).<br>• Opcional: DTO resumido para listado (proyección) y uso en frontend. | 3 | |
| 7.4  | Búsqueda por placa e índices | sistema | que la búsqueda por placa use índice y que consultas por estado/fecha sean más eficientes | evitar full scan y preparar crecimiento | • Búsqueda por placa sin impedir índice (normalización de placa o columna `plate_upper`).<br>• Índice compuesto (status, exit_time) en vehicles para consultas “completados hoy”. | 2 | |

**Nota para Scrum (1 feb 2025):** La **prioridad** de esta épica (y si se planifica en el próximo sprint o más adelante) queda a criterio del **profesional Scrum / Product Owner**. Puede ser prioridad alta si se espera alto volumen de registros o múltiples puestos; media si el volumen se mantiene bajo.

---

## Resumen por épica

| Épica | Historias | Puntos totales |
|-------|-----------|----------------|
| 1. Fuente única de verdad | 3 | 18 |
| 2. Caja y cierre de turno | 3 | 13 |
| 3. Métricas y reportes | 2 | 8 |
| 4. Roles y usuarios | 2 | 13 |
| 5. Backup y Drive | 2 | 13 |
| 6. Robustez y operación | 4 | 12 |
| 7. Arquitectura de datos y rendimiento | 4 | 13 |
| **Total** | **20** | **90** |

---

## Notas para refinamiento

- **Épica 1** cerrada (1.1, 1.2, 1.3 hechas). Caja y métricas ya leen del mismo almacén que vehículos.
- Almacenamiento backend: **SQLite** en `app_data_dir/coco_parking.db`; esquema y migraciones en `db.rs` (véase DATABASE_SCHEMA.md).
- **Consultoría datos (CONSULTORIA_DATOS.md):** Valorar migración única de datos legacy (vehículos completados sin fila en `transactions`) para deprecar el fallback de Caja y dejar `transactions` como única fuente.
- **Épica 7 (ARQUITECTURA_DATOS_PERFORMANCE.md):** Prioridad a criterio de SM/PO. Si se prioriza, puede planificarse después de cerrar flujo core (Épicas 1–2) o en paralelo según capacidad.

---

**Para el profesional Scrum / SM:** La historia **2.1 (Tesorería real)** está **Hecho**. Actualizar tablero (mover 2.1 a Hecho), sprint planning si aplica. Criterios de aceptación verificados: (1) Pantalla Caja muestra **total esperado** e **ingresado** (esperado vs ingresado) a partir de transacciones persistidas del día. (2) Datos provienen del backend: la pantalla consume `caja_get_treasury`; se muestra nota “Datos según transacciones del día desde el backend”, estado de carga y error, y botón Actualizar. Desglose por método de pago con porcentajes reales. La historia 1.3 sigue Hecho según la nota anterior.

**Para el profesional Scrum / SM (1 feb 2025 — Historia 2.2):** La historia **2.2 (Cierre de turno)** está **Hecho**. **Actualizar tablero**: mover 2.2 a Hecho. Criterios de aceptación verificados: (1) **Comando/flujo de cierre de turno persiste resumen**: tabla `shift_closures` (migración 4 en `db.rs`); comando `caja_close_shift(arqueo_cash?, notes?)` calcula total esperado desde transacciones del día, persiste resumen (expected_total, cash/card/transfer, arqueo opcional, discrepancy, total_transactions, notes). (2) **Historial de cierres**: comando `caja_list_shift_closures(limit?)` devuelve cierres ordenados por fecha; en pantalla Caja, sección "Historial de cierres" con tabla (fecha, total esperado, arqueo, discrepancia, transacciones). Flujo: botón "Cierre de Turno" abre diálogo con resumen del día, campo opcional arqueo (efectivo contado), notas; al confirmar se persiste el cierre y se actualiza el historial.
