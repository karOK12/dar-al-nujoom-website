// lib/chat-engine.ts
import { knowledgeBase, smartFallbacks, Intent } from "@/data/chat-knowledge";

export const analyzeAndRespond = (userMessage: string, lastBotMessage?: string): { text: string; isEscalation: boolean } => {
  const normalizedText = userMessage.toLowerCase().replace(/[^\w\s\u0600-\u06FF]/gi, '');
  
  let bestIntent: Intent | null = null;
  let highestScore = 0;

  // 1. تحليل النص وحساب التطابق مع النوايا
  for (const intent of knowledgeBase) {
    let score = 0;
    for (const keyword of intent.keywords) {
      if (normalizedText.includes(keyword)) {
        score += 1;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestIntent = intent;
    }
  }

  let responseText = "";
  let isEscalation = false;

  // 2. اختيار الرد
  if (bestIntent && highestScore >= 1) {
    // تصفية الردود لتجنب تكرار نفس الرد بالضبط فوراً
    const availableResponses = bestIntent.responses.filter(r => r !== lastBotMessage);
    const pool = availableResponses.length > 0 ? availableResponses : bestIntent.responses;
    
    responseText = pool[Math.floor(Math.random() * pool.length)];
    isEscalation = bestIntent.id === "escalation";
  } else {
    // استخدام الردود العامة الاحترافية عند عدم الفهم
    const availableFallbacks = smartFallbacks.filter(r => r !== lastBotMessage);
    const pool = availableFallbacks.length > 0 ? availableFallbacks : smartFallbacks;
    responseText = pool[Math.floor(Math.random() * pool.length)];
  }

  return { text: responseText, isEscalation };
};

// محاكاة تأخير بشري طبيعي (بين 1.2 و 2.5 ثانية)
export const getTypingDelay = () => Math.floor(1200 + Math.random() * 1300);