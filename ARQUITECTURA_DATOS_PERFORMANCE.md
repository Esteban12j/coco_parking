# Análisis: Arquitectura de Datos y Rendimiento — COCO Parking

**Fecha:** 1 de febrero de 2025  
**Rol de referencia:** Arquitecto de Datos / Performance / Alta disponibilidad y escalabilidad  
**Objetivo:** Evaluar esquema de datos, data-flow Frontend–Backend, caché y consultas para garantizar aplicación escalable, eficiente en recursos y preparada para crecimiento masivo de registros.

---

## 1. Resumen ejecutivo

Se ha analizado el proyecto COCO Parking desde la perspectiva de **modelado de datos**, **flujo de datos entre Frontend y Backend**, **estrategia de caché** y **auditoría de consultas**. La base actual (SQLite + Tauri + React) es adecuada para una app de escritorio con una sola instancia; sin embargo, hay **oportunidades claras de optimización** que conviene abordar antes de que el volumen de datos crezca.

| Área | Estado actual | Riesgo / Oportunidad |
|------|----------------|----------------------|
| **Modelado y escalabilidad** | Esquema correcto; índices básicos | Sin paginación ni proyecciones; listado completo en memoria |
| **Data-flow** | Una sola fuente (backend); TanStack Query | Invalidación global; 3 queries en paralelo siempre; JSON completo por entidad |
| **Caché** | Solo caché cliente (TanStack Query) | Sin caché en backend; refetch total tras cada mutación |
| **Queries** | Consultas correctas funcionalmente | Varias round-trips por pantalla; consultas no consolidadas; UPPER(plate) impide uso de índice |

**Recomendación:** Incluir en el backlog una **Épica de Arquitectura de Datos y Rendimiento** (o historias concretas) para que el **profesional Scrum** pueda priorizarla. Puede ser prioridad alta si se espera alto volumen de vehículos o múltiples puestos de caja en el futuro.

---

## 2. Modelado de datos y escalabilidad

### 2.1 Esquema actual

- **Motor:** SQLite, pool r2d2 (`db.rs`).
- **Tablas:** `vehicles`, `transactions`, `schema_version`.
- **Índices:** `idx_vehicles_ticket`, `idx_vehicles_plate`, `idx_vehicles_status`, `idx_vehicles_entry_time`; `idx_transactions_vehicle`, `idx_transactions_created`.

Evaluación: El diseño normalizado y los índices por columna son correctos para el uso actual.

### 2.2 Cuellos de botella identificados

| Punto | Descripción | Impacto con crecimiento |
|-------|-------------|--------------------------|
| **Listado sin paginación** | `vehiculos_list_vehicles` hace `SELECT * FROM vehicles ORDER BY entry_time DESC` sin `LIMIT`/`OFFSET`. | Con decenas de miles de filas: alto consumo de RAM y latencia en serialización JSON. |
| **Sin proyecciones** | El frontend siempre recibe el objeto `Vehicle` completo (todos los campos). | Desperdicio de ancho de banda y CPU en listados donde bastaría id, ticketCode, plate, entryTime, status. |
| **Búsqueda por placa con UPPER()** | `vehiculos_get_plate_debt` y `vehiculos_find_by_plate` usan `WHERE UPPER(plate) = UPPER(?1)`. | El índice `idx_vehicles_plate` no se utiliza; full scan en tabla vehicles. |
| **Caja: 4 consultas separadas** | `caja_get_treasury` ejecuta COUNT + SUM(cash) + SUM(card) + SUM(transfer) en 4 round-trips. | Más latencia y carga en BD de lo necesario. |
| **Métricas: varias consultas** | `metricas_get_daily` hace varias `query_row` a `vehicles` (activos, completados hoy, ingresos, tiempos). | Se puede reducir a 1–2 consultas con agregaciones. |

### 2.3 Índices estratégicos sugeridos

