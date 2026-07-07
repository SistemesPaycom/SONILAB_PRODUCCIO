# Historia del proyecto

Memoria larga del proyecto. NO es un diario de commits (git ya hace eso).
Solo se anota lo que merece la pena recordar para entender el "porqué" del estado actual.

Categorías que SÍ van aquí:
1. Bugs gordos resueltos (sobre todo si la causa raíz fue rara o contraintuitiva)
2. Decisiones arquitectónicas grandes
3. Hitos del proyecto (features grandes, integraciones, sub-proyectos cerrados)
4. Incidencias (cosas que se rompieron y cómo se reaccionó)

Orden: cronológico inverso (más reciente arriba).
Fechas: absolutas, en el encabezado de cada entrada.

---

<!-- Plantilla canónica de entrada:

## YYYY-MM-DD — Título corto

**Tipo:** bug resuelto | decisión arquitectónica | hito | incidencia

**Síntoma / Contexto:**
Qué pasaba, por qué era un problema, en qué situación apareció.

**Lo que NO funcionó:**
- Intento A — por qué falló
- Intento B — por qué falló
(Esta sección es la más valiosa: evita que alguien repita el mismo callejón sin salida.)

**Solución:**
Qué se hizo finalmente. Snippets, archivos tocados, valores concretos.

**Archivos tocados:**
- `ruta/al/archivo.ts`
- ...

**Lección:**
La regla generalizable que se aprende, redactada para que sirva en problemas futuros similares.

**Follow-ups (movidos a tareas.md):**
- ...

-->

## 2026-07-07 — Limpieza del repo y adopción del modelo `.claude`

**Tipo:** incidencia + decisión arquitectónica

**Síntoma / Contexto:**
La rama `ModificacionesMarcJulio2026` (subconjunto reducido de `main`) no tenía `.gitignore` ni `CLAUDE.md` raíz, tenía ~5.74 GB de media (`backend_nest_mvp/SonilabData/`) commiteados en el historial que impedían el push (GitHub rechaza archivos >100 MB), y arrastraba artefactos de skills (`docs/`, `.playwright-mcp/`) y archivos con nombre corrupto.

**Solución:**
- `.gitignore` raíz nuevo: ignora `docs/`, `.superpowers/`, `.playwright-mcp/`, `SonilabData/`, builds, logs. Se conservan `.vscode/` y `.claude/` (decisión propia de esta rama, opuesta a `main`).
- Purga de los 5.74 GB del historial con `git filter-branch --index-filter`.
- `CLAUDE.md` raíz traído de `main` y luego **fusionado** con el modelo genérico `0000_MODELO_PROYECTO_CLAUDE` (constitución operativa + contexto de producto Sonilab).
- Adoptada la estructura `.claude/` del modelo (settings, docs/tareas.md, docs/history.md, to_claude, commands, skills).

**Lección:**
Datos de runtime (media de usuario) nunca en git. La media vive fuera del repo; `SonilabData/` está en `.gitignore` en ambas ramas.
