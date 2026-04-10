# Informe Técnico: Persistencia y Gestión del Historial (Tasques IA & Pujades)

Este informe analiza la arquitectura actual de los paneles de historial y proporciona una hoja de ruta detallada para unificar su comportamiento, garantizando que los registros persistan tras recargar la página y solo se eliminen por acción explícita del usuario.

---

## 1. Resumen para el Desarrollador (Contexto de Negocio)

**Objetivo:** Unificar el comportamiento de los paneles "Tasques IA" y "Pujades" para que sus historiales sean persistentes. Actualmente, al recargar la página, el historial de subidas (Pujades) se pierde completamente, mientras que el de tareas (Tasques IA) se mantiene.

**Requerimiento del Usuario:** 
"La intención es que siempre se guarde el historial de ambos, y SOLAMENTE SE BORRE cuando EL USUARIO decidá eliminar-lo con el botón que hemos puesto expresamente para ello."

---

## 2. Análisis Técnico de la Implementación Actual

### A. Panel de "Tasques IA" (Persistencia Híbrida)
*   **Componente:** `TasksIAPanel.tsx`
*   **Funcionamiento:** 
    *   Los datos se recuperan del backend (base de datos). Esto garantiza que, al recargar, las tareas sigan existiendo.
    *   El "borrado" no borra el dato del servidor, sino que guarda los IDs en `localStorage.snlbpro_tasks_ia_hidden_ids`. 
    *   Al renderizar, el frontend filtra y oculta los IDs que están en esa lista de "borrados".
*   **Estado:** Funciona según el requerimiento, aunque el filtrado es solo local por navegador.

### B. Panel de "Pujades" (Memoria Volátil)
*   **Contexto:** `UploadContext.tsx`
*   **Funcionamiento:**
    *   El estado de las subidas vive únicamente en un `useState` dentro de la memoria del navegador.
    *   No hay persistencia en `localStorage` ni en base de datos.
    *   Al pulsar F5, el contexto se reinicia y el historial desaparece.
*   **Estado:** INCUMPLE el requerimiento de persistencia.

---

## 3. Hoja de Ruta para la Implementación (Guía para Claude)

### Tarea Principal: Persistencia en `UploadContext.tsx`
Para que el historial de subidas sobreviva a una recarga, se deben realizar los siguientes cambios en el contexto:

1.  **Carga Inicial:** Al arrancar el `UploadProvider`, debe intentar leer el historial previo de `localStorage`.
2.  **Guardado Automático:** Cada vez que el array de `jobs` cambie (nueva subida, actualización de progreso o finalización), se debe sincronizar con `localStorage`.
3.  **Gestión de Estados Huérfanos:** Al recargar la página, las subidas que estaban en estado `uploading` deben marcarse automáticamente como `error` o `interrumpidas`, puesto que el proceso real de subida se cortó al cerrar la sesión anterior. Solo los estados `done` y `error` deben ser visibles en el historial persistido.

### Tarea Secundaria: Revisión de `TasksIAPanel.tsx`
1.  Verificar que el límite de 100 tareas (`limit: 100`) sea suficiente o si se requiere un sistema de paginación para historiales muy largos.

---

## 4. Conflictos y Errores a Vigilar

*   **Corrupción de JSON:** Al leer de `localStorage`, es vital usar `try/catch` para evitar que un dato corrupto rompa la aplicación entera.
*   **Límites de Espacio:** El `localStorage` tiene un límite de ~5MB. El historial no debe crecer infinitamente; se recomienda mantener solo los últimos 50 registros de subidas.
*   **Consistencia de Tipos:** Asegurarse de que las fechas (ISO Strings) se manejen correctamente al serializar/deserializar.

---

## 5. Instrucciones Pro de Ejecución (Superpowers Prompt)

Si vas a delegar esta tarea a **Claude**, asegúrate de incluir lo siguiente en el prompt:

> "Activa tus **superpowers** de **Deep Debugging** y **Code-Review**. 
> 
> 1. Analiza `UploadContext.tsx` y propón una implementación robusta de persistencia usando `localStorage` que incluya manejo de errores (`try/catch`) y filtrado de estados 'zombie' (subidas que se quedaron en 'uploading' al cerrar la pestaña).
> 2. Realiza un **Code-Review** del sistema de filtrado en `TasksIAPanel.tsx` para asegurar que el uso de `hiddenJobIds` no impacte el rendimiento si la lista crece mucho.
> 3. Utiliza la herramienta **debug** para simular una recarga de página y verificar que el historial de subidas aparece correctamente tras la modificación."

---
**Informe generado por Antigravity.**
*Este documento es una guía técnica para la mejora de la persistencia del sistema.*