| Índice | Tabla | Justificación |
|--------|--------|----------------|
| Compuesto `(status, exit_time)` | vehicles | Consultas “completados hoy” (métricas, reportes) y filtros por estado + fecha. |
| Opcional: columna normalizada `plate_upper` | vehicles | Permitir búsqueda por placa sin UPPER() en WHERE y usar índice. Alternativa: índice funcional si el motor lo soporta. |
| `created_at` ya indexado | transactions | Consultas por día con `created_at LIKE 'YYYY-MM-DD%'` pueden usar el índice en muchos casos. |

### 2.4 Estructuras para crecimiento masivo

- **Paginación:** Añadir parámetros `limit` y `offset` (o cursor por `entry_time`) a `vehiculos_list_vehicles` y, en frontend, listado paginado o virtualizado.
- **Proyecciones:** Definir DTOs reducidos para listado (ej. `VehicleSummary`: id, ticketCode, plate, entryTime, status) y opcionalmente endpoint/comando que devuelva solo esos campos.
- **Partición por tiempo (futuro):** Si se llega a millones de registros, valorar tablas o particiones por año/mes para consultas históricas (fuera del alcance actual de la app de escritorio).

---

## 3. Optimización del flujo data-flow (Frontend–Backend)

### 3.1 Comportamiento actual

- **Fuente de verdad:** Backend (SQLite); frontend consume vía `invoke` y TanStack Query.
- **Queries centrales:** `vehiculos_list_vehicles`, `metricas_get_daily`, `caja_get_treasury` se disparan desde `useParkingStore` con `queryKey: ['parking']`.
- **Invalidación:** Cualquier mutación (entrada/salida) llama a `invalidateParking()` → invalida y refetch de **todas** las queries bajo `['parking']` (vehicles, metrics, treasury).

Efectos:

- **Latencia:** Tras cada entrada o salida se recargan listado completo, métricas y tesorería aunque la pantalla solo necesite uno de ellos.
- **JSON:** Se serializa/deserializa el array completo de `Vehicle` y los objetos de métricas/tesorería; no hay “pedir solo lo necesario”.
- **Paginación:** No existe; el listado es “todo o nada”.

### 3.2 Mejoras recomendadas

| Mejora | Descripción |
|--------|-------------|
| **Paginación avanzada** | Backend: `vehiculos_list_vehicles(limit, offset)` o cursor; frontend: tabla/grid paginada o virtualizada (ej. solo activos en vista principal). |
| **Proyecciones** | Comando o parámetro para listado “resumido” (solo campos necesarios para la grilla). |
| **Invalidación selectiva** | Tras `register_entry`: invalidar solo `['parking','vehicles']` (y opcionalmente métricas). Tras `process_exit`: invalidar vehicles, treasury y opcionalmente métricas; no refetch todo siempre. |
| **Agregaciones en backend** | Caja y métricas: consolidar en menos consultas y devolver un solo DTO; reducir round-trips y tamaño de respuestas. |

---

## 4. Estrategia de almacenamiento en caché

### 4.1 Estado actual

- **Backend:** Sin capa de caché (Redis ni caché en memoria). Cada comando lee directamente de SQLite.
- **Frontend:** TanStack Query con caché en memoria; `staleTime` por defecto 0 implica que los datos se consideran obsoletos de inmediato (refetch en remount o invalidation).

### 4.2 Datos de alta frecuencia de lectura

| Dato | Lectura alta | Volatilidad | Recomendación |
|------|----------------|------------|----------------|
| Listado de vehículos activos | Sí | Alta (cada entrada/salida) | Caché corta en cliente; invalidación selectiva. En backend, sin caché por ahora. |
| Métricas del día | Sí | Media | Posible caché en backend de 1–2 min para mismo día; o solo optimizar consulta. |
| Tesorería del día | Sí | Media | Similar a métricas; una sola query consolidada reduce carga sin necesidad de Redis en desktop. |

### 4.3 Caché recomendada (según contexto)

- **App de escritorio (actual):** No es prioritario introducir Redis. Priorizar: **consultas más eficientes** y **invalidación selectiva** en frontend para reducir carga en SQLite y latencia percibida.
- **Si en el futuro hay varios puestos o servicio central:** Valorar caché en memoria (ej. métricas/tesorería del día con TTL 1–2 min) o Redis para datos compartidos y de solo lectura frecuente. Decidir qué es volátil (listado activos) y qué puede ser persistido/cacheado (agregados del día).

