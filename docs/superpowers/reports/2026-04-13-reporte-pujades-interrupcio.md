# Reporte: Gestión de Interrupciones en Subidas (Pujades)

Este informe detalla la situación actual de la funcionalidad de subida de archivos y las mejoras necesarias para garantizar una experiencia de usuario segura y un backend libre de archivos huérfanos tras interrupciones (recargas, cierres de pestaña o fallos de red/energía).

---

## 1. Explicación para Claude (Contexto de Negocio)

Actualmente, cuando un usuario sube un vídeo/audio y recarga la página, la subida se corta abruptamente sin previo aviso. Esto genera incertidumbre en el usuario y puede dejar archivos parciales en el servidor que consumen espacio inútilmente.

El objetivo es implementar una doble capa de seguridad:
1.  **Frontend (Preventiva):** Avisar al usuario mediante un mensaje de confirmación si intenta abandonar la página mientras hay subidas activas.
2.  **Backend (Correctiva/Robustez):** Asegurar que cualquier archivo que no se haya completado correctamente sea eliminado del disco, incluso si el fallo es crítico (corte de luz del cliente, caída del servidor). No podemos confiar únicamente en el evento de "cancelar" del navegador.

Se requiere que el asistente analice el ciclo de vida de la subida desde que se selecciona el archivo hasta que se registra en la base de datos, implementando mecanismos de limpieza para los casos en que este ciclo se rompa.

---

## 2. Análisis Técnico Detallado

### 2.1. Frontend: Estado Actual e Interrupciones
He identificado los componentes clave que gestionan el estado de las subidas:

#### [MODIFY] [UploadContext.tsx](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/context/Upload/UploadContext.tsx)
Este archivo ya detecta subidas interrumpidas al recargar, pero solo *a posteriori*:
```tsx
// Línea 33
return parsed.map(j =>
  j.status === 'uploading'
    ? { ...j, status: 'error' as const, error: 'Subida interrompuda', ... }
    : j
);
```
**Acción Necesaria:** Implementar un listener de `beforeunload` dentro del `UploadProvider` que compruebe si `jobs.some(j => j.status === 'uploading')`. Si es así, debe ejecutar `e.preventDefault()` y mostrar el mensaje estándar del navegador.

#### [MODIFY] [api.ts](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/frontend/services/api.ts)
La función `uploadMedia` utiliza `XMLHttpRequest`, lo cual es ideal porque permite cancelación:
```tsx
// Línea 198
const xhr = new XMLHttpRequest();
// ...
xhr.send(fd);
```
**Acción Necesaria:** La función debe devolver un objeto que incluya la `Promise` y un método `abort()`. Esto permitirá que el `UploadContext` o el componente `PujadesPanel` cancelen la petición de red si el usuario decide cancelar manualmente la subida.

---

### 2.2. Backend: Gestión de Archivos Huérfanos
El controlador de media gestiona las subidas de la siguiente manera:

#### [MODIFY] [media.controller.ts](file:///d:/MisProgramas/Sonilab_transcriptions/SONILAB_PRODUCCIO/backend_nest_mvp/src/modules/media/media.controller.ts)
Usa Multer con `diskStorage`, lo que escribe el archivo en el disco real en tiempo real:
```tsx
// Línea 108
storage: diskStorage({ ... })
```
**Problema Detectado:** Si la conexión se pierde a mitad de subida, Multer puede dejar el archivo parcial en la carpeta de media. Como el documento en la base de datos solo se crea al finalizar con éxito (Línea 177), nunca se genera una referencia a ese archivo parcial, convirtiéndolo en "basura" persistente.

**Soluciones Propuestas:**
1.  **Limpieza por Huérfanos (Recomendado):** Implementar una tarea programada (cron job) o un proceso al arranque que escanee la carpeta de media y compare los archivos físicos con los registros de `media.path` en la colección `documents`. Cualquier archivo que no tenga registro (y sea mayor de X horas para no borrar subidas activas) debe ser eliminado.
2.  **Manejo de Aborto:** Escuchar el evento `close` del request en el controlador para intentar ejecutar `fs.unlinkSync(file.path)` si la subida no se completó. *Nota: Esto no cubre el caso de "corte de luz" del servidor.*

---

## 3. Instrucciones para la Implementación (Guía para Claude)

> [!IMPORTANT]
> Se debe utilizar el modo **superpowers debug** para simular desconexiones de red (usando las DevTools si es posible o simplemente abortando el proceso) y verificar que el backend reaccione correctamente o que el proceso de limpieza identifique el archivo fallido.
> Asimismo, realiza un **code-review** de cómo Multer gestiona los errores de stream para no duplicar lógica de borrado innecesaria.

Claude debe:
1.  **Frontend:** Añadir el mensaje de emergencia en `beforeunload` solo cuando haya subidas en curso.
2.  **Frontend:** Mejorar `api.uploadMedia` para permitir la cancelación activa de subidas.
3.  **Backend:** Diseñar una lógica de limpieza de "archivos huérfanos" (Orphan Cleanup Service). El criterio de seguridad debería ser: *Si el archivo físico existe en la carpeta de media, pero no existe ningún documento en la DB que lo use, y el archivo tiene más de 12 horas de antigüedad, bórralo.*
4.  **Backend:** Considerar el uso de una carpeta temporal para subidas en curso, moviéndolas a la carpeta final solo tras el éxito.

---
**Reporte generado por:** Antigravity (Advanced Agentic Coding)
**Fecha:** 2026-04-13
