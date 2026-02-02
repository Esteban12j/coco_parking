# Product Backlog — COCO Parking

**Última actualización:** 2 de febrero de 2025  
**Fuente:** Análisis Scrum, Consultoría Datos, feedback de producto; análisis mantenibilidad (tech lead, backend, frontend, DevOps, ciberseguridad, DBA). Refinamiento: v1 = instalador Windows; Épica 15 siguiente; Épica 17 (mantenibilidad queries/API) post-v1.  
**Prioridad:** P0 = más alta; 1 = más alta dentro de P1.

---

## Objetivo v1 (prioridad máxima)

**El backlog v1 culmina en generar el instalador para Windows y validar que la instalación funciona correctamente.** El programa se instalará en **Windows**. Todas las épicas e historias nuevas están priorizadas para alcanzar este objetivo.

---

## Resumen de avance (Épicas 1–8)

**Hecho:** 1.1–1.3, 2.1–2.3, 3.1–3.2, 4.1–4.2, 5.1, 6.0–6.3, 7.1–7.4, 8.1–8.3, 9.1, 10.1–10.4, 11.1–11.2, 13.1–13.3, 16.1–16.2.  
**Eliminadas:** 5.2 (Sincronización Drive), 10.5 (filtros y tabla reportes; ya no necesario para v1).  
**Siguiente:** Épica 15 — Instalador Windows (15.1 build e instalador, 15.2 checklist verificación).  
Backend: SQLite, dominios vehiculos/caja/metricas/roles/auth/backup/reportes; permisos, scanner. Frontend: rutas vehicles, till, debtors, metrics, roles, backup, dev-console; i18n es/en.

---

## Priorización v1 (Épicas 9–16)

| Orden | Prioridad | Épica | Objetivo | Estado |
|-------|-----------|--------|----------|--------|
| **1** | **P0** | **15. Instalador Windows** | Build e instalador Windows; checklist verificación instalación | **Siguiente** |
| 2 | P1 | 16. Tarifas (default + personalizada) | Tarifa por defecto; opción tarifa personalizada (buscar/crear) | Hecho |
| — | P1 | 9. Seguridad | Bloqueo inyección SQL/HTML/XSS; documentación | Hecho |
| — | P1 | 10. Métricas UI y datos reales | Horas pico, layout, mapa de calor, rango fechas | Hecho |
| — | P1 | 11. Tema y tipografía | Fondo no blanco, modo suave; tipografía ajustable | Hecho (11.3 despriorizado) |
| — | P1 | 12. Responsive | Adaptación a tamaño de ventana | Despriorizado |
| — | P1 | 13. Historial y búsqueda | Historial por placa, búsqueda progresiva, Vehículos de hoy | Hecho |
| — | P2 | 14. Herramientas avanzadas | Export Excel / gráficos (v1.1) | Backlog v1.1 |
| — | P1 | **17. Mantenibilidad (queries y API)** | Queries localizables; capa API única; no romper al cambiar | Backlog (post-v1) |

---

## Épica 17: Mantenibilidad — queries, capa API y estructura

**Objetivo:** Que el equipo pueda localizar y cambiar queries sin perderse, y que el frontend tenga una única forma de llamar al backend. Basado en análisis con tech lead, backend, frontend, DevOps, ciberseguridad y DBA. **Prioridad P1**; no bloqueante para v1 (instalador); recomendado después de Épica 15.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 17.1 | Queries localizables y documentadas (backend/DBA) | desarrollador backend / DBA | saber dónde está cada query y qué tabla/comando la usa | cambiar una consulta sin romper otras ni perderla | Backend (Rust): documento o convención que indique por dominio (vehiculos, metricas, caja, reportes, roles, etc.) qué comandos tocan qué tablas; opcional: extraer queries compartidas o complejas a funciones por dominio para no duplicar lógica. Sin cambiar comportamiento; solo organización y documentación. | 5 | **Hecho** |
| 17.2 | Una sola capa de llamadas al backend (frontend) | desarrollador frontend / tech lead | que todas las llamadas a Tauri pasen por un único contrato (api/ o lista de comandos) | no tener que buscar invokeTauri en todo el código para cambiar un contrato | Decisión: o (A) todas las features/hooks usan solo los módulos de `api/` (auth, backup, customTariffs, metricas, reportes, roles) y se añaden api/caja, api/vehiculos, api/dev donde falten; o (B) se documenta que el contrato es "nombre de comando Tauri + args" y se mantiene una lista única de comandos y parámetros (ej. en README o types). Código consistente según la opción elegida. | 5 | Por hacer |
| 17.3 | Índice api/ coherente con archivos existentes | desarrollador frontend | que `api/index.ts` no exporte módulos que no existen | evitar errores de build al importar desde @/api | Eliminar exportaciones de `caja`, `dev`, `vehiculos` en `api/index.ts` si no existen esos archivos; o crear esos módulos y reexportar las llamadas correspondientes. Build sin errores al importar desde api. | 1 | Por hacer |
| 17.4 | Documentación comando → tabla (para DBA/auditoría) | DBA / tech lead | un mapa sencillo de qué comando lee/escribe qué tabla | auditar rendimiento y consistencia sin abrir todos los dominios | Documento (ej. en repo o wiki) o comentarios en código: lista de comandos Tauri y tablas SQL que usan (solo lectura o escritura). Actualizable cuando se añadan comandos o tablas. | 2 | Por hacer |

