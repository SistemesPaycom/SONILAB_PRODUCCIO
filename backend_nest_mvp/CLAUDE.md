# Backend Nest MVP — reglas de trabajo para Claude

Este archivo complementa `SONILAB_PRODUCCIO/CLAUDE.md` y aplica a `backend_nest_mvp/`.

> **Git — regla heredada del CLAUDE.md raíz:** NO hagas commits, ramas, push ni ninguna operación de git/GitHub a menos que el usuario lo pida EXPLÍCITAMENTE.

## 1. Principio rector

En backend debes preferir:
- validaciones autoritativas y pequeñas
- guardas antes de dejar estados inconsistentes
- mantener contratos API existentes
- no convertir una corrección local en un rediseño del módulo

## 2. Reglas de diseño

1. Si una integridad funcional importa, protégela en backend aunque también exista guarda en frontend.
2. Si un cambio afecta a delete/purge, piensa en:
   - soft delete
   - purge
   - lotes
   - folders
   - documentos sueltos
3. Si el frontend opera por lote, el backend debe poder razonar sobre ese lote.
4. No metas lógica grande en controllers si puede vivir en service.

## 3. Riesgos típicos

- tratar media y documento clásico con la misma operación genérica sin guardas
- validar solo el documento individual y olvidar árbol/lote
- dejar integridad referencial rota con LNK
- suponer que `sourceType` basta para distinguir comportamientos
- tocar endpoints sin revisar el helper `api.ts` correspondiente

## 4. Reglas de no regresión

No romper:
- contratos REST existentes salvo ampliación mínima y compatible
- `@Body('batchDocIds')` en delete/purge si ya existe
- soft delete y restore
- purge
- `createMediaRef`
- módulos de projects
- módulos de media si no están en alcance

## 5. Convenciones

- Services: lógica de negocio real
- Controllers: traducción fina de request/response
- Cambios pequeños
- Mensajes de error claros y útiles para frontend
- Sin “optimizar” o reestructurar si no aporta valor funcional

## 6. Módulos sensibles

- `src/modules/library/`
- `src/modules/projects/`

Lee siempre su `CLAUDE.md` local antes de tocar esos módulos.
