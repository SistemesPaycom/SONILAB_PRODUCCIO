# Reporte — Modificación del preset "Per defecte" por Administradores desde la UI

**Fecha:** 2026-04-08
**Estado:** Informe de investigación y análisis completado, listo para la ejecución de Claude.

---

## 1. Explicación y directrices para Claude (Alto nivel, sin código)

Claude, el objetivo principal de esta tarea es permitir que el preset de estilos tipográficos "Per defecte" (que actualmente es un valor fijo de fábrica) pase a ser **editable de manera global desde la propia UI**, siempre y cuando el usuario **sea Administrador**.

Actualmente, cualquier usuario que entra a la sección "Estils" y selecciona el preset "Per defecte", se encuentra con un panel que le informa que es un preset del sistema y los botones de guardado están deshabilitados. Para que los usuarios adapten su diseño deben crear un nuevo estilo y aplicarle sus configuraciones que se guardan en sus cuentas locales. 

El nuevo requerimiento implica que:
1. **Los Administradores** ya no tendrán el botón "Guardar" bloqueado para este estilo base. Podrán alterar las fuentes, colores y tamaños, y al darle a "Guardar", la plataforma no lo grabará solo en sus preferencias de usuario, sino que sobrescribirá un **esquema global** a nivel de la base de datos de manera central.
2. Cada vez que **cualquier usuario** (nuevo, o que no haya modificado sus estilos, o que acabe de usar la funcionalidad de "Factory Reset") cargue la aplicación, absorberá este nuevo esquema global como si fuesen los colores "De fábrica" de toda la vida.
3. Se eliminará o sobrepondrá el concepto de "Dato duro" fijo para dar paso a un "Global dinámico y central" que gobierne la app a su libre discrecionalidad visual y corporativa. 

Es mandato que sigas manteniendo la protección para el resto de mortales (sólo un admin lo edita) e impidas que nadie pueda "eliminar" el sistema base (incluso el admin sólo puede "Guardarlo" alterado). 

---

## 2. Informe Detallado: Análisis de código, conflictos e hitos técnicos

> **⚠️ IMPORTANTE PARA CLAUDE (WORKER AGENCY):** Tienes acceso completo a tus herramientas (*grep_search*, *view_file*, *bash/run_command*). Usa los superpowers `debug` y `code-review` si los requieres.  
> **No te tomes este informe como una verdad absoluta al 100%.** Haz tu propio análisis iterativo a partir de estas pistas, y si encuentras que el estado del código recomienda tomar otra arquitectura (ej. en NestJS para la base de datos de Prisma), sé libre de proponer la decisión óptima ajustada a tus hallazgos.

Durante el análisis previo se han detectado los siguientes focos que requerirán toda tu atención técnica:

### 2.1. El estado del Frontend y Puntos de Impacto
1. **`StylesPresetBar.tsx` y `BuiltinPresetNotice.tsx`**: Estos componentes actualmente detectan si un preset tiene la bandera `builtin: true` (basado en el array `state.presets`). Bloquean el "Guardado" (`isBuiltin`) y alertan mediante el Notice correspondiente. 
   * **Solución propuesta**: Inyectar el rol del usuario (via `AuthContext`) aquí dentro para permitir `handleSave` en caso de que sea administrador, a pesar de que el valor siga siendo "Built-in" o de sistema. Tampoco queremos que se oculte que es de sistema, sólo destrabarle las puertas al rol privilegiado. El botón "Eliminar" continuaremos dejándolo bloqueado por obvias razones funcionales.
2. **`UserStylesContext.tsx` y Modos de Guardado**: Actualmente el contexto dispara la acción de guardar local e informa al backend (`api.updateMe`) incrustando todo a `me.preferences.userStyles`.
   * **Posible conflicto**: Si un admin le da a "Guardar", debes asegurarte de ramificar la lógica. Si fue `id === 'factory'` (o el ID del "Per defecte"), la solicitud de actualización NO DEBE ir sólo a las `preferences` del admin. Debe ir en paralelo a un endpoint global que impacte a toda la app.
3. **`factoryStyles.ts` y el Payload Inicial**: 
   * La construcción `buildInitialPayload({ legacy })` lee las constantes locales (`FACTORY_SUBTITLE_STYLES`, `FACTORY_HOME_STYLES`).
   * **Problema detectado (Flicker/Override)**: Todos los usuarios tienen local cache. Si el admin cambia el global, ¿cómo se enteran los usuarios que no han guardado nada (`remote === null`)?. Se debe crear un endpoint de arranque, o aprovechar la llamada de `/auth/me` para que envíe `preferences.globalStyles` como la "nueva semilla" por encima de los hardcoded en `factoryStyles.ts`.
4. **Factory Reset (`factoryReset.ts`)**: Su trabajo actual es hacer que `preferences.userStyles` vuelva al estado de origen (`null`). Funciona a favor del cambio pero hay que vigilar el orden pre-render y asegurar que el borrado sigue extrayendo la fuente correcta (es decir, el global singleton del backend) tras el reload.

### 2.2. Implementación Backend (Node/NestJS)
En el backend no hemos localizado actualmente en `api.ts` o en las carpetas de `backend_nest_mvp/src/modules/` ningún módulo de "Configuration/Settings" global. La app maneja usuarios, librería y proyectos.

* **El Reto:** Configurar en Prisma u otro almacenamiento cómo se alojarán los Global Styles. Podría ser:
  * a) Añadir una tabla simple de 1 sola fila en Prisma, `GlobalSettings` con campo JSON `userStyles` / `homeStyles`.
  * b) Modificarlos guardándolos en un Storage, Json file, Redis o anclarlos de alguna manera robusta.
* **Solución sugerida:** Prisma `Settings` table parece el estándar dorado (modelo Singleton), de este modo exponiendo por un `GET /settings/global` accesible publicamente y por un `PATCH /settings/user-styles` que exija estar interceptado por la guarda de `@Roles('admin')`.

### 2.3. Resumen y Prevención de Bugs que podrías encontrar al desarrollar:
- **Sobrescritura por cachés antiguos (`version: 1` -> `version: 2`)**: Lee detenidamente `userStylesMigration.ts`. Algunos presets locales se construyen usando colores "fijos" para arreglar el tema del "parpadeo visual" y la adaptación a darkmode (el issue de "*Flicker and Colors*"). Asegúrate de no estropear la migración de las variables de CSS en el entorno cruzado con el backend.
- **Riesgo en el context de React**: Si se pide el "Global" por HTTP en paralelo con `me()`, puede desencadenar de nuevo problemas con `loadOrMigrate` provocando renders parpadeantes de red. Aclimatar correctamente la asincronía es clave. Lo mejor sería que el endpoint `me()` agrupara la bandera global bajo otra llave general o un hook `useGlobalConfig` se resolviese al inicio de `App.tsx`.

## 3. Próximos pasos

Toma posesión del teclado Claude. Planifica tu intervención revisando todos los aspectos del frontend listados para ver la coherencia del flujo de permisos de admin antes de crear esquemas backend perennes. Recuerda revisar bien `@Roles` o los accesos de Prisma. Tus superpoderes de investigación son tu mejor brújula.
