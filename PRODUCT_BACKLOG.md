# Product Backlog — COCO Parking

**Última actualización:** 1 de febrero de 2025  
**Fuente:** Análisis Scrum (ANALISIS_SCRUM.md), Consultoría Datos (CONSULTORIA_DATOS.md)  
**Prioridad:** 1 = más alta.

**Avance:** Historias 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 5.1, 6.0, 6.1 y 6.2 **Hecho**. (5.2 Sincronización Drive fue eliminada del producto; solo se mantiene backup local.) 1.1: Backend persiste entradas/salidas en SQLite; `vehiculos_register_entry` y `vehiculos_process_exit` persisten; `vehiculos_process_exit` inserta en tabla `transactions` con método de pago; reinicio no pierde datos. 1.2: `vehiculos_list_vehicles` y `vehiculos_find_by_plate` en backend; frontend Tauri consume solo backend para listado y búsqueda. 1.3: `caja_get_treasury` y `metricas_get_daily` usan AppState.db (SQLite); en Tauri no hay cálculo de tesorería/métricas en frontend. 2.1: Pantalla Caja muestra esperado/ingresado desde transacciones; datos vía `caja_get_treasury`; carga/error y nota “según transacciones del día”; desglose por método de pago; CheckoutPanel permite elegir método y backend persiste en `transactions`. 2.2: Tabla `shift_closures` (migración 4); `caja_close_shift(arqueo_cash?, notes?)` persiste resumen; `caja_list_shift_closures(limit?)` para historial; pantalla Caja: diálogo cierre con arqueo opcional, sección historial de cierres. 2.3: Cada transacción de salida permite elegir método de pago (efectivo/tarjeta/transferencia); se persiste en `transactions.method`; tesorería y pantalla Caja muestran desglose por tipo de pago; cierres de turno incluyen totales por método. 6.0: Caja usa una sola fuente (store → backend); sin query duplicada; tesorería desde tabla `transactions`.

**Resumen de lo desarrollado (revisión 1 feb 2025):**

| Área | Implementado |
|------|--------------|
| **Backend** | SQLite en `app_data_dir/coco_parking.db`; migraciones en `db.rs` (v5: users, roles, role_permissions; v7: drive_config legacy sin uso); dominios vehiculos (list, register, process_exit, find_by_plate, get_vehicles_by_plate, delete, plate_conflicts, resolve_conflict, get_plate_debt), caja (get_treasury, get_debug, close_shift, list_shift_closures), metricas (get_daily), roles (list_roles, list_users, create_user, update_user, set_password, delete_user, get_role_permissions, update_role_permissions, get_permissions_for_user — persistidos en BD), auth (login, logout, get_session); **backup** (backup_create(path), backup_restore(path); permisos backup:create, backup:restore, backup:list:read); dev_*; scanner HID → evento `barcode-scanned`. |
| **Frontend** | Rutas: login (Tauri), vehicles, till, metrics, roles, backup, dev-console; useParkingStore, useSession, useMyPermissions; AuthGate; LoginPage; RolesPage; VehiculosPage, CajaPage, MetricasPage, CheckoutPanel; **Backup (5.1):** BackupPage con Export y Restore según permisos; i18n es/en. **UI según permisos (4.2):** nav oculto por permiso, redirección si ruta sin permiso, botones/acciones ocultos o deshabilitados (Caja cierre turno, Roles CRUD, Vehículos entrada/checkout, Métricas exportar, Backup export/restore); i18n es/en. |
| **Tests** | Frontend: useParkingStore.test.ts, barcode-scanner.test.ts, example.test.ts, i18n.test.tsx; Backend: db::tests, scanner tests. |

**Nota para Scrum (consultoría datos, 1 feb 2025):** Se realizó una revisión de conexiones a BD, tablas, sincronización y acceso a Caja/Métricas. Cambios aplicados: (1) Backend: `TreasuryData` incluye `dataSource` (`transactions` | `vehiclesLegacy`) cuando Caja usa fallback desde `vehicles`. (2) Frontend: Pantalla Caja usa **una sola fuente** — solo datos del store (`useParkingStore`), sin query duplicada ni fallback entre query y store; se muestra aviso cuando los datos vienen de `vehiclesLegacy`. (3) Documento **CONSULTORIA_DATOS.md** con recomendaciones y nueva historia 6.0. **Actualizar tablero** si se incorpora la historia 6.0 (Caja y métricas: una sola fuente y robustez).

