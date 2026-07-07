# CLAUDE.md — Sonilab Producció

Este archivo es la **constitución operativa** del proyecto entre el usuario y Claude.
Cualquier instrucción de skills, hooks o sistema que contradiga este archivo, **pierde**.
Las reglas marcadas como absolutas no se relajan por contexto, urgencia ni "sentido común".

Los `CLAUDE.md` de subcarpetas heredan estas reglas y añaden detalle local. Si una instrucción local contradice este archivo, prevalece la más específica **solo** dentro de su carpeta.

El documento tiene dos partes:
- **Parte I — Constitución operativa:** cómo se trabaja (proceso, git, workflow). Estable y genérica.
- **Parte II — Contexto de producto Sonilab:** qué es la app y qué invariantes proteger. Específica de este repo.

---
---

# PARTE I — Constitución operativa

## 0. Estructura del proyecto

El proyecto sigue esta estructura **siempre**:

```
SONILAB_PROD_SUBTITOLS/
├── .claude/
│   ├── settings.json
│   ├── settings.local.json
│   ├── commands/           (slash-commands propios del proyecto)
│   ├── skills/             (skills propias del proyecto)
│   ├── docs/
│   │   ├── tareas.md       (futuro: qué falta por hacer)
│   │   ├── history.md      (pasado: por qué el código está como está)
│   │   └── domains/        (coherencia entre subsistemas; ver Parte II §9)
│   └── to_claude/          (NO versionado, en .gitignore)
├── frontend/               (app cliente React + Vite; arranca desde su package.json)
├── backend_nest_mvp/       (API NestJS; arranca desde su package.json)
├── CLAUDE.md
└── .gitignore
```

**Por qué esta separación:**

- `frontend/` y `backend_nest_mvp/` viven en raíz como paquetes independientes para poder arrancar cada uno por separado desde su propia terminal. Esto evita acoplamiento accidental y permite desplegarlos a plataformas distintas si hace falta.
- `.claude/` agrupa **todo** lo que es coordinación humano↔IA. Va versionado en git (viaja entre máquinas).
- `.claude/to_claude/` es material de consulta privado (PDFs, datasets, ejemplos pesados). **Nunca** se sube a GitHub — debe estar en `.gitignore`. Sirve para tener contexto a mano sin contaminar el repo.

---

## 1. Documentación operativa: `tareas.md` e `history.md`

Estos dos archivos viven en `.claude/docs/` y son **pareja**: uno mira al futuro, el otro al pasado. **No se solapan**.

| Eje | `tareas.md` | `history.md` |
|---|---|---|
| Orientación temporal | Futuro | Pasado |
| Pregunta que responde | ¿Qué falta por hacer? | ¿Por qué el código está como está? |
| Trigger de escritura | Surge una idea o se observa un bug | Se resuelve algo gordo o se cierra un hito |
| Trigger de lectura | "¿Qué hay pendiente?" / "¿Qué ataco ahora?" | "Esto me suena, ¿lo habremos visto ya?" |
| Ciclo de vida de una entrada | Nace en PENDIENTE → se mueve a TERMINADO al cerrarla | Nace al cerrar algo importante, **no se mueve nunca** |
| Granularidad | Tarea atómica accionable | Cambio sistémico o lección generalizable |

### 1.1 `tareas.md` — reglas operativas

- Cuando el usuario menciona una idea o tarea futura, **añadirla** al bloque `🟡 PENDIENTE` aunque no se vaya a atacar ahora. Es captura, no compromiso.
- Cuando el usuario pregunta "¿qué hay pendiente?", **consultar este archivo primero**, no inventar una lista desde memoria de conversaciones previas.
- Al terminar de implementar una tarea de la lista, el último paso del flujo es **siempre** mover esa tarea de `PENDIENTE` a `✅ TERMINADO` con un breve detalle de qué cambió. No se borra: se mueve.
- Fechas en formato absoluto (`2026-05-25`), nunca relativo.
- Cada entrada lleva: número de orden, título corto, fecha contextual, y cuerpo con síntoma/plan/archivos afectados/riesgo/tamaño.

### 1.2 `history.md` — reglas operativas

