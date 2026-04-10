# Informe Técnico: Implementación de Limpieza de Historial

Este informe detalla la funcionalidad actual de los paneles de **Tasques IA** y **Pujades**, y proporciona una guía detallada para implementar un botón de "Limpiar Historial" en ambos.

---

## 1. Explicación para Claude (Contexto de Negocio)

**Objetivo:** Añadir un botón para limpiar el historial en los paneles de "Tasques IA" (tareas de transcripción/procesamiento) y "Pujades" (subidas de archivos) dentro de la pestaña "Historial".

**Requerimiento:**
- Cuando el usuario esté en la pestaña "Historial" de cualquiera de los dos paneles, debe aparecer un botón visible (ej: "Netejar Historial").
- Al hacer clic, se deben eliminar todas las entradas que no estén activas (es decir, las que tengan estado "Completado" o "Error").
- La limpieza debe ser intuitiva y, preferiblemente, pedir una confirmación rápida para evitar borrados accidentales si el historial es valioso.
- En el panel de "Tasques IA", lo ideal sería que la limpieza persistiera entre sesiones (que no vuelvan a aparecer al recargar la página).

---

## 2. Análisis Técnico Detallado

### A. Panel de Tasques IA
- **Archivo:** [TasksIAPanel.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/TasksIA/TasksIAPanel.tsx)
- **Estado Actual:** 
  - Las tareas se obtienen del backend mediante `api.listJobs({ limit: 100 })`.
  - El panel realiza un *polling* cada 3 segundos para actualizar el estado.
  - El historial se filtra localmente: `const historyJobs = jobs.filter(j => j.status === 'done' || j.status === 'error');`.
- **Conflicto Potencial:** 
  - No existe actualmente un endpoint en el backend para "borrar" o "archivar" trabajos finalizados. Si solo se limpian en el estado de React (`setJobs`), el *polling* o una recarga de la página volverán a traer los 100 últimos trabajos del servidor.
- **Solución Propuesta:**
  1. **Frontend-only (Rápido):** Filtrar los IDs borrados en un estado local o `localStorage`.
  2. **Full-stack (Recomendado):** Implementar un endpoint `DELETE /jobs/history` en el backend (NestJS) que marque como "archived" o elimine físicamente los registros `Job` con estado `done` o `error` del usuario actual.

### B. Panel de Pujades
- **Archivo:** [PujadesPanel.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/components/Pujades/PujadesPanel.tsx)
- **Estado Actual:** 
  - Utiliza el contexto `UploadContext` ([UploadContext.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/context/Upload/UploadContext.tsx)).
  - Las subidas son volátiles (solo viven en la memoria del navegador durante la sesión). Al recargar desaparecen.
- **Solución Propuesta:**
  1. Añadir una función `clearHistory()` al `UploadContext` que ejecute: `setJobs(prev => prev.filter(j => j.status === 'uploading'))`.
  2. Invocar esta función desde un botón en el `PujadesPanel.tsx`.

---

## 3. Guía de Implementación para Claude

> [!IMPORTANT]
> **Instrucciones para Claude:**
> Utiliza tus **superpowers** de análisis profundo y **code-review** para validar la consistencia de los tipos de datos al modificar los contextos. Emplea la herramienta **debug** si encuentras problemas de sincronización en el polling de *Tasques IA* tras la limpieza.

### Paso 1: Modificar `UploadContext.tsx`
Añadir la capacidad de limpiar el historial en el sistema de subidas:
```typescript
// En UploadContextValue interface
clearHistory: () => void;

// En UploadProvider
const clearHistory = () => {
  setJobs(prev => prev.filter(j => j.status === 'uploading'));
};
```

### Paso 2: Interfaz de Usuario (UI)
En ambos archivos (`TasksIAPanel.tsx` y `PujadesPanel.tsx`):
1. Localizar el renderizado de la pestaña "Historial".
2. Añadir un contenedor sobre la lista de tareas que contenga el botón.
3. **Estética:** Usar un diseño acorde al sistema actual (botón pequeño, quizás con un icono de `Icons.Trash` o similar, texto "Netejar Historial").
4. **Lógica de visibilidad:** El botón solo debe aparecer si `historyJobs.length > 0` y la pestaña activa es `history`.

### Paso 3: El desafío del Backend (Tasques IA)
Para que la limpieza de *Tasques IA* sea real:
1. **Revisar el Backend:** Buscar el controlador de `Jobs` en NestJS.
2. **Nuevo Endpoint:** Crear algo como `DELETE /jobs/history`.
3. **Actualizar API Service:** Añadir el método en `frontend/services/api.ts`.

---

## 4. Posibles Errores y Conflictos

1. **Race Condition en Polling:** En `TasksIAPanel`, si se limpia el historial en el cliente pero no en el servidor, el siguiente `fetchJobs` (que ocurre cada 3s) sobreescribirá el estado local y el historial reaparecerá. **Es crítico que la limpieza sea persistente o que el filtro de "borrados" se mantenga activo.**
2. **Confirmación de Usuario:** Borrar el historial de "Error" puede ser contraproducente si el usuario no ha visto por qué falló una transcripción. Se sugiere un `window.confirm` o un pequeño modal de confirmación.
3. **Z-Index:** Ambos paneles son modales con `z-[500]`. Asegurarse de que cualquier diálogo de confirmación esté por encima.

---

**Informe generado por Antigravity.**
*Preparado para ejecución inmediata por Claude con capacidades de depuración avanzada.*
