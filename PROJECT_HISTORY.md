# PROJECT_HISTORY.md

# Sonilab — historia resumida del proyecto y continuidad técnica

## Propósito de este documento

Este archivo no define el producto entero. Su función es dar continuidad histórica a una IA o colaborador técnico que entra en el proyecto sin contexto previo.

Debe servir para entender:

- qué decisiones importantes ya se tomaron
- qué problemas reales ya aparecieron
- qué se cerró en Fase 1
- qué se contuvo en Fase 2
- qué NO debe reabrirse sin motivo
- desde dónde debe arrancar la siguiente fase

---

## Resumen histórico

El sistema de biblioteca evolucionó intentando hacer convivir dos modelos distintos dentro de una misma UI y un mismo árbol de trabajo:

1. **media deduplicada tratada como asset canónico**
2. **sistema clásico de archivos con copiar / cortar / pegar / duplicar**

Mientras esa mezcla fue poco exigida, parecía tolerable. Pero en cuanto se empezó a usar de forma más seria con vídeo/audio, aparecieron contradicciones funcionales claras.

La tensión principal fue esta:

- backend y modelo de media empujaban hacia asset canónico
- frontend y algunas acciones visibles seguían empujando hacia fichero clásico

Eso generó UX engañosa y caminos incoherentes.

---

## Fase 1 — definición funcional del modelo

## Objetivo de Fase 1

Cerrar, sin escribir implementación grande, la definición funcional de:

- Media
- Arxius
- LNK
- Projectes

## Conclusiones cerradas en Fase 1

### Media
- repositorio canónico de vídeo/audio
- deduplicado
- no debe comportarse como fichero clásico duplicable
- su reutilización correcta no es “copiar binario”, sino referenciar o reutilizar asset

### Arxius
- sistema clásico de trabajo
- aquí sí encajan `txt`, `srt`, `pdf`, `docx` y similares
- copiar / cortar / pegar / duplicar reales tienen sentido aquí

### LNK
- referencia desde Arxius hacia Media
- no duplica binario
- debe distinguirse visualmente
- puede convivir con documentos clásicos
- si se copia/duplica, duplica la referencia, no el media

### Projectes
- se mantiene como capa propia
- no se fusiona con Media
- no desaparece
- sigue relacionando carpeta, media, srt, guion y estado

## Resultado de Fase 1

La separación funcional quedó fijada:

- **Media ≠ Arxius**
- **LNK = puente**
- **Projectes se conserva**

Esta fase quedó cerrada y no debe reabrirse salvo evidencia fuerte de contradicción real.

---

## Fase 2 — contención del sistema actual

## Objetivo de Fase 2

Parar la hemorragia de comportamientos engañosos sin rediseñar todavía toda la arquitectura.

No se buscaba rehacer el sistema entero, sino impedir que la UI siguiera prometiendo cosas incompatibles con el modelo ya fijado.

## Problemas reales que se detectaron

Entre los problemas que aparecieron en el sistema real:

- media canónica tratada como si pudiera copiarse/cortarse como fichero clásico
- `copy/paste` y `cut/paste` capaces de mover o duplicar media de forma incoherente
- `POST /documents/:id/ref` aceptando targets no media
- drag/drop genérico de media hacia carpetas
- subida de media por flujos de Arxius
- entrada de documentos clásicos por la pestaña Media
- mezcla de LNK y media en los listados
- selección y acciones de lote usando conjuntos no alineados con lo visible
- borrado y purge capaces de dejar LNK activos rotos
- LNK huérfanos que podían seguir comportándose como si su target existiera

---

## Contenciones aplicadas en Fase 2

### 1. Acciones clásicas sobre media canónica
Se ocultaron / bloquearon acciones engañosas sobre media canónica:
- `Copiar`
- `Retallar`

tanto en menú contextual como en toolbar.

### 2. Clipboard clásico
Se endurecieron:
- `copy/paste`
- `cut/paste`

para que media canónica no entre en esos flujos y los lotes se validen de forma atómica.

### 3. Referencias
`POST /documents/:id/ref` pasó a aceptar solo targets con `media` poblado.

### 4. Drag/drop genérico
Se bloquearon rutas de drag/drop genérico para media canónica.

### 5. Entrada de media y documentos
Se cerró la separación bidireccional:
- media ya no entra por `library/projects`
- documentos clásicos ya no entran por `media`

Además, al entrar en pestaña `media`, `currentFolderId` dejó de arrastrar una carpeta previa de Arxius.

### 6. Listados y clasificación
Se alineó la clasificación visible:
- `media` lista solo media canónica real
- `media` no lista LNK
- `library/projects` no listan media canónica como si fuera Arxius

### 7. Selección y acciones
Se alinearon:
- `itemsToRender`
- `handleSelectAll`
- `isAllSelected`

para que lo no visible no contaminara la lógica de selección.

### 8. Delete y purge
Se introdujo razonamiento por **conjunto total efectivo**:
- soft delete
- purge
- documento
- carpeta
- lotes mixtos

La validación pasó a permitir:
- borrar media junto con sus LNK si forman parte del mismo lote

y a bloquear:
- borrar/purgar media si quedarían LNK activos fuera del lote

### 9. LNK huérfanos
Se contuvo el comportamiento de LNK rotos:
- no abren
- no previsualizan
- no muestran “ubicación real”
- se marcan visualmente como referencia rota
- siguen pudiendo seleccionarse y borrarse

---

## Resultado de Fase 2

Fase 2 dejó contenidas las superficies críticas de mezcla entre Media, Arxius y LNK:

- listados
- acciones visibles
- selección
- clipboard clásico
- drag/drop genérico
- entrada de ficheros
- delete/purge
- apertura de LNK huérfanos

El cierre técnico de Fase 2 se basa en que ya no quedan fugas funcionales relevantes en esas superficies.

---

## Decisiones que NO deben reabrirse

No deben reabrirse sin evidencia fuerte:

1. **Media no es un fichero clásico dentro de Arxius.**
2. **LNK es el mecanismo correcto para llevar media a Arxius sin duplicar binario.**
3. **Projectes no se simplifica ni se fusiona con Media.**
4. **Delete/purge deben proteger integridad referencial.**
5. **La contención de Fase 2 prima honestidad funcional sobre conveniencia de UX provisional.**

---

## Qué no resolvía Fase 2

Fase 2 no pretendía cerrar todavía:

- arquitectura final de Media como módulo completo
- UX final refinada de creación y gestión de LNK
- diseño final de menús y acciones de biblioteca
- reorganización completa de drag/drop
- evolución futura de formatos y exportación
- rediseños grandes del flujo documental o audiovisual

Eso pertenece a fases posteriores.

---

## Punto de arranque para la siguiente fase

La siguiente fase debe partir de estas verdades ya cerradas:

- el modelo funcional está definido
- la contención crítica ya está aplicada
- no hace falta volver a discutir si Media y Arxius deben separarse
- no hace falta seguir parcheando Fase 2 salvo que aparezca una fuga real nueva
- lo siguiente ya debe orientarse a construcción correcta, no a apagar incendios

---

## Regla práctica para futuras IAs

Si entras en este proyecto en una fase posterior:

- no repitas toda la auditoría histórica desde cero
- no trates Fase 2 como “aún abierta” salvo evidencia real
- usa este documento para entender qué ya se decidió y por qué
- parte del cierre de Fase 1 y Fase 2 como baseline
- concentra el esfuerzo en la fase nueva, no en reabrir contenciones ya cerradas