**Nota para Scrum Master:** 17.1 completada. Documento creado: `app/src-tauri/QUERIES_BY_DOMAIN.md` (comandos Tauri → tablas por dominio; convención y patrones compartidos). Actualizar tablero/sprint.

---

## Épica 9: Seguridad (inyección y validación)

**Objetivo:** Bloqueo frente a inyección SQL, HTML/XSS y postura documentada. Prioridad P1 para v1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 9.1 | Bloqueo inyección SQL/HTML/XSS | sistema / admin | que las entradas de usuario no permitan inyección SQL ni HTML/XSS | evitar explotación y datos corruptos | • Backend: todas las consultas SQL usan parámetros (ya aplicado); documentar postura en README o doc de seguridad.<br>• Frontend: sanitizar o escapar cualquier texto que el usuario introduce y se renderiza (placas, observaciones, notas); no usar dangerouslySetInnerHTML con input de usuario.<br>• Opcional: cabeceras CSP en webview Tauri si aplica. | 3 | **Hecho** |

---

## Épica 10: Métricas — UI y datos reales

**Objetivo:** Horas pico con datos reales, layout Métricas, mapa de calor día/tipo vehículo, rango de fechas. Prioridad P1 para v1. **Estado:** Hecho (10.1–10.4).

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 10.1 | Horas pico con datos reales | admin | ver horas pico calculadas desde transacciones/entradas reales | tomar decisiones con datos fiables | Backend: comando métricas por franja horaria. Frontend: datos del backend en "Horas pico". | 5 | **Hecho** |
| 10.2 | Layout Métricas clave y Exportar reportes | admin | que la previsualización de reportes no expanda Métricas clave | no perder contexto visual | Exportar reportes en su propia fila (ancho completo); Métricas clave altura estable. | 2 | **Hecho** |
| 10.3 | Mapa de calor día de semana vs tipo de vehículo | admin | mapa de calor legible (día vs tipo vehículo), rango fechas, filtro periodo (mañana/medio día/tarde/noche) | patrones de uso por día y tipo | Backend: date_from, date_to, periodo opcional; tipos desde BD. Frontend: widget fila completa, leyenda, tooltips, filtro periodo. | 5 | **Hecho** |
| 10.4 | Rango de fechas para métricas | admin | filtrar métricas y gráficos por rango (desde/hasta) | analizar periodos | Filtro único Desde/Hasta en cabecera; rango aplicado a horas pico y heatmap; métricas clave siempre "hoy". | 3 | **Hecho** |
| 10.5 | Filtros y tabla en Exportar reportes | — | — | — | — | 3 | **Eliminada** (ya no necesario para v1) |

---

## Épica 11: Tema, tipografía y accesibilidad visual

**Objetivo:** Reducir fatiga visual: fondos no sólidos, modo suave, tipografía. Prioridad P1 para v1. **Estado:** Hecho (11.1, 11.2); 11.3 despriorizado.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 11.1 | Fondo y tarjetas no blanco sólido | usuario | fondo y tarjetas no blanco puro | confort visual | Sustituir blanco sólido por tonos claros; contraste accesible. | 2 | **Hecho** |


- **Scrum Master — update:** Story **11.1** is implemented. `app/src/index.css` uses soft non–pure white: `--background` 98%, `--card` / `--popover` / `--sidebar-background` 99% (hue 210°). Acceptance criteria met; please move to Done and run acceptance if needed.
| 11.2 | Modo suave (no oscuro) | usuario | tema intermedio con tonos suaves | reducir impacto visual | Tema "suave" como opción (Light / Soft / Dark). | 3 | **Hecho** |
| 11.3 | Tipografía legible y ajustable | usuario | tipografía legible y ajustable (zoom o tamaño) | accesibilidad | Fuente base cómoda; opción zoom o tamaño persistido. | 3 | Despriorizado |

