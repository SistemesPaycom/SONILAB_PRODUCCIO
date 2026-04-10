# Backend Projects — reglas para Claude

Este archivo aplica a `backend_nest_mvp/src/modules/projects/`.

> **Git — regla heredada del CLAUDE.md raíz:** NO hagas commits, ramas, push ni ninguna operación de git/GitHub a menos que el usuario lo pida EXPLÍCITAMENTE.

## 1. Naturaleza del módulo

Projectes es una entidad propia con semántica propia.  
No la simplifiques ni la mezcles con `library` o `media`.

## 2. Relaciones que NO debes romper

Cada proyecto se apoya en referencias explícitas como:
- `folderId`
- `mediaDocumentId`
- `srtDocumentId`
- `guionDocumentId` (opcional)

Estas relaciones son clave y deben mantenerse coherentes.

## 3. Reglas de trabajo

1. No conviertas Project en un Document.
2. No conviertas su carpeta contenedora en la entidad proyecto.
3. No mezcles la lógica del proyecto con Media aunque apunte a media.
4. No des por hecho que una corrección de biblioteca debe tocar este módulo.

## 4. Riesgos típicos

- romper create project por cambios en library
- invalidar `mediaDocumentId`
- invalidar `srtDocumentId`
- tocar flujos de guion sin necesidad
- mezclar delete/purge de library con semántica de proyecto

## 5. No regresión

No romper:
- `POST /projects`
- `POST /projects/from-existing`
- vínculo con guion
- estados `created/processing/ready/error`
- relación con carpeta de proyecto
- relación con media y srt