**Nota para Scrum (arquitectura datos y rendimiento, 1 feb 2025):** Se ha realizado un **análisis de arquitectura de datos y rendimiento** (escalabilidad, data-flow, caché, auditoría de queries). Ver **[ARQUITECTURA_DATOS_PERFORMANCE.md](./ARQUITECTURA_DATOS_PERFORMANCE.md)**. Se ha añadido la **Épica 7** (Arquitectura de datos y rendimiento) con historias 7.1–7.4. **La prioridad de esta épica corresponde al profesional Scrum / PO** — puede ser prioridad si se decide que escalabilidad y rendimiento son críticos en los próximos sprints.

**Para el profesional Scrum / SM — actualizar tablero (commit backup + Drive eliminado):** Se ha implementado **backup real (5.1)** y se ha **eliminado la sección Drive** (antes solo placeholder «en desarrollo»). **Acciones:** (1) Mover **5.1 (Backup real)** a Hecho en el tablero. (2) Marcar **5.2 (Sincronización Drive)** como Eliminada / fuera de alcance; quitar del tablero activo o archivarla. (3) Actualizar vista de Épica 5 a «Backup» (sin Drive). (4) Comunicar al equipo: respaldo solo local (Export/Restore); no hay integración con nube. Commit de referencia: `feat(backup): implement real export/restore; remove Drive placeholder (5.1)`.

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
| 2.3  | Método de pago por transacción | cajero | registrar método de pago (efectivo/tarjeta/transferencia) por transacción | tener trazabilidad y reportes por tipo de pago | • Cada transacción de salida permite elegir método de pago.<br>• Se persiste y se refleja en tesorería y reportes. | 3 | **Hecho** |

---

## Épica 3: Métricas y reportes

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|------|----------|--------|---------|--------|--------------------------|-----|--------|
| 3.1  | Métricas desde datos persistentes | admin | ver métricas diarias calculadas desde datos persistentes | tomar decisiones con datos fiables | • `metricas_get_daily` (o equivalente) calcula desde el almacén persistente.<br>• Pantalla Métricas muestra datos coherentes con vehículos y caja. | 3 | **Hecho** |
| 3.2  | Exportar reportes | admin | exportar reportes (CSV/PDF) con filtros de fecha | analizar y compartir datos | • Exportación CSV/PDF con rango de fechas.<br>• Contenido alineado con datos persistidos.<br>• **Refinamiento:** Reporte por defecto con headers configurables (selección de columnas por tipo de reporte). Filtros (fechas y según tipo: método de pago, tipo de vehículo, etc.). Vista previa del reporte en pantalla (mismos headers y filtros) antes de exportar; opción de exportar desde la vista previa. Tipos de reporte predefinidos (transacciones, vehículos completados, cierres de turno, transacciones + datos vehículo); las tablas se cruzan vía JOIN en backend — no se requieren tablas dinámicas. | 5 | **Hecho** |

---

## Épica 4: Roles y usuarios

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|------|----------|--------|---------|--------|--------------------------|-----|--------|
| 4.1  | Usuarios y roles persistentes | admin | gestionar usuarios y asignación de roles de forma persistente | tener equipos y permisos estables | • CRUD de usuarios y asignación de roles persistidos en backend.<br>• Login/identificación usa esos usuarios (o al menos admin puede gestionarlos). | 8 | **Hecho** |
| 4.2  | UI según permisos | operador/cajero | que en frontend se oculten o deshabiliten acciones para las que no tengo permiso | no ver opciones que no puedo usar | • Rutas o acciones restringidas según permisos devueltos por backend.<br>• Botones/links deshabilitados u ocultos cuando no hay permiso. | 5 | **Hecho** |

---

## Épica 5: Backup

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|------|----------|--------|---------|--------|--------------------------|-----|--------|
| 5.1  | Backup real | admin | hacer backup real de datos (export/import) con ruta seleccionable | recuperar ante fallos | • Backup exporta datos del almacén a archivo en ruta elegida.<br>• Restore importa desde archivo y deja datos consistentes. | 5 | **Hecho** |
| 5.2  | Sincronización Drive | admin | — | — | Eliminada del producto; solo se mantiene backup local (export/restore). | — | **Eliminada** |

---

## Épica 6: Robustez y operación