---

## Épica 12: Responsive en escritorio

**Objetivo:** Adaptación a distintos tamaños de ventana. Prioridad P1 para v1. **Estado:** Despriorizado.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 12.1 | Layout responsive a tamaño de ventana | usuario | que al redimensionar el contenido se adapte sin overflow ni bloques rotos | usabilidad en distintos monitores | Grids flexibles; tablas con scroll si hace falta; revisión en ventana pequeña/estándar/grande. | 3 | Despriorizado |

---

## Épica 13: Historial y búsqueda por placa

**Objetivo:** Historial por placa, búsqueda progresiva, acceso rápido "Vehículos de hoy". Prioridad P1 para v1. **Estado:** Hecho.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 13.1 | Historial por placa | operador/admin | historial de un coche por placa (activos + completados) | consultar sesiones y pagos | Sección Historial por placa; vehiculos_get_vehicles_by_plate; columnas ticket, placa, tipo, entrada, salida, estado, monto/deuda; enlace detalle deuda. | 5 | **Hecho** |
| 13.2 | Búsqueda progresiva por placa | operador | que al escribir más caracteres se reduzcan coincidencias | encontrar más rápido | Consulta con debounce (≥2 caracteres); listado que se actualiza al escribir. | 3 | **Hecho** |
| 13.3 | Acceso rápido "Vehículos de hoy" | operador | ver vehículos del día en un solo lugar | menos clics | Enlace "Vehículos de hoy"; vehiculos_list_vehicles_by_date; filtro hoy por defecto; tabla con paginación. | 3 | **Hecho** |

---

## Épica 14: Herramientas avanzadas (backlog v1.1)

**Objetivo:** Valorar herramientas para que el cliente calcule otras métricas: gráficos propios, tablas dinámicas, exportar datos para Excel. **No forma parte del alcance v1**; prioridad P2 / v1.1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 14.1 | Exportar datos crudos o Excel / gráficos personalizados | admin | exportar datos en bruto o crear mis propios gráficos/tablas dinámicas (o llevarlos a Excel) | análisis flexible | • Opción de exportar datos crudos (CSV/Excel) de tablas relacionales con filtros básicos.<br>• Opcional: herramienta interna para gráficos con tablas dinámicas o unión de datos; si no, al menos export suficiente para hacerlo en Excel.<br>• **Alcance:** backlog v1.1; no bloqueante para instalador v1. | 8 | despriorizado |

---

## Épica 16: Tarifas — por defecto y personalizada

**Objetivo:** Tarifa por defecto obligatoria; opción tarifa personalizada (buscar o crear en el flujo). Prioridad P1 para v1. **Estado:** Hecho.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 16.1 | Tarifa por defecto obligatoria | operador/sistema | que por defecto se use siempre la tarifa por defecto del sistema y que el cliente no pueda modificar tarifas base ni dejar fija una tarifa a un vehículo | evitar configuración errónea y mantener coherencia | • No existe flujo ni permiso para que el cliente edite las tarifas base del sistema.<br>• No existe asignación "tarifa fija por vehículo/placa"; cada cálculo usa por defecto la tarifa por defecto.<br>• En registro de entrada o cálculo de costo: valor por defecto = tarifa por defecto del sistema. | 3 | **Hecho** |
| 16.2 | Opción tarifa personalizada (buscar o crear) | operador | poder elegir "usar tarifa personalizada" y abrir un buscador que muestre brevemente placa y costo, o crear una tarifa personalizada ahí mismo | aplicar un precio acordado puntual sin tocar tarifas base | • En el flujo donde se aplica tarifa (ej. entrada o cierre de sesión): opción "Usar tarifa personalizada" además del valor por defecto.<br>• Al elegir tarifa personalizada: se abre buscador/selector que lista tarifas personalizadas existentes mostrando de forma breve placa (o identificador) y costo; búsqueda por placa o filtro para encontrar la esperada.<br>• Opción "Crear tarifa personalizada aquí": formulario mínimo (ej. placa/ref + monto o descripción breve + costo) para crear y aplicar en el acto, sin acceder a configuración global de tarifas.<br>• Las tarifas personalizadas son de uso puntual o asociadas a sesión/vehículo en curso; no sustituyen la tarifa por defecto del sistema. | 5 | **Hecho** |

---

## Épica 15: Instalador Windows (objetivo v1)

