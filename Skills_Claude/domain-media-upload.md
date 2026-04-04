# Dominio: Upload de media

## Qué es este dominio

El flujo de subida de media tiene lógica especial de deduplicación por SHA-256. Es diferente de la subida de documentos clásicos (txt/srt/pdf/docx). No confundir los dos flujos.

## Regla fundamental

`parentId: null` **siempre** al subir media. Media va al repositorio plano `STORAGE_ROOT`, no a ninguna carpeta de Files. Nunca heredar el `currentFolderId` activo para media.

## Flujo completo

```
Usuario arrastra/selecciona archivo de media
        ↓
Precheck: ¿nombre + tamaño coinciden con un documento media existente?
        ↓ Sí                              ↓ No
Modal tentativo:                   api.uploadMedia(file, progress, parentId: null)
"Possible arxiu duplicat"                  ↓
"Continuar i verificar" / "Cancel·lar"    Backend calcula SHA-256
        ↓ Continuar                        ↓
api.uploadMedia(file, progress, parentId: null)   uploadResult.duplicated?
        ↓                                  ↓ No           ↓ Sí
Backend calcula SHA-256            Asset creado    Modal definitivo
        ↓ duplicated = true
Modal definitivo:
"Arxiu ja existent"
"Usar asset existent" / "↗ Crear accés directe" / "Cancel·lar"
```

## Acciones del modal definitivo (SHA-256 confirmado)

| Opción | Acción |
|--------|--------|
| "Usar asset existent" | Navegar al asset existente en la tab Media (pendiente de implementar — Fase 3) |
| "↗ Crear accés directe" | Crear un LNK en la carpeta activa de Files que apunta al asset existente |
| "Cancel·lar" | Cerrar modal sin acción |

**No existe opción de forzar duplicado.** La deduplicación por SHA-256 es siempre autoritativa.

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `frontend/components/Library/LibraryView.tsx` | Toda la lógica del flujo (precheck, upload, modales, acciones) |
| `frontend/api.ts` | `uploadMedia(file, onProgress, parentId)` — llama a `POST /media/upload` |
| `backend_nest_mvp/src/modules/media/` | Endpoint `POST /media/upload`; calcula SHA-256; detecta duplicados |

## Estado del modal de duplicado

```ts
// frontend/components/Library/LibraryView.tsx
const [duplicateNotice, setDuplicateNotice] = useState<{
  fileName: string;
  existingName: string;
  existingDocId: string;
  folderPath: string;
  file: File;
  targetParentId: string | null;
  tentative?: boolean;  // true = modal tentativo (precheck); false = definitivo (SHA-256)
} | null>(null);
```

## Identidad del asset

- Identidad = **SHA-256**, no el nombre ni la ruta.
- El archivo se guarda en disco con nombre aleatorio (`nanoid`) + extensión original.
- No puede haber dos assets con el mismo SHA-256 en el backend.

## Qué hacer si se toca este dominio

- **Se modifica el endpoint `POST /media/upload`** → verificar que el campo `duplicated` sigue devolviendo el documento existente correctamente; verificar que el frontend procesa los dos casos (nuevo y duplicado).
- **Se modifica el modal de duplicado** → mantener las tres opciones (no añadir "forzar nuevo"); verificar que `tentative` controla correctamente el texto del modal.
- **Se modifica `api.uploadMedia`** → asegurar que `parentId` sigue siendo `null` por defecto para media; no heredar carpeta activa de Files.
- **Se implementa "Usar asset existent"** → navegar a la tab Media y seleccionar/destacar el asset; no duplicar binario.

## No romper

- `parentId: null` al subir media (media no hereda carpeta de Files)
- Deduplicación SHA-256 siempre activa (no se puede desactivar ni forzar)
- LNK creado por "Crear accés directe" apunta al asset existente, no duplica binario
- El precheck de nombre+tamaño es solo tentativo — siempre confirmar con SHA-256 real antes de bloquear
