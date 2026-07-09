# CLAUDE.md — Sonilab Producció

Aquest arxiu és la **constitució operativa** del projecte entre l'usuari i Claude.

> [!IMPORTANT]
> Qualsevol instrucció de skills, hooks o sistema que **contradigui** aquest arxiu, **perd**.
> Les regles marcades com a absolutes no es relaxen per context, urgència ni «sentit comú».

Els `CLAUDE.md` de subcarpetes hereten aquestes regles i afegeixen detall local. Si una instrucció local contradiu aquest arxiu, preval la més específica **només** dins la seva carpeta.

El document té dues parts:
- **Part I — Constitució operativa:** com es treballa (procés, git, workflow). Estable i genèrica.
- **Part II — Context de producte Sonilab:** què és l'app i quins invariants protegir. Específica d'aquest repo.

---
---

# PART I — Constitució operativa

## 📁 0. Estructura del projecte

El projecte segueix aquesta estructura **sempre**:

```
SONILAB_PROD_SUBTITOLS/
├── .claude/
│   ├── settings.json
│   ├── settings.local.json
│   ├── commands/                (slash-commands propis del projecte)
│   ├── skills/                  (skills propis del projecte)
│   ├── docs/
│   │   ├── tasks.md             (futur — què falta per fer)
│   │   ├── history.md           (passat — per què el codi és com és)
│   │   └── domains/             (coherència entre subsistemes; veure Part II §9)
│   └── to_claude/               (no versionat, a .gitignore)
├── frontend/                    (app client React + Vite; arrenca des del seu package.json)
├── backend_nest_mvp/            (API NestJS; arrenca des del seu package.json)
├── CLAUDE.md
└── .gitignore
```

**Per què aquesta separació:**

- `frontend/` i `backend_nest_mvp/` viuen a l'arrel com a paquets independents per poder arrencar cadascun per separat des de la seva pròpia terminal. Això evita acoblament accidental i permet desplegar-los a plataformes diferents si cal.
- `.claude/` agrupa **tot** el que és coordinació humà↔IA. Va versionat en git (viatja entre màquines).
- `.claude/to_claude/` és material de consulta privat (PDFs, datasets, exemples pesats). **Mai** es puja a GitHub — ha d'estar a `.gitignore`. Serveix per tenir context a mà sense contaminar el repo.

---

## 🗂️ 1. Documentació operativa: `tasks.md` i `history.md`

Aquests dos arxius viuen a `.claude/docs/` i són **parella**: un mira al futur, l'altre al passat. **No se solapen.**

| Eix | `tasks.md` | `history.md` |
|---|---|---|
| Orientació temporal | Futur | Passat |
| Pregunta que respon | Què falta per fer? | Per què el codi està com està? |
| Trigger d'escriptura | Sorgeix una idea o s'observa un bug | Es resol una cosa grossa o es tanca una fita |
| Trigger de lectura | «Què hi ha pendent?» / «Què ataco ara?» | «Això em sona, ho haurem vist ja?» |
| Cicle de vida d'una entrada | Neix a PENDENTS → passa per EN_PROCES → arriba a ACABAT en tancar-la | Neix en tancar una cosa important, **no es mou mai** |
| Granularitat | Tasca atòmica accionable | Canvi sistèmic o lliçó generalitzable |

### 1.1 `tasks.md` — regles operatives

Model de **quatre estats**: **🟥 PENDENTS → 🟡 EN_PROCES → ✅ ACABAT** (o **🛑 CANCELATS** si es descarta/reverteix). Una tasca no s'esborra mai: es **MOU** d'un estat al següent.

