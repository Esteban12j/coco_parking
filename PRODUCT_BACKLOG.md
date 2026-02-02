# Product Backlog — COCO Parking

**Última actualización:** 1 de febrero de 2025  
**Fuente:** Análisis Scrum, Consultoría Datos, Análisis Deuda, feedback de producto (métricas, UI, seguridad, historial, tema, instalador, tarifas default/personalizada). Refinamiento 10.2: layout + UX reportes (filtros y tabla). Refinamiento 10.3: heatmap día de semana vs tipo de vehículo (tipos dinámicos desde BD), legibilidad, filtro fechas + periodo (mañana/medio día/tarde/noche/sin filtro), widget en fila completa.  
**Prioridad:** 1 = más alta.

---

## Objetivo v1 (prioridad máxima)

**El backlog v1 culmina en generar el instalador para Windows y validar que la instalación funciona correctamente.** El programa se instalará en **Windows**. Todas las épicas e historias nuevas están priorizadas para alcanzar este objetivo.

---

## Resumen de avance (Épicas 1–8)

**Hecho:** Historias 1.1–1.3, 2.1–2.3, 3.1–3.2, 4.1–4.2, 5.1, 6.0–6.3, 7.1–7.4, 8.1–8.3, **9.1**, **10.1**, **10.2**, **10.3**, **10.4**. **Eliminada:** 5.2 (Sincronización Drive).  
**Siguiente en desarrollo:** 10.5 (filtros y tabla en reportes).  
Backend: SQLite, dominios vehiculos/caja/metricas/roles/auth/backup/reportes, permisos, scanner. Frontend: rutas vehicles, till, debtors, metrics, roles, backup, dev-console; permisos en nav y acciones; i18n es/en.

---

## Priorización v1 (Épicas 9–16)

| Prioridad | Épica | Objetivo | Responsable típico |
|-----------|--------|----------|--------------------|
| **P0** | 15. Instalador Windows | Build e instalador para Windows; verificación de instalación | DevOps / Tech Lead |
| **P1** | **16. Tarifas (default + personalizada)** | Por defecto tarifa del sistema; opción tarifa personalizada (buscar o crear); sin editar tarifas base ni fijar por vehículo | Tech Lead / Frontend |
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

**Objetivo:** Horas pico con datos reales, layout correcto en Métricas, mapa de calor con datos reales (por tiempo, no por spots), rango de fechas para métricas, y mejor UX en vista Exportar reportes (filtros + tabla). Prioridad P1 para v1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 10.1 | Horas pico con datos reales | admin | ver horas pico calculadas desde transacciones/entradas reales | tomar decisiones con datos fiables | • Backend: comando o extensión de métricas que devuelva ocupación o número de transacciones por franja horaria (ej. por hora del día) para la fecha o rango indicado.<br>• Frontend: reemplazar datos fijos en el bloque "Horas pico" por datos del backend; mismo formato (franja, porcentaje o cantidad). | 5 | **Hecho** |
| 10.2 | Layout Métricas clave y Exportar reportes | admin | que al abrir la previsualización de reportes no se expanda el bloque de Métricas clave dejando espacio en blanco | no perder contexto visual | • "Métricas clave" y "Exportar reportes" no comparten celda de grid que crece con la previsualización.<br>• **Exportar reportes en su propia fila** (ancho completo); al expandir la previsualización solo ese bloque crece; Métricas clave (y Revenue breakdown) mantienen altura estable. | 2 | **Hecho** |
| 10.3 | Mapa de calor día de semana vs tipo de vehículo | admin | ver un mapa de calor legible (días de la semana vs tipo de vehículo) con datos reales, rango de fechas y filtro por periodo del día (mañana, medio día, tarde, noche o sin filtro) | entender patrones de uso por día y tipo de vehículo, y por franja horaria | • **Backend:** comando con date_from, date_to y filtro opcional de periodo (morning, midday, afternoon, night o sin filtro). Devuelve datos por (día de la semana, tipo de vehículo, count). **Tipos de vehículo:** valores únicos existentes en la tabla (no lista fija).<br>• **Frontend:** widget en **fila completa** (como Exportar reportes): buen gráfico, layout claro, gama de color con leyenda que explique qué significa cada tono (bajo/medio/alto), distribución del espacio que facilite la lectura; selector de rango de fechas; **botón/filtro adicional** para periodo del día (mañana, medio día, tarde, noche, sin filtro) para estudiar el mapa por franjas horarias.<br>• **Legibilidad:** información suficiente para que el usuario entienda el mapa (etiquetas, tooltips con valor, leyenda).<br>• Nota: mapa por "estacionamientos" (spots físicos) queda fuera de v1; no existe entidad spot. | 5 | **Hecho** |
| 10.4 | Rango de fechas para métricas | admin | filtrar métricas y gráficos (horas pico, mapa de calor) por rango de fechas (día, mes, año) | analizar periodos concretos | • **Pantalla Métricas:** un único filtro de rango (Desde / Hasta) visible en cabecera; valor por defecto = hoy.<br>• Ese rango se aplica a las **tres tarjetas de horas pico** (arrivals, occupancy, exits) y al **mapa de calor**; el heatmap deja de tener selector de fechas propio y usa el rango global.<br>• **Métricas clave** (grid de 4 tarjetas + Key metrics + Revenue breakdown) se mantienen siempre en "hoy"; sin filtro de rango.<br>• Backend: sin cambios; `metricas_get_peak_hours`, `metricas_get_arrivals_by_hour`, `metricas_get_occupancy_by_hour` y `metricas_get_heatmap_day_vehicle` ya aceptan date_from/date_to. `metricas_get_daily` no se extiende. | 3 | **Hecho** |
| 10.5 | Filtros y tabla en Exportar reportes | admin | tener filtros claros y una tabla de previsualización usable (altura acotada, paginación, ordenación) sin cambiar de pantalla | mejor usabilidad al generar reportes | • Filtros (tipo reporte, fechas, método de pago, tipo vehículo, columnas) en barra o agrupación clara; no amontonados en un grid pequeño.<br>• Tabla de previsualización con altura acotada (max-h + scroll interno), paginación en cliente y ordenación por columnas; opcional: búsqueda en cliente sobre datos cargados.<br>• Sin cambios en backend; mismo contrato reportes_fetch. | 3 | Por hacer | **ya no es necesario** |