---

## 5. Auditoría de rendimiento (queries)

### 5.1 Consultas más costosas o mejorables

| Origen | Query / Comportamiento | Optimización sugerida |
|--------|------------------------|------------------------|
| `vehiculos_list_vehicles` | SELECT completo, ORDER BY entry_time DESC, sin LIMIT | Añadir LIMIT/OFFSET o cursor; opcionalmente SELECT solo columnas necesarias. |
| `vehiculos_get_plate_debt` | `WHERE UPPER(plate)=UPPER(?1)` | Normalizar placa a mayúsculas al escribir; buscar por `plate = ?` usando valor ya en mayúsculas; o columna `plate_upper` indexada. |
| `vehiculos_find_by_plate` | Igual que arriba + `status='active'` | Misma normalización; índice (plate, status) o (status, plate) según filtros. |
| `caja_get_treasury` | 4 queries: COUNT, SUM(cash), SUM(card), SUM(transfer) con mismo filtro `created_at LIKE ?` | Una sola query con `SUM(CASE WHEN LOWER(method)='cash' THEN amount ELSE 0 END)` etc. y COUNT(*). |
| `metricas_get_daily` | Varias query_row: activos, completados hoy + revenue, suma tiempos | Una o dos consultas con agregaciones (COUNT, SUM, AVG) y filtros por status y exit_time LIKE. |

### 5.2 Planes de ejecución

- En SQLite se puede usar `EXPLAIN QUERY PLAN` para cada SELECT y comprobar uso de índices.
- Especial atención: consultas con `UPPER(plate)` y con `LIKE 'YYYY-MM-DD%'` (prefix suele usar índice).

### 5.3 Consumo de CPU y RAM

- **Serialización JSON:** Listados muy grandes aumentan uso de CPU (Rust serde) y memoria. Paginación y proyecciones reducen ambos.
- **Pool r2d2:** Configuración por defecto suele ser suficiente para una instancia; vigilar si en el futuro hubiera picos de concurrencia.

---

## 6. Resumen de acciones sugeridas

| Prioridad | Acción | Responsable típico |
|-----------|--------|--------------------|
| Alta | Paginación (o límite) en `vehiculos_list_vehicles` y uso en frontend | Backend + Frontend |
| Alta | Consolidar `caja_get_treasury` en una sola query agregada | Backend |
| Media | Reducir round-trips en `metricas_get_daily` (1–2 consultas) | Backend |
| Media | Invalidación selectiva de queries en frontend (no refetch todo) | Frontend |
| Media | Proyecciones / DTO resumido para listado de vehículos | Backend + Frontend |
| Baja | Normalizar búsqueda por placa (columna o valor en mayúsculas) para usar índice | Backend |
| Baja | Índice compuesto (status, exit_time) en vehicles | Backend (migración) |

---

## 7. Para el profesional Scrum / Product Owner

- Este análisis corresponde al **perfil de Arquitectura de Datos y Rendimiento** (alta disponibilidad, escalabilidad, eficiencia de recursos).
- Las mejoras pueden materializarse como **una nueva épica** (“Arquitectura de datos y rendimiento”) o como **historias repartidas** en épicas existentes (p. ej. “Listado paginado de vehículos”, “Optimización de consultas de Caja y Métricas”).
- **Priorización:** Puede ser **prioridad alta** si se prevé crecimiento rápido de datos o múltiples puestos; **media** si el volumen se mantiene bajo a corto plazo.
- Se recomienda **refinar con el equipo** qué ítems del resumen de acciones (tabla anterior) se llevan al backlog y en qué sprint, y **actualizar** ANALISIS_SCRUM.md, PRODUCT_BACKLOG.md y SPRINT_PLANNING.md en consecuencia.

---

*Documento generado a partir del análisis del repositorio COCO Parking. Complementa CONSULTORIA_DATOS.md y DATABASE_SCHEMA.md.*