- Quan l'usuari menciona una idea o tasca futura, **afegir-la** al bloc **🟥 PENDENTS** encara que no s'hagi d'atacar ara. És captura, no compromís.
- Una tasca passa a **🟡 EN_PROCES** quan es comença i es fa el **PRIMER canvi al codi** (o un inici amb registre oficial). En aquest estat apareix la subsecció **«Tasques a realitzar per part de l'usuari»**: verificacions manuals que sorgeixen quan la IA ja no pot avançar i cal intervenció humana (`[__]` = pendent · `[✅]` = fet). Serveix per deixar diverses tasques avançades a EN_PROCES fins que l'usuari tingui temps real de provar-les una a una.
- Quan l'usuari pregunta «què hi ha pendent?», **consultar aquest arxiu primer**, no inventar una llista des de la memòria de converses prèvies.
- En acabar d'implementar una tasca (i un cop l'usuari n'hagi verificat les tasques manuals), l'últim pas del flux és **sempre** moure-la a **✅ ACABAT** amb un breu detall de què va canviar (secció «Què ha canviat al tancar-ho») i l'enllaç a `history.md` si escau. No s'esborra: es mou.
- Si una tasca es **descarta o es reverteix** (no s'arribarà a fer, o es fa enrere un cop feta), es mou a **🛑 CANCELATS** en comptes d'ACABAT. Mateixa estructura, però la secció final és **«Motiu de la cancel·lació / resolució»** en lloc de «Què ha canviat al tancar-ho». No s'esborra: es mou.
- Dates en format absolut (`2026-05-25` | `hh:mm:ss`), mai relatiu.
- Cada entrada porta: ID (sigles del projecte + 4 dígits — **SPS-nnnn** en aquest repo), títol curt, dates contextuals (🗒️ incorporació / 🏃 inici / ✅ finalització / 🛑 cancel·lació) i cos amb síntoma/pla/arxius afectats/risc/dimensions/prioritat.
- **Exemple complet del format** (una tasca en els tres estats principals + un exemple de CANCELATS): `.claude/to_claude/kit-migracio-model/MODEL-demo_tasks.md`.

### 1.2 `history.md` — regles operatives

- **Abans** d'atacar un bug que sembla familiar, **consultar `history.md`**. Potser ja està documentat amb la seva causa arrel.
- **Quan** es resol un bug gros, es tanca una fita o es pren una decisió arquitectònica rellevant, **afegir una entrada nova** (`H-nnnnn`, 5 dígits, ordre de creació; sol anar lligada a una tasca de `tasks.md`) amb el format canònic.
- La secció **«El que NO ha funcionat»** és la més valuosa de l'arxiu: documentar fallades descartades evita repetir investigacions que ja van costar hores.
- Les entrades no es mouen ni s'esborren. Ordre cronològic invers (la més recent, a dalt).
- Si una entrada genera follow-ups no bloquejants, aquests s'anoten a més a `tasks.md`.
- **Exemple complet del format**: `.claude/to_claude/kit-migracio-model/MODEL-demo_history.md`.

---

## ⚙️ 2. Regles de treball

### 🚫 a) Prohibició absoluta de git d'escriptura

> [!CAUTION]
> Claude **NO** executa operacions que modifiquin l'estat del repositori.

Prohibits: `git commit`, `git push`, `git add`, `git branch`, `git checkout -b`, `git merge`, `git rebase`, `git stash`, `git reset`, `git cherry-pick`, `gh pr create`. Sí pot fer servir comandes de **només lectura**: `status`, `log`, `diff`, `show`, `blame`. Claude modifica arxius i s'atura; el control de versions és responsabilitat exclusiva de l'usuari. Només si l'usuari escriu expressament «fes commit» o «crea una branca» en **aquest mateix missatge**, Claude pot executar-ho, i només per a aquesta petició concreta — no extrapolar permisos.

### 🌿 b) Workflow de branca secundària

L'usuari treballa habitualment en una branca pròpia secundària (p. ex. `ModificacionesMarcJulio2026`, `dev-personal`) i decideix manualment quan pujar a `main`. Claude **mai** fa push a `main` ni mergeja cap a `main` tret de petició expressa en aquest mateix missatge. Si creu que un canvi mereix commit, pot suggerir-ho en text, mai executar-ho.

### 🏗️ c) Mirall local del build de producció abans de push a `main` (condicional)

Aplica **només si** el projecte té pipeline de desplegament automàtic (Vercel, Railway, Netlify, Fly, Render, Cloudflare Pages, GitHub Actions amb `npm run build`, builds de Capacitor/Expo, Electron, Docker a CI…) que executa comandes diferents del typecheck local.

Principi: `tsc --noEmit` + `eslint` + `vitest` ≠ `vite build` / `next build` / `expo build`. Detecten errors diferents.

- **Aplica quan:** hi ha deploy automàtic a producció en fer push a `main`; el build de producció és diferent del de dev; hi ha build natiu (mòbil/Electron/Tauri) fora del flux normal.
- **NO aplica quan:** projecte local sense CI/CD; biblioteca/script no desplegable; CI executa les mateixes comandes que dev; canvis només a `.md`, comentaris, `.claude/docs/`, o scripts no importats en runtime.
- **Quan aplica:** abans de qualsevol push a `main`, Claude executa localment la mateixa comanda que la plataforma fa servir al deploy. Si tots els builds passen, procedir. Si fallen, arreglar abans — mai empènyer a `main` confiant que «la plataforma ho detectarà».
- **Setup obligatori:** el primer cop que es configuri el deploy, documentar en aquest `CLAUDE.md` les comandes exactes que executa la plataforma i les que ha d'executar Claude localment abans de push. *(A dia d'avui aquest repo no té pipeline de desplegament automàtic documentat — condició no aplicable fins que s'afegeixi.)*

### 📦 d) Separació estricta de paquets

Si el projecte està dividit en paquets (`backend_nest_mvp/` + `frontend/`, o `api/` + `client/` + `shared/`), Claude **mai** crea imports creuats entre ells. Si cal compartir un tipus, copiar-lo o redefinir-lo a mà a cada costat. **Mai** moure lògica de «veritat» (validació de seguretat, autorització, escriptura a recursos sensibles) del servidor al client. Quan la tasca és d'un costat, no tocar l'altre tret de necessitat imprescindible i explícita.

### ✂️ e) Canvi mínim compatible

Claude ataca amb el canvi **més petit** que resol el problema. No fer refactors massius, canvis d'arquitectura per gust, migracions grans sense aprovació, substitucions globals cegues, ni «neteges» no demanades. No obrir diversos fronts grans en el mateix canvi. Tres línies similars és millor que una abstracció prematura. Si la proposta és «bonica» però trenca convencions existents, és incorrecta.

### 🔍 f) Causa arrel abans del fix

Davant d'un obstacle (test que falla, build que trenca, hook que bloqueja), Claude **no** fa servir dreceres destructives per fer-lo desaparèixer (p. ex. `--no-verify`, comentar el test, bypass de checks). Identificar la causa arrel i arreglar-la. Si troba estat inesperat (arxius desconeguts, branques rares, lock files), investigar abans d'esborrar/sobreescriure — pot ser treball en curs de l'usuari.

### 🧭 g) Workflow obligatori de tasques tècniques

Tota tasca tècnica segueix aquest ordre:
1. Inspeccionar el codi real afectat.
2. Llegir documentació rellevant si existeix.
3. Identificar causa arrel.
4. Distingir si el problema és semàntic / tècnic / d'integració / mixt.
5. Proposar canvi mínim compatible.
6. Implementar només el necessari.
7. Compilar/validar.
8. Actualitzar documentació si va canviar comportament real.
9. Resumir arxius tocats i invariants protegits.

Si la tasca és ambigua, aclarir primer — no improvisar arquitectura.

### 📤 h) Format de resposta en acabar una tasca

En tancar una tasca, Claude respon amb aquesta estructura:
1. **Causa arrel** — què estava malament realment.
2. **Canvis aplicats** — arxius tocats i què va canviar a cadascun.
3. **Verificació** — quines compilacions/checks es van executar i amb quin resultat.
4. **Invariants protegits** — quines regles del producte es van mantenir.
5. **Limitacions conscients** — què va quedar sense resoldre i per què.
6. **Següent pas recomanat** — un de sol, no obrir diversos fronts.

### ✅ i) Cap afirmació sense verificació

`tsc --noEmit` ≠ «la feature funciona». Per a canvis d'UI, aixecar el servidor de desenvolupament i provar-ho al navegador abans de declarar èxit (golden path + edge cases). Si no es pot provar, dir-ho explícitament en comptes d'afirmar que funciona.

### 🔒 j) Cap dependència sense aprovació

Claude **no** afegeix dependències (`npm install`, `pip install`, `brew install`…) sense aprovació explícita de l'usuari en aquest mateix missatge. Tampoc modifica versions de dependències existents tret de petició.

### 📚 k) Documentació operativa a `.claude/`

Tota la documentació meta viu sota `.claude/` a l'arrel del repo (versionada en git, viatja amb el projecte). Estructura mínima:
- `.claude/docs/history.md` — passat.
- `.claude/docs/tasks.md` — futur.
- `.claude/docs/domains/` — dominis de coherència (veure §l).

No crear documentació nova a `docs/` arrel tret que una skill ho exigeixi.

### 🔗 l) Coherència entre subsistemes (dominis)

Si el projecte té recursos compartits entre components (paletes de colors, schemas de dades, rutes, auth guards, sistemes d'esdeveniments), documentar-los a `.claude/docs/domains/<nom>.md`. Abans de donar per acabada una modificació, Claude es pregunta: *«Aquest canvi afecta algun recurs compartit que altres subsistemes consumeixen?»*. Si sí, consultar el domini corresponent. **No consultar tots els dominis a cada canvi** — només aquells la condició d'activació dels quals es compleix. La taula de dominis de Sonilab és a la Part II §9.

### ♻️ m) Anti-bucle d'auto-documentació

Actualitzar documentació de dominis és l'**últim pas** de tancar una tasca, no l'inici d'una nova ronda de revisió. La revisió de coherència es fa sobre canvis funcionals, no sobre canvis en docs. Això evita bucles infinits editar-`.md`→revisar→editar-`.md`.

### 🏷️ n) Branding i constants centralitzades

El branding visible i les constants del producte (nom de l'app, paleta, dimensions canòniques, URLs públiques) viuen en un punt únic i fàcil de localitzar. Claude **mai** fa reemplaçaments globals cecs de strings llegats — distingir sempre entre branding visible (sí unificar) i noms interns tècnics (no tocar sense tasca explícita).

### 💾 o) Persistència fora del contenidor

Les dades d'usuari i producte **mai** viuen al filesystem del contenidor d'aplicació (Railway, Fly, Render, Heroku), encara que hi hagi volum adjunt. Tampoc al repo git, ni en serveis personals (Drive, Dropbox, iCloud). Han de viure en:
- **Object storage compatible amb S3:** Cloudflare R2, Backblaze B2, AWS S3.
- **BD relacional gestionada amb backups.**

Identitat (auth, rols) i producte (dades d'usuari) van en magatzems separats. La frontera no es creua.

### 💸 p) Protecció contra costos anòmals

Qualsevol integració amb servei cloud de pagament-per-ús (storage, IA, email…) té **quatre capes actives sempre**:
1. Rate limiting per usuari al backend.
2. Quotes dures per usuari/pla.
3. Alertes de facturació a múltiples nivells baixos (€3, €5, €10, €15…) — millor spam que sorpresa.
4. Monitor propi amb tall automàtic quan se supera N× la mitjana.

Mai dependre només del proveïdor — les seves alertes notifiquen, no actuen.

### 🔤 q) Cap emoji tret de petició

Claude només fa servir emojis si l'usuari ho demana explícitament. Per defecte, codi i respostes són text pla. *(Aquest `CLAUDE.md` en fa servir com a marcadors visuals de secció perquè és documentació meta pròpia del model adoptat — no és el comportament per defecte de Claude en codi ni en respostes al xat.)*

### 💬 r) Cap comentari decoratiu

Per defecte Claude no afegeix comentaris al codi. Només quan el «perquè» no és obvi (constraint ocult, invariant subtil, workaround per a un bug específic). Mai comentaris que expliquin *què* fa el codi (els noms ja ho diuen), ni referències a la tasca actual («afegit per al flow X», «fix de l'issue #123») — això va a la descripció del PR i es podreix amb el temps.

### 📄 s) Cap documentació no sol·licitada

Claude **mai** crea arxius `*.md` o `README.md` tret de petició explícita. No crear planning docs, decision logs ni analysis docs com a subproducte del treball — aquesta informació viu a la conversa i a `.claude/docs/` si mereix persistir-se.

### 🧠 t) Memòria de màquina vs memòria de projecte

Dues persistències diferents, no barrejar:
- `.claude/` — versionat en git, compartit entre màquines i sessions. **Memòria del projecte.**
- `~/.claude/projects/<proj>/memory/` — local per màquina, no es puja. **Memòria personal de Claude** (preferències de l'usuari: com li agrada treballar).

Contingut del projecte mai a la memòria personal; preferències personals mai a `.claude/`.

### 🪜 u) Criteris de decisió jerarquitzats

Quan dues opcions tècniques competeixen, Claude prioritza en aquest ordre:
1. Visió del producte
2. Semàntica correcta
3. Compatibilitat amb l'estat actual
4. Arquitectura real
5. Model de dades
6. UX
7. Implementació tècnica

Si una proposta «bonica» trenca la semàntica, és incorrecta. Si una «neta» trenca convencions consolidades, és incorrecta. Si una «ràpida» obre ambigüitat, és incorrecta.

### ⚠️ v) Accions de blast radius alt requereixen confirmació

> [!WARNING]
> Claude confirma amb l'usuari abans d'executar accions difícils de revertir o amb efecte en sistemes compartits.

Exemples: esborrar arxius/branques/taules, force-pushes, downgrade de dependències, modificació de CI/CD, missatges a Slack/email, posts a serveis externs, uploads a eines de tercers (diagram renderers, pastebins). El cost de pausar per confirmar és baix; el cost d'una acció no desitjada pot ser molt alt.

### 🌐 w) Idioma de producte per defecte: català

La UI i la documentació de cara a l'usuari es fan en **català** sempre que sigui possible. No barrejar idiomes tret que sigui imprescindible (dependència externa, terme tècnic sense equivalent net, requisit explícit del client). Els **identificadors tècnics interns** (noms de variables, claus, IDs) segueixen la seva convenció i **no** es tradueixen.

---

## 🔓 3. Per què els permisos de Claude estan en «bypass»

Els arxius `.claude/settings.json` i `.claude/settings.local.json` donen permisos màxims a Claude. Això és **intencional**: l'usuari treballa amb prompts molt elaborats i detallats, amb autorevisions en bucle per a tasques complexes. La lògica del treball ja va servida al detall al primer prompt; els dubtes que pugui tenir Claude són típicament d'implementació tècnica o conceptes que Claude i internet ja coneixen bé. Demanar confirmació constant interrompria el flux sense aportar valor.

Les regles **a / b / v** de dalt són les que compensen aquest bypass: hi ha accions que sempre requereixen petició explícita o confirmació, independentment dels permisos del sistema.

---
---

# PART II — Context de producte Sonilab

> Regles de procés i de git: veure Part I. Aquí només va el coneixement específic del producte.

## 4. Naturaleza del producto

Esta app **no** es una herramienta pequeña ni solo de subtítulos.
Es una aplicación web grande y modular con áreas de:
- biblioteca
- vídeo
- audio
- subtítulos
- timeline
- waveform
- guion
- traducción
- revisión
- proyectos

Cualquier cambio en biblioteca debe proteger el resto del sistema.

## 5. Modelo funcional cerrado de biblioteca

La biblioteca tiene cuatro módulos con lógica y UI propia. En el frontend son cuatro pestañas: **Files**, **Projectes**, **Media**, **Paperera**.

### Files (antes "Arxius" / "Llibreria")
Sistema clásico de trabajo con estructura real de carpetas/subcarpetas en backend.
- Contiene: txt, srt, pdf, docx, LNK y carpetas de trabajo
- Permite: copiar / cortar / pegar / duplicar / mover / renombrar
- Regla de duplicados: mismo nombre+formato en la misma carpeta = prohibido; en ruta distinta = permitido
- **NO muestra media canónica** (vídeo/audio con `media` poblado y sin `refTargetId`)
- **NO muestra documentos con `sourceType` de media** aunque no tengan `media` poblado (legacy)
- Carpetas de proyecto se identifican por `projectFolderIds` y muestran icono 🗃️ y formato "PROJECTE"
- Carpetas normales muestran icono 📁 y formato "CARPETA"
- El breadcrumb muestra "Files" cuando `page === 'library'`

### Media
Repositorio canónico de assets audiovisuales. **Solo vídeo y audio.**
- Backend: carpeta plana única en disco (`STORAGE_ROOT`), sin subdirectorios reales
- Cada archivo guardado con nombre aleatorio (`nanoid`) + extensión original
- Identidad del asset = SHA-256, no el nombre ni la ruta
- Deduplicación siempre activa: no puede haber dos assets con el mismo SHA-256
- No se comporta como archivo clásico: no hay copiar/cortar/pegar/duplicar binario
- Las "agrupaciones" que ve el usuario son solo vistas del frontend (orden/filtro), no estructura en disco
- Solo muestra documentos con `media` poblado y `refTargetId` vacío
- El breadcrumb muestra "Media" cuando `page === 'media'`

### LNK
Referencia desde Files hacia un asset de Media.
- No duplica binario; apunta al original
- Puede convivir con txt/srt/docs en cualquier carpeta de Files
- Copiar un LNK duplica la referencia, no el media
- LNK huérfano (target borrado): no se puede abrir, se marca visualmente como roto

### Projectes
Capa propia del producto. Lista de carpetas de proyecto.
- No se fusiona con Media ni con Files
- Cada proyecto apunta a un `mediaDocumentId` canónico de Media
- La pestaña Projectes filtra `itemsToRender` mostrando solo carpetas cuyo `id` está en `projectFolderIds`
- `projectFolderIds` se calcula a partir del estado de proyectos del backend
- El breadcrumb muestra "Projectes" cuando `page === 'projects'`
- Las carpetas de proyecto también son visibles en Files (con icono 🗃️ y formato "PROJECTE")

## 6. Definiciones canónicas

```ts
const isCanonicalMedia = (doc: any) =>
  doc?.type === 'document' && !!doc.media && !doc.refTargetId;

const isLnk = (doc: any) =>
  doc?.type === 'document' && !!doc.refTargetId;

const isOrphanLnk = (doc: any, allDocs: any[]) =>
  isLnk(doc) && !allDocs.find(d => d.id === doc.refTargetId && !d.isDeleted);
```

No bases decisiones funcionales solo en `sourceType` si necesitas distinguir:
- media canónica
- documento clásico
- LNK

## 7. Estado actual de fases

### Fase 1
Cerrada funcionalmente.
- Media, Arxius, LNK y Projectes definidos sin ambigüedad.

### Fase 2
Cerrada técnicamente.
La contención ya cubre:
- copy/cut/paste de media canónica
- drag/drop genérico de media
- subida cruzada media ↔ Arxius
- clasificación por tabs
- selección y acciones múltiples
- delete/purge con conjunto total efectivo
- LNK huérfanos

### Fase 3
Iniciada. Contrato funcional cerrado y primer bloque implementado.

**Decisiones funcionales cerradas:**
- Media backend = carpeta plana única en disco (sin subdirectorios reales). Las agrupaciones del frontend son solo visuales.
- No existe "forzar nuevo" para duplicados confirmados. La deduplicación por SHA-256 es siempre autoritativa.
- Duplicado probable (precheck nombre+tamaño): modal tentativo — "Continuar i verificar" / "Cancel·lar".
- Duplicado confirmado (SHA-256): modal definitivo — "Usar asset existent" / "↗ Crear accés directe" / "Cancel·lar".
- Subida de media siempre con `parentId: null` (no hereda carpeta de Arxius).
- Reutilizar media = crear LNK, no duplicar binario.

**Implementado en esta fase:**
- Eliminado `forceDuplicate` y `nameOverride` del endpoint `POST /media/upload`.
- Eliminado `forceDuplicate` de `api.ts → uploadMedia()`.
- Eliminada función `handleForceImport` y estados asociados de `LibraryView.tsx`.
- Modal de duplicado confirmado rediseñado sin opción de force.
- `parentId: null` forzado en todas las rutas de subida de media en `LibraryView.tsx`.

**Pendiente en Fase 3:**
- Relación Media ↔ LNK: flujo de "Usar asset existent" (navegación al asset en Media).
- Organización visual dentro de Media (frontend only).
- Compatibilidad con Projectes verificada pero no reforzada explícitamente.

## 8. Invariantes a proteger y rutas sensibles

No abras una fase nueva por tu cuenta. No cambies arquitectura global sin instrucción explícita. Si una zona ya está contenida, no la reabras por perfeccionismo. Si detectas una fuga real, corrígela en el punto más local posible. Si no hay fuga real, no inventes trabajo.

Protege especialmente:
- Projectes
- editores
- timeline
- waveform
- syncRequest
- transcripción
- traducción
- revisión

Rutas más sensibles (lee el `CLAUDE.md` local antes de tocarlas):
- `frontend/components/Library/`
- `frontend/context/Library/`
- `backend_nest_mvp/src/modules/library/`
- `frontend/components/Projects/`
- `backend_nest_mvp/src/modules/projects/`

Convenciones prácticas:
- Comentarios de código: catalán si ya existe esa convención local.
- Nombres de variables y funciones: inglés.
- Mantén contratos existentes salvo razón fuerte.
- Evita renombrados masivos y cambios "de limpieza" sin valor funcional.

## 9. Coherencia entre subsistemas (dominios de Sonilab)

Muchos componentes de Sonilab comparten recursos indirectos. Dos partes de la app pueden no estar conectadas directamente pero depender del mismo contrato compartido.

Ejemplo: añadir un nuevo `sourceType` afecta a `FileItem.tsx` (icono/formato), `LibraryView.tsx` (clasificación), `OpenWithModal.tsx` (detección y apertura), `exportUtils.ts` (extensión del nombre) y posiblemente al backend. Sin consultar todos los afectados, el cambio queda a medias.

Los archivos de dominio viven en `.claude/docs/domains/<nombre>.md` (ver regla l de la Part I). Cada uno explica qué archivos involucra, qué hacer al añadir/modificar/eliminar algo, y qué relaciones indirectas existen.

| Condición de activación | Dominio | Archivo |
|------------------------|---------|---------|
| Se añade, modifica o elimina un valor de `sourceType` | Clasificación de documentos | `.claude/docs/domains/source-types.md` |
| Se añade o renombra una clave en `LOCAL_STORAGE_KEYS` | Persistencia local | `.claude/docs/domains/localstorage.md` |
| Se modifica `isCanonicalMedia`, `isLnk` o la lógica de tab (Files/Media/Projectes) | Modelo de biblioteca | `.claude/docs/domains/library-model.md` |
| Se modifica el formato `snlbpro` o su pipeline de import/export/apertura | Formato de guion | `.claude/docs/domains/snlbpro-format.md` |
| Se toca `projectFolderIds` o cualquier lógica del módulo Projectes | Proyectos | `.claude/docs/domains/projectes.md` |
| Se modifica el modelo de segmento, `SubtitleEditorContext` o el editor de subtítulos | Editor de subtítulos | `.claude/docs/domains/subtitles.md` |
| Se modifica el flujo de subida de media o la lógica de deduplicación SHA-256 | Upload de media | `.claude/docs/domains/media-upload.md` |
| Se toca sincronización de tiempo entre media, subtítulos o waveform | Timeline / Waveform | `.claude/docs/domains/timeline.md` |
| Se añade una ruta nueva en frontend o un endpoint nuevo en backend | Navegación y routing | `.claude/docs/domains/routing.md` |
| Se modifica `exportToPdf` del editor de guion, el flujo de impresión a PDF o los anchors `[data-page-break-anchor]` | Export del guion a PDF | `.claude/docs/domains/script-pdf-export.md` |
| Se modifica el sistema de presets de estilos del usuario, las CSS vars `--us-*` o cualquier componente de `frontend/components/Settings/UserStyles/` | User styles | `.claude/docs/domains/user-styles.md` |

**Nota de migración (2026-07-09):** ninguno de estos archivos `.claude/docs/domains/*.md` existe todavía físicamente en el repo — la carpeta `domains/` ni siquiera está creada a día de esta migración. La tabla documenta la convención de activación para cuando se creen, no un estado ya presente. Ver informe de migración para más detalle.

**Cómo crece esta tabla:** al crear un subsistema con recursos compartidos, crear `.claude/docs/domains/<nombre>.md` y añadir su condición de activación aquí. No documentar subsistemas sin relaciones indirectas.

**Regla de auto-documentación (sin bucles):** al terminar una modificación, comprobar UNA VEZ si introduce un recurso compartido nuevo (→ crear dominio) o amplía uno existente (→ actualizar su `.md`). Actualizar un dominio es el último paso, NO activa otra ronda de revisión (ver regla m de la Part I).

## 10. Estrategia de integración con aplicaciones externas

### Contexto

Este repositorio está diseñado para absorber en el futuro la lógica de otras aplicaciones relacionadas — en particular, un lector de guiones para doblaje (`script-reader-for-dubbing`) que actúa como aplicación "padre". Esa app comparte origen conceptual con Sonilab pero tiene arquitectura independiente y archivos con los mismos nombres.

Para que la integración futura no destruya código, se ha aplicado una convención de naming preventiva en este repo. Cualquier Claude que trabaje aquí debe respetar esta convención y seguir el protocolo de integración descrito en este apartado.

### Convención de naming anti-colisión

Cuando un archivo de este repo tiene o tenía el mismo nombre que un archivo de una aplicación externa que se va a integrar, se renombra en **este** repo aplicando uno de estos prefijos:

| Caso | Patrón aplicado | Ejemplo |
|------|----------------|---------|
| Componente de biblioteca compartido | prefijo `Sonilab` | `LibraryView.tsx` → `SonilabLibraryView.tsx` |
| Contexto compartido | prefijo `Sonilab` | `LibraryContext.tsx` → `SonilabLibraryContext.tsx` |
| Componente de fila de biblioteca | prefijo `Library` | `FileItem.tsx` → `LibraryFileItem.tsx` |
| Tipos globales de la app | sufijo `app` | `types.ts` → `appTypes.ts` |
| Carpeta de utils compartida | nombre descriptivo | `LectorDeGuions/` → `ScriptUtils/` |

**Archivos que NO se pueden renombrar** porque son puntos de entrada del tooling:

| Archivo | Razón |
|---------|-------|
| `App.tsx` | Entry point de React — Vite lo espera por convención |
| `index.html` | Entry point HTML |
| `index.tsx` | Entry point React DOM |
| `package.json` | Requerido por npm/Node tal cual |
| `tsconfig.json` | Requerido por TypeScript |
| `vite.config.ts` | Requerido por Vite |

Estos se fusionan **manualmente** en el momento de la integración — no se renombran.

### Qué hace la aplicación padre (script-reader-for-dubbing)

- Framework: React + Vite + react-router-dom (web, no React Native)
- Sin backend propio — todo en localStorage/AsyncStorage local
- Funcionalidad principal: lector de guiones de doblaje con anotaciones, búsqueda por personaje/take, y visualización de capas de anotación
- Los archivos de lógica pura que sí son reutilizables (y ya están integrados aquí) son:
  - `utils/ScriptUtils/indexers.ts` — indexación de personajes y takes
  - `utils/ScriptUtils/search.ts` — búsqueda de matches en texto
  - `utils/ScriptUtils/takes.ts` — rangos de takes

### Archivos de la app padre que NO se integrarán como código

Estos archivos existen en la app padre pero su lógica está implementada de forma distinta en Sonilab y **no deben mezclarse**:

| Archivo padre | Por qué no se porta |
|--------------|---------------------|
| `LibraryContext.tsx` | Usa AsyncStorage local; Sonilab usa backend NestJS |
| `LibraryView.tsx` | React Native; Sonilab usa React web con Tailwind |
| `FileItem.tsx` | React Native; Sonilab usa React web con Tailwind |
| `types.ts` (biblioteca) | Subconjunto mínimo; Sonilab tiene supertipo completo en `appTypes.ts` |
| `App.tsx` | Usa react-router-dom; Sonilab usa hash routing propio |

### Lo que sí se portará cuando llegue la integración

Los componentes propios del lector que no existen en Sonilab:

| Archivo padre | Descripción | Dónde irá en Sonilab |
|--------------|-------------|----------------------|
| `components/AnnotationCanvas.tsx` | Lienzo de anotaciones sobre el guion | `components/LectorDeGuions/` |
| `components/LayerPanel.tsx` | Panel de capas de anotación | `components/LectorDeGuions/` |
| `components/TakesByCharacterPanel.tsx` | Panel de takes por personaje | `components/LectorDeGuions/` |
| `components/HighlightedScript.tsx` | Vista de guion con highlights | `components/LectorDeGuions/` |
| `components/ConfirmTextModal.tsx` | Modal de confirmación de texto | `components/LectorDeGuions/` |
| `app/index.tsx` (EditorPage) | Página principal del lector | Adaptado como nueva vista en Sonilab |
| `app/library-manager.tsx` | Gestión de biblioteca del lector | Sustituido por la biblioteca de Sonilab |
| `types/annotation.ts` | Tipos de anotación | `types/LectorDeGuions/` |

### Protocolo de integración (cuando llegue el momento)

Seguir estos pasos en orden. No mezclar pasos.

**Paso 1 — Verificar que no hay nuevas colisiones de nombres.** Antes de portar cualquier archivo nuevo, comprobar que su nombre no coincide con ningún archivo existente en Sonilab. Si coincide, aplicar la convención de naming de la sección anterior.

**Paso 2 — Portar únicamente lógica pura (utils y types).** Copiar los archivos de lógica sin UI a sus carpetas destino. No modificar los existentes en Sonilab. Verificar que los imports son correctos.

**Paso 3 — Portar componentes UI como módulo aislado.** Colocar los componentes del lector en `components/LectorDeGuions/`. No importar desde ellos hacia componentes de Sonilab ni al revés, salvo a través de una interfaz explícita.

**Paso 4 — Añadir la nueva vista al router.** Añadir el nuevo `OpenMode` para el lector en `appTypes.ts`. Añadir la rama de render en `App.tsx`. Añadir la ruta al hash router en `useHashRoute.ts`. Ver `.claude/docs/domains/routing.md`.

**Paso 5 — Añadir el botón de apertura en OpenWithModal.** Solo si el documento es un tipo reconocible por el lector. Seguir el patrón existente de `isSnlbpro` para la detección.

**Paso 6 — Fusionar package.json.** Añadir solo las dependencias nuevas que el lector necesite y que no estén ya en Sonilab. No sobrescribir versiones existentes sin verificar compatibilidad.

**Paso 7 — Verificar no regresión.** Comprobar que Files, Media, Projectes, editor de subtítulos y editor de guion siguen funcionando exactamente igual que antes.

### Regla general

Cuando se porta código de otra aplicación a este repo:
1. Primero verificar nombres — aplicar convención si colisionan.
2. Portar como módulo aislado — no mezclar lógica interna.
3. Conectar por interfaz explícita (OpenMode, router, OpenWithModal) — no por imports directos entre módulos.
4. No tocar lo que ya funciona en Sonilab como efecto lateral del port.
