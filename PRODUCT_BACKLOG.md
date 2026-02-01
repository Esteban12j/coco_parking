# Product Backlog — COCO Parking

**Última actualización:** 1 de febrero de 2025  
**Fuente:** Análisis Scrum, Consultoría Datos, Análisis Deuda, feedback de producto (métricas, UI, seguridad, historial, tema, instalador).  
**Prioridad:** 1 = más alta.

---

## Objetivo v1 (prioridad máxima)

**El backlog v1 culmina en generar el instalador para Windows y validar que la instalación funciona correctamente.** El programa se instalará en **Windows**. Todas las épicas e historias nuevas están priorizadas para alcanzar este objetivo.

---

## Resumen de avance (Épicas 1–8)

**Hecho:** Historias 1.1–1.3, 2.1–2.3, 3.1–3.2, 4.1–4.2, 5.1, 6.0–6.3, 7.1–7.4, 8.1–8.3, **9.1**. **Eliminada:** 5.2 (Sincronización Drive).  
Backend: SQLite, dominios vehiculos/caja/metricas/roles/auth/backup/reportes, permisos, scanner. Frontend: rutas vehicles, till, debtors, metrics, roles, backup, dev-console; permisos en nav y acciones; i18n es/en.

---

## Priorización v1 (Épicas 9–15)

| Prioridad | Épica | Objetivo | Responsable típico |
|-----------|--------|----------|--------------------|
| **P0** | 15. Instalador Windows | Build e instalador para Windows; verificación de instalación | DevOps / Tech Lead |
| **P1** | 9. Seguridad | Bloqueo inyección SQL/HTML/XSS; validación y documentación | Arquitecto / Ciberseguridad |
| **P1** | 10. Métricas UI y datos reales | Horas pico reales, layout Métricas, mapa de calor por tiempo, rango fechas | Tech Lead / Frontend |
| **P1** | 11. Tema y tipografía | Fondo no blanco sólido, modo suave, tipografía legible/ajustable | UI/UX |
| **P1** | 12. Responsive | Adaptación a distintos tamaños de ventana en escritorio | Frontend |
| **P1** | 13. Historial y búsqueda | Historial por placa, búsqueda progresiva, acceso rápido "Vehículos de hoy" | Tech Lead / Frontend |
| **P2** | 14. Herramientas avanzadas | Export datos crudos / Excel / gráficos personalizados (backlog v1.1) | PM / Backlog |

---

## Épica 9: Seguridad (inyección y validación)

**Objetivo:** Bloqueo frente a inyección SQL, HTML/XSS y postura documentada. Prioridad P1 para v1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 9.1 | Bloqueo inyección SQL/HTML/XSS | sistema / admin | que las entradas de usuario no permitan inyección SQL ni HTML/XSS | evitar explotación y datos corruptos | • Backend: todas las consultas SQL usan parámetros (ya aplicado); documentar postura en README o doc de seguridad.<br>• Frontend: sanitizar o escapar cualquier texto que el usuario introduce y se renderiza (placas, observaciones, notas); no usar dangerouslySetInnerHTML con input de usuario.<br>• Opcional: cabeceras CSP en webview Tauri si aplica. | 3 | **Hecho** |

---

## Épica 10: Métricas — UI y datos reales

**Objetivo:** Horas pico con datos reales, layout correcto en Métricas, mapa de calor con datos reales (por tiempo, no por spots), y rango de fechas para métricas. Prioridad P1 para v1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 10.1 | Horas pico con datos reales | admin | ver horas pico calculadas desde transacciones/entradas reales | tomar decisiones con datos fiables | • Backend: comando o extensión de métricas que devuelva ocupación o número de transacciones por franja horaria (ej. por hora del día) para la fecha o rango indicado.<br>• Frontend: reemplazar datos fijos en el bloque "Horas pico" por datos del backend; mismo formato (franja, porcentaje o cantidad). | 5 | Por hacer |
| 10.2 | Layout Métricas clave y Exportar reportes | admin | que al abrir la previsualización de reportes no se expanda el bloque de Métricas clave dejando espacio en blanco | no perder contexto visual | • "Métricas clave" y "Exportar reportes" no comparten la misma celda de grid que crece con la previsualización.<br>• Exportar reportes en su propia fila o columna; al expandir la previsualización solo ese bloque crece; Métricas clave mantiene altura estable. | 2 | Por hacer |
| 10.3 | Mapa de calor por ocupación en el tiempo | admin | ver un mapa de calor con datos reales (ocupación por hora/día) y poder elegir rango de fechas | entender patrones de uso | • Backend: comando que devuelva datos para mapa de calor por tiempo (ej. ocupación o transacciones por hora del día, o por día del mes), con rango de fechas (date_from, date_to).<br>• Frontend: reemplazar el grid actual (datos aleatorios) por visualización con datos reales; selector de rango de fechas; leyenda comprensible (bajo/medio/alto).<br>• Nota: mapa de calor por "estacionamientos" (spots físicos) queda fuera de v1; no existe entidad spot ni asignación de vehículo a spot. | 5 | Por hacer |
| 10.4 | Rango de fechas para métricas | admin | filtrar métricas y gráficos (horas pico, mapa de calor) por rango de fechas (día, mes, año) | analizar periodos concretos | • Pantalla Métricas: filtro de rango de fechas (desde/hasta) aplicado a horas pico, mapa de calor y, si se desea, a métricas clave (o mantener "hoy" por defecto para KPIs).<br>• Backend: métricas diarias extendidas o nuevo comando que acepte date_from/date_to donde corresponda. | 3 | Por hacer |

