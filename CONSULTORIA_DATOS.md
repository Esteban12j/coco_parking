# Consultoría: Datos, base de datos y acceso a Caja/Métricas

**Fecha:** 1 de febrero de 2025  
**Rol:** Consultor (administración, desarrollo, bases de datos, finanzas)  
**Objetivo:** Mejorar conexiones a BD, tablas, sincronización y uso de la información desde el backend; prioridad: vista de métricas/caja y fallbacks.

---

## 1. Resumen ejecutivo

Se ha revisado el proyecto COCO Parking en lo referente a:

- Esquema y conexión a la base de datos (SQLite vía r2d2).
- Tablas `vehicles` y `transactions` y su uso en Caja y Métricas.
- Fallback actual en Caja cuando no hay filas en `transactions`.
- Doble fuente de datos en la vista Caja (query propia + store).

**Conclusión:** La arquitectura de persistencia es correcta y la escritura en `transactions` al procesar salida está implementada. Los problemas detectados son: (1) **fallback de Caja** que mezcla dos fuentes (transactions vs vehicles) y puede confundir en reportes y método de pago; (2) **doble consulta** en la pantalla Caja (store + useQuery local) con fallback entre ellas, lo que no es una sola fuente de verdad en frontend.

Se proponen mejoras concretas y una historia para el backlog (ver §5 y §6).

---

## 2. Estado actual: base de datos y tablas

### 2.1 Conexión y pool

- **Archivo:** `app/src-tauri/src/db.rs`
- **Motor:** SQLite, pool r2d2 (`r2d2_sqlite::SqliteConnectionManager`).
- **Migraciones:** `schema_version`; versión 1 crea `vehicles` y `transactions`.
- **Evaluación:** Adecuado para una app de escritorio; una sola instancia de la app, sin necesidad de múltiples escritores concurrentes. El pool evita abrir/cerrar conexiones por comando.

### 2.2 Tablas

| Tabla           | Uso principal                                                                 |
|-----------------|-------------------------------------------------------------------------------|
| `vehicles`      | Entradas/salidas: id, ticket_code, plate, vehicle_type, entry_time, exit_time, status, total_amount, debt, special_rate. |
| `transactions`  | Pagos por salida: id, vehicle_id (FK), amount, method, created_at.           |

- **Sincronización conceptual:** Cada salida cobrada debería generar **una fila en `vehicles` actualizada** (exit_time, status, total_amount, debt) **y una fila en `transactions`** (amount, method, created_at). En el código actual, `vehiculos_process_exit` hace ambos (UPDATE vehicles + INSERT transactions), por lo que en flujo normal las tablas están alineadas.

### 2.3 Posibles mejoras de esquema (futuro)

- Índice compuesto para consultas por día: `(status, exit_time)` en `vehicles` y `(created_at)` ya existe en `transactions`.
- Si más adelante se requiere auditoría por transacción, considerar `created_by` o tabla de auditoría; no es bloqueante para la prioridad actual.

---

## 3. Caja: fallback y doble fuente

### 3.1 Comportamiento actual (backend)

- **Origen principal:** `caja_get_treasury` lee de la tabla **`transactions`** filtrando por `created_at` del día (UTC).
- **Fallback (caja.rs, líneas 124–142):** Si **no hay filas en `transactions`** para hoy, se calcula desde **`vehicles`**: vehículos `status = 'completed'`, `exit_time` de hoy, `total_amount` no nulo. Ese total se devuelve todo como “cash” (no hay método de pago por vehículo).

Casos donde aparece el fallback:

- Datos antiguos creados antes de existir `transactions`.
- Algún bug que complete vehículos sin insertar en `transactions` (hoy no hay otro camino que `vehiculos_process_exit`, que sí escribe).
- Primer día de uso con datos migrados solo en `vehicles`.

Problemas del fallback actual:

1. **Finanzas:** El desglose por método (cash/card/transfer) no es fiable cuando se usa vehicles; todo se muestra como efectivo.
2. **Una sola fuente de verdad:** Caja puede mostrar datos de dos tablas distintas según el día y el volumen de transacciones, lo que dificulta conciliación y reportes.
3. **UX:** No se indica en la interfaz si los datos vienen de transacciones reales o del agregado de vehículos.

### 3.2 Comportamiento actual (frontend)

- **CajaPage** hace su **propio** `useQuery` a `caja_get_treasury` y, si la respuesta es `null` o falla, usa **`storeTreasury`** (del `useParkingStore`).
- El **store** también tiene `treasuryQuery` y expone `treasury` (treasuryData ?? ZERO_TREASURY).

