# Frontend — reglas de trabajo para Claude

Este archivo complementa `SONILAB_PRODUCCIO/CLAUDE.md` y aplica a todo `frontend/`.

> **Git — regla heredada del CLAUDE.md raíz:** NO hagas commits, ramas, push ni ninguna operación de git/GitHub a menos que el usuario lo pida EXPLÍCITAMENTE.

## 1. Prioridad

En frontend prioriza:
- no romper vistas existentes
- no contaminar estado compartido
- no mezclar lógica entre tabs
- no cambiar más UI de la necesaria

## 2. Principios de trabajo

1. No rediseñes la UI si el problema es funcional.
2. No cambies layout, densidad visual o estilos salvo que el bug dependa de ello.
3. Si una corrección puede vivir en un componente local, no la muevas al contexto.
4. Si una vista depende de una variable derivada, usa la misma variable para render, selección y acciones.

## 3. Riesgos típicos a vigilar

- usar `currentItems` cuando la vista real usa un subconjunto filtrado
- mezclar tabs (`library`, `media`, `projects`) con una misma semántica
- resolver un LNK como si fuera media canónica
- dejar handlers alternativos sin guardas (single click vs double click, toolbar vs menú fila)
- arreglar solo render y olvidar selección/acciones

## 4. Reglas de no regresión

No romper:
- navegación entre tabs
- selección múltiple
- `itemsToRender`
- `handleSelectAll`
- `isAllSelected`
- modales ya funcionales
- preview/open de documentos válidos
- LNK válidos
- toasts/errores ya existentes

## 5. Flujo recomendado antes de tocar nada

1. Localiza el entry point real del comportamiento.
2. Comprueba si ya existe una guarda parecida en otra ruta paralela.
3. Decide si el problema es de:
   - render
   - selección
   - acción visible
   - handler de apertura
   - sincronización de estado
4. Cambia lo mínimo posible.
5. Revisa si existe otra ruta hermana que deba quedar simétrica.

## 6. Carpetas sensibles

- `components/Library/`: no mezclar Media con Arxius
- `context/Library/`: no contaminar estado compartido
- `components/Projects/`: proteger UX de proyecto

Lee el `CLAUDE.md` local de la subcarpeta antes de tocar esas zonas.
