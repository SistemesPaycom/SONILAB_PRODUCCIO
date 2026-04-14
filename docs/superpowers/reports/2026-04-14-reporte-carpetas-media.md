# Informe Detallado: Funcionalidad de Carpetas en Media vs Files

Este informe detalla el funcionamiento actual de la gestión de archivos y carpetas en el sistema, centrándose en la discrepancia entre las pestañas "Media" y "Files" (Arxius), y proporciona una hoja de ruta para implementar la organización por carpetas en la sección de Media.

## Contexto para Claude (Resumen Ejecutivo)

Actualmente, el sistema trata la pestaña **Media** como una vista plana de todos los documentos que contienen archivos binarios (vídeo/audio). Aunque el backend almacena todo en una estructura de "Library", la interfaz de Media ignora las carpetas.

**El problema central:** Cuando un usuario está en la pestaña Media y pulsa "Crear Carpeta", la lógica del frontend crea una carpeta en la raíz de "Files" porque en Media la carpeta actual (`currentFolderId`) siempre es `null`. Además, la vista de Media no renderiza carpetas, por lo que la carpeta recién creada parece "desaparecer" de Media y aparece en Files.

**Objetivo:** Permitir que Media tenga su propia jerarquía de carpetas "virtuales" (u organizativas) para que los vídeos no estén todos en una lista plana, manteniendo la restricción de seguridad de que no puede haber dos vídeos con el mismo nombre en todo el sistema.

---

## Análisis Técnico del Código Actual

### 1. Frontend: `SonilabLibraryView.tsx`

#### Renderizado de Elementos (Líneas 435-451)
La lógica actual de filtrado para la pestaña Media excluye explícitamente las carpetas:
```tsx
: page === 'media'
  ? state.documents.filter(
      (doc) => !doc.isDeleted && MEDIA_EXTS.includes((doc.sourceType || '').toLowerCase()) && !!(doc as any).media && !(doc as any).refTargetId
    )
```
*   **Observación:** Solo filtra `state.documents`. Las `state.folders` no se tienen en cuenta.
*   **Conflicto:** Si se añaden carpetas a Media, este filtro debe actualizarse para incluir carpetas que pertenezcan a la categoría "Media".

#### Navegación a Media (Líneas 146-151)
Al entrar en Media, el sistema resetea la carpeta actual:
```tsx
const goMedia = () => {
  dispatch({ type: 'SET_VIEW', payload: 'library' });
  dispatch({ type: 'SET_CURRENT_FOLDER', payload: null });
  setIsCollapsed(false);
  onChangePage('media');
};
```
*   **Consecuencia:** Cualquier acción de creación dentro de Media ocurre en el nivel raíz (`null`).

#### Creación de Carpetas (Líneas 241-252)
La función `handleCreateFolder` usa `state.currentFolderId`. Como en Media es `null`, la carpeta se crea siempre en la raíz de la biblioteca general.

### 2. Backend: `library.service.ts` y `folder.schema.ts`

#### Esquema de Carpeta
El esquema actual (`folder.schema.ts`) es muy simple:
```typescript
export class Folder {
  @Prop({ required: true, index: true }) ownerId: string;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ type: String, default: null, index: true }) parentId: string | null;
  @Prop({ default: false, index: true }) isDeleted: boolean;
}
```
*   **Deficiencia:** No hay ningún campo que distinga si una carpeta es para "Media" o para "Files".

#### Restricción de Nombres Duplicados (Líneas 423-429)
El backend ya implementa la seguridad de nombres únicos para media:
```typescript
async findMediaByName(name: string): Promise<any | null> {
  const doc = await this.docModel
    .findOne({ isDeleted: false, media: { $ne: null }, name })
    .collation({ locale: 'en', strength: 2 })
    .lean();
  return doc ? { ...doc, id: doc._id.toString() } : null;
}
```
*   **Seguridad:** Esta búsqueda **no** filtra por `parentId`, lo que significa que valida la unicidad del nombre en toda la base de datos de media, independientemente de la carpeta. Esto debe mantenerse.

---

## Posibles Soluciones y Mejoras Propuestas

### A. Diferenciación de Carpetas (Backend)
Es necesario añadir un campo a `FolderSchema` para categorizar las carpetas.
1.  **Modificar `folder.schema.ts`**: Añadir `@Prop({ type: String, default: 'files' }) category: 'files' | 'media';`.
2.  **Actualizar `LibraryService.createFolder`**: Aceptar `category` en el DTO y guardarlo.

### B. Gestión de la Vista en Media (Frontend)
1.  **Actualizar `SonilabLibraryView.tsx`**:
    *   Modificar `itemsToRender` para que, si `page === 'media'`, incluya carpetas del estado cuyo `category` sea `'media'` y cuyo `parentId` coincida con el actual.
    *   Modificar `handleCreateFolder`: Si estamos en `page === 'media'`, enviar `category: 'media'` al backend.
2.  **Mantenimiento de Estado**: Asegurarse de que al navegar entre Media y Files, el `currentFolderId` se gestione correctamente (quizás tener un `currentMediaFolderId` separado en el contexto).

### C. Restricción de Nombres
La lógica de subida de Media ya comprueba duplicados globales (ver `api.checkMediaDuplicate` y `api.uploadMedia`). No se requiere cambio aquí para mantener la seguridad, ya que la búsqueda de duplicados es agnóstica a la carpeta.

---

## Riesgos y Conflictos Identificados

1.  **Confusión de Estructuras**: Si un usuario tiene una carpeta llamada "Proyecto A" en Files y otra "Proyecto A" en Media, el sistema debe ser capaz de distinguirlas (el campo `category` soluciona esto).
2.  **Breadcrumbs**: El componente de migas de pan debe entender en qué jerarquía se encuentra para no saltar de Media a Files accidentalmente.
3.  **Movimiento de Archivos**: ¿Se podrá mover un vídeo de una carpeta de Media a otra? Sí, pero moverlo de Media a Files (o viceversa) requeriría cambiar la categoría del documento o tratarlo como una referencia (`LNK`).
4.  **Migración**: Las carpetas creadas actualmente desde Media están en Files. Habría que decidir si se mueven automáticamente a la categoría Media o si el usuario debe reorganizarlas.

---

## Instrucciones para la Implementación (Para Claude)

> [!IMPORTANT]
> Se recomienda encarecidamente utilizar las herramientas de **superpowers debug** y **code-review** durante la implementación para detectar posibles efectos secundarios en el árbol de dependencias del LibraryContext.

1.  **Análisis de Impacto**: Antes de modificar el esquema, usa `code-review` en `library.service.ts` para asegurar que `getTree` y los métodos de borrado en cascada no se rompan al añadir el nuevo campo.
2.  **Pruebas de Regresión**: Al modificar el filtrado de `itemsToRender`, verifica que la pestaña de "Files" y "Projects" siga funcionando exactamente igual.
3.  **Seguridad**: Verifica con `debug` que al intentar subir un archivo con nombre duplicado en una carpeta de Media diferente, el backend siga detectando el conflicto correctamente.

---
*Informe generado para asistir en la mejora del sistema de organización de Media.*
