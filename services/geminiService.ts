import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, MissionBriefing } from "../types";

// Safely retrieve API key to avoid runtime crashes in environments where process is undefined
const getApiKey = (): string | undefined => {
  try {
    return process.env.API_KEY;
  } catch {
    return undefined;
  }
};

const apiKey = getApiKey();
// Only initialize if key exists, otherwise we'll use fallback immediately
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateMissionBriefing = async (difficulty: Difficulty): Promise<MissionBriefing> => {
  // Robust fallback briefing for offline mode or timeouts (Chinese)
  const fallbackBriefing: MissionBriefing = {
    title: "行动代号：孤狼",
    message: `指挥链路连接不稳定。已获得本地作战授权。立即拦截并消灭所有${difficulty === 'HARDCORE' ? '高危' : ''}敌对目标。祝你好运，飞行员。`
  };

  // Immediate fallback if no API key is present
  if (!ai) {
    console.warn("AI Client not initialized (Missing API Key). Using fallback.");
    // Small artificial delay to simulate "decryption" for UX consistency
    await new Promise(resolve => setTimeout(resolve, 800));
    return fallbackBriefing;
  }

  try {
    const prompt = `
      你是一位未来科幻世界的军事指挥官 AI。
      请为战斗机飞行员生成一段简短、紧迫的任务简报。
      
      当前任务难度等级：${difficulty}。
      
      风格要求：
      - 语言：简体中文 (Simplified Chinese)。
      - 如果难度是 EASY (简单)：语气要有鼓励性。
      - 如果难度是 NORMAL (普通)：语气严肃专业。
      - 如果难度是 HARDCORE (困难)：语气冷酷，警告飞行员这几乎是自杀式任务。
      
      请返回 JSON 格式，包含以下字段：
      - 'title': 简短帅气的任务代号（例如：天穹行动、破晓计划）。
      - 'message': 简报内容（最多2句话，充满临场感）。
    `;

    // Create a timeout promise to prevent infinite loading (4 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out")), 4000)
    );

    const apiCallPromise = ai.models.generateContent({
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

    // Race the API call against the timeout
    // @ts-ignore - Types between timeout and api response can be mixed in race
    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    const text = response.text;
    if (!text) throw new Error("No response text from AI");
    
    return JSON.parse(text) as MissionBriefing;

  } catch (error) {
    console.error("Mission Generation Failed (using fallback):", error);
    return fallbackBriefing;
  }
};