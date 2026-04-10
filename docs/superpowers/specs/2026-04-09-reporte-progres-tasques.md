# Report d'Anàlisi: Restauració de la Barra de Progrés a Tasques IA

## Context i Objectiu
Aquest informe detalla el motiu pel qual el percentatge i la barra de progrés de les transcripcions ja no són visibles a la UI ("Tasques IA"). L'objectiu és proporcionar una anàlisi clara perquè Claude implementi la solució òptima utilitzant les seves eines de desenvolupament (superpowers: debug i code-review).

## Explicació de la funcionalitat (Sense format de Codi)
L'arquitectura actual per mostrar el progrés i el seu estatus funciona de la següent manera:
1. **Backend**: Quan un projecte passa completament a l'etapa de "processament", el gestor de tasques en segon pla (el Worker encarregat d'executar les transcripcions) envia punts de control i fites de percentatge definides (com un 15%, 50%, 70%, 100% etc.) cap a la base de dades on es desen les tasques.
2. **Frontend**: El tauler "Tasques IA", en ser obert o actiu, s'actualitza periòdicament mitjançant un sondeig automàtic (polling) cada pocs segons. Aquesta rutina demana al servidor els valors de progrés emmagatzemats per visualitzar-los.
3. **Per què s'ha perdut visualment?**: Sense anar en detalls tècnics encara, el sistema rep bé les xifres del 0 al 100, però hi ha una fallada estrictament en l'ordre i estructura visual de les "pistes" de com dibuixar la barra. Quan a la finestra se li dona instruccions com "Pinta aquest color si està en procés" i separat una altra dient "Fes la barra a X de mida", el paquet visual està ometent el color i quedant exclusivament amb la mida per la manera com estan col·locades. Quan la tasca està "en cua", funciona bé perquè hi ha una ordre de color fixa, però just quan perd i canvia al processament verdader, actua el problema de l'estil trencat i fa la barra invisible, igualment donant la sensació d'absència de càlcul.

---

## Technical Report per a Claude

**Problema Detectat**: Bug visual (React overwrite prop bug) al component `TasksIAPanel.tsx`

L'error es troba dins l'element `<div />` encarregat d'aplicar visualment l'amplada i el color dins les iteracions de la llista de tasques, quan aquestes reben the jobs (en cursos "processing" o "queued"). Com a resultat hi ha múltiples `style` solapats.

```tsx
// Situació Actual a TasksIAPanel.tsx (aproximadament línia 205)
<div
  className={`h-full rounded-full transition-all duration-500 ...`}
  style={job.status !== 'queued' ? { backgroundColor: 'var(--th-accent)' } : undefined}
  style={{ width: `${Math.max(job.progress, 2)}%` }} // [BUG] Aquest document de prop aixafa l'anterior completament
/>
```

### Anàlisi del Conflicte

- A l'ecosistema de React amb JSX, definir diverses vegades l'atribut `style` sota una mateixa etiqueta XML implica que només sobreviu la del final, perquè una sintaxi JSX és interpretada en arguments d'un objecte, provocant que la key de propietats de `style` sigui reescrita sense merge.
- Amb freqüència, això resulta que el comportament de la propietat reactiva `width: ${job.progress}%` acabi anul·lant `backgroundColor: 'var(--th-accent)'`.
- Durant l'estat de cua (`queued`), una classe extra (`bg-amber-500`) s'encarrega temporalment del color i no trontolla completament, però a l'hora de canviar al seu format base (blau i progressant), perdent la classe, la barra és exclusivament invisible/transparent dins el fons fosc, no revelant el procés malgrat l'obtenció correcta del Backend.

### Instruccions a Claude

És necessari actuar directament sobre l'arquitectura:
1. Executa els integrants del teu context, especialment **`code-review` i l'eina `debug`**, i valora l'anàlisi realitzat en l'apartat del directori `/frontend/components/TasksIA/TasksIAPanel.tsx`. Ets lliure d'analitzar exhaustivament la coherència global i veure si hi ha un altre prop solapat en els fills/pares.
2. Troba la porció on s'acobla aquest domini per l'estat i refactoritza el node fusionant les propietats de `width` i `backgroundColor` dinàmic dins un mateix objecte JavaScript `style={{ ... }}` combinat.
3. Repassa visualment al teu codi generat si l'expressió `<span>{job.progress}%</span>` i la mateixa barra estaran perfectament visibles garantint el bon reflex temporal a l'aplicació final del usuari.
4. Genera el report habitual dels teus treballs.
