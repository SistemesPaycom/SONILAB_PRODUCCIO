# Dominio: Navegación y routing

## Qué es este dominio

El frontend usa hash routing (`window.location.hash`). No hay React Router. El estado de navegación se gestiona con el hook `useHashRoute` más variables de estado en `App.tsx`.

## Hash routing (frontend)

```ts
// frontend/hooks/useHashRoute.ts
type HashRoute =
  | { view: 'home' }
  | { view: 'editor'; mode: OpenMode; docId: string }
  | { view: 'script-view' }
  | { view: 'loading-preview' };
```

Formato de URL:
- `#/` o vacío → `{ view: 'home' }`
- `#/editor/<mode>/<docId>` → `{ view: 'editor', mode, docId }`
- `#/script-view` → `{ view: 'script-view' }`
- `#/loading-preview` → `{ view: 'loading-preview' }`

## OpenMode

```ts
// frontend/types.ts
export type OpenMode =
  | 'editor'              // editor de guion (texto plano/snlbpro)
  | 'editor-video'        // editor de vídeo (sin subtítulos)
  | 'editor-video-subs'   // editor de vídeo con subtítulos y waveform
  | 'editor-ssrtlsf'      // editor de guion snlbpro (SsrtlsfEditorView)
  | 'editor-srt-standalone'; // editor SRT standalone (sin vídeo)
```

## Tab page (biblioteca)

```ts
// App.tsx
const [page, setPage] = useState<'library' | 'media' | 'projects'>('library');
```

`page` no forma parte de la URL — es estado local de `App.tsx`. Cambiar de tab no cambia el hash.

## Routing en App.tsx

```ts
// Qué renderiza cada openMode:
if (openMode === 'editor-video')        → <VideoEditorView />
if (openMode === 'editor-video-subs')   → <VideoSubtitlesEditorView />
if (openMode === 'editor-ssrtlsf')      → <SsrtlsfEditorView />
if (openMode === 'editor-srt-standalone') → <VideoSrtStandaloneEditorView />
// default (openMode === 'editor')       → CsvView / editor de texto
```

## Módulos backend

```
backend_nest_mvp/src/modules/
├── auth/       — autenticación y sesión
├── health/     — endpoint de health check
├── library/    — carpetas y documentos (Files)
├── media/      — assets audiovisuales (Media)
├── projects/   — proyectos (Projectes)
└── users/      — gestión de usuarios
```

Los endpoints siguen la convención REST estándar de NestJS.

## Qué hacer si se toca este dominio

### Añadir una vista nueva en frontend

1. Añadir el caso a `HashRoute` en `useHashRoute.ts`.
2. Añadir la rama de parsing en `parseHash()` de `useHashRoute.ts`.
3. Añadir la rama de render en `App.tsx`.
4. Si la vista tiene un `OpenMode` asociado, añadirlo a `types.ts`.
5. Si el usuario puede navegar a ella desde la biblioteca (`OpenWithModal.tsx` o doble clic en `LibraryView.tsx`), añadir el handler correspondiente.
6. Actualizar esta tabla.

### Añadir un endpoint nuevo en backend

1. Crear el módulo/servicio/controller en `backend_nest_mvp/src/modules/<nombre>/`.
2. Registrar el módulo en `AppModule`.
3. Añadir la función correspondiente en `frontend/api.ts`.
4. Actualizar esta tabla.

## No romper

- `useHashRoute` es el único lugar donde se parsea el hash — no duplicar esa lógica.
- `page` es estado local de `App.tsx` — no persistir en URL salvo encargo explícito.
- Al cambiar de tab (`setPage`), resetear `openDocId` y `openMode` (ya se hace en el handler `onChangePage`).
- Los modos de apertura válidos vienen de `OpenMode` — no hardcodear strings en los componentes.
