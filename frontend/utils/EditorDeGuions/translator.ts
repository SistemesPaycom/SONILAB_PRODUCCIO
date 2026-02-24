
// utils/EditorDeGuions/translator.ts
import { getTranslationPrompt } from './translationPrompt';
import { GoogleGenAI } from "@google/genai";

/**
 * Tradueix un guió utilitzant l'API de Gemini.
 * Implementa una lògica de reintent per evitar errors puntuals de connexió o "cold start".
 */
export const translateScript = async (
  content: string,
  sourceLang: string,
  targetLang: string,
  retryCount = 1
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // 1. Obtenim les instruccions detallades per a la IA.
    const systemInstruction = getTranslationPrompt(sourceLang, targetLang);

    console.log(`Enviant a Gemini API (gemini-3-flash-preview)... Intent: ${2 - retryCount}`);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: content,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3, // Temperatura baixa per a més fidelitat en traducció tècnica
      },
    });

    const translatedText = response.text;

    if (typeof translatedText !== 'string' || !translatedText.trim()) {
      throw new Error("La resposta de l'API és buida o invàlida.");
    }

    console.log("Traducció rebuda correctament.");
    return translatedText;

  } catch (error: any) {
    console.error("Error en la traducció:", error);

    // Si ens queden intents, provem de nou després d'una petita pausa
    if (retryCount > 0) {
      console.log("Reintentant traducció en 1.5 segons...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      return translateScript(content, sourceLang, targetLang, retryCount - 1);
    }

    // Si hem esgotat els intents, informem a l'usuari
    const errorMsg = error?.message || "Error desconegut";
    alert(`No s'ha pogut completar la traducció després de diversos intents.\n\nDetall: ${errorMsg}`);
    
    // Retornem el contingut original per evitar trencar el flux, 
    // App.tsx detectarà que és igual i marcarà l'error a la tasca.
    return content;
  }
};