| ID   | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|------|----------|--------|---------|--------|--------------------------|-----|--------|
| 6.0  | Caja y métricas: una sola fuente y robustez | cajero/admin | que Caja y Métricas usen una sola fuente de datos y se indique el origen cuando sea fallback | conciliar y confiar en los datos | • Caja en frontend usa solo datos del store (sin query duplicada).<br>• Tesorería indica origen (`transactions` vs `vehiclesLegacy`) cuando se use fallback.<br>• Pantalla Caja muestra aviso cuando datos vengan de `vehiclesLegacy`.<br>• Opcional: en error al cargar métricas/tesorería, mostrar mensaje de error en lugar de solo ceros. | 3 | **Hecho** (consultoría 1 feb 2025) |
| 6.1  | Errores y reintentos Tauri | operador | que las llamadas a Tauri tengan manejo de errores y reintentos | no perder operaciones por fallos puntuales | • Errores de invoke mostrados al usuario de forma clara.<br>• Reintentos configurables donde aplique (ej. red). | 3 | **Hecho** |
| 6.2  | Documentar permisos escáner | desarrollador/admin | documentar requisitos de permisos en Linux para el escáner (grupo `input`) | facilitar despliegue | • README o docs con pasos para grupo `input` y troubleshooting. | 1 | **Hecho** |
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
| 5. Backup | 2 | 5 |
| 6. Robustez y operación | 4 | 12 |
| 7. Arquitectura de datos y rendimiento | 4 | 13 |
| **Total** | **20** | **82** |

---

## Notas para refinamiento

- **Épica 1** cerrada (1.1, 1.2, 1.3 hechas). Caja y métricas ya leen del mismo almacén que vehículos.
- Almacenamiento backend: **SQLite** en `app_data_dir/coco_parking.db`; esquema y migraciones en `db.rs` (véase DATABASE_SCHEMA.md).
- **Consultoría datos (CONSULTORIA_DATOS.md):** Valorar migración única de datos legacy (vehículos completados sin fila en `transactions`) para deprecar el fallback de Caja y dejar `transactions` como única fuente.
- **Épica 7 (ARQUITECTURA_DATOS_PERFORMANCE.md):** Prioridad a criterio de SM/PO. Si se prioriza, puede planificarse después de cerrar flujo core (Épicas 1–2) o en paralelo según capacidad.
- **Historia 3.2 (Exportar reportes):** No se requieren tablas dinámicas. Las tablas existentes (`vehicles`, `transactions`, `shift_closures`) se cruzan en backend con JOINs para reportes combinados (ej. transacciones + placa/tipo vehículo). Tipos de reporte predefinidos; el usuario elige headers por tipo, filtros y ve vista previa antes de exportar CSV/PDF.

---

**Para el profesional Scrum / SM (1 feb 2025 — Historia 4.2):** La historia **4.2 (UI según permisos)** está **Hecho**. **Actualizar tablero**: mover 4.2 a Hecho. Criterios de aceptación verificados: (1) **Rutas o acciones restringidas según permisos devueltos por backend**: hook `useMyPermissions()` obtiene permisos vía `roles_get_my_permissions`; en AppLayout los enlaces del nav se filtran por permiso requerido (vehiculos:entries:read, caja:treasury:read, metricas:dashboard:read, roles:users:read, backup:list:read, dev:console:access); si el usuario accede a una ruta sin permiso se redirige a la primera ruta permitida. (2) **Botones/links deshabilitados u ocultos cuando no hay permiso**: Caja — botón "Cierre de Turno" solo si `caja:shift:close`; Roles — "Nuevo usuario" si `roles:users:create`, editar/cambiar contraseña si `roles:users:modify`, eliminar si `roles:users:delete`, editar permisos por rol deshabilitado si no `roles:permissions:read`+`modify`; Vehículos — escáner deshabilitado si no hay create ni checkout, formulario entrada solo si `vehiculos:entries:create`, panel checkout solo si `caja:transactions:create`; Métricas — sección exportar reportes solo si `metricas:reports:export`; Dev console — enlace y página según `dev:console:access`.

