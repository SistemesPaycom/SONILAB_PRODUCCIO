# Backend Library — contrato local para Claude

Este archivo aplica a `backend_nest_mvp/src/modules/library/`.

## 1. Modelo funcional local

### Media canónica
Documento con:
- `media` poblado
- `refTargetId` vacío/null

### Documento clásico
Documento con:
- `media` vacío/null
- `refTargetId` vacío/null

### LNK
Documento con:
- `refTargetId` poblado
- `media: null`

## 2. Reglas que NO debes romper

1. `createMediaRef` solo acepta targets con `media` poblado.
2. Delete y purge deben proteger integridad de LNK.
3. La validación debe considerar el conjunto total efectivo del lote si se pasa `batchDocIds`.
4. Borrar/purgar un LNK nunca debe afectar al asset original.
5. Si el lote incluye media + sus LNK, no debe bloquear por sí solo.
6. Si quedarían LNK vivos fuera del lote, sí debe bloquear.

## 3. Entry points sensibles

- `softDeleteDocument`
- `softDeleteFolderTree`
- `purgeDocument`
- `purgeFolderTree`
- `createMediaRef`
- endpoints controller que reciben `batchDocIds`

Antes de tocar uno, revisa los otros tres para no dejar una asimetría.

## 4. batchDocIds

`batchDocIds` ya forma parte del contrato práctico de delete/purge.

Úsalo para excluir del conteo:
- LNK que forman parte del mismo lote
- y evitar falsos bloqueos en operaciones coherentes

No lo elimines ni lo ignores sin instrucción explícita.

## 5. Reglas de implementación

- Backend debe ser la autoridad final en integridad
- Los mensajes de error deben ser claros
- No conviertas esto en un sistema grande de dependencias
- No metas cascadas automáticas de borrado de LNK
- No hagas hard delete en cadena

## 6. No regresión

No romper:
- restore
- soft delete
- purge
- create/update document
- create/update folder
- listados de media
- proyectos que dependen de folder/media/srt/guion