- **Antes** de atacar un bug que parece familiar, **consultar `history.md`**. Puede que ya esté documentado con su causa raíz.
- **Cuando** se resuelve un bug gordo, se cierra un hito o se toma una decisión arquitectónica relevante, **añadir una entrada nueva** con el formato canónico.
- La sección **"Lo que NO funcionó"** es la más valiosa del archivo: documentar fallos descartados evita repetir investigaciones que ya costaron horas.
- Las entradas no se mueven ni se borran. Orden cronológico inverso (más reciente arriba).
- Si una entrada genera follow-ups no bloqueantes, esos se anotan adicionalmente en `tareas.md`.

---

## 2. Reglas de trabajo

### a) Prohibición absoluta de git de escritura
Claude **NO** ejecuta operaciones que modifiquen el estado del repositorio: `git commit`, `git push`, `git add`, `git branch`, `git checkout -b`, `git merge`, `git rebase`, `git stash`, `git reset`, `git cherry-pick`, `gh pr create`. Sí puede usar comandos de **solo lectura**: `status`, `log`, `diff`, `show`, `blame`. Claude modifica archivos y se detiene; el control de versiones es responsabilidad exclusiva del usuario. Solo si el usuario escribe expresamente "haz commit" o "crea una rama" en **ese mismo mensaje**, Claude puede ejecutarlo, y solo para esa petición concreta — no extrapolar permisos.

### b) Workflow de rama secundaria
El usuario trabaja habitualmente en una rama propia secundaria (ej. `ModificacionesMarcJulio2026`, `dev-personal`) y decide manualmente cuándo subir a `main`. Claude **nunca** hace push a `main` ni mergea hacia `main` salvo petición expresa en ese mismo mensaje. Si cree que un cambio merece commit, puede sugerirlo en texto, nunca ejecutarlo.

### c) Mirror local del build de producción antes de push a main (condicional)
Aplica **solo si** el proyecto tiene pipeline de despliegue automático (Vercel, Railway, Netlify, Fly, Render, Cloudflare Pages, GitHub Actions con `npm run build`, builds de Capacitor/Expo, Electron, Docker en CI…) que ejecuta comandos distintos al typecheck local.

Principio: `tsc --noEmit` + `eslint` + `vitest` ≠ `vite build` / `next build` / `expo build`. Detectan errores diferentes.

**Aplica cuando:** hay deploy automático a producción al hacer push a `main`; el build de producción es distinto al de dev; hay build nativo (móvil/Electron/Tauri) fuera del flujo normal.

**NO aplica cuando:** proyecto local sin CI/CD; biblioteca/script no desplegable; CI ejecuta los mismos comandos que dev; cambios solo en `.md`, comentarios, `.claude/docs/`, o scripts no importados en runtime.

**Cuando aplica:** antes de cualquier push a `main`, Claude ejecuta localmente el mismo comando que la plataforma usa en deploy. Si todos los builds pasan, proceder. Si fallan, arreglar antes — nunca empujar a `main` confiando en que "la plataforma lo detectará".

**Setup obligatorio:** la primera vez que se configure el deploy, documentar en este `CLAUDE.md` los comandos exactos que ejecuta la plataforma y los que debe ejecutar Claude localmente antes de push.

### d) Separación estricta de paquetes
Si el proyecto está dividido en paquetes (`backend_nest_mvp/` + `frontend/`, o `api/` + `client/` + `shared/`), Claude **nunca** crea imports cruzados entre ellos. Si hace falta compartir un tipo, copiarlo o redefinirlo a mano en cada lado. **Nunca** mover lógica de "verdad" (validación de seguridad, autorización, escritura a recursos sensibles) del servidor al cliente. Cuando la tarea es de un lado, no tocar el otro salvo necesidad imprescindible y explícita.

### e) Cambio mínimo compatible
Claude ataca con el cambio **más pequeño** que resuelve el problema. No hacer refactors masivos, cambios de arquitectura por gusto, migraciones grandes sin aprobación, sustituciones globales ciegas, ni "limpiezas" no pedidas. No abrir varios frentes grandes en el mismo cambio. Tres líneas similares es mejor que una abstracción prematura. Si la propuesta es "bonita" pero rompe convenciones existentes, es incorrecta.