**Para el profesional Scrum / SM (1 feb 2025 — Historia 4.1):** La historia **4.1 (Usuarios y roles persistentes)** está **Hecho**. **Actualizar tablero**: mover 4.1 a Hecho. Criterios de aceptación verificados: (1) **CRUD de usuarios y asignación de roles persistidos en backend**: migración 5 en `db.rs` crea tablas `users`, `roles`, `role_permissions`; comandos `roles_list_users`, `roles_create_user`, `roles_update_user`, `roles_set_password`, `roles_delete_user`; `roles_list_roles` lee desde BD; `roles_get_role_permissions` y `roles_update_role_permissions` para asignar permisos por rol. (2) **Login/identificación usa esos usuarios**: `auth_login(username, password)` verifica contraseña (argon2), carga permisos del rol del usuario en estado y devuelve el usuario; `auth_logout` y `auth_get_session`; en Tauri la app exige login (AuthGate redirige a /login si no hay sesión). (3) **Dashboard de gestión amigable**: pantalla Roles con listado de usuarios (tabla), botón Nuevo usuario (diálogo crear con username, contraseña, nombre para mostrar, rol), editar usuario (displayName, rol), cambiar contraseña, eliminar usuario; sección Roles con botones por rol para "Editar permisos" (diálogo con checkboxes por permiso). Usuario por defecto: admin / admin (cambiar en primer uso).

**Para el profesional Scrum / SM:** La historia **2.1 (Tesorería real)** está **Hecho**. Actualizar tablero (mover 2.1 a Hecho), sprint planning si aplica. Criterios de aceptación verificados: (1) Pantalla Caja muestra **total esperado** e **ingresado** (esperado vs ingresado) a partir de transacciones persistidas del día. (2) Datos provienen del backend: la pantalla consume `caja_get_treasury`; se muestra nota “Datos según transacciones del día desde el backend”, estado de carga y error, y botón Actualizar. Desglose por método de pago con porcentajes reales. La historia 1.3 sigue Hecho según la nota anterior.

**Para el profesional Scrum / SM (1 feb 2025 — Historia 2.2):** La historia **2.2 (Cierre de turno)** está **Hecho**. **Actualizar tablero**: mover 2.2 a Hecho. Criterios de aceptación verificados: (1) **Comando/flujo de cierre de turno persiste resumen**: tabla `shift_closures` (migración 4 en `db.rs`); comando `caja_close_shift(arqueo_cash?, notes?)` calcula total esperado desde transacciones del día, persiste resumen (expected_total, cash/card/transfer, arqueo opcional, discrepancy, total_transactions, notes). (2) **Historial de cierres**: comando `caja_list_shift_closures(limit?)` devuelve cierres ordenados por fecha; en pantalla Caja, sección "Historial de cierres" con tabla (fecha, total esperado, arqueo, discrepancia, transacciones). Flujo: botón "Cierre de Turno" abre diálogo con resumen del día, campo opcional arqueo (efectivo contado), notas; al confirmar se persiste el cierre y se actualiza el historial.

**Para el profesional Scrum / SM (1 feb 2025 — Historia 2.3):** La historia **2.3 (Método de pago por transacción)** está **Hecho**. **Actualizar tablero**: mover 2.3 a Hecho. Criterios de aceptación verificados: (1) **Cada transacción de salida permite elegir método de pago**: en CheckoutPanel el cajero elige efectivo, tarjeta o transferencia antes de cobrar; el valor se envía con `processExit(ticketCode, partialPayment?, paymentMethod)` al backend. (2) **Se persiste**: `vehiculos_process_exit` recibe `payment_method`, normaliza a cash/card/transfer (default cash) e inserta en tabla `transactions` (campo `method`). (3) **Se refleja en tesorería y reportes**: `caja_get_treasury` devuelve `payment_breakdown` (cash, card, transfer) desde transacciones del día; pantalla Caja muestra "Desglose por método de pago" con importes y porcentajes; cierres de turno (`shift_closures`) incluyen totales por método (cash_total, card_total, transfer_total).

**Para el profesional Scrum / SM (1 feb 2025 — Historia 3.1):** La historia **3.1 (Métricas desde datos persistentes)** está **Hecho**. **Actualizar tablero**: mover 3.1 a Hecho. Criterios de aceptación verificados: (1) **`metricas_get_daily` calcula desde el almacén persistente**: el comando usa SQLite (AppState.db); ingresos y número de transacciones del día provienen de la tabla `transactions` (misma fuente que Caja); conteo de vehículos activos desde `vehicles`; tiempo medio de estadía desde `vehicles` unidos a `transactions` del día. (2) **Pantalla Métricas muestra datos coherentes con vehículos y caja**: revenue y transacciones coinciden con la tesorería; la pantalla muestra estado de carga, error y nota "Datos desde el almacén persistente (coherentes con vehículos y caja)" y botón Actualizar.

