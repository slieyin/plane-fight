import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, MissionBriefing } from "../types";

// Safely retrieve API key
const getApiKey = (): string | undefined => {
  try {
    return process.env.API_KEY;
  } catch {
    return undefined;
  }
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Pre-defined briefings for offline mode or network blocking (China region friendly)
const OFFLINE_BRIEFINGS: Record<Difficulty, MissionBriefing[]> = {
  [Difficulty.EASY]: [
    { title: "训练行动：破晓", message: "新兵，这是你的首次实战模拟。敌机数量稀少，保持冷静，熟悉飞行控制系统。你可以做到的！" },
    { title: "巡逻任务：蓝天", message: "空域相对平静。只需清理零星的侦察机。这是热身的好机会，享受飞行吧。" }
  ],
  [Difficulty.NORMAL]: [
    { title: "拦截行动：铁雨", message: "雷达侦测到敌方中队正在集结。你的任务是切断他们的补给线。务必小心敌方的火力网。" },
    { title: "突袭计划：夜鹰", message: "敌方防御系统出现短暂漏洞。立即突入并尽可能消灭有生力量。情报显示敌机装备了新型护盾。" }
  ],
  [Difficulty.HARDCORE]: [
    { title: "绝境行动：诸神黄昏", message: "这几乎是一次自杀式任务。敌军主力已包围我方基地。不惜一切代价生存下去，飞行员！" },
    { title: "最终防线：孤狼", message: "指挥部已撤离，你是最后一道防线。面对无尽的敌军潮水，让它们见识一下什么叫绝望。" }
  ]
};

const getRandomFallback = (difficulty: Difficulty): MissionBriefing => {
  const options = OFFLINE_BRIEFINGS[difficulty];
  return options[Math.floor(Math.random() * options.length)];
};

export const generateMissionBriefing = async (difficulty: Difficulty): Promise<MissionBriefing> => {
  const fallbackBriefing = getRandomFallback(difficulty);

  // If no AI client, return immediately
  if (!ai) {
    // Simulate a short "processing" delay for UX consistency
    await new Promise(resolve => setTimeout(resolve, 600));
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

    // Reduced timeout to 1.5 seconds.
    // This ensures that if the API is blocked (e.g. in China without VPN), 
    // the user doesn't wait long before the offline content loads.
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Network timeout")), 1500)
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

    // Race the API call against the short timeout
    // @ts-ignore
    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    const text = response.text;
    if (!text) throw new Error("No text response");
    
    return JSON.parse(text) as MissionBriefing;

  } catch (error) {
    // Silently fail to console and return fallback
    // content to ensure gameplay is never blocked
    console.warn("Switching to Offline Briefing:", error);
    return fallbackBriefing;
  }
};