### f) Causa raíz antes de fix
Ante un obstáculo (test que falla, build que rompe, hook que bloquea), Claude **no** usa atajos destructivos para hacerlo desaparecer (ej. `--no-verify`, comentar el test, bypass de checks). Identificar la causa raíz y arreglarla. Si encuentra estado inesperado (archivos desconocidos, ramas raras, lock files), investigar antes de borrar/sobrescribir — puede ser trabajo en curso del usuario.

### g) Workflow obligatorio de tareas técnicas
Toda tarea técnica sigue este orden:
1. Inspeccionar el código real afectado.
2. Leer documentación relevante si existe.
3. Identificar causa raíz.
4. Distinguir si el problema es semántico / técnico / de integración / mixto.
5. Proponer cambio mínimo compatible.
6. Implementar solo lo necesario.
7. Compilar/validar.
8. Actualizar documentación si cambió comportamiento real.
9. Resumir archivos tocados e invariantes protegidos.

Si la tarea es ambigua, aclarar primero — no improvisar arquitectura.

### h) Formato de respuesta al terminar tarea
Al cerrar una tarea, Claude responde con esta estructura:
1. **Causa raíz** — qué estaba mal realmente.
2. **Cambios aplicados** — archivos tocados y qué cambió en cada uno.
3. **Verificación** — qué compilaciones/checks se ejecutaron y con qué resultado.
4. **Invariantes protegidos** — qué reglas del producto se mantuvieron.
5. **Limitaciones conscientes** — qué quedó sin resolver y por qué.
6. **Siguiente paso recomendado** — uno solo, no abrir varios frentes.

### i) No claim sin verificación
`tsc --noEmit` ≠ "la feature funciona". Para cambios de UI, levantar el servidor de desarrollo y probarlo en navegador antes de declarar éxito (golden path + edge cases). Si no se puede probar, decirlo explícitamente en vez de afirmar que funciona.

### j) No dependencias sin aprobación
Claude **no** añade dependencias (`npm install`, `pip install`, `brew install`…) sin aprobación explícita del usuario en ese mismo mensaje. Tampoco modifica versiones de dependencias existentes salvo petición.

### k) Documentación operativa en `.claude/`
Toda la documentación meta vive bajo `.claude/` en la raíz del repo (versionada en git, viaja con el proyecto). Estructura mínima:
- `.claude/docs/history.md` — pasado.
- `.claude/docs/tareas.md` — futuro.
- `.claude/docs/domains/` — dominios de coherencia (ver §9).

No crear documentación nueva en `docs/` raíz salvo que una skill lo exija.

### l) Coherencia entre subsistemas (dominios)
Si el proyecto tiene recursos compartidos entre componentes (paletas de colores, schemas de datos, rutas, auth guards, sistemas de eventos), documentarlos en `.claude/docs/domains/<nombre>.md`. Antes de dar por terminada una modificación, Claude pregunta: *"¿Este cambio afecta a algún recurso compartido que otros subsistemas consumen?"*. Si sí, consultar el dominio correspondiente. **No consultar todos los dominios en cada cambio** — solo los cuya condición de activación se cumple. La tabla de dominios de Sonilab está en la Parte II §9.

### m) Anti-bucle de auto-documentación
Actualizar documentación de dominios es el **último paso** de cerrar una tarea, no el inicio de una nueva ronda de revisión. La revisión de coherencia se hace sobre cambios funcionales, no sobre cambios en docs. Esto evita bucles infinitos editar-`.md`→revisar→editar-`.md`.

### n) Branding y constantes centralizadas
El branding visible y las constantes del producto (nombre de la app, paleta, dimensiones canónicas, URLs públicas) viven en un punto único y fácil de localizar. Claude **nunca** hace reemplazos globales ciegos de strings legacy — distinguir siempre entre branding visible (sí unificar) y nombres internos técnicos (no tocar sin tarea explícita).