**Para el profesional Scrum / SM (1 feb 2025 — Historia 5.2):** La historia **5.2 (Sincronización Drive)** fue **eliminada** del producto; no hay integración con Google Drive; solo backup local (5.1).

**Para el profesional Scrum / SM (1 feb 2025 — Historia 5.1):** La historia **5.1 (Backup real)** está **Hecho**. **Actualizar tablero**: mover 5.1 a Hecho. Criterios de aceptación verificados: (1) **Backup exporta datos del almacén a archivo en ruta elegida**: comando `backup_create(path)` recibe la ruta elegida por el usuario (frontend abre diálogo guardar con `@tauri-apps/plugin-dialog` save), usa SQLite backup API (rusqlite feature backup) para copiar la BD a esa ruta y devuelve path y size_bytes; permisos `backup:create` (admin). (2) **Restore importa desde archivo y deja datos consistentes**: comando `backup_restore(path)` recibe la ruta del archivo (frontend abre diálogo abrir, confirmación con AlertDialog), adjunta el archivo como BD, borra tablas en main en orden y copia datos desde la BD adjunta; permisos `backup:restore` (admin). Pantalla Backup: Export y Restore según permisos; i18n es/en.

**Para el profesional Scrum / SM (1 feb 2025 — Historia 6.1):** La historia **6.1 (Errores y reintentos Tauri)** está **Hecho**. **Actualizar tablero**: mover 6.1 a Hecho. Criterios de aceptación verificados: (1) **Errores de invoke mostrados al usuario de forma clara**: todas las llamadas a backend usan `invokeTauri` desde `@/lib/tauriInvoke`; los errores se normalizan con `parseTauriError` y se muestran en toasts (título "Error" o equivalente, descripción con el mensaje claro). (2) **Reintentos configurables donde aplique**: `invokeTauri(cmd, args, options)` acepta `maxRetries`, `retryDelayMs` y `retryCondition`; las queries usan retry por defecto en React Query (2 reintentos, backoff exponencial); operaciones como backup restore usan reintentos explícitos (ej. `maxRetries: 2`). Configuración central en `TAURI_INVOKE_RETRY_DEFAULTS` y en `QueryClient.defaultOptions.queries`.

**Para el profesional Scrum / SM (1 feb 2025 — Historia 6.2):** La historia **6.2 (Documentar permisos escáner)** está **Hecho**. **Actualizar tablero**: mover 6.2 a Hecho. Criterios de aceptación verificados: (1) **README o docs con pasos para grupo `input` y troubleshooting**: en **app/README.md** se añadió la sección "Barcode scanner (Linux)" con pasos para añadir el usuario al grupo `input` (`sudo usermod -aG input "$USER"`), verificación (`groups`), cierre de sesión/entrada, tabla de troubleshooting (escáner no dispara, permission denied, foco en la página Vehículos, múltiples dispositivos) y nota sobre **instalador y despliegue offline** (la app se ejecutará solo offline; el instalador futuro puede añadir al usuario a `input` o documentar el paso en la pantalla de finalización). En **app/src-tauri/README.md** se amplió la sección "Barcode scanner" con los mismos pasos para Linux y troubleshooting, y referencia al README de la app para despliegue e instalador.

**Para el profesional Scrum / SM (1 feb 2025 — Historia 3.2):** La historia **3.2 (Exportar reportes)** está **Hecho**. **Actualizar tablero**: mover 3.2 a Hecho. Criterios de aceptación verificados: (1) **Exportación CSV/PDF con rango de fechas**: en Métricas, sección "Exportar reportes" con filtros fecha desde/hasta; vista previa con mismos headers y filtros; exportar CSV (descarga desde vista previa) y PDF (impresión desde vista previa). (2) **Contenido alineado con datos persistidos**: backend `reportes_fetch` y `reportes_write_csv` leen de SQLite (tablas `transactions`, `vehicles`, `shift_closures`) con JOINs. (3) **Headers configurables**: `reportes_get_column_definitions(report_type)` devuelve columnas por tipo; el usuario selecciona columnas con checkboxes; vista previa y export usan las mismas. (4) **Filtros**: fechas obligatorios; método de pago (transacciones, transacciones+vehículo); tipo de vehículo (vehículos completados, transacciones+vehículo). (5) **Tipos predefinidos**: transactions, completed_vehicles, shift_closures, transactions_with_vehicle; JOIN en backend para el último tipo.
