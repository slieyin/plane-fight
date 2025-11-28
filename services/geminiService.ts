import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, MissionBriefing } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMissionBriefing = async (difficulty: Difficulty): Promise<MissionBriefing> => {
  try {
    const prompt = `
      You are a futuristic military commander AI. 
      Generate a very short, high-stakes mission briefing for a fighter pilot.
      The difficulty level is ${difficulty}.
      For 'EASY', be encouraging.
      For 'NORMAL', be serious.
      For 'HARDCORE', be grim and warn of near-certain death.
      
      Return JSON with 'title' (short cool mission name) and 'message' (max 2 sentences).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            message: { type: Type.STRING }
          },
          required: ["title", "message"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as MissionBriefing;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if API fails
    return {
      title: "OPERATION: SILENT FALLBACK",
      message: `Communications offline. Engage all ${difficulty} targets at will. Good luck, pilot.`
    };
  }
};
