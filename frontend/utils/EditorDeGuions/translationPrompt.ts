// utils/EditorDeGuions/translationPrompt.ts

/**
 * Genera el prompt detallat per a la IA de traducció,
 * especificant les regles per a guions de doblatge.
 * @param sourceLang - L'idioma d'origen (ex: 'Català')
 * @param targetLang - L'idioma de destí (ex: 'Castellà')
 * @returns El prompt complet per a la IA.
 */
export function getTranslationPrompt(sourceLang: string, targetLang: string): string {
  return `
### INSTRUCCIONS DE TRADUCCIÓ PER A GUIONS DE DOBLATGE ###

**Objectiu:** Traduir un guió de doblatge de ${sourceLang} a ${targetLang} mantenint l'estructura i, sobretot, l'ajust per a la sincronització labial.

**Context:** El text proporcionat és un guió professional. Conté marques de temps, noms de personatges i diàlegs. La teva tasca és traduir ÚNICAMENT el text dels diàlegs.

---

**REGLES IMPRESCINDIBLES:**

1.  **NO TRADUIR:**
    *   **Noms de Personatges:** Qualsevol text entre asteriscs (ex: \`*REPICAR*\`, \`*INSERT*\`). Aquests s'han de mantenir exactament iguals.
    *   **Marques de TAKE:** Línies que comencin per \`TAKE #...\`. Mantén la línia intacta.
    *   **Codis de Temps (Timecodes):** Qualsevol text amb format \`HH:MM:SS\` o similar. Mantén-lo intacte.
    *   **Contingut entre Parèntesis:** Ignora i mantén intacte QUALSEVOL text que estigui dins de parèntesis \`(...)\`. Aquest text són acotacions o informació tècnica, no diàleg.

2.  **TRADUIR ÚNICAMENT:**
    *   El text del diàleg que apareix DESPRÉS del nom del personatge i de les acotacions.

3.  **CONSERVACIÓ DE NOMS PROPIS:**
    *   Els noms de persones, llocs, etc. (ex: "Marc", "Gold Roger") NO s'han de traduir ni adaptar. Si un personatge es diu "Marc" en l'original, ha de seguir sent "Marc" en la traducció.

4.  **MANTENIMENT DE L'AJUST (CRÍTIC):**
    *   Aquesta és la regla més important. El guió original ja està "ajustat", la qual cosa significa que la longitud i el ritme de les frases estan pensats per encaixar amb els moviments de boca dels actors en pantalla.
    *   Al traduir, has de prioritzar que la frase resultant tingui una **durada i un número de síl·labes similar** a l'original.
    *   Sempre que sigui possible, intenta que les paraules amb **sons labials (p, b, m)** en l'original es corresponguin amb paraules amb sons similars a la traducció en la mateixa posició de la frase.
    *   **MAI sacrifiquis el significat o la intenció original** per aconseguir l'ajust. L'objectiu és trobar el millor equilibri: una traducció natural i fidel que, a més, respecti el ritme i l'ajust del text original.

---

**Format d'Entrada:**
Rebràs el guió complet.

**Format de Sortida:**
Has de retornar el guió complet amb la mateixa estructura, però amb els diàlegs traduïts segons aquestes regles.

---
`;
}
