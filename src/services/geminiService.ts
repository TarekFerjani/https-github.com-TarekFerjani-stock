
import { GoogleGenAI } from "@google/genai";

// Fix: Updated API key handling to use process.env.API_KEY as per the coding guidelines.
// This also resolves the TypeScript error regarding 'import.meta.env'.
// The API key is assumed to be pre-configured and available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  generateProductDescription: async (productName: string): Promise<string> => {
    try {
      const prompt = `Générez une description de produit convaincante et concise (environ 30-50 mots) pour: "${productName}". La description doit être en français.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Error generating product description:", error);
      return "Impossible de générer la description. Veuillez réessayer.";
    }
  },

  suggestProductCategory: async (productName: string): Promise<string> => {
    try {
      const prompt = `Suggérez une seule catégorie de produit appropriée pour: "${productName}". Choisissez parmi les suivantes: Électronique, Vêtements, Appareils Ménagers, Livres, Jouets, Sports, Alimentation, Meubles. Retournez uniquement le nom de la catégorie en français.`;
       const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text.trim();
    } catch (error) {
      console.error("Error suggesting product category:", error);
      return "";
    }
  },
};