---

## Épica 11: Tema, tipografía y accesibilidad visual

**Objetivo:** Reducir fatiga visual: fondos no sólidos blancos, modo "suave" (no oscuro), tipografía legible y ajustable. Prioridad P1 para v1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 11.1 | Fondo y tarjetas no blanco sólido | usuario | que el fondo y las tarjetas no sean blanco puro para no cansar la vista | confort visual | • Sustituir blanco sólido (card, background) por tonos claros no sólidos (ej. gray-50, bone, variaciones suaves).<br>• Mantener contraste accesible y tonos claros. | 2 | Por hacer |
| 11.2 | Modo suave (no oscuro) | usuario | un tema intermedio con tonos más suaves para los ojos, no dark completo | reducir impacto visual | • Añadir tema "suave" (ej. grises claros, tonos neutros) como opción; no sustituir dark actual si existe, sino ofrecer tercera opción o sustituir dark por este modo suave según decisión de producto. | 3 | Por hacer |
| 11.3 | Tipografía legible y ajustable | usuario | que la tipografía sea legible y, si es posible, ajustable (tamaño o zoom) | accesibilidad | • Tamaño de fuente base suficiente para lectura cómoda.<br>• Opción de ajuste: control de zoom global (ej. 90 %, 100 %, 110 %) o selector de tamaño de fuente (pequeño/medio/grande) persistido en preferencias. | 3 | Por hacer |

---

## Épica 12: Responsive en escritorio

**Objetivo:** Que la aplicación de escritorio se adapte correctamente a distintos tamaños de ventana. Prioridad P1 para v1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 12.1 | Layout responsive a tamaño de ventana | usuario | que al redimensionar la ventana el contenido se adapte sin overflow horizontal ni bloques rotos | usabilidad en distintos monitores | • Grids y contenedores usan breakpoints o unidades flexibles (%, min/max, clamp) para adaptarse al ancho de ventana.<br>• Tablas con scroll horizontal si es necesario; navegación y acciones accesibles en ventanas pequeñas.<br>• Revisión en ventana pequeña, estándar y grande. | 3 | Por hacer |

---

## Épica 13: Historial y búsqueda por placa

**Objetivo:** Buscar historial de un coche por placa, búsqueda progresiva y acceso rápido a "Vehículos de hoy". Prioridad P1 para v1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 13.1 | Historial por placa | operador/admin | buscar el historial de un coche por su placa (activos + completados) | consultar sesiones y pagos de esa placa | • Pantalla o sección "Historial por placa" (o integrada en Vehículos): campo placa y tabla con todos los vehículos de esa placa (vehiculos_get_vehicles_by_plate).<br>• Columnas: ticket, placa, tipo, entrada, salida, estado, monto/deuda según corresponda; opcional enlace a detalle deuda si aplica. | 5 | Por hacer |
| 13.2 | Búsqueda progresiva por placa | operador | que al escribir más caracteres de la placa se reduzcan las coincidencias mostradas | encontrar más rápido el vehículo o historial | • En la búsqueda por placa (y donde se liste por placa): consulta al backend con debounce (ej. ≥2 caracteres); resultados que coincidan con el texto introducido; listado que se actualiza al seguir escribiendo. | 3 | Por hacer |
| 13.3 | Acceso rápido "Vehículos de hoy" | operador | ver desde un solo lugar los vehículos del día (activos y ya pagados) sin ir a Métricas y aplicar filtros | menos clics para una consulta frecuente | • Enlace o sección "Vehículos de hoy" (en nav o en Vehículos) que muestre listado de vehículos con entrada o salida hoy (activos + completados hoy); filtro de fecha "hoy" aplicado por defecto; sin pasar por Métricas ni varios clics. | 3 | Por hacer |

---

## Épica 14: Herramientas avanzadas (backlog v1.1)