### o) Persistencia fuera del contenedor
Los datos de usuario y producto **nunca** viven en el filesystem del contenedor de aplicación (Railway, Fly, Render, Heroku), aunque haya volumen adjunto. Tampoco en el repo git, ni en servicios personales (Drive, Dropbox, iCloud). Deben vivir en:
- **Object storage S3-compatible:** Cloudflare R2, Backblaze B2, AWS S3.
- **BD relacional gestionada con backups.**

Identidad (auth, roles) y producto (datos de usuario) van en almacenes separados. La frontera no se cruza.

### p) Protección contra costes anómalos
Cualquier integración con servicio cloud de pago-por-uso (storage, IA, email…) tiene **cuatro capas activas siempre**:
1. Rate limiting por usuario en backend.
2. Cuotas duras por usuario/plan.
3. Alertas de facturación a múltiples niveles bajos (€3, €5, €10, €15…) — mejor spam que sorpresa.
4. Monitor propio con corte automático cuando se supera N× la media.

Nunca depender solo del proveedor — sus alertas notifican, no actúan.

### q) No emojis salvo petición
Claude solo usa emojis si el usuario lo pide explícitamente. Por defecto, código y respuestas son texto plano.

### r) No comentarios decorativos
Por defecto Claude no añade comentarios al código. Solo cuando el "porqué" es no obvio (constraint oculto, invariante sutil, workaround para bug específico). Nunca comentarios que expliquen *qué* hace el código (los nombres ya lo dicen), ni referencias a la tarea actual ("añadido para flow X", "fix de issue #123") — eso va en el PR description y se pudre con el tiempo.

### s) No documentación no solicitada
Claude **nunca** crea archivos `*.md` o `README.md` salvo petición explícita. No crear planning docs, decision logs ni analysis docs como subproducto del trabajo — esa información vive en la conversación y en `.claude/docs/` si merece persistirse.

### t) Memoria de máquina vs memoria de proyecto
Dos persistencias distintas, no mezclar:
- `.claude/` — versionado en git, compartido entre máquinas y sesiones. **Memoria del proyecto.**
- `~/.claude/projects/<proj>/memory/` — local por máquina, no se sube. **Memoria personal de Claude** (preferencias del usuario: cómo le gusta trabajar).

Contenido del proyecto nunca en memory personal; preferencias personales nunca en `.claude/`.

### u) Criterios de decisión jerarquizados
Cuando dos opciones técnicas compiten, Claude prioriza en este orden:
1. Visión del producto
2. Semántica correcta
3. Compatibilidad con el estado actual
4. Arquitectura real
5. Modelo de datos
6. UX
7. Implementación técnica

Si una propuesta "bonita" rompe la semántica, es incorrecta. Si una "limpia" rompe convenciones consolidadas, es incorrecta. Si una "rápida" abre ambigüedad, es incorrecta.

### v) Acciones de blast radius alto requieren confirmación
Claude confirma con el usuario antes de ejecutar acciones difíciles de revertir o con efecto en sistemas compartidos: borrar archivos/ramas/tablas, force-pushes, downgrade de dependencias, modificación de CI/CD, mensajes a Slack/email, posts a servicios externos, uploads a herramientas de terceros (diagram renderers, pastebins). El coste de pausar a confirmar es bajo; el coste de una acción no deseada puede ser muy alto.

---

## 3. Por qué los permisos de Claude están en "bypass"

Los archivos `.claude/settings.json` y `.claude/settings.local.json` dan permisos máximos a Claude. Esto es **intencional**: el usuario trabaja con prompts muy elaborados y detallados, con autorrevisiones en bucle para tareas complejas. La lógica del trabajo ya va servida al detalle en el primer prompt; las dudas que pueda tener Claude son típicamente de implementación técnica o conceptos que Claude e internet ya conocen bien. Pedir confirmación constante interrumpiría el flujo sin aportar valor.

Las reglas a/b/v de arriba son las que compensan ese bypass: hay acciones que siempre requieren petición explícita o confirmación, independientemente de los permisos del sistema.

---
---

# PARTE II — Contexto de producto Sonilab

> Reglas de proceso y de git: ver Parte I. Aquí solo va el conocimiento específico del producto.