**Nota para Scrum Master:** Historias **10.1**, **10.2**, **10.3** y **10.4** están **Hecho**. **10.4** entregado: pantalla Métricas con filtro único Desde/Hasta en cabecera (valor por defecto = hoy); rango aplicado a las tres tarjetas de horas pico (arrivals, occupancy, exits) y al mapa de calor; heatmap sin selector de fechas propio, solo filtro de periodo del día; métricas clave (4 tarjetas + Key metrics + Revenue breakdown) siempre "hoy". Backend sin cambios. **Orden de desarrollo Épica 10:** 10.5 (filtros + tabla reportes).

---

## Épica 11: Tema, tipografía y accesibilidad visual

**Objetivo:** Reducir fatiga visual: fondos no sólidos blancos, modo "suave" (no oscuro), tipografía legible y ajustable. Prioridad P1 para v1.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 11.1 | Fondo y tarjetas no blanco sólido | usuario | que el fondo y las tarjetas no sean blanco puro para no cansar la vista | confort visual | • Sustituir blanco sólido (card, background) por tonos claros no sólidos (ej. gray-50, bone, variaciones suaves).<br>• Mantener contraste accesible y tonos claros. | 2 | **Hecho** |

**Design discussion (11.1) — Scrum Master facilitation**

- **Current palette (from `app/src/index.css`):** Base is already “Eye-Friendly” with `--background: 210 20% 98%` (soft bone ~#F8F9FA). **Card, popover and sidebar are still pure white** (`0 0% 100%`). Secondary/muted use blue-grays (`214 32% 91%`, `210 20% 96%`). Primary is COCO yellow; foreground is blue-black for contrast.
- **PM:** Goal is less eye strain without changing brand or layout. Prefer a single, consistent light theme; no extra theme variants for this story.
- **Product Designer / UI-UX:** Keep one hue family (current blue-gray) so the UI stays coherent. Use soft, non-pure-white for both page and surfaces: background slightly warmer/softer than now, cards/sidebar/popover as “elevated” soft tones (e.g. 99% or 98% lightness, same hue as background) so hierarchy is clear and contrast stays accessible.
- **Frontend:** Change only CSS variables in `:root`. All screens already use `bg-background`, `bg-card`, `border-border`; no component changes needed. Dark theme variables unchanged.
- **Agreed:** (1) Leave `--background` as is (already soft bone). (2) Replace pure white for **card**, **popover**, **sidebar-background** with the same hue (210°), lightness 98–99%, so they are soft but still “lighter” than the page. (3) Keep **muted** and **sidebar-accent** aligned to this scale. (4) No new tokens; preserve contrast ratios for text. Implementation: update `app/src/index.css` only.
- **Scrum Master — update:** Story **11.1** is implemented. `app/src/index.css` uses soft non–pure white: `--background` 98%, `--card` / `--popover` / `--sidebar-background` 99% (hue 210°). Acceptance criteria met; please move to Done and run acceptance if needed.
| 11.2 | Modo suave (no oscuro) | usuario | un tema intermedio con tonos más suaves para los ojos, no dark completo | reducir impacto visual | • Añadir tema "suave" (ej. grises claros, tonos neutros) como opción; no sustituir dark actual si existe, sino ofrecer tercera opción o sustituir dark por este modo suave según decisión de producto. | 3 | Hecho |
- **Scrum Master — update:** Story **11.2** is implemented. Theme "Soft" added as third option (Light / Soft / Dark). `next-themes` ThemeProvider with `themes={["light", "dark", "soft"]}`; CSS variables for `.soft` in `app/src/index.css` (same hue family and brand palette: primary, success, destructive, info, warning unchanged; backgrounds/surfaces use lighter neutral grays). Theme selector in sidebar (AppLayout) with i18n (`theme.light`, `theme.soft`, `theme.dark`). Preference persisted in `localStorage` key `coco-parking-theme`. Please move to Done and run acceptance if needed.
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

## Épica 16: Tarifas — por defecto y personalizada

**Objetivo:** El cliente no puede modificar las tarifas base ni asignar una tarifa fija a un vehículo en particular. Por defecto se usa siempre la tarifa por defecto del sistema. Opción de usar una tarifa personalizada: buscador (placa + costo) o crear una en el momento. Prioridad P1 para v1.

**Nota para Scrum Master (16.1):** Historia 16.1 cerrada. Implementación: tarifas por defecto centralizadas en `app/src/lib/defaultRates.ts`; entrada y cierre de sesión usan exclusivamente la tarifa por defecto por tipo de vehículo. Backend ignora `special_rate` en el cálculo de salida. No existe flujo ni permiso para editar tarifas base; no hay asignación tarifa fija por vehículo. Actualizar tablero y resumen por épica.

**Nota para Scrum Master (16.2):** Historia 16.2 cerrada. En el flujo de cierre de sesión (CheckoutPanel): opción "Usar tarifa personalizada" junto a "Tarifa por defecto". Al elegir tarifa personalizada se abre el selector (CustomTariffSelector) que lista tarifas desde la tabla `custom_tariffs` (placa/ref + monto), con búsqueda por placa o descripción, y opción "Crear tarifa personalizada aquí" con formulario mínimo (placa/ref, descripción opcional, monto) para crear y aplicar en el acto. Backend: migración 10 añade tabla `custom_tariffs`; comandos `custom_tariffs_list` y `custom_tariffs_create`; `vehiculos_process_exit` acepta `custom_parking_cost` opcional para aplicar monto acordado puntual. Las tarifas personalizadas no sustituyen la tarifa por defecto. Actualizar tablero y resumen por épica.

| ID | Historia | Como… | Quiero… | Para… | Criterios de aceptación | Pts | Estado |
|----|----------|--------|---------|--------|--------------------------|-----|--------|
| 16.1 | Tarifa por defecto obligatoria | operador/sistema | que por defecto se use siempre la tarifa por defecto del sistema y que el cliente no pueda modificar tarifas base ni dejar fija una tarifa a un vehículo | evitar configuración errónea y mantener coherencia | • No existe flujo ni permiso para que el cliente edite las tarifas base del sistema.<br>• No existe asignación "tarifa fija por vehículo/placa"; cada cálculo usa por defecto la tarifa por defecto.<br>• En registro de entrada o cálculo de costo: valor por defecto = tarifa por defecto del sistema. | 3 | **Hecho** |
| 16.2 | Opción tarifa personalizada (buscar o crear) | operador | poder elegir "usar tarifa personalizada" y abrir un buscador que muestre brevemente placa y costo, o crear una tarifa personalizada ahí mismo | aplicar un precio acordado puntual sin tocar tarifas base | • En el flujo donde se aplica tarifa (ej. entrada o cierre de sesión): opción "Usar tarifa personalizada" además del valor por defecto.<br>• Al elegir tarifa personalizada: se abre buscador/selector que lista tarifas personalizadas existentes mostrando de forma breve placa (o identificador) y costo; búsqueda por placa o filtro para encontrar la esperada.<br>• Opción "Crear tarifa personalizada aquí": formulario mínimo (ej. placa/ref + monto o descripción breve + costo) para crear y aplicar en el acto, sin acceder a configuración global de tarifas.<br>• Las tarifas personalizadas son de uso puntual o asociadas a sesión/vehículo en curso; no sustituyen la tarifa por defecto del sistema. | 5 | **Hecho** |

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
| **10. Métricas UI y datos reales** | 5 | 18 | Por hacer |
| **11. Tema y tipografía** | 3 | 8 | Por hacer |
| **12. Responsive** | 1 | 3 | Por hacer |
| **13. Historial y búsqueda** | 3 | 11 | Por hacer |
| 14. Herramientas avanzadas | 1 | 8 | Backlog v1.1 |
| **15. Instalador Windows** | 2 | 7 | Por hacer |
| **16. Tarifas (default + personalizada)** | 2 | 8 | Hecho |
| **Total (v1 activo)** | **36** | **~156** | — |

---

## Diálogo de producto (resumen de acuerdos)

**Nota para Scrum Master (actualización 9.1):** Historia 9.1 (Bloqueo inyección SQL/HTML/XSS) completada. Backend: postura documentada en `app/SECURITY.md` y `app/README.md` (solo consultas parametrizadas). Frontend: utilidad `escapeForAttribute` en `app/src/lib/escape.ts` para atributos; React escapa texto en nodos; no se usa `dangerouslySetInnerHTML` con input de usuario (chart.tsx solo inyecta CSS interno). CSP opcional aplicada en `app/src-tauri/tauri.conf.json` (`app.security.csp`). Actualizar estado en backlog y en refinamiento.

**Scrum Master:** Priorización añadida: tarifas. El cliente no puede modificar tarifas base ni fijar una tarifa a un vehículo; por defecto siempre tarifa del sistema. Opción "tarifa personalizada": buscador (placa + costo) o crear en el momento. Épica 16 priorizada P1. Resumimos el feedback: seguridad (SQL/HTML/XSS), métricas (horas pico reales, layout, mapa de calor, rango fechas), tema (no blanco sólido, modo suave, tipografía), responsive, historial por placa, búsqueda progresiva, acceso rápido "Vehículos de hoy", y que v1 culmine en instalador Windows.

**PM:** Priorizamos v1 = instalador Windows listo para probar instalación. Incluimos en v1: seguridad, métricas con datos reales y layout, tema/tipografía, responsive, historial por placa y acceso rápido. Gráficos personalizados / Excel / tablas dinámicas los dejamos para v1.1.

**Arquitecto:** SQL ya está parametrizado; documentamos postura y aseguramos validación/sanitización en frontend para XSS. Sin cambios de esquema para v1.

**Tech Lead:** Horas pico y mapa de calor requieren backend por tiempo (franjas horarias/día); mapa por "estacionamientos" no está en modelo, lo dejamos para después. Layout de Métricas: Exportar reportes en fila propia para que no arrastre a Métricas clave.

**Ciberseguridad:** Validar y escapar inputs que se renderizan; no usar HTML crudo de usuario. Documentar en README o doc de seguridad.

**UI/UX:** Fondo y cards en tonos claros no sólidos; tema "suave"; tipografía base legible y control de zoom o tamaño. Responsive en ventana para distintos tamaños.

**QA:** Checklist de instalación en Windows como criterio de cierre v1. Incluir smoke: login, entrada, salida, caja, permisos.

**DevOps:** Build Tauri para Windows reproducible; documentar pasos y requisitos. Objetivo: instalador listo para probar en Windows.

**Scrum Master:** Quedan épicas 9–16 en backlog; P0 = Épica 15 (Instalador Windows); P1 = 16 (Tarifas), 9, 10, 11, 12, 13; P2 = 14 (v1.1). Orden sugerido para sprints: 16.1–16.2 (tarifas) junto con 9, 10.2, 11, 12, 13 y 15.1 donde se pueda; luego 10.1, 10.3, 10.4 y 15.2.

**Scrum Master (refinamiento 10.2 / UX reportes):** Acordado con Product Designer, UI/UX, Frontend y PM: (1) **Layout:** Exportar reportes en fila propia (ancho completo); Métricas clave y Revenue breakdown mantienen altura estable. (2) **Filtros y tabla en la página actual:** Filtros en barra/agrupación clara; tabla de previsualización con altura acotada, paginación en cliente y ordenación por columnas (sin cambios en backend). Historia 10.5 añadida para (2). **Orden de desarrollo Épica 10:** 10.2 (layout) → **10.3 (mapa de calor, en desarrollo)** → 10.5 (filtros + tabla) → 10.4 (rango fechas). **Refinamiento 10.3:** Heatmap día de semana vs tipo de vehículo; tipos de vehículo = valores únicos en BD; widget en fila completa, legible (leyenda, gama de color, tooltips); filtro fechas + filtro periodo (mañana, medio día, tarde, noche, sin filtro).

**Scrum Master (refinamiento 10.4 — rango de fechas para métricas):** Reunión con PM, Product Designer, UI/UX, Frontend y Backend para consensuar experiencia y usabilidad.

- **PM:** El usuario admin debe poder analizar periodos concretos (día, mes, año). La historia pide filtro desde/hasta aplicado a horas pico, mapa de calor y opcionalmente a métricas clave; aceptamos mantener KPIs en "hoy" por defecto si simplifica y evita confusión operativa.
- **Product Designer:** Una sola fuente de verdad para el rango: un filtro global en la pantalla Métricas evita que el usuario tenga que elegir fechas en varios sitios. El heatmap ya tiene su propio selector (10.3); unificar bajo un único control mejora coherencia.
- **UI/UX:** Filtro de rango visible arriba (junto al título o bajo la cabecera), con "Desde" y "Hasta" en formato fecha; valor por defecto = hoy (un solo día). Presets opcionales (Hoy, Esta semana, Este mes) reducen fricción; si no entran en v1, dejamos solo desde/hasta. Las tarjetas de horas pico y el heatmap deben reflejar el mismo rango; las métricas clave (KPIs) pueden quedar siempre en "hoy" para no mezclar semántica (ocupación actual vs. análisis histórico).
- **Frontend:** Hoy las tres queries de horas pico (arrivals, occupancy, exits) usan `today` fijo; el heatmap ya tiene estado local `dateFrom`/`dateTo`. Propuesta: estado de rango (dateFrom, dateTo) en la página Métricas (o en un contexto pequeño), por defecto hoy; pasar ese rango a las tres queries de horas pico y al heatmap (eliminando el selector duplicado del heatmap). `useParkingStore` sigue llamando `metricas_get_daily()` sin fechas para KPIs; no tocamos el store para no afectar otras pantallas.
- **Backend:** `metricas_get_peak_hours`, `metricas_get_arrivals_by_hour` y `metricas_get_occupancy_by_hour` ya aceptan `date_from`/`date_to` opcionales. `metricas_get_heatmap_day_vehicle` también. No hay cambios de API para horas pico ni heatmap. Para métricas clave (10.4 dice "si se desea"): `metricas_get_daily` actualmente no recibe fecha; si en el futuro se quiere KPIs por rango, se puede añadir `date` opcional (un solo día) para no complicar con agregaciones multi-día en v1. Consenso: no extender `metricas_get_daily` en 10.4; KPIs = "hoy" siempre.
- **Consenso:** (1) **Un único filtro de rango** en la pantalla Métricas (Desde / Hasta), por defecto hoy. (2) Ese rango se aplica a **horas pico** (tres tarjetas) y al **mapa de calor**; el heatmap deja de tener selector de fechas propio y usa el rango global. (3) **Métricas clave** (grid de 4 tarjetas + Key metrics + Revenue breakdown) se mantienen con **"hoy"** siempre (sin filtro de rango); backend sin cambios para `metricas_get_daily`. (4) Backend ya listo para date_from/date_to en horas pico y heatmap; solo frontend: estado de rango + una barra de filtro + propagar rango a queries y al heatmap. Puntos 3 se mantienen.

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

- **Tarifas:** Cliente no edita tarifas base; no hay "tarifa fija por vehículo". Default = tarifa del sistema. Tarifa personalizada = opción en el flujo (buscar por placa/costo o crear ahí).
- **Windows:** Entorno objetivo de instalación para v1.
- **Mapa de calor por "estacionamientos":** No existe entidad spot ni asignación vehículo→spot; queda fuera de v1. **Mapa de calor v1 (10.3):** días de la semana vs tipo de vehículo (tipos = valores únicos en tabla); rango de fechas; filtro por periodo (mañana, medio día, tarde, noche, sin filtro); widget en fila completa, legible (leyenda, gama de color, tooltips).
- **Herramientas avanzadas (gráficos propios, Excel, tablas dinámicas):** Backlog v1.1; no bloqueante para v1.
- **Épica 10 — orden de desarrollo:** 10.2 (hecho) → **10.3 (en desarrollo)** → 10.5 (filtros y tabla en Exportar reportes) → 10.4 (rango fechas para métricas).
