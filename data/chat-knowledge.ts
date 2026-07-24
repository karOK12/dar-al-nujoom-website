// data/chat-knowledge.ts
export type Intent = {
  id: string;
  category: string;
  keywords: string[];
  responses: string[];
  fallbackResponses: string[];
};

export const knowledgeBase: Intent[] = [];
export const smartFallbacks: string[] = [];