## 4. Naturaleza del producto

Esta app **no** es una herramienta pequeña ni solo de subtítulos.
Es una aplicación web grande y modular con áreas de:
- biblioteca
- vídeo
- audio
- subtítulos
- timeline
- waveform
- guion
- traducción
- revisión
- proyectos

Cualquier cambio en biblioteca debe proteger el resto del sistema.

## 5. Modelo funcional cerrado de biblioteca

La biblioteca tiene cuatro módulos con lógica y UI propia. En el frontend son cuatro pestañas: **Files**, **Projectes**, **Media**, **Paperera**.

### Files (antes "Arxius" / "Llibreria")
Sistema clásico de trabajo con estructura real de carpetas/subcarpetas en backend.
- Contiene: txt, srt, pdf, docx, LNK y carpetas de trabajo
- Permite: copiar / cortar / pegar / duplicar / mover / renombrar
- Regla de duplicados: mismo nombre+formato en la misma carpeta = prohibido; en ruta distinta = permitido
- **NO muestra media canónica** (vídeo/audio con `media` poblado y sin `refTargetId`)
- **NO muestra documentos con `sourceType` de media** aunque no tengan `media` poblado (legacy)
- Carpetas de proyecto se identifican por `projectFolderIds` y muestran icono 🗃️ y formato "PROJECTE"
- Carpetas normales muestran icono 📁 y formato "CARPETA"
- El breadcrumb muestra "Files" cuando `page === 'library'`

### Media
Repositorio canónico de assets audiovisuales. **Solo vídeo y audio.**
- Backend: carpeta plana única en disco (`STORAGE_ROOT`), sin subdirectorios reales
- Cada archivo guardado con nombre aleatorio (`nanoid`) + extensión original
- Identidad del asset = SHA-256, no el nombre ni la ruta
- Deduplicación siempre activa: no puede haber dos assets con el mismo SHA-256
- No se comporta como archivo clásico: no hay copiar/cortar/pegar/duplicar binario
- Las "agrupaciones" que ve el usuario son solo vistas del frontend (orden/filtro), no estructura en disco
- Solo muestra documentos con `media` poblado y `refTargetId` vacío
- El breadcrumb muestra "Media" cuando `page === 'media'`

### LNK
Referencia desde Files hacia un asset de Media.
- No duplica binario; apunta al original
- Puede convivir con txt/srt/docs en cualquier carpeta de Files
- Copiar un LNK duplica la referencia, no el media
- LNK huérfano (target borrado): no se puede abrir, se marca visualmente como roto

### Projectes
Capa propia del producto. Lista de carpetas de proyecto.
- No se fusiona con Media ni con Files
- Cada proyecto apunta a un `mediaDocumentId` canónico de Media
- La pestaña Projectes filtra `itemsToRender` mostrando solo carpetas cuyo `id` está en `projectFolderIds`
- `projectFolderIds` se calcula a partir del estado de proyectos del backend
- El breadcrumb muestra "Projectes" cuando `page === 'projects'`
- Las carpetas de proyecto también son visibles en Files (con icono 🗃️ y formato "PROJECTE")

## 6. Definiciones canónicas

```ts
const isCanonicalMedia = (doc: any) =>
  doc?.type === 'document' && !!doc.media && !doc.refTargetId;

const isLnk = (doc: any) =>
  doc?.type === 'document' && !!doc.refTargetId;

const isOrphanLnk = (doc: any, allDocs: any[]) =>
  isLnk(doc) && !allDocs.find(d => d.id === doc.refTargetId && !d.isDeleted);
```

No bases decisiones funcionales solo en `sourceType` si necesitas distinguir:
- media canónica
- documento clásico
- LNK

## 7. Estado actual de fases

### Fase 1
Cerrada funcionalmente.
- Media, Arxius, LNK y Projectes definidos sin ambigüedad.

### Fase 2
Cerrada técnicamente.
La contención ya cubre:
- copy/cut/paste de media canónica
- drag/drop genérico de media
- subida cruzada media ↔ Arxius
- clasificación por tabs
- selección y acciones múltiples
- delete/purge con conjunto total efectivo
- LNK huérfanos

