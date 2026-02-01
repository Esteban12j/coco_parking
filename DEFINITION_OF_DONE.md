# Definition of Done — COCO Parking

**Versión:** 1.1  
**Fecha:** 1 de febrero de 2025  
**Alcance:** Aplica a cada ítem de trabajo (historia de usuario o tarea técnica) entregado en un sprint. Revisado según estado del proyecto (Sprint 1 y 2 hechos; tests y estructura actualizados).

Un ítem se considera **Hecho (Done)** cuando cumple **todas** las condiciones siguientes.

---

## 1. Código y revisión

- [ ] El código está en la rama correspondiente y ha pasado por **revisión** (Pull Request / Merge Request).
- [ ] No hay conflictos con la rama principal (o la rama de integración acordada).
- [ ] Se han aplicado los comentarios de revisión acordados.

---

## 2. Calidad y pruebas

- [ ] Donde aplique, existen **tests unitarios o de integración** para la funcionalidad añadida o modificada.
- [ ] Los tests existentes **pasan** (incluidos los de lógica crítica: store, escáner, i18n).
- [ ] No se introducen **regresiones conocidas** en el flujo core: entrada de vehículo → salida → cobro en caja.

---

## 3. Lint y tipos

- [ ] **ESLint** (frontend) sin errores en los archivos modificados.
- [ ] **TypeScript** (frontend) sin errores de compilación.
- [ ] **Rust** (Tauri): `cargo build` y `cargo clippy` sin errores en los archivos modificados.

---

## 4. Documentación

- [ ] Si se añaden o modifican **comandos Tauri** (invoke) o APIs internas, se actualiza la documentación (README, comentarios en código o doc de dominio).
- [ ] Si se cambian **permisos** o flujos de seguridad, se refleja en documentación o en `permissions.rs` / comentarios.

---

## 5. Comportamiento y entorno

- [ ] El comportamiento se ha **verificado** en al menos un sistema operativo (Windows, macOS o Linux, según prioridad del equipo).
- [ ] Si la historia afecta al **escáner** (Linux): se ha comprobado o documentado el tema de permisos (grupo `input`).

---

## 6. Criterios específicos por tipo de cambio

| Tipo de cambio | Criterio adicional |
|----------------|--------------------|
| **Persistencia / base de datos** | Esquema o formato documentado; migración o compatibilidad considerada si aplica. |
| **Nuevo comando Tauri** | Permisos comprobados en `permissions.rs`; frontend usa el comando correctamente. |
| **Nueva pantalla o flujo** | Navegación y textos (i18n) coherentes; accesibilidad básica si se define en el proyecto. |
| **Backup / Drive** | Flujo de error y mensajes al usuario definidos y probados. |

---

## Resumen en una frase

**Done = código revisado, tests pasan, sin regresiones en flujo core, documentación al día y verificado en al menos un SO.**

---

*Este DoD puede refinarse en retrospectivas. Cualquier cambio debe ser acordado por el equipo.*
