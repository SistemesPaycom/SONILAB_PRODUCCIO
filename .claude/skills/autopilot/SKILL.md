---
name: autopilot
description: >
  Flux autònom complet de planificar -> auto-revisar-fins-a-convergir -> executar
  per a qualsevol tasca substancial de diversos passos. Fes-la servir sempre que
  l'usuari et passi una tasca real i vulgui que la portis de punta a punta SENSE
  aturar-te a demanar confirmacio entre passos -- frases com "elabora un pla i
  executa", "fes-ho tot", "no m'esperis", "endavant sense preguntar", "autopilot",
  o qualsevol cop que l'usuari t'hagi donat una especificacio detallada i esperi
  que planifiquis, enforteixis el pla amb revisio iterativa, i despres l'implementis
  pel teu compte. Activa-la fins i tot quan l'usuari no digui la paraula "autopilot"
  pero clarament vulgui la feina feta de forma autonoma. NO la facis servir per a
  una pregunta rapida d'una linia ni una edicio trivial que no necessita cap pla.
---

# Autopilot

Porta una tasca substancial des de la peticio en brut fins a la implementacio
acabada tu sol: planifica-la, enforteix el pla amb una auto-revisio acotada, i
despres executa -- sense aturar-te mai a preguntar "continuo?" entre fases.

Aquest es el mode de treball per defecte de l'usuari per a tasques reals. Ha cedit
el control deliberadament i sovint estara absent mentre treballes. Aturar-se a
mitja feina per esperar una confirmacio que no calia es el pitjor error possible
aqui: l'usuari pot no veure-ho durant hores, i tota l'execucio queda encallada per
res.

## La regla que mes importa: no t'aturis entre fases

Les fases de sota s'encadenen automaticament. Les condicions de sortida del Pas 3
SON el procediment de decisio -- no hi ha cap punt de control huma entre
planificar, revisar i executar. Per tant:

- Mai acabis un torn amb "he acabat el pla, confirma per continuar" o "llest per a
  la seguent iteracio?". Simplement passa a la fase seguent.
- Mai demanis permis per fer una altra ronda de revisio, per comencar a executar,
  o per llancar sub-agents. Aquestes decisions ja estan preses -- per les
  condicions de sortida i per la preferencia permanent d'autonomia de l'usuari.
- Les uniques pauses legitimes son les barreres dures de seguretat (vegeu
  Seguretat, mes avall): accions genuinament destructives, irreversibles o cap a
  l'exterior. Aquestes es gestionen fent primer tota la feina segura i mostrant
  nomes l'accio bloquejada -- no aturant tot el flux.

Si et sorprens a punt de preguntar "hauria de continuar?", la resposta es si.
Continua.

## Pas 0 - Calibra l'esforc a la tasca

Ajusta la maquinaria a la mida de la tasca. Aplicar tot el pipeline de pla+revisio
a un canvi trivial malgasta tokens i temps -- l'oposat de l'objectiu.