**Objetivo:** Valorar herramientas para que el cliente calcule otras métricas: gráficos propios, tablas dinámicas, exportar datos para Excel. **No forma parte del alcance v1**; prioridad P2 / v1.1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 14.1 | Exportar datos crudos o Excel / gráficos personalizados | admin | exportar datos en bruto o crear mis propios gráficos/tablas dinámicas (o llevarlos a Excel) | análisis flexible | • Opción de exportar datos crudos (CSV/Excel) de tablas relacionales con filtros básicos.<br>• Opcional: herramienta interna para gráficos con tablas dinámicas o unión de datos; si no, al menos export suficiente para hacerlo en Excel.<br>• **Alcance:** backlog v1.1; no bloqueante para instalador v1. | 8 | Backlog |

---

## Épica 15: Instalador Windows (objetivo v1)

**Objetivo:** Generar instalador para Windows y validar que la instalación funciona. **Prioridad P0**; el backlog v1 culmina aquí.

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
| **9. Seguridad** | 1 | 3 | Hecho |
| **10. Métricas UI y datos reales** | 4 | 15 | Por hacer |
| **11. Tema y tipografía** | 3 | 8 | Por hacer |
| **12. Responsive** | 1 | 3 | Por hacer |
| **13. Historial y búsqueda** | 3 | 11 | Por hacer |
| 14. Herramientas avanzadas | 1 | 8 | Backlog v1.1 |
| **15. Instalador Windows** | 2 | 7 | Por hacer |
| **Total (v1 activo)** | **33** | **~145** | — |

---

## Diálogo de producto (resumen de acuerdos)

**Nota para Scrum Master (actualización 9.1):** Historia 9.1 (Bloqueo inyección SQL/HTML/XSS) completada. Backend: postura documentada en `app/SECURITY.md` y `app/README.md` (solo consultas parametrizadas). Frontend: utilidad `escapeForAttribute` en `app/src/lib/escape.ts` para atributos; React escapa texto en nodos; no se usa `dangerouslySetInnerHTML` con input de usuario (chart.tsx solo inyecta CSS interno). CSP opcional aplicada en `app/src-tauri/tauri.conf.json` (`app.security.csp`). Actualizar estado en backlog y en refinamiento.

**Scrum Master:** Resumimos el feedback: seguridad (SQL/HTML/XSS), métricas (horas pico reales, layout, mapa de calor, rango fechas), tema (no blanco sólido, modo suave, tipografía), responsive, historial por placa, búsqueda progresiva, acceso rápido "Vehículos de hoy", y que v1 culmine en instalador Windows.

**PM:** Priorizamos v1 = instalador Windows listo para probar instalación. Incluimos en v1: seguridad, métricas con datos reales y layout, tema/tipografía, responsive, historial por placa y acceso rápido. Gráficos personalizados / Excel / tablas dinámicas los dejamos para v1.1.

**Arquitecto:** SQL ya está parametrizado; documentamos postura y aseguramos validación/sanitización en frontend para XSS. Sin cambios de esquema para v1.

**Tech Lead:** Horas pico y mapa de calor requieren backend por tiempo (franjas horarias/día); mapa por "estacionamientos" no está en modelo, lo dejamos para después. Layout de Métricas: Exportar reportes en fila propia para que no arrastre a Métricas clave.

**Ciberseguridad:** Validar y escapar inputs que se renderizan; no usar HTML crudo de usuario. Documentar en README o doc de seguridad.

**UI/UX:** Fondo y cards en tonos claros no sólidos; tema "suave"; tipografía base legible y control de zoom o tamaño. Responsive en ventana para distintos tamaños.

**QA:** Checklist de instalación en Windows como criterio de cierre v1. Incluir smoke: login, entrada, salida, caja, permisos.

**DevOps:** Build Tauri para Windows reproducible; documentar pasos y requisitos. Objetivo: instalador listo para probar en Windows.

**Scrum Master:** Quedan épicas 9–15 en backlog; P0 = Épica 15 (Instalador Windows); P1 = 9, 10, 11, 12, 13; P2 = 14 (v1.1). Orden sugerido para sprints: primero 9, 10.2, 11, 12, 13 y 15.1 en paralelo donde se pueda; luego 10.1, 10.3, 10.4 y 15.2.

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

- **Windows:** Entorno objetivo de instalación para v1.
- **Mapa de calor por "estacionamientos":** No existe entidad spot ni asignación vehículo→spot; queda fuera de v1; mapa de calor v1 = por ocupación en el tiempo (hora/día) con rango de fechas.
- **Herramientas avanzadas (gráficos propios, Excel, tablas dinámicas):** Backlog v1.1; no bloqueante para v1.
