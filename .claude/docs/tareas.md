# Tareas del proyecto

Este archivo es la **fuente única de verdad sobre el futuro del proyecto**.
Las tareas NO se borran al completarse: se MUEVEN de PENDIENTE a TERMINADO.
Las fechas son SIEMPRE absolutas (YYYY-MM-DD), nunca relativas.

---

## 🟡 PENDIENTE

> Ordenado por recomendación de ataque: de más rápido/desbloqueante a más grande.

## 1. Mode Duo + estacionari: model de ratolí alternatiu *(2026-07-07)*

**Síntoma / Contexto:** El nou model de ratolí de l'editor de subtítols (clic = seek sense recentrar · doble clic = seleccionar · arrossegar = moure/redimensionar · modificador+clic = fixar cues) depèn del **page-follow**. En mode **ESTACIONARI** (que recentra la vista a cada seek) el clic i el doble-clic no funcionen igual perquè la vista fuig.
**Plan:** Decidir/implementar el comportament de ratolí per a estacionari — probablement estil **Ctrl+clic per editar** (l'esquema original de l'usuari) — o assumir que estacionari és un mode "llegat" amb interacció limitada. De moment, el mode **Duo/estacionari** queda amb el comportament ACTUAL; per defecte el programa arrenca en mode **Pàgina** (nou), on tot el nou esquema funciona.
**Archivos afectados:** editor de subtítols (visualitzador d'ona) — mode de scroll (page vs estacionari) i handlers de ratolí.
**Riesgo:** medio
**Tamaño:** medio

## 2. Presets d'interacció de ratolí page vs duo *(2026-07-07)*

**Síntoma / Contexto:** Potser cal separar explícitament els presets d'interacció de ratolí per mode (page vs duo) en comptes de derivar-los del mode de scroll actiu.
**Plan:** Avaluar si val la pena un preset explícit per mode o mantenir la derivació actual.
**Riesgo:** bajo
**Tamaño:** pequeño

### Tareas manuales del usuario

<!-- Cosas que requieren acción humana fuera del código -->

### Informacionales (no tocar)

<!-- Decisiones tomadas de NO hacer algo, documentadas para que no se reabran sin contexto -->

## Notes de disseny — dreceres vs ratolí *(2026-07-07)*

- Les **dreceres de teclat** (nudges Alt/Alt+Shift+fletxes, F9–F12, Ctrl+fletxes, Ctrl+Shift+M, Ctrl+Alt+V, etc.) són **independents del mode de scroll** → un sol joc, vàlid a pàgina i estacionari. No cal preset per mode per al teclat.
- El que és dependent del mode és **només el ratolí**.
- Documents relacionats: `Shortcuts Subtitols - Consolidat.csv`.

---

## ✅ TERMINADO

> Histórico de tareas cerradas. Más reciente arriba.

<!-- Ejemplo:
## N. Título *(cerrada 2026-05-25)*

**Qué cambió al cerrarla:** ...
-->