### Fase 3
Iniciada. Contrato funcional cerrado y primer bloque implementado.

**Decisiones funcionales cerradas:**
- Media backend = carpeta plana única en disco (sin subdirectorios reales). Las agrupaciones del frontend son solo visuales.
- No existe "forzar nuevo" para duplicados confirmados. La deduplicación por SHA-256 es siempre autoritativa.
- Duplicado probable (precheck nombre+tamaño): modal tentativo — "Continuar i verificar" / "Cancel·lar".
- Duplicado confirmado (SHA-256): modal definitivo — "Usar asset existent" / "↗ Crear accés directe" / "Cancel·lar".
- Subida de media siempre con `parentId: null` (no hereda carpeta de Arxius).
- Reutilizar media = crear LNK, no duplicar binario.

**Implementado en esta fase:**
- Eliminado `forceDuplicate` y `nameOverride` del endpoint `POST /media/upload`.
- Eliminado `forceDuplicate` de `api.ts → uploadMedia()`.
- Eliminada función `handleForceImport` y estados asociados de `LibraryView.tsx`.
- Modal de duplicado confirmado rediseñado sin opción de force.
- `parentId: null` forzado en todas las rutas de subida de media en `LibraryView.tsx`.

**Pendiente en Fase 3:**
- Relación Media ↔ LNK: flujo de "Usar asset existent" (navegación al asset en Media).
- Organización visual dentro de Media (frontend only).
- Compatibilidad con Projectes verificada pero no reforzada explícitamente.

## 8. Invariantes a proteger y rutas sensibles

No abras una fase nueva por tu cuenta. No cambies arquitectura global sin instrucción explícita. Si una zona ya está contenida, no la reabras por perfeccionismo. Si detectas una fuga real, corrígela en el punto más local posible. Si no hay fuga real, no inventes trabajo.

Protege especialmente:
- Projectes
- editores
- timeline
- waveform
- syncRequest
- transcripción
- traducción
- revisión

Rutas más sensibles (lee el `CLAUDE.md` local antes de tocarlas):
- `frontend/components/Library/`
- `frontend/context/Library/`
- `backend_nest_mvp/src/modules/library/`
- `frontend/components/Projects/`
- `backend_nest_mvp/src/modules/projects/`

Convenciones prácticas:
- Comentarios de código: catalán si ya existe esa convención local.
- Nombres de variables y funciones: inglés.
- Mantén contratos existentes salvo razón fuerte.
- Evita renombrados masivos y cambios "de limpieza" sin valor funcional.

## 9. Coherencia entre subsistemas (dominios de Sonilab)

Muchos componentes de Sonilab comparten recursos indirectos. Dos partes de la app pueden no estar conectadas directamente pero depender del mismo contrato compartido.

Ejemplo: añadir un nuevo `sourceType` afecta a `FileItem.tsx` (icono/formato), `LibraryView.tsx` (clasificación), `OpenWithModal.tsx` (detección y apertura), `exportUtils.ts` (extensión del nombre) y posiblemente al backend. Sin consultar todos los afectados, el cambio queda a medias.

Los archivos de dominio viven en `.claude/docs/domains/<nombre>.md` (ver regla l de la Parte I). Cada uno explica qué archivos involucra, qué hacer al añadir/modificar/eliminar algo, y qué relaciones indirectas existen.