**Objetivo:** Generar instalador para Windows y validar que la instalación funciona. **Prioridad P0**; el backlog v1 culmina aquí. **Siguiente en desarrollo.**

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 15.1 | Build e instalador Windows | DevOps / equipo | que el proyecto genere un instalador para Windows (Tauri) de forma reproducible | entregar al cliente en Windows | • Script o pipeline (CI) que ejecute build Tauri para Windows y genere el artefacto de instalación (ej. .msi o .exe según configuración Tauri).<br>• Documentar requisitos (Node, Rust, versiones) y pasos para generar el instalador.<br>• **Entorno objetivo:** Windows. | 5 | Por hacer |
| 15.2 | Verificación de instalación en Windows | QA / equipo | tener un checklist para probar que la instalación en Windows funciona correctamente | asegurar que el usuario final puede instalar y usar la app | • Checklist: instalar desde el instalador, arrancar app, login, flujo básico (entrada, salida, caja), permisos, cierre de turno, backup export/restore (opcional).<br>• Documentar resultado y requisitos de sistema (Windows 10/11, etc.). | 2 | Por hacer |

---

## Resumen por épica (incluye v1)

| Épica | Historias | Puntos | Estado |
|-------|-----------|--------|--------|
| 1. Fuente única de verdad | 3 | 18 | Hecho |
| 2. Caja y cierre de turno | 3 | 13 | Hecho |
| 3. Métricas y reportes | 2 | 8 | Hecho |
| 4. Roles y usuarios | 2 | 13 | Hecho |
| 5. Backup | 2 | 5 | Hecho (5.2 Eliminada) |
| 6. Robustez y operación | 4 | 12 | Hecho |
| 7. Arquitectura de datos y rendimiento | 4 | 13 | Hecho |
| 8. Deudores | 3 | 13 | Hecho |
| 9. Seguridad | 1 | 3 | Hecho |
| 10. Métricas UI y datos reales | 5 | 18 | Hecho (10.5 Eliminada) |
| 11. Tema y tipografía | 3 | 8 | Hecho (11.3 despriorizado) |
| 12. Responsive | 1 | 3 | Despriorizado |
| 13. Historial y búsqueda | 3 | 11 | Hecho |
| 14. Herramientas avanzadas | 1 | 8 | Backlog v1.1 |
| **15. Instalador Windows** | **2** | **7** | **Siguiente (P0)** |
| 16. Tarifas (default + personalizada) | 2 | 8 | Hecho |
| 17. Mantenibilidad (queries y API) | 4 | 13 | Backlog (post-v1) |
| **Total (v1 + 17)** | **39** | **~166** | — |

---

## Diálogo de producto (resumen de acuerdos)

**v1:** Objetivo = instalador Windows listo para probar. Incluido: seguridad (9), métricas (10), tema (11), historial/búsqueda (13), tarifas (16). Responsive (12) y tipografía ajustable (11.3) despriorizados. Herramientas avanzadas (14) en v1.1.

**P0:** Épica 15 — Instalador Windows (15.1 build/instalador, 15.2 checklist verificación). DevOps / Tech Lead.

**QA:** Checklist instalación Windows: instalar, arrancar, login, flujo básico (entrada, salida, caja), permisos, cierre turno, backup opcional.

---

## Épicas 1–8 (referencia breve)

Las épicas 1–8 se mantienen como referencia; todas las historias están **Hecho** salvo 5.2 (Eliminada).

- **Épica 1:** Persistencia backend, listado y búsqueda desde backend, caja/métricas mismo almacén.
- **Épica 2:** Tesorería real, cierre de turno, método de pago por transacción.
- **Épica 3:** Métricas desde persistencia, exportar reportes CSV/PDF con filtros.
- **Épica 4:** Usuarios y roles persistentes, UI según permisos.
- **Épica 5:** Backup real (export/restore); 5.2 Drive eliminada.
- **Épica 6:** Una sola fuente Caja/Métricas, errores/reintentos Tauri, documentación escáner, tests E2E/integración.
- **Épica 7:** Paginación vehículos, optimización queries Caja/Métricas, invalidación selectiva, búsqueda por placa e índices.
- **Épica 8:** Lista deudores y deuda total, detalle por placa, reporte/export deudores.

---

## Notas para refinamiento

- **Siguiente:** Épica 15 — 15.1 (build e instalador Windows), 15.2 (checklist verificación). Entorno objetivo: Windows.
- **Épica 17 (Mantenibilidad):** Queries localizables, capa API única, índice api/ coherente, documento comando→tabla. No bloqueante para v1; priorizar después del instalador (tech lead, backend, frontend, DBA).
- **Tarifas:** Hecho. Cliente no edita tarifas base; tarifa personalizada = opción en flujo (buscar o crear).
- **Herramientas avanzadas (Excel, gráficos):** Backlog v1.1.