- Trivial (fix obvi d'una linia, renombrar, ajustar config): salta't la
  planificacio i la revisio. Fes-ho i reporta.
- Substancial (diversos arxius, decisions de disseny, ambiguitat, risc real):
  segueix el flux complet de sota.

En cas de dubte, inclina't pel flux complet -- pero mante la revisio acotada
(Pas 2).

## Pas 1 - Planifica, amb autocritica incorporada

Produeix una especificacio/pla escrit. Si Superpowers esta disponible, fes servir
`superpowers:brainstorming` i despres `superpowers:writing-plans`; si no,
planifica directament.

Cobreix les possibilitats que canvien la decisio -- no totes les branques
imaginables. L'exhaustivitat cega es una fuita de tokens; l'objectiu es la
suficiencia.

Abans de tancar el pla, critica el teu propi esborrany: llista'n els punts mes
febles (requisits que falten, suposits arriscats, casos limit, invariants que
podria trencar) i corregeix-los alli mateix. Aixi el primer esborrany ja supera
una revisio de franc, cosa que redueix quantes rondes externes necessitaras
despres.

## Pas 2 - Enforteix: una ronda acotada de revisio adversarial en paral.lel

En comptes de moltes passades de revisio sequencials (que rellegeixen tot el
context cada cop i deriven amb la cache freda, la fuita principal de tokens de
l'enfocament ingenu), fes UNA ronda de 2-3 sub-agents en paral.lel, cadascun amb
una lent diferent:

- **Correccio i coherencia** - el pla resol realment el problema plantejat; es
  internament consistent?
- **Completesa i casos limit** - requisits que falten, estats no gestionats, modes
  de fallada.
- **Encaix amb el codi existent** - convencions, invariants, radi d'impacte, punts
  d'integracio.

Lents diverses en una sola passada capturen mes que passades identiques fetes en
sequencia. Recull totes les troballes i grada cadascuna com a major o minor:

- **Major**: bug de correccio, requisit que falta, enfocament equivocat, defecte
  arquitectonic, problema de seguretat, invariant trencat.
- **Minor**: redaccio/coherencia de l'especificacio, polit de documentacio, detalls
  de nomenclatura, follow-ups no bloquejants.

Si Superpowers hi es, `superpowers:dispatching-parallel-agents` encaixa de forma
natural per llancar les lents.

## Pas 3 - Convergeix (condicions de sortida)

Decideix a partir de les troballes -- no facis bucles oberts:

- **Cap troballa, o nomes minors** -> convergit. Passa directament al Pas 4. Els
  minors residuals es resolen sobre la marxa durant l'execucio; polir mes el
  document nomes crema tokens sense millorar el resultat.
- **Alguna troballa major** -> corregeix el pla i fes exactament UNA ronda mes de
  revisio. Despres d'aquesta segona ronda, executa igualment malgrat els minors
  que quedin.
- **Limit dur: 2 rondes de revisio. Mai una tercera.**

Despres continua cap a l'execucio -- automaticament, dins el mateix flux, sense
confirmacio.

## Pas 4 - Executa

Implementa el pla convergit. Si Superpowers esta disponible,
`superpowers:executing-plans` o `superpowers:subagent-driven-development`
encaixen be. Compleix el llisto de qualitat de la propia tasca (tests / build /
verificacio segons les convencions del projecte). Reporta al final amb que ha
canviat i que has verificat -- no a mig cami preguntant si continuar.

## Documentacio operativa (tasks.md / history.md)

Si el projecte mante `tasks.md` i `history.md` a `.claude/docs/` (la convencio del
CLAUDE.md, seccio 1), mante'ls al dia com a part del flux -- no com una tasca a
part. Segueix el format exacte que defineix el CLAUDE.md i els seus exemples
(`demo_tasks.md`, `demo_history.md`); no el redefineixis aqui.

- **En comencar a implementar** (primer canvi al codi): mou la tasca a **EN_PROCES**
  a `tasks.md` (o crea-la si no hi era). Es el moment en que s'obre la subseccio
  "Tasques a realitzar per part de l'usuari".
- **Durant el desenvolupament**: si detectes coses que **l'huma** hauria de verificar
  en el futur, anota-les com a punts `[__]` dins d'aquesta subseccio. Criteri per no
  passar-se:
  - Si ho pots provar tu mateix i queda verificat -> **no** ho passis a l'huma.
  - Anota-ho nomes quan el **criteri huma** es mes adequat: si es visualment
    agradable, si es practic o comode per a una persona, decisions de gust/UX, o
    coses que depenen del context real de l'usuari que tu no pots comprovar.
- **En tancar la tasca del tot**: mou-la a **ACABAT** amb el breu "Que ha canviat al
  tancar-ho" (no s'esborra, es mou). I si el que has fet es un bug gros resolt, una
  fita tancada o una decisio arquitectonica rellevant, afegeix una entrada nova a
  `history.md` (`H-nnnnn`), incloent-hi la seccio "El que NO ha funcionat" (les vies
  descartades -- sovint la part mes valuosa).
- **Proporcio**: escala-ho. Una tasca trivial (Pas 0) no necessita entrada a
  `history.md` ni fabricar-ne una a `tasks.md`; nomes actualitza `tasks.md` si la
  tasca ja hi era registrada.
- **Anti-bucle** (CLAUDE.md, seccio m): actualitzar la documentacio es l'**ultim**
  pas de tancar, no l'inici d'una nova ronda de revisio. No facis revisio de
  coherencia sobre els teus propis canvis en `.md`.

## Politica de sub-agents

Fes servir sub-agents lliurement i sense preguntar -- l'usuari ho prefereix per
defecte. Recorre-hi quan la feina sigui genuinament independent i paral.lelitzable
(les lents de revisio del Pas 2, vies d'implementacio independents, cerques
amples). No els llancis per feina estrictament sequencial o trivial on el cost de
coordinacio supera el guany. El criteri es "ajuda aqui el paral.lelisme o
l'aillament?" -- no "tinc permis?" (el tens).

## Seguretat: que NO anul.la l'autonomia

Auto-executar vol dir sense confirmacio per a la *cadencia del flux de treball*. No
vol dir saltar-se les barreres dures de seguretat del projecte. Continua respectant
les regles del CLAUDE.md que exigeixen peticio explicita o confirmacio de l'usuari:

- Cap operacio de git d'escriptura (commit, push, add, branch, merge, reset,
  rebase...) tret que l'usuari ho hagi demanat en aquest mateix missatge.
- Confirma abans d'accions d'alt radi d'impacte: esborrar arxius/taules/branques,
  force-push, instal.lar/degradar dependencies, editar CI/CD, enviar res a serveis
  externs.
- Nomes fixos de causa arrel -- cap drecera destructiva (`--no-verify`, comentar o
  esborrar tests, saltar-se checks) per fer desapareixer un obstacle.

Fes primer tota la feina segura; quan arribis a una accio bloquejada, mostra-la
clarament i segueix amb tota la resta que puguis fer.
