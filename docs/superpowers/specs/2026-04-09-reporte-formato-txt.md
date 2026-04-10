# Report d'Anàlisi: Refactorització visual del format "SNLBPRO" a "TXT"

Aquest document ha estat generat per proporcionar una anàlisi prèvia sobre la modificació del format visual per als fitxers de text dins de la interfície del frontend. Serveix com a base per a la implementació, però s'espera que utilitzis les eines "superpowers debug" i "code-review" per validar, ampliar i implementar els canvis adequats.

---

## 1. Explicació d'Alt Nivell (Per a l'assistent d'IA)

L'objectiu principal d'aquesta tasca és purament estètic i de millora de l'experiència d'usuari (UX) al frontend, específicament a la columna "Format" de la biblioteca d'arxius.

Actualment, el sistema utilitza el terme intern "SNLBPRO" per definir l'estructura de dades o el tipus d'origen d'alguns fitxers de text (com els guions). Tot i que aquest terme és perfectament vàlid per a l'ús intern del backend i per al processament de dades, no és un terme amigable o reconeixible per a l'usuari final. L'usuari simplement veu aquests arxius com a documents de text pla o "TXT".

**Què s'ha de fer:**
Cal interceptar la informació del format just abans que es renderitzi visualment a la columna "Format" de la llista d'arxius, i assegurar-se que qualsevol referència visible a "SNLBPRO" es canviï de manera que l'usuari llegeixi "TXT" en el seu lloc.

**Què NO s'ha de fer:**
No s'ha de canviar el format subjacent a la base de dades, ni la forma en què els components processen aquests arxius internament. "SNLBPRO" s'ha de mantenir com a "Type" o "SourceType" en l'estat global, l'emmagatzematge i la lògica de reconeixement d'arxius (com ara formularis, eines d'importació o conversion logic de subtítols). Utilitzar el terme intern per filtrar o processar la informació segueix sent essencial i correcte. Alterar-ho podria generar efectes secundaris greus en com els editors (com l'Editor de Guions) obren i treballen els fitxers.

---

## 2. Informe Detallat i Proposta Tècnica

Durant l'anàlisi de la base de codi s'ha examinat l'arrel on es renderitza la informació a la vista de llista o l'explorador de la Library.

### Arxius Rellevants Detectats
- `frontend/components/Library/LibraryFileItem.tsx`: És el responsable de dibuixar cada línia i mostrar la columna de format al costat del nom de l'arxiu.
- `frontend/components/Library/OpenWithModal.tsx`: Realitza comprovacions internes usant the `sourceType`.
- `frontend/components/Library/SonilabLibraryView.tsx`: Controla l'estat i pot inicialitzar elements.

### Lògica Actual Culpable
A `LibraryFileItem.tsx`, cap a la línia ~286-287, l'aplicació extreu directament de la propietat `sourceType` (o usa 'snlbpro' com a fallback per defecte) i el converteix a majúscules per mostrar-lo directament:

```typescript
const rawFormat = ((item as Document).sourceType || 'snlbpro').toUpperCase();
const formatLabel = item.type === 'folder' ? (isProject ? 'Projecte' : 'Carpeta') : isRef ? `LNK (${rawFormat})` : rawFormat;
```

La variable `formatLabel` després es pinta directament al component JSX en el seu contenidor respectiu de la columna format.

### Solució Proposada
S'ha de mapar o traduir "SNLBPRO" a "TXT" **únicament per la variable referenciada visualment**.  Això manté el flux intern inalterat però soluciona el problema de cara a l'usuari:

```typescript
const sourceTypeStr = (item as Document).sourceType || 'snlbpro';
const rawFormat = sourceTypeStr.toUpperCase();
// Traduir SNLBPRO a TXT només per a la renderització visual
const displayFormat = rawFormat === 'SNLBPRO' ? 'TXT' : rawFormat;

const formatLabel = item.type === 'folder' 
  ? (isProject ? 'Projecte' : 'Carpeta') 
  : isRef 
    ? `LNK (${displayFormat})` 
    : displayFormat;
```

*(Nota: assegura't que l'element DOM renderitzi "formatLabel", que així recollirà el canvi).*

### Possibles Conflictes o Riscos a Evitar
1. **Aturar-se en lo visual:** Si es modifica la lògica d'obertura (per exemple, si es fa algun canvi a fitxers com `OpenWithModal.tsx`), aplicacions com l'editor de guions podrien deixar d'obrir aquests fitxers, ja que internament verifiquen `sourceType === 'snlbpro'` o l'herència de `.slsf` abans d'habilitar funcions d'edició. Assegura't de modificar *exclusivament* allò que s'imprimeix a pantalla de manera informativa. 
2. **Accessos Directes (LNK):** El codi mostra referències indirectes, generant etiquetes com `LNK (SNLBPRO)`. La solució recomanada a dalt també cobreix l'accés directe ja que empassa la variable traduïda `displayFormat`, resultant idealment en `LNK (TXT)`. Verifica aquest comportament.
3. **Casos Sensibles:** Tot i que `.toLowerCase() / .toUpperCase()` s'usa freqüentment, comprova sempre l'ús de combinacions en majúscula quan facis conversions en cadena.

---

### Instruccions per a Claude

S'espera que **no donis per tancat aquest anàlisi ràpid al 100%**. Et demano que realitzis els teus propis diagnòstics i confirmacions utilitzant les eines de **superpowers debug** i, si convé per trobar efectes en cadena o fitxers vinculats, utilitza **code-review**.

Si us plau, empra aquest informe com un punt de partida per a accelerar l'entrega, analitzar el codi circumdant i aplicar el pegat de manera segura.
