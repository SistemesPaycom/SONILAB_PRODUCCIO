# Report d'Anàlisi: Nou Panel de "Pujades"

## Context i Objectiu (Explicació per a Claude)
Actualment, quan es puja un arxiu a l'aplicació, apareix una petita finestra a la part inferior esquerra que mostra el progrés d'aquesta pujada. Aquesta finestra genera tres problemes d'usabilitat importants:
1. Tapa altres botons o components necessaris de la interfície.
2. No disposa de botó de tancar, per tant no es pot ocultar manualment en cap moment.
3. En comptes de desaparèixer correctament quan finalitza l'arxiu, la finestra s'acostuma a quedar bloquejada al 100% permanentment, la qual cosa confon a l'usuari fins a fer un reload de pàgina o provocar errors si hi tracta.

La tasca consta en extreure aquesta finestra de la interfície i substituir-la per una eina millor: afegirem un botó fix dit **"Pujades"** just per sota del botó permanent de "Tasques IA". Fent clic al botó de "Pujades", s'obrirà un panell modal flotant amb funcions, disseny i aspecte visual idèntic al panell d'ajustos de **"Tasques IA"**. En aquest nou panel s'hi podran veure múltiples fitxers pujant-se i l'historial del que ja s'hagi carregat sense bloquejar cap funcionalitat.

---

## Technical Report per a Claude (Codi, Solucions i Possibles Conflictes)

### 1. Origen del comportament actual (On és el bug/comportament de les Pujades)
L'estat del progrés actual i la finestra de pujada es troben com un estat reactiu local exclusivament dins el component secundari principal de library `SonilabLibraryView.tsx` (situada cap a la línia 91, i el codi JSX a la ~1129):
```tsx
const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number } | null>(null);
```
El bloqueig prové quan dins `handleSingleFileUpload` o `handleContinueUpload`, es crida a l'api:
```tsx
const uploadResult = await api.uploadMedia(file, (pct) => {
  setUploadProgress({ name: file.name, pct });
}, null);
setUploadProgress(null);
```
Com passa amb múltiples operacions asíncrones de React mal recollides en catch o manipulacions per reaccions externes d'estat de document si cau abans de `setUploadProgress(null)`, es queda perpetuat el 100%. A part, procesar diversos arxius a la mateixa funció simple solaparà sempre el widget de baix al no guardar memòria col·lectiva com a llista (`Array`), mostrant noms parpellejant un per un si es posen arxius lleugers.

### 2. Proposta Arquitectònica de Solució
Cal modificar la lògica d'aquesta petició per suportar les solucions d'arquitectura necessàries:
- **Gestió d'Estat Llista (Global o de Component pare)**: Cal que el nou estat de descàrrega no sigui d'un objecte tancat, sinó un magatzem (`useState<UploadJob[]>`) situat en un context correcte (com `LibraryContext` per viure independentment o dins `App.tsx` on viuen la resta de Panels i passes callbacks a `LibraryView`). Ha de guardar una referència clara generant ID unívoca prèvia a cada fitxer llançat per no barrejar-se per referències amb el backend.
- **Crear Component nou: `PujadesPanel.tsx`**: Aquest nou arxiu hauria de ser arquitectònicament la integració equivalent de `TasksIAPanel.tsx`, amb el fons `bg-gray-800` propi i llistat i un botó creueta al top corner perquè es pugui tancar i seguir utilitzant l'escriptori per sota. En comptes del fetch autònom i pooling que té la interfície IA, pot rebre els "UploadJobs" directament per propietats o de forma injectada al component. Valora la viabilitat.
- **Incloure i vincular al Frontend**: Al fitxer secundari de rutes (`SonilabLibraryView.tsx`), sota el botó de les notificacions actual d'IA, col·loca el teu nou botó "Pujades" cridant al toggle encarregat de mostrar `<PujadesPanel />` prèviament. Desembarraça l'actual element CSS fix per sota absolut (`<div className="fixed bottom-4 left-4 z-[600]...>`) de les Pujades progressives i adapta-ho de pas a la propaga de les llistes pel Panel.

### 3. Conflictes i errors previstos
- `api.uploadMedia(file, (pct) => ...)` (`services/api.ts`): Cridar reiteradament el tracker pot aixecar conflictes de cursa de components si l'state utilitzat en callbacks no empra setState amb l'estat previ: `setUploads(prev => prev.map(...))`. Altrament els callbacks antics només veuran l'estat original buid, cancel·lant fitxers anteriors en subides múltiples (Stale State bug).

---

## Instruccions Executives per a Claude

És necessari actuar directament sobre l'arquitectura de base per aplicar aquesta funcionalitat. No obstant, NO em prenguis exclusivament o inamovible la paraula d'aquest informe sense valorar tu matisos. Has d'aplicar anàlisis previs al teu gust:

1. Utilitza i invoca les teves eines de **superpowers (`debug` i `code-review`)** directament per sobre d'`App.tsx`/`LibraryContext.tsx` o on tu percebis que seria el destí més intel·ligent on encabir els estats i dissenya-ho entenent què podria passar segons el meu informe i allò que vegis.
2. Analitza ben bé la gestió i dependències asíncrones de l'Upload (els xhr reques localitzats a `api.ts`), garantint que un context superior de React no provarà de cancel·lar components renderitzats i no trenquis el cicle visual dels uploads quan són ràpids.
3. Genera la sol·lució amb el teu propi marge de llibertat creativa procurant deixar tota la usabilitat i interaccions visualment atractives el màxim de semblants al mateix menú `TasksIAPanel.tsx` utilitzant i exportant les mateixes subestructures que té per guiar-vos si s'escau.
4. Quan ho donis per resolt, proporciona els detalls implementats per poder verificar l'eficàcia.