| Condición de activación | Dominio | Archivo |
|------------------------|---------|---------|
| Se añade, modifica o elimina un valor de `sourceType` | Clasificación de documentos | `.claude/docs/domains/source-types.md` |
| Se añade o renombra una clave en `LOCAL_STORAGE_KEYS` | Persistencia local | `.claude/docs/domains/localstorage.md` |
| Se modifica `isCanonicalMedia`, `isLnk` o la lógica de tab (Files/Media/Projectes) | Modelo de biblioteca | `.claude/docs/domains/library-model.md` |
| Se modifica el formato `snlbpro` o su pipeline de import/export/apertura | Formato de guion | `.claude/docs/domains/snlbpro-format.md` |
| Se toca `projectFolderIds` o cualquier lógica del módulo Projectes | Proyectos | `.claude/docs/domains/projectes.md` |
| Se modifica el modelo de segmento, `SubtitleEditorContext` o el editor de subtítulos | Editor de subtítulos | `.claude/docs/domains/subtitles.md` |
| Se modifica el flujo de subida de media o la lógica de deduplicación SHA-256 | Upload de media | `.claude/docs/domains/media-upload.md` |
| Se toca sincronización de tiempo entre media, subtítulos o waveform | Timeline / Waveform | `.claude/docs/domains/timeline.md` |
| Se añade una ruta nueva en frontend o un endpoint nuevo en backend | Navegación y routing | `.claude/docs/domains/routing.md` |
| Se modifica `exportToPdf` del editor de guion, el flujo de impresión a PDF o los anchors `[data-page-break-anchor]` | Export del guion a PDF | `.claude/docs/domains/script-pdf-export.md` |
| Se modifica el sistema de presets de estilos del usuario, las CSS vars `--us-*` o cualquier componente de `frontend/components/Settings/UserStyles/` | User styles | `.claude/docs/domains/user-styles.md` |

**Cómo crece esta tabla:** al crear un subsistema con recursos compartidos, crear `.claude/docs/domains/<nombre>.md` y añadir su condición de activación aquí. No documentar subsistemas sin relaciones indirectas.

**Regla de auto-documentación (sin bucles):** al terminar una modificación, comprobar UNA VEZ si introduce un recurso compartido nuevo (→ crear dominio) o amplía uno existente (→ actualizar su `.md`). Actualizar un dominio es el último paso, NO activa otra ronda de revisión (ver regla m de la Parte I).

## 10. Estrategia de integración con aplicaciones externas

### Contexto

Este repositorio está diseñado para absorber en el futuro la lógica de otras aplicaciones relacionadas — en particular, un lector de guiones para doblaje (`script-reader-for-dubbing`) que actúa como aplicación "padre". Esa app comparte origen conceptual con Sonilab pero tiene arquitectura independiente y archivos con los mismos nombres.

Para que la integración futura no destruya código, se ha aplicado una convención de naming preventiva en este repo. Cualquier Claude que trabaje aquí debe respetar esta convención y seguir el protocolo de integración descrito en este apartado.

### Convención de naming anti-colisión

Cuando un archivo de este repo tiene o tenía el mismo nombre que un archivo de una aplicación externa que se va a integrar, se renombra en **este** repo aplicando uno de estos prefijos:

| Caso | Patrón aplicado | Ejemplo |
|------|----------------|---------|
| Componente de biblioteca compartido | prefijo `Sonilab` | `LibraryView.tsx` → `SonilabLibraryView.tsx` |
| Contexto compartido | prefijo `Sonilab` | `LibraryContext.tsx` → `SonilabLibraryContext.tsx` |
| Componente de fila de biblioteca | prefijo `Library` | `FileItem.tsx` → `LibraryFileItem.tsx` |
| Tipos globales de la app | sufijo `app` | `types.ts` → `appTypes.ts` |
| Carpeta de utils compartida | nombre descriptivo | `LectorDeGuions/` → `ScriptUtils/` |

**Archivos que NO se pueden renombrar** porque son puntos de entrada del tooling:

| Archivo | Razón |
|---------|-------|
| `App.tsx` | Entry point de React — Vite lo espera por convención |
| `index.html` | Entry point HTML |
| `index.tsx` | Entry point React DOM |
| `package.json` | Requerido por npm/Node tal cual |
| `tsconfig.json` | Requerido por TypeScript |
| `vite.config.ts` | Requerido por Vite |

Estos se fusionan **manualmente** en el momento de la integración — no se renombran.

### Qué hace la aplicación padre (script-reader-for-dubbing)

- Framework: React + Vite + react-router-dom (web, no React Native)
- Sin backend propio — todo en localStorage/AsyncStorage local
- Funcionalidad principal: lector de guiones de doblaje con anotaciones, búsqueda por personaje/take, y visualización de capas de anotación
- Los archivos de lógica pura que sí son reutilizables (y ya están integrados aquí) son:
  - `utils/ScriptUtils/indexers.ts` — indexación de personajes y takes
  - `utils/ScriptUtils/search.ts` — búsqueda de matches en texto
  - `utils/ScriptUtils/takes.ts` — rangos de takes

