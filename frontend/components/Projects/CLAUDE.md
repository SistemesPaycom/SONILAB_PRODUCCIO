# Frontend Projects — reglas para Claude

Este archivo aplica a `frontend/components/Projects/`.

> **Git — regla heredada del CLAUDE.md raíz:** NO hagas commits, ramas, push ni ninguna operación de git/GitHub a menos que el usuario lo pida EXPLÍCITAMENTE.

## 1. Principio rector

Projectes es una capa propia.  
No lo simplifiques a “solo una carpeta” aunque use una carpeta como anclaje visual.

## 2. Qué no debes romper

- creación de proyecto
- flujo desde media existente
- relación con SRT
- relación con guion
- estados del proyecto
- sub-vista de projects en biblioteca

## 3. Relación con biblioteca

Projectes puede apoyarse en Arxius, pero:
- no debe fusionarse con Media
- no debe absorber la semántica de Media
- no debe perder compatibilidad con LNK

## 4. Riesgos típicos

- tocar un flujo de biblioteca y romper creación de proyecto
- asumir que una carpeta de proyecto es solo una carpeta normal
- tocar modales de proyecto por un problema que era de Library
- romper apertura de media o SRT asociados

## 5. Regla de alcance

Si un cambio de biblioteca no exige tocar `components/Projects/`, no la toques.  
Si la tocas, el cambio debe ser mínimo y defensivo.

## 6. No regresión

No romper:
- CreateProjectModal
- carga de guion
- media existente
- proyectos desde SRT existente
- estados de proyecto