Efecto: hay **dos fuentes** de datos de tesorería en la pantalla Caja (query local + store), con fallback de una a la otra. No hay una única fuente de verdad en frontend y puede dar lugar a estados inconsistentes o confusos (loading de una y datos de la otra).

---

## 4. Métricas

- **Backend:** `metricas_get_daily` lee **solo** de `vehicles` (activos, completados hoy, ingresos, tiempos). No hay fallback a otra tabla; es una sola fuente.
- **Frontend:** La vista Métricas usa solo `useParkingStore().metrics`; si el backend falla, el store usa `ZERO_METRICS`. No hay doble query.

Si “no se logra acceder a la información” en métricas, las causas probables son:

- Error de permisos (`METRICAS_DASHBOARD_READ`).
- Error de conexión a la BD (pool, archivo bloqueado, etc.).
- En ese caso el frontend muestra ceros sin distinguir “sin datos” de “error”. Conviene mejorar el manejo de error (mensaje o estado de error) en lugar de depender del fallback a ceros.

---

## 5. Recomendaciones (prioridad 1: Caja y acceso a datos)

### 5.1 Backend – Caja

1. **Mantener una sola fuente oficial para tesorería:** La fuente canónica debe ser **`transactions`**. Cuando no haya filas en `transactions` para el día, devolver totales en cero y, opcionalmente, un indicador de que no hay transacciones (véase 5.1.2).
2. **Indicador de origen (recomendado):** Añadir al DTO de tesorería un campo `dataSource: "transactions" | "vehicles_legacy"`. Cuando se use el fallback desde `vehicles`, devolver `dataSource: "vehicles_legacy"` para que la UI pueda mostrar un aviso tipo “Datos estimados desde vehículos (sin método de pago)”. A medio plazo, planear migración de datos legacy (vehicles sin transaction) y luego deprecar el fallback.
3. **Consistencia:** No añadir otros caminos que marquen vehículos como completados sin insertar la fila correspondiente en `transactions`.

### 5.2 Frontend – Caja y Métricas

1. **Una sola fuente en Caja:** La pantalla Caja debe usar **solo** los datos del store (`useParkingStore().treasury`, `isLoading`, error). Eliminar el `useQuery` duplicado en CajaPage que hace fallback a `storeTreasury`; así se evita doble fuente y estados raros.
2. **Métricas:** Mantener una sola fuente (store). Si el backend falla, mostrar estado de error o mensaje claro en lugar de solo ceros, para no confundir “sin actividad” con “error de acceso”.
3. **Invalidación:** Tras operaciones que cambien tesorería (por ejemplo, procesar salida), el store ya invalida/refetch con `invalidateParking`; asegurar que la pantalla Caja dependa de ese flujo y no de una refetch local redundante (o un único botón “Actualizar” que invalide el store).

---

## 6. Para el profesional Scrum / Product Owner

- **Backlog:** Incluir una historia de **mejora de datos y Caja** (prioridad alta), por ejemplo:
  - **Título:** “Caja y métricas: una sola fuente de datos y robustez de acceso”.
  - **Criterios:** (1) Caja en frontend usa solo datos del store (sin query duplicada ni fallback entre query y store). (2) Tesorería en backend indica origen de datos (`transactions` vs `vehicles_legacy`) cuando se use fallback. (3) Pantalla Caja muestra aviso cuando los datos vengan de `vehicles_legacy`. (4) Métricas: en caso de error al obtener datos del backend, mostrar mensaje de error en lugar de solo ceros.
- **Refinamiento:** Valorar migración única de datos legacy (vehículos completados sin fila en `transactions`) para poder deprecar el fallback de Caja y dejar `transactions` como única fuente.

---

## 7. Resumen de cambios propuestos en código

| Área        | Cambio                                                                 |
|------------|-------------------------------------------------------------------------|
| Backend    | Añadir `dataSource` a `TreasuryData` cuando se use fallback desde vehicles. |
| Frontend   | CajaPage: quitar useQuery propio; usar solo store (treasury, loading, error). |
| Frontend   | Opcional: en Métricas/Caja, mostrar mensaje de error cuando falle la carga en lugar de solo ceros. |
| Documentación | PRODUCT_BACKLOG y Sprint/Análisis actualizados con esta consultoría y la nueva historia. |

Con esto se mejora la claridad de la fuente de datos, la trazabilidad financiera y la experiencia en Caja y Métricas, manteniendo compatibilidad con datos existentes mediante el indicador de origen y la futura migración.