### Archivos de la app padre que NO se integrarán como código

Estos archivos existen en la app padre pero su lógica está implementada de forma distinta en Sonilab y **no deben mezclarse**:

| Archivo padre | Por qué no se porta |
|--------------|---------------------|
| `LibraryContext.tsx` | Usa AsyncStorage local; Sonilab usa backend NestJS |
| `LibraryView.tsx` | React Native; Sonilab usa React web con Tailwind |
| `FileItem.tsx` | React Native; Sonilab usa React web con Tailwind |
| `types.ts` (biblioteca) | Subconjunto mínimo; Sonilab tiene supertipo completo en `appTypes.ts` |
| `App.tsx` | Usa react-router-dom; Sonilab usa hash routing propio |

### Lo que sí se portará cuando llegue la integración

Los componentes propios del lector que no existen en Sonilab:

| Archivo padre | Descripción | Dónde irá en Sonilab |
|--------------|-------------|----------------------|
| `components/AnnotationCanvas.tsx` | Lienzo de anotaciones sobre el guion | `components/LectorDeGuions/` |
| `components/LayerPanel.tsx` | Panel de capas de anotación | `components/LectorDeGuions/` |
| `components/TakesByCharacterPanel.tsx` | Panel de takes por personaje | `components/LectorDeGuions/` |
| `components/HighlightedScript.tsx` | Vista de guion con highlights | `components/LectorDeGuions/` |
| `components/ConfirmTextModal.tsx` | Modal de confirmación de texto | `components/LectorDeGuions/` |
| `app/index.tsx` (EditorPage) | Página principal del lector | Adaptado como nueva vista en Sonilab |
| `app/library-manager.tsx` | Gestión de biblioteca del lector | Sustituido por la biblioteca de Sonilab |
| `types/annotation.ts` | Tipos de anotación | `types/LectorDeGuions/` |

### Protocolo de integración (cuando llegue el momento)

Seguir estos pasos en orden. No mezclar pasos.

**Paso 1 — Verificar que no hay nuevas colisiones de nombres.** Antes de portar cualquier archivo nuevo, comprobar que su nombre no coincide con ningún archivo existente en Sonilab. Si coincide, aplicar la convención de naming de la sección anterior.

**Paso 2 — Portar únicamente lógica pura (utils y types).** Copiar los archivos de lógica sin UI a sus carpetas destino. No modificar los existentes en Sonilab. Verificar que los imports son correctos.

**Paso 3 — Portar componentes UI como módulo aislado.** Colocar los componentes del lector en `components/LectorDeGuions/`. No importar desde ellos hacia componentes de Sonilab ni al revés, salvo a través de una interfaz explícita.

**Paso 4 — Añadir la nueva vista al router.** Añadir el nuevo `OpenMode` para el lector en `appTypes.ts`. Añadir la rama de render en `App.tsx`. Añadir la ruta al hash router en `useHashRoute.ts`. Ver `.claude/docs/domains/routing.md`.

**Paso 5 — Añadir el botón de apertura en OpenWithModal.** Solo si el documento es un tipo reconocible por el lector. Seguir el patrón existente de `isSnlbpro` para la detección.

**Paso 6 — Fusionar package.json.** Añadir solo las dependencias nuevas que el lector necesite y que no estén ya en Sonilab. No sobrescribir versiones existentes sin verificar compatibilidad.

**Paso 7 — Verificar no regresión.** Comprobar que Files, Media, Projectes, editor de subtítulos y editor de guion siguen funcionando exactamente igual que antes.

### Regla general

Cuando se porta código de otra aplicación a este repo:
1. Primero verificar nombres — aplicar convención si colisionan.
2. Portar como módulo aislado — no mezclar lógica interna.
3. Conectar por interfaz explícita (OpenMode, router, OpenWithModal) — no por imports directos entre módulos.
4. No tocar lo que ya funciona en Sonilab como efecto lateral del port.
