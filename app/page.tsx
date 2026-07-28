"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ============================================================
// TYPES & INTERFACES (نفس السابق مع إضافة حالات)
// ============================================================

type Sender = "user" | "bot" | "agent" | "system";
type AgentStatus = "online" | "away" | "offline";
type Department = 'support' | 'ads' | 'technical';
type ChatStatus = "typing" | "online" | "waiting" | "inactive" | "closed";
type ProductShape = "circle" | "rectangle" | "square" | "portrait";
type IntentType = "pricing" | "technical" | "contact" | "greeting" | "farewell" | "general" | "escalation";
type ConversationPhase = "initial" | "ongoing" | "clarifying" | "closing" | "ended";

interface Attachment {
  type: 'image' | 'link' | 'card' | 'product';
  url?: string;
  title?: string;
  description?: string;
}

interface Message {
  id: string;
  sender: Sender;
  role?: "user" | "assistant";
  text: string;
  time: string;
  status?: "sent" | "delivered" | "read";
  attachments?: Attachment[];
}

interface Agent {
  employeeId: string;
  name: string;
  img: string;
  role: string;
  department: Department;
  status: AgentStatus;
  lastActivity: string;
  isBusy: boolean;
}

interface DepartmentOption {
  id: Department;
  name: string;
  description: string;
}

interface TrendingProduct {
  id: number;
  name: string;
  desc: string;
  img: string;
  shape: ProductShape;
}

interface UserIntent {
  type: IntentType;
  targetDepartment?: Department;
  confidence: number;
}

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

const PRICING_CONFIG = {
  weekly: { name: "الباقة الأسبوعية", price: 135, currency: "دولار", duration: "أسبوع", views: "50,000", platforms: "منصتين رئيسيتين" },
  monthly: { name: "الباقة الشهرية", price: 405, currency: "دولار", duration: "شهر", views: "200,000", platforms: "3 منصات رئيسية" },
  professional: { name: "الباقة الاحترافية", price: 810, currency: "دولار", duration: "شهر", views: "500,000+", platforms: "جميع المنصات مع مدير حساب مخصص" }
};

const CONTACT_INFO = {
  website: "https://dar-alnujum.com",
  email: "info@dar-alnujum.com",
  phone: "+966 50 000 0000",
  social: { twitter: "@DarAlnujum", instagram: "@DarAlnujum" }
};

const SESSION_TIMEOUTS = {
  IDLE_TO_CLOSED: 59,
  QUEUE_CHECK_INTERVAL: 8000,
};

const SUPPORT_AGENTS: Agent[] = [
  { employeeId: "EMP-001", name: "خالد الأحمد", img: "https://i.pravatar.cc/150?img=68", role: "خدمة العملاء", department: 'support', status: 'online', lastActivity: new Date().toISOString(), isBusy: false },
  { employeeId: "EMP-002", name: "نورة السالم", img: "https://i.pravatar.cc/150?img=44", role: "دعم فني متقدم", department: 'technical', status: 'online', lastActivity: new Date().toISOString(), isBusy: false },
  { employeeId: "EMP-003", name: "سارة المالكي", img: "https://i.pravatar.cc/150?img=47", role: "مسؤولة الإعلانات", department: 'ads', status: 'online', lastActivity: new Date().toISOString(), isBusy: false },
];

const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { id: 'support', name: 'فريق الدعم وخدمة العملاء', description: 'للاستفسارات العامة وخدمة العملاء' },
  { id: 'ads', name: 'فريق الإعلانات والمبيعات', description: 'لحجز الإعلانات والاستفسار عن الأسعار والباقات' },
  { id: 'technical', name: 'فريق الدعم الفني', description: 'لحل المشاكل التقنية وأخطاء الموقع' },
];

const TRENDING_PRODUCTS: TrendingProduct[] = [
  { id: 1, name: "كاميرا تصوير احترافية", desc: "خصم 25% لفترة محدودة", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&h=150&fit=crop", shape: "circle" },
  { id: 2, name: "سماعات استوديو", desc: "عزل ضوضاء فائق الجودة", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=150&fit=crop", shape: "rectangle" },
  { id: 3, name: "إضاءة Ring Light", desc: "مثالية لصناع المحتوى", img: "https://images.unsplash.com/photo-1615469062329-5f23633c1182?w=150&h=150&fit=crop", shape: "square" },
  { id: 4, name: "ميكروفون بث مباشر", desc: "جودة صوت استثنائية", img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=150&h=200&fit=crop", shape: "portrait" },
];

// قوائم ردود الموظفين الديناميكية (سياقية)
const AGENT_REPLIES = {
  ads: {
    greeting: ["أهلاً بك، أنا سارة من فريق الإعلانات، كيف يمكنني مساعدتك في اختيار الباقة المناسبة؟", "مرحباً، معك سارة، متخصصة في الإعلانات. تفضل، أخبرني عن احتياجاتك."],
    pricing: [
      "تفضل، هذه باقاتنا الأساسية: الأسبوعية بـ 135 دولار، الشهرية بـ 405، والاحترافية بـ 810. هل تود الاطلاع على تفاصيل أكثر؟",
      "باقاتنا مصممة لتناسب جميع الميزانيات. الأسبوعية 135$، الشهرية 405$، والاحترافية 810$. أي منها يثير اهتمامك؟"
    ],
    general: [
      "بكل سرور، كيف أقدر أساعدك في اختيار الباقة؟",
      "حاضر، أنا معك. هل لديك ميزانية محددة في ذهنك؟",
      "تفضل، أنا هنا لمساعدتك في أي استفسار عن الإعلانات.",
      "يسعدني خدمتك، ما هو السؤال الذي تريد طرحه؟"
    ],
    clarification: ["عذراً، لم أفهم طلبك بوضوح. هل يمكنك توضيح أكثر؟", "آسف، لم أستوعب ما تقصده. هل تفضل إعادة الصياغة؟"]
  },
  technical: {
    greeting: ["أهلاً، أنا نورا من الدعم الفني. أخبرني عن المشكلة وسأساعدك.", "مرحباً، معك نورا، خبيرة الدعم الفني. كيف أقدر أحل مشكلتك؟"],
    technical: [
      "حاضر، سأقوم بفحص الأمر. هل يمكنك تزويدي برقم الطلب أو وصف دقيق للمشكلة؟",
      "تمام، دعوني أراجع التفاصيل. هل واجهت هذه المشكلة مؤخراً أم أنها مستمرة؟"
    ],
    general: [
      "أنا هنا لمساعدتك في أي مشكلة تقنية، تفضل.",
      "حاضر، أنا أتابع معك، اشرح لي المشكلة بالتفصيل.",
      "بكل سرور، كيف أقدر أساعدك؟",
      "يسعدني خدمتك، ما هو العطل الذي تواجهه؟"
    ],
    clarification: ["عذراً، لم أستوعب المشكلة بوضوح، هل يمكنك توضيح أكثر؟", "آسف، أحتاج إلى تفاصيل إضافية لفهم المشكلة."]
  },
  support: {
    greeting: ["أهلاً بك، أنا خالد من خدمة العملاء. كيف يمكنني مساعدتك؟", "مرحباً، معك خالد، متخصص خدمة العملاء. تفضل بسؤالك."],
    general: [
      "أنا هنا للإجابة عن استفساراتك، تفضل.",
      "حاضر، أنا معك، اسأل ما تشاء.",
      "بكل سرور، كيف أقدر أساعدك؟",
      "يسعدني خدمتك، ما هو سؤالك؟"
    ],
    clarification: ["عذراً، لم أفهم طلبك بالكامل، هل يمكنك إعادة صياغته؟", "آسف، أحتاج توضيحاً أكثر لفهم احتياجك."]
  }
};

// رسائل الترحيب للمساعد الذكي (عشوائية)
const GREETING_MESSAGES = [
  "أهلاً بك، كيف يمكنني مساعدتك اليوم؟",
  "مرحباً بك في دار النجوم، يسعدني مساعدتك.",
  "أهلاً وسهلاً، أخبرني بما تحتاج وسأساعدك.",
  "يسعدني وجودك، كيف أستطيع خدمتك؟"
];

// رسائل الختام للموظفين
const CLOSING_MESSAGES = [
  "سعدنا بخدمتك، إذا احتجت أي مساعدة مستقبلاً فنحن هنا.",
  "شكراً لتواصلك معنا، نتمنى لك يوماً سعيداً.",
  "نتمنى أن نكون قد قدمنا لك المساعدة المطلوبة، أهلاً بك مجدداً في أي وقت."
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

const normalizeArabicText = (text: string): string => {
  return text
    .normalize("NFKD")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

// تحليل النية بشكل أكثر دقة
const analyzeUserIntent = (inputText: string): UserIntent => {
  const normalized = normalizeArabicText(inputText);
  
  // الكشف عن طلب الأسعار بشكل صريح
  const pricingKeywords = ["سعر", "اسعار", "تكلفة", "باقه", "باقات", "اعلان", "عرض سعر", "كم سعر", "كم تكلفة", "ارسال الاسعار", "عرض الاسعار", "ما هي الباقات", "ما تكلفة", "كم سعر الاعلان", "اريد الباقات"];
  if (pricingKeywords.some(kw => normalized.includes(kw))) {
    return { type: "pricing", targetDepartment: 'ads', confidence: 0.98 };
  }
  
  if (normalized.includes("خطأ") || normalized.includes("لا يعمل") || normalized.includes("مشكله") || normalized.includes("دخول") || normalized.includes("كلمة مرور") || normalized.includes("عطل")) {
    return { type: "technical", targetDepartment: 'technical', confidence: 0.95 };
  }
  if (normalized.includes("ايميل") || normalized.includes("بريد") || normalized.includes("هاتف") || normalized.includes("تواصل") || normalized.includes("موقع")) {
    return { type: "contact", targetDepartment: 'support', confidence: 0.95 };
  }
  if (normalized.includes("شكرا") || normalized.includes("مع السلامه") || normalized.includes("انتهيت") || normalized.includes("هذا كل شيء") || normalized.includes("كفاية")) {
    return { type: "farewell", confidence: 0.95 };
  }
  if (normalized.includes("مرحبا") || normalized.includes("هلا") || normalized.includes("السلام عليكم")) {
    return { type: "greeting", confidence: 0.95 };
  }
  if (normalized.includes("موظف") || normalized.includes("بشري") || normalized.includes("تحويل") || normalized.includes("خدمة عملاء") || normalized.includes("تكلم مع موظف")) {
    return { type: "escalation", confidence: 0.95 };
  }
  
  return { type: "general", confidence: 0.5 };
};

const findAvailableAgent = (department: Department): Agent | null => {
  return SUPPORT_AGENTS.find(agent => agent.department === department && agent.status === 'online' && !agent.isBusy) || null;
};

const createMessage = (
  sender: Sender, 
  text: string, 
  role?: "user" | "assistant", 
  status: "sent" | "delivered" | "read" = "read",
  attachments?: Attachment[]
): Message => ({
  id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  sender, 
  text, 
  role,
  time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
  status,
  attachments
});

// دالة لاختيار رد عشوائي من قائمة مع إمكانية تجنب التكرار
const getRandomReply = (replies: string[], usedReplies?: Set<string>): string => {
  if (usedReplies && usedReplies.size >= replies.length) usedReplies.clear();
  const available = usedReplies ? replies.filter(r => !usedReplies.has(r)) : replies;
  const chosen = available[Math.floor(Math.random() * available.length)];
  if (usedReplies) usedReplies.add(chosen);
  return chosen;
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Home() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  
  const [currentSpeaker, setCurrentSpeaker] = useState<"bot" | "agent">("bot");
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [sessionAgents, setSessionAgents] = useState<Agent[]>([]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("online");
  const [isQueued, setIsQueued] = useState(false);
  const [showDepartmentSelection, setShowDepartmentSelection] = useState(false);
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // حالة الـ Loader الداخلي (لعمليات متعددة)
  const [isProcessing, setIsProcessing] = useState(false);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // حركة العين والوجه
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false); // للتحكم في الفم
  const [isThinking, setIsThinking] = useState(false); // للنظر للأعلى
  const targetEyePos = useRef({ x: 0, y: 0 });
  const currentEyePos = useRef({ x: 0, y: 0 });
  
  const chatButtonRef = useRef<HTMLDivElement>(null);

  // Refs للمتغيرات التي تتغير كثيراً
  const currentSpeakerRef = useRef(currentSpeaker);
  const chatStatusRef = useRef(chatStatus);
  const lastActivityTimeRef = useRef(Date.now());
  const isSendingRef = useRef(false);
  const previousAgentRepliesRef = useRef<Set<string>>(new Set());
  const usedGreetingsRef = useRef<Set<string>>(new Set()); // لتجنب تكرار الترحيب
  
  // سياق المحادثة
  const conversationContextRef = useRef<string[]>([]);
  const lastHandledTopicRef = useRef<string | null>(null);
  const conversationPhaseRef = useRef<ConversationPhase>("initial");
  const lastAgentMessageRef = useRef<string>("");
  const agentReplyHistoryRef = useRef<Set<string>>(new Set()); // لتجنب تكرار الردود
  
  // متغير لتتبع ما إذا تم الترحيب بالفعل في الجلسة الحالية
  const hasGreetedRef = useRef(false);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { chatStatusRef.current = chatStatus; }, [chatStatus]);

  // ============================================================
  // أولاً: شريط التحميل البنفسجي (سلس، يصل 100%، يختفي تدريجياً) – محسّن للعمليات
  // ============================================================
  useEffect(() => {
    // تحميل الصفحة الرئيسي
    let progress = 0;
    let isComplete = false;
    let rafId: number;

    const updateProgress = (target: number, duration: number = 400) => {
      if (isComplete) return;
      const startTime = performance.now();
      const startProgress = progress;
      
      const animate = (currentTime: number) => {
        if (isComplete) return;
        const elapsed = currentTime - startTime;
        const progressRatio = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progressRatio, 3);
        
        progress = startProgress + (target - startProgress) * eased;
        setLoadingProgress(Math.min(progress, 99));
        
        if (progressRatio < 1) rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
    };

    updateProgress(15, 300);
    const t1 = setTimeout(() => updateProgress(40, 500), 200);
    const t2 = setTimeout(() => updateProgress(75, 600), 600);
    const t3 = setTimeout(() => updateProgress(95, 500), 1200);

    const handleReadyState = () => { if (document.readyState === 'interactive') updateProgress(98, 300); };
    const handleLoad = () => {
      isComplete = true;
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (rafId) cancelAnimationFrame(rafId);
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 600);
    };

    document.addEventListener('readystatechange', handleReadyState);
    window.addEventListener('load', handleLoad);

    const fallback = setTimeout(() => {
      if (!isComplete) {
        isComplete = true;
        if (rafId) cancelAnimationFrame(rafId);
        setLoadingProgress(100);
        setTimeout(() => setLoadingProgress(0), 600);
      }
    }, 10000);

    return () => {
      document.removeEventListener('readystatechange', handleReadyState);
      window.removeEventListener('load', handleLoad);
      clearTimeout(fallback); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // دالة لعرض Loader أثناء أي عملية (API، تحويل، إلخ)
  const startLoader = useCallback(() => {
    setIsProcessing(true);
    // نبدأ من 0 إلى 90 تدريجياً
    setLoadingProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 8 + 1; // زيادة عشوائية
        if (progress > 90) progress = 90;
        setLoadingProgress(progress);
      }
    }, 200);
    processingTimeoutRef.current = setTimeout(() => {
      clearInterval(interval);
      // عند انتهاء العملية يتم تعيين 100 ثم إخفاء
    }, 10000); // مهلة أمان
    return () => {
      clearInterval(interval);
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    };
  }, []);

  const finishLoader = useCallback(() => {
    setLoadingProgress(100);
    setTimeout(() => {
      setLoadingProgress(0);
      setIsProcessing(false);
    }, 400);
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  // ============================================================
  // عاشراً: حركة العين البشرية الواقعية (محسّنة)
  // ============================================================
  useEffect(() => {
    let rafId: number;
    const animateEye = () => {
      // حركة العين: تتبع الهدف مع تخميد
      const dx = targetEyePos.current.x - currentEyePos.current.x;
      const dy = targetEyePos.current.y - currentEyePos.current.y;
      // إضافة تأثير Micro Movement (اهتزاز بسيط)
      const microX = (Math.random() - 0.5) * 0.1;
      const microY = (Math.random() - 0.5) * 0.1;
      
      currentEyePos.current.x += dx * 0.12 + microX;
      currentEyePos.current.y += dy * 0.12 + microY;
      
      // العودة للمنتصف تدريجياً إذا لم يكن هناك هدف
      if (Math.abs(targetEyePos.current.x) < 0.01 && Math.abs(targetEyePos.current.y) < 0.01) {
        currentEyePos.current.x *= 0.95;
        currentEyePos.current.y *= 0.95;
        if (Math.abs(currentEyePos.current.x) < 0.01) currentEyePos.current.x = 0;
        if (Math.abs(currentEyePos.current.y) < 0.01) currentEyePos.current.y = 0;
      }
      
      // إذا كان في حالة تفكير، ننظر للأعلى
      if (isThinking) {
        currentEyePos.current.y = -2.5;
      }
      
      setEyePos({ x: currentEyePos.current.x, y: currentEyePos.current.y });
      rafId = requestAnimationFrame(animateEye);
    };
    rafId = requestAnimationFrame(animateEye);
    return () => cancelAnimationFrame(rafId);
  }, [isThinking]);

  // تتبع الماوس
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (chatButtonRef.current && !open) {
        const rect = chatButtonRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const maxOffset = 2.8;
        const rawX = (e.clientX - centerX) / 40;
        const rawY = (e.clientY - centerY) / 40;
        
        targetEyePos.current = {
          x: Math.max(-maxOffset, Math.min(maxOffset, rawX)),
          y: Math.max(-maxOffset, Math.min(maxOffset, rawY))
        };
      }
    };
    
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [open]);

  // عند فتح المحادثة: توجيه النظر إلى الزاوية اليسرى العليا (كأنه ينظر للمستخدم)
  useEffect(() => {
    if (open) {
      targetEyePos.current = { x: -2.2, y: 2.2 };
      const timer = setTimeout(() => {
        targetEyePos.current = { x: 0, y: 0 };
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      targetEyePos.current = { x: 0, y: 0 };
    }
  }, [open]);

  // الرمش
  useEffect(() => {
    let blinkTimeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const randomDelay = 2500 + Math.random() * 3500;
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 120);
      }, randomDelay);
    };
    scheduleBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  // ============================================================
  // LOCAL STORAGE – تحسين: حفظ حالة الترحيب أيضاً
  // ============================================================
  const saveStateToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('dar-alnujum-chat-state', JSON.stringify({
        messages,
        currentSpeaker,
        currentAgent,
        sessionAgents,
        chatStatus,
        isQueued,
        hasGreeted: hasGreetedRef.current,
        conversationPhase: conversationPhaseRef.current,
        usedGreetings: Array.from(usedGreetingsRef.current),
        agentReplyHistory: Array.from(agentReplyHistoryRef.current)
      }));
    } catch (e) { console.error('Save state error:', e); }
  }, [messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, isQueued]);

  const loadStateFromStorage = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('dar-alnujum-chat-state');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      
      setMessages(parsed.messages || []);
      setCurrentSpeaker("bot");
      setCurrentAgent(null);
      setSessionAgents([]);
      setChatStatus("online");
      setIsQueued(false);
      setShowDepartmentSelection(false);
      previousAgentRepliesRef.current.clear();
      conversationContextRef.current = [];
      lastHandledTopicRef.current = null;
      conversationPhaseRef.current = parsed.conversationPhase || "initial";
      lastAgentMessageRef.current = "";
      hasGreetedRef.current = parsed.hasGreeted || false;
      if (parsed.usedGreetings) usedGreetingsRef.current = new Set(parsed.usedGreetings);
      if (parsed.agentReplyHistory) agentReplyHistoryRef.current = new Set(parsed.agentReplyHistory);
      return true;
    } catch (e) { 
      console.error('Load state error:', e); 
      return false; 
    }
  }, []);

  // ============================================================
  // ثالثاً: انتهاء جلسة الموظف (59 ثانية) – مع إعادة ضبط كاملة
  // ============================================================
  useEffect(() => {
    if (currentSpeaker !== "agent") return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - lastActivityTimeRef.current) / 1000;

      if (elapsedSeconds >= SESSION_TIMEOUTS.IDLE_TO_CLOSED) {
        // إرسال رسالة انتهاء الجلسة
        const timeoutMsg = createMessage(
          "system",
          "انتهت جلسة الموظف بسبب عدم وجود نشاط، وتم إعادتك إلى المساعد الذكي.",
          "assistant"
        );
        setMessages(prev => [...prev, timeoutMsg]);
        // إعادة ضبط الجلسة (حذف كل شيء)
        resetToBotSession();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSpeaker]);

  // دالة إعادة ضبط الجلسة بالكامل (للاستخدام عند الختام أو انتهاء المهلة)
  const resetToBotSession = useCallback(() => {
    // حذف رسائل الموظف (نحتفظ برسائل النظام فقط ورسائل المستخدم؟ المطلوب حذف كل شيء)
    // لكن حسب الطلب: حذف جميع رسائل جلسة الموظف، وإعادة تشغيل المساعد الذكي.
    // نختار الاحتفاظ برسائل المستخدم فقط ليكون السياق، لكننا سنقوم بمسح الكل وبدء جلسة جديدة.
    // لكن للحفاظ على تجربة أفضل، سنقوم بحذف جميع الرسائل وبدء جلسة جديدة بالكامل.
    setMessages([]);
    setCurrentSpeaker("bot");
    setCurrentAgent(null);
    setSessionAgents([]);
    setChatStatus("online");
    setIsQueued(false);
    setShowDepartmentSelection(false);
    conversationPhaseRef.current = "initial";
    lastHandledTopicRef.current = null;
    lastAgentMessageRef.current = "";
    previousAgentRepliesRef.current.clear();
    conversationContextRef.current = [];
    agentReplyHistoryRef.current.clear();
    hasGreetedRef.current = false;
    usedGreetingsRef.current.clear();
    // إضافة ترحيب جديد
    const greeting = getRandomReply(GREETING_MESSAGES, usedGreetingsRef.current);
    setMessages([createMessage("bot", greeting, "assistant")]);
    hasGreetedRef.current = true;
    lastActivityTimeRef.current = Date.now();
    // حفظ الحالة
    saveStateToStorage();
  }, [saveStateToStorage]);

  // ============================================================
  // دالة بدء جلسة موظف
  // ============================================================
  const startAgentSession = useCallback((agent: Agent) => {
    setCurrentAgent(agent);
    setSessionAgents(prev => prev.find(a => a.employeeId === agent.employeeId) ? prev : [...prev, agent]);
    setCurrentSpeaker("agent");
    setIsQueued(false);
    setShowDepartmentSelection(false);
    previousAgentRepliesRef.current.clear();
    conversationContextRef.current = [];
    lastHandledTopicRef.current = null;
    conversationPhaseRef.current = "initial";
    lastAgentMessageRef.current = "";
    agentReplyHistoryRef.current.clear();
    
    // اختيار ترحيب خاص بالقسم
    const dept = agent.department;
    const deptReplies = AGENT_REPLIES[dept]?.greeting || ["أهلاً بك، أنا هنا لمساعدتك."];
    const greeting = getRandomReply(deptReplies, agentReplyHistoryRef.current);
    const welcomeMsg = createMessage("agent", greeting, "assistant");
    setMessages(prev => [...prev, welcomeMsg]);
    setChatStatus("online");
    lastActivityTimeRef.current = Date.now();
    hasGreetedRef.current = true; // تم الترحيب في هذه الجلسة
    // حفظ الحالة
    saveStateToStorage();
  }, [saveStateToStorage]);

  // ============================================================
  // ESCALATION & TRANSFER LOGIC (محسّن)
  // ============================================================
  const handleHumanRequest = useCallback(() => {
    setShowDepartmentSelection(true);
    setChatStatus("online");
    const deptMsg = createMessage("system", "يرجى اختيار القسم الذي ترغب في التواصل معه:");
    setMessages(prev => [...prev, deptMsg]);
  }, []);

  const initiateDepartmentTransfer = useCallback((dept: Department) => {
    setChatStatus("typing");
    const deptOption = DEPARTMENT_OPTIONS.find(d => d.id === dept);
    
    setMessages(prev => [...prev, createMessage("system", `جاري البحث عن موظف متاح في ${deptOption?.name}...`)]);
    setShowDepartmentSelection(false);
    // بدء الـ Loader
    startLoader();

    setTimeout(() => {
      const availableAgent = findAvailableAgent(dept);
      if (availableAgent) {
        finishLoader();
        startAgentSession(availableAgent);
      } else {
        setIsQueued(true);
        setMessages(prev => [...prev, createMessage("system", `جميع موظفي ${deptOption?.name} مشغولون حالياً. تم وضعك في قائمة الانتظار.`)]);
        setChatStatus("waiting");
        finishLoader();
        
        // محاولة مرة أخرى بعد فترة
        setTimeout(() => {
          const fallbackAgent = findAvailableAgent(dept) || SUPPORT_AGENTS.find(a => a.department === dept);
          if (fallbackAgent) {
            startLoader();
            setTimeout(() => {
              startAgentSession(fallbackAgent);
              setMessages(prev => [...prev, createMessage("system", "تم توصيلك بأحد موظفينا. نعتذر عن الانتظار.")]);
              finishLoader();
            }, 500);
          }
        }, SESSION_TIMEOUTS.QUEUE_CHECK_INTERVAL);
      }
    }, 1500);
  }, [startAgentSession, startLoader, finishLoader]);

  // ============================================================
  // تحويل داخلي بين الأقسام (مع نقل السياق)
  // ============================================================
  const performInternalTransfer = useCallback((targetDept: Department, currentAgentName: string) => {
    const targetAgent = findAvailableAgent(targetDept) || SUPPORT_AGENTS.find(a => a.department === targetDept);
    if (!targetAgent) return;

    const lastUserMsg = messages.filter(m => m.sender === 'user').pop()?.text || "استفسار عام";
    
    const transferMsg = createMessage(
      "agent",
      `لحظة واحدة، هذا الاستفسار يخص قسم ${targetDept === 'ads' ? 'الإعلانات' : 'الدعم الفني'}. سأقوم بتحويلك الآن إلى زميلي المختص لمساعدتك بشكل أدق.`,
      "assistant"
    );
    
    setMessages(prev => [...prev, transferMsg]);
    startLoader();
    
    setTimeout(() => {
      setSessionAgents(prev => {
        if (prev.find(a => a.employeeId === targetAgent!.employeeId)) return prev;
        return [...prev, targetAgent!];
      });
      
      setCurrentAgent(targetAgent);
      // نقل السياق: نحتفظ بآخر 3 رسائل من المستخدم والموظف السابق
      const contextMessages = messages.slice(-5).filter(m => m.sender !== 'system').map(m => m.text);
      conversationContextRef.current = contextMessages;
      lastHandledTopicRef.current = null; // نعيد تعيين الموضوع لأن الموظف الجديد سيبدأ من جديد
      conversationPhaseRef.current = "ongoing";
      lastAgentMessageRef.current = "";
      agentReplyHistoryRef.current.clear();
      
      setTimeout(() => {
        const newAgentWelcome = createMessage(
          "agent",
          `أهلاً بك، أنا ${targetAgent!.name}. اطلعت على محادثتك مع الأستاذ ${currentAgentName} بخصوص "${lastUserMsg}"، وسأتابع معك من هنا مباشرة. تفضل.`,
          "assistant"
        );
        
        setMessages(prev => [...prev, newAgentWelcome]);
        setChatStatus("online");
        isSendingRef.current = false;
        lastActivityTimeRef.current = Date.now();
        finishLoader();
      }, 1000);
    }, 1500);
  }, [messages, startLoader, finishLoader]);

  // ============================================================
  // الكشف عن الختام وردود الموظف السياقية
  // ============================================================
  const detectFarewell = useCallback((text: string): boolean => {
    const intent = analyzeUserIntent(text);
    return intent.type === "farewell" && intent.confidence > 0.8;
  }, []);

  // توليد رد للموظف بناءً على السياق والقسم
  const generateAgentReply = useCallback((userText: string, agent: Agent): string => {
    const dept = agent.department;
    const intent = analyzeUserIntent(userText);
    const phase = conversationPhaseRef.current;
    const context = conversationContextRef.current;
    const lastTopic = lastHandledTopicRef.current;

    // إذا كانت رسالة ختام
    if (intent.type === "farewell") {
      conversationPhaseRef.current = "closing";
      return getRandomReply(CLOSING_MESSAGES, agentReplyHistoryRef.current);
    }

    // إذا كان السؤال عن الأسعار والقسم إعلانات
    if (intent.type === "pricing" && dept === 'ads') {
      if (lastTopic !== 'pricing_details') {
        lastHandledTopicRef.current = 'pricing_details';
        // عرض الأسعار بشكل مفصل
        const pricingText = `تفضل، هذه باقاتنا الأساسية:\n🔹 ${PRICING_CONFIG.weekly.name}: ${PRICING_CONFIG.weekly.price} ${PRICING_CONFIG.weekly.currency} (مدة ${PRICING_CONFIG.weekly.duration}، ${PRICING_CONFIG.weekly.views} ظهور، ${PRICING_CONFIG.weekly.platforms}).\n🔹 ${PRICING_CONFIG.monthly.name}: ${PRICING_CONFIG.monthly.price} ${PRICING_CONFIG.monthly.currency} (مدة ${PRICING_CONFIG.monthly.duration}، ${PRICING_CONFIG.monthly.views} ظهور، ${PRICING_CONFIG.monthly.platforms}).\n🔹 ${PRICING_CONFIG.professional.name}: ${PRICING_CONFIG.professional.price} ${PRICING_CONFIG.professional.currency} (مدة ${PRICING_CONFIG.professional.duration}، ${PRICING_CONFIG.professional.views} ظهور، ${PRICING_CONFIG.professional.platforms}).\n\nهل تود أن نبدأ بحجز إحدى هذه الباقات، أو لديك استفسار عن باقة مخصصة؟`;
        return pricingText;
      } else {
        // تم عرض الأسعار سابقاً، نرد بسؤال عن الاختيار
        return getRandomReply(["هل لديك أي استفسار إضافي عن الباقات؟", "هل تود أن نقوم بتخصيص باقة تناسب احتياجاتك؟"], agentReplyHistoryRef.current);
      }
    }

    // إذا كان السؤال تقني والقسم تقني
    if (intent.type === "technical" && dept === 'technical') {
      if (lastTopic !== 'technical_details') {
        lastHandledTopicRef.current = 'technical_details';
        return getRandomReply(AGENT_REPLIES.technical.technical, agentReplyHistoryRef.current);
      } else {
        // نطلب تفاصيل أكثر إذا كان في مرحلة توضيح
        if (phase === "clarifying") {
          return getRandomReply(["هل يمكنك توضيح أكثر؟ متى بدأت المشكلة؟", "أحتاج إلى معلومات إضافية لفهم المشكلة بشكل أفضل."], agentReplyHistoryRef.current);
        }
        return getRandomReply(AGENT_REPLIES.technical.general, agentReplyHistoryRef.current);
      }
    }

    // إذا كان السؤال خارج الاختصاص (تم التعامل معه في مكان آخر)
    // هنا نرد برد عام مناسب للقسم
    const generalReplies = AGENT_REPLIES[dept]?.general || ["بكل سرور، كيف يمكنني مساعدتك؟"];
    return getRandomReply(generalReplies, agentReplyHistoryRef.current);
  }, []);

  // ============================================================
  // SEND MESSAGE & API HANDLING (محسّن)
  // ============================================================
  const sendMessage = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingRef.current) return;

    isSendingRef.current = true;
    // إضافة رسالة المستخدم
    setMessages(prev => [...prev, createMessage("user", trimmedText, "user", "sent")]);
    setText("");
    lastActivityTimeRef.current = Date.now();
    
    // تحديث السياق
    conversationContextRef.current.push(trimmedText);
    if (conversationContextRef.current.length > 10) conversationContextRef.current.shift();

    // بدء Loader للعملية
    startLoader();
    setChatStatus("typing");
    // تفعيل حركة التفكير (نظر للأعلى)
    setIsThinking(true);
    // فتح الفم أثناء الكتابة
    setMouthOpen(true);

    // ============================================================
    // الكشف عن النية واتخاذ الإجراء المناسب
    // ============================================================
    const intent = analyzeUserIntent(trimmedText);

    // 1. طلب التواصل (معلومات الاتصال)
    if (intent.type === "contact") {
      setTimeout(() => {
        const contactReply = `إليك معلومات التواصل الرسمية:\n\n🌐 الموقع: ${CONTACT_INFO.website}\n📧 البريد: ${CONTACT_INFO.email}\n📞 الهاتف: ${CONTACT_INFO.phone}\n🐦 تويتر: ${CONTACT_INFO.social.twitter}\n📸 انستغرام: ${CONTACT_INFO.social.instagram}`;
        setMessages(prev => [...prev, createMessage(currentSpeaker, contactReply, "assistant")]);
        setChatStatus("online");
        setIsThinking(false);
        setMouthOpen(false);
        finishLoader();
        isSendingRef.current = false;
        lastActivityTimeRef.current = Date.now();
      }, 800);
      return;
    }

    // 2. طلب تحويل لموظف بشري
    if (intent.type === "escalation" && currentSpeaker === "bot" && !showDepartmentSelection) {
      handleHumanRequest();
      finishLoader();
      setIsThinking(false);
      setMouthOpen(false);
      isSendingRef.current = false;
      return;
    }

    // 3. إذا كان هناك نية محددة وقسم مستهدف والمساعد الذكي، نقوم بالتحويل المباشر
    if (intent.confidence > 0.85 && intent.targetDepartment && currentSpeaker === "bot" && !showDepartmentSelection) {
      initiateDepartmentTransfer(intent.targetDepartment);
      finishLoader();
      setIsThinking(false);
      setMouthOpen(false);
      isSendingRef.current = false;
      return;
    }

    // ============================================================
    // 4. إذا كان المتحدث موظفاً (agent)
    // ============================================================
    if (currentSpeaker === "agent" && currentAgent) {
      // تحديث آخر نشاط
      lastActivityTimeRef.current = Date.now();

      // الكشف عن الختام
      if (detectFarewell(trimmedText)) {
        // نرسل رسالة ختامية ثم ننهي الجلسة
        const closingMsg = getRandomReply(CLOSING_MESSAGES, agentReplyHistoryRef.current);
        setMessages(prev => [...prev, createMessage("agent", closingMsg, "assistant")]);
        setChatStatus("online");
        setIsThinking(false);
        setMouthOpen(false);
        finishLoader();
        isSendingRef.current = false;
        // بعد 2 ثانية نقوم بإعادة الضبط
        setTimeout(() => {
          resetToBotSession();
        }, 2500);
        return;
      }

      // التحقق من خروج المستخدم عن اختصاص القسم
      const dept = currentAgent.department;
      const isOutOfScope = (dept: Department, txt: string) => {
        const norm = normalizeArabicText(txt);
        if (dept === 'technical' && (norm.includes("سعر") || norm.includes("اعلان") || norm.includes("باقه"))) return 'ads';
        if (dept === 'ads' && (norm.includes("خطأ") || norm.includes("لا يعمل") || norm.includes("مشكله") || norm.includes("عطل"))) return 'technical';
        return null;
      };
      const targetDept = isOutOfScope(dept, trimmedText);
      if (targetDept) {
        setMessages(prev => [...prev, createMessage("agent", `عذراً، هذا الاستفسار خارج نطاق اختصاصي. سأقوم بتحويلك الآن إلى القسم المختص لمساعدتك بشكل أفضل.`, "assistant")]);
        setTimeout(() => performInternalTransfer(targetDept as Department, currentAgent.name), 1000);
        finishLoader();
        setIsThinking(false);
        setMouthOpen(false);
        isSendingRef.current = false;
        return;
      }

      // توليد رد سياقي للموظف
      const agentReply = generateAgentReply(trimmedText, currentAgent);
      // تحديث الحالة
      conversationPhaseRef.current = "ongoing";
      lastAgentMessageRef.current = agentReply;
      // إضافة الرد
      setTimeout(() => {
        setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
        setChatStatus("online");
        setIsThinking(false);
        setMouthOpen(false);
        finishLoader();
        isSendingRef.current = false;
        lastActivityTimeRef.current = Date.now();
      }, 1000);
      return;
    }

    // ============================================================
    // 5. المساعد الذكي (bot) مع API
    // ============================================================
    if (currentSpeaker === "bot") {
      // تحقق مما إذا كانت رسالة ترحيبية (نرد بترحيب مناسب لكن بدون تكرار)
      if (intent.type === "greeting") {
        if (!hasGreetedRef.current) {
          // نختار ترحيب جديد
          const greeting = getRandomReply(GREETING_MESSAGES, usedGreetingsRef.current);
          setMessages(prev => [...prev, createMessage("bot", greeting, "assistant")]);
          hasGreetedRef.current = true;
          setChatStatus("online");
          setIsThinking(false);
          setMouthOpen(false);
          finishLoader();
          isSendingRef.current = false;
          return;
        } else {
          // رد مختصر
          const reply = "أهلاً بك مجدداً، كيف يمكنني مساعدتك؟";
          setMessages(prev => [...prev, createMessage("bot", reply, "assistant")]);
          setChatStatus("online");
          setIsThinking(false);
          setMouthOpen(false);
          finishLoader();
          isSendingRef.current = false;
          return;
        }
      }

      // إذا كانت رسالة طلب أسعار ولكن المساعد الذكي (غير محوّل) – نرد بالأسعار مباشرة
      if (intent.type === "pricing") {
        // نعرض الأسعار دون تحويل (حسب الطلب: عرض الباقات المناسبة)
        const pricingText = `تفضل، هذه باقاتنا الأساسية:\n🔹 ${PRICING_CONFIG.weekly.name}: ${PRICING_CONFIG.weekly.price} ${PRICING_CONFIG.weekly.currency} (مدة ${PRICING_CONFIG.weekly.duration}، ${PRICING_CONFIG.weekly.views} ظهور، ${PRICING_CONFIG.weekly.platforms}).\n🔹 ${PRICING_CONFIG.monthly.name}: ${PRICING_CONFIG.monthly.price} ${PRICING_CONFIG.monthly.currency} (مدة ${PRICING_CONFIG.monthly.duration}، ${PRICING_CONFIG.monthly.views} ظهور، ${PRICING_CONFIG.monthly.platforms}).\n🔹 ${PRICING_CONFIG.professional.name}: ${PRICING_CONFIG.professional.price} ${PRICING_CONFIG.professional.currency} (مدة ${PRICING_CONFIG.professional.duration}، ${PRICING_CONFIG.professional.views} ظهور، ${PRICING_CONFIG.professional.platforms}).\n\nهل تود أن نبدأ بحجز إحدى هذه الباقات، أو لديك استفسار عن باقة مخصصة؟`;
        setMessages(prev => [...prev, createMessage("bot", pricingText, "assistant")]);
        setChatStatus("online");
        setIsThinking(false);
        setMouthOpen(false);
        finishLoader();
        isSendingRef.current = false;
        return;
      }

      // نية الختام (وداع) – نرد وننهي الجلسة؟
      if (intent.type === "farewell") {
        const farewellReply = "شكراً لتواصلك معنا، نتمنى لك يوماً سعيداً. إذا احتجت أي مساعدة مستقبلاً، فنحن هنا.";
        setMessages(prev => [...prev, createMessage("bot", farewellReply, "assistant")]);
        setChatStatus("online");
        setIsThinking(false);
        setMouthOpen(false);
        finishLoader();
        isSendingRef.current = false;
        // لا ننهي الجلسة، بل نترك المستخدم يغلق المحادثة بنفسه أو نعيد تعيين الحالة بعد فترة؟
        // ولكن حسب المتطلبات: لا يغلق المحادثة مباشرة، بل يرسل رسالة ختامية.
        return;
      }

      // الحالة العامة: نستخدم API
      try {
        // تحضير رسائل API (نرسل آخر 10 رسائل للسياق)
        const apiMessages = messages
          .filter(m => m.sender !== "system")
          .slice(-10)
          .map(m => ({ role: (m.sender === "bot" || m.sender === "agent") ? "assistant" : "user", content: m.text }));
        
        if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].role !== "user") {
          apiMessages.push({ role: "user", content: trimmedText });
        }

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const botResponse: Message = createMessage(
          "bot", 
          data.text || data.message || "عذراً، لم أتمكن من الرد حالياً.", 
          "assistant", 
          "read",
          data.attachments || data.products || data.cards || [] 
        );

        setMessages(prev => [...prev, botResponse]);

        // إذا طلب API تحويلاً بشرياً
        if (data.escalate === true && currentSpeaker === "bot" && !showDepartmentSelection) {
          handleHumanRequest();
        }

      } catch (error) {
        console.error("Chat API Error:", error);
        setMessages(prev => [...prev, createMessage("system", "عذراً، حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.")]);
      } finally {
        setChatStatus("online");
        setIsThinking(false);
        setMouthOpen(false);
        finishLoader();
        isSendingRef.current = false;
      }
    }
  }, [
    text, 
    currentSpeaker, 
    currentAgent, 
    messages, 
    showDepartmentSelection, 
    handleHumanRequest, 
    initiateDepartmentTransfer, 
    performInternalTransfer, 
    resetToBotSession, 
    generateAgentReply, 
    detectFarewell,
    startLoader,
    finishLoader
  ]);

  // ============================================================
  // EFFECTS: تحميل الحالة عند فتح المحادثة
  // ============================================================
  useEffect(() => {
    if (!open) return;
    // إذا كانت الرسائل فارغة ولم يتم الترحيب بعد
    if (messages.length === 0 && !hasGreetedRef.current) {
      setChatStatus("typing");
      setTimeout(() => {
        const greeting = getRandomReply(GREETING_MESSAGES, usedGreetingsRef.current);
        setMessages([createMessage("bot", greeting, "assistant")]);
        hasGreetedRef.current = true;
        setChatStatus("online");
      }, 500);
    } else if (messages.length === 0 && hasGreetedRef.current) {
      // حالة نادرة: قد تكون المسحت، نضيف ترحيب
      const greeting = getRandomReply(GREETING_MESSAGES, usedGreetingsRef.current);
      setMessages([createMessage("bot", greeting, "assistant")]);
      hasGreetedRef.current = true;
    }
  }, [open, messages.length]);

  // حفظ الحالة عند التغيير
  useEffect(() => {
    if (open) {
      saveStateToStorage();
    }
  }, [saveStateToStorage, open]);

  // تنظيف المؤقتات عند الفك
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    };
  }, []);

  // ============================================================
  // RENDER HELPERS (محسّنة للأداء)
  // ============================================================
  const getStatusText = useCallback(() => {
    switch (chatStatus) {
      case "typing": return "يكتب الآن...";
      case "online": return "متصل الآن";
      case "waiting": return "في قائمة الانتظار...";
      case "inactive": return "انتهت المحادثة مؤقتاً";
      case "closed": return "عاد المساعد الذكي";
      default: return "غير نشط";
    }
  }, [chatStatus]);

  const getStatusColor = useCallback(() => {
    switch (chatStatus) {
      case "typing": return "bg-yellow-400 animate-pulse";
      case "online": return "bg-green-400 animate-pulse";
      case "waiting": return "bg-orange-400 animate-pulse";
      case "inactive": return "bg-gray-500";
      case "closed": return "bg-green-400 animate-pulse";
      default: return "bg-gray-400";
    }
  }, [chatStatus]);

  const shapeMap = useMemo<Record<ProductShape, string>>(() => ({
    'circle': 'w-16 h-16 rounded-full',
    'rectangle': 'w-20 h-14 rounded-xl',
    'portrait': 'w-14 h-20 rounded-2xl',
    'square': 'w-16 h-16 rounded-md'
  }), []);

  const renderSeamlessItems = useCallback(() => {
    const products = [...TRENDING_PRODUCTS, ...TRENDING_PRODUCTS];
    return products.map((product, index) => {
      const shapeClass = shapeMap[product.shape] || 'w-16 h-16 rounded-md';
      return (
        <div key={`${product.id}-${index}`} className="flex-shrink-0 inline-flex items-center gap-4 mx-4 bg-[#1f2937]/90 backdrop-blur-sm px-4 py-3 border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 w-[300px]">
          <img src={product.img} alt={product.name} className={`object-cover border-2 border-purple-500 shadow-md flex-shrink-0 ${shapeClass}`} />
          <div className="flex flex-col text-right flex-1 min-w-0">
            <span className="text-sm md:text-base font-bold text-white leading-tight mb-1 line-clamp-2">{product.name}</span>
            <span className="text-xs md:text-sm text-purple-400 font-medium leading-tight line-clamp-2">{product.desc}</span>
          </div>
        </div>
      );
    });
  }, [shapeMap]);

  // ============================================================
  // JSX (نفس الهيكل مع إضافة بعض التحسينات للأنيميشن)
  // ============================================================
  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white font-sans flex flex-col" dir="rtl">
      <style jsx global>{`
        @keyframes seamless-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-seamless-scroll { animation: seamless-scroll 50s linear infinite; will-change: transform; }
        .animate-seamless-scroll:hover { animation-play-state: paused; }
        @keyframes slide-in-right { 0% { transform: translateX(100px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes blink-human {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.1); }
        }
        .animate-blink-human { 
          animation: blink-human 0.12s ease-in-out; 
          transform-origin: center;
        }
        
        @keyframes cartoon-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.01); }
        }
        .animate-cartoon-breathe {
          animation: cartoon-breathe 3s ease-in-out infinite;
        }
        
        /* تحريك الفم باستخدام SVG morph */
        @keyframes mouth-talk {
          0% { d: path("M 10 22 C 10 22, 14 26, 16 26 C 18 26, 22 22, 22 22"); }
          50% { d: path("M 10 22 C 10 22, 13 27, 16 27 C 19 27, 22 22, 22 22"); }
          100% { d: path("M 10 22 C 10 22, 14 26, 16 26 C 18 26, 22 22, 22 22"); }
        }
        .animate-mouth-talk {
          animation: mouth-talk 0.6s ease-in-out infinite;
        }
        
        @keyframes mouth-smile {
          0%, 100% { d: path("M 10 22 C 10 22, 14 25.5, 16 25.5 C 18 25.5, 22 22, 22 22"); }
          50% { d: path("M 10 22 C 10 22, 14 25, 16 25 C 18 25, 22 22, 22 22"); }
        }
        .animate-mouth-smile {
          animation: mouth-smile 4s ease-in-out infinite;
        }
        
        @keyframes typing { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }
      `}</style>

      {/* شريط التحميل */}
      {loadingProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gray-800/50">
          <div 
            className="absolute top-0 right-0 h-full bg-gradient-to-l from-purple-500 via-blue-500 to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]"
            style={{ 
              width: `${loadingProgress}%`,
              transition: loadingProgress === 100 ? 'width 0.5s ease-out, opacity 0.5s ease-out' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: loadingProgress === 100 ? 0 : 1
            }}
          />
        </div>
      )}

      {/* الهيدر وباقي الواجهة كما هي (بدون تغيير) */}
      <header className="sticky top-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="w-full px-2 md:px-4 py-3 flex flex-wrap md:flex-nowrap justify-between items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 shrink-0 order-1">
            <a href="/login" className="px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition">اشتراك</a>
            <a href="/upgrade" className="hidden sm:flex items-center gap-1 px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition">ترقية 👑</a>
          </div>
          <div className="flex-1 max-w-md mx-2 hidden md:block order-2">
            <input 
              type="text" 
              placeholder="🔎 ابحث عن مشاهير، برامج، أو محتوى..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500 text-sm" 
            />
          </div>
          <a href="/" className="flex items-center gap-2 md:gap-3 shrink-0 order-3">
            <img src="https://iili.io/Bsjh2M7.png" alt="شعار" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border-2 border-purple-500 shadow-md" />
            <span className="text-base md:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">قناة مجلة دار النجوم</span>
          </a>
        </div>
        <div className="md:hidden px-2 pb-3">
          <input type="text" placeholder="🔎 ابحث عن محتوى..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
        </div>
      </header>

      <div className="bg-[#111827] border-b border-gray-800 overflow-hidden relative py-3">
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="flex animate-seamless-scroll w-max">
          {renderSeamlessItems()}
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 flex-1">
        <section className="text-center mb-12">
          <div className="youtube-ad-marquee bg-purple-900/30 border border-purple-500/30 rounded-full py-2.5 mb-8 overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0b0f1a] to-transparent z-10 pointer-events-none rounded-r-full"></div>
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0b0f1a] to-transparent z-10 pointer-events-none rounded-l-full"></div>
            <div className="flex whitespace-nowrap animate-seamless-scroll w-max">
              {[...Array(10), ...Array(10)].map((_, i) => (
                <span key={i} className="mx-8 text-purple-300 text-sm font-semibold flex items-center gap-2"> إعلان حصري: تابعوا أحدث البرامج واللقاءات على قناة مجلة دار النجوم</span>
              ))}
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">مرحبًا بكم في <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">دار النجوم</span></h1>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">منصتكم الإعلامية الأولى لعالم المشاهير والمحتوى الحصري.</p>
        </section>
      </main>

      {/* أيقونة المساعد المحسّنة (وجه متحرك) */}
      <div ref={chatButtonRef} onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/40 cursor-pointer hover:scale-110 transition-transform duration-300 z-50 border-2 border-white/10 animate-slide-in-right" title="مركز المساعدة">
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="animate-cartoon-breathe">
            {/* العين اليسرى */}
            <g className={isBlinking ? "animate-blink-human" : ""}>
              <circle cx="10" cy="14" r="5" fill="white" />
              <circle cx="10" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.1s linear' }} />
            </g>
            {/* العين اليمنى */}
            <g className={isBlinking ? "animate-blink-human" : ""} style={{ animationDelay: '0.05s' }}>
              <circle cx="22" cy="14" r="5" fill="white" />
              <circle cx="22" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.1s linear' }} />
            </g>
            {/* الفم المتحرك (Morph) */}
            <path 
              d={mouthOpen ? "M 10 22 C 10 22, 13 27, 16 27 C 19 27, 22 22, 22 22" : "M 10 22 C 10 22, 14 25.5, 16 25.5 C 18 25.5, 22 22, 22 22"}
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              className={mouthOpen ? "animate-mouth-talk" : "animate-mouth-smile"} 
              style={{ transition: 'd 0.2s ease' }}
            />
          </g>
        </svg>
      </div>

      {/* صندوق الدردشة (نفس الهيكل مع تحسينات للانتقالات) */}
      <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl transition-all duration-300 z-50 flex flex-col ${open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}>
        <div className="p-4 border-b border-gray-700 flex items-center gap-3 bg-[#1f2937]/50 rounded-t-2xl">
          <div className="flex items-center gap-2 flex-shrink-0">
            {sessionAgents.length === 0 ? (
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center border-2 border-purple-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="12" rx="3" fill="white" opacity="0.95"/><circle cx="9" cy="14" r="1.5" fill="#7c3aed"/><circle cx="15" cy="14" r="1.5" fill="#7c3aed"/><path d="M9 17 Q12 19 15 17" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" fill="none"/><line x1="12" y1="8" x2="12" y2="5" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="4" r="1.5" fill="white"/></svg>
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111827] bg-green-500"></span>
              </div>
            ) : (
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {sessionAgents.map((agent, idx) => (
                  <img key={agent.employeeId} src={agent.img} alt={agent.name} className={`w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-[#111827] object-cover ${idx === sessionAgents.length - 1 ? "border-purple-500 z-10 ring-2 ring-purple-500/30" : "border-gray-500 z-0 opacity-60 grayscale"}`} />
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-sm truncate">{sessionAgents.length === 0 ? "المساعد الذكي" : currentAgent?.name}</h4>
            <p className="text-xs flex items-center gap-1 truncate">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusColor()}`}></span>
              <span className="truncate">{getStatusText()}</span>
            </p>
          </div>
        </div>

        <div className="h-80 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#0b0f1a]/50">
          {messages.map((msg) => {
            if (msg.sender === "system") {
              return <div key={msg.id} className="flex justify-center my-2"><span className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1.5 rounded-full border border-gray-700 text-center max-w-[90%] leading-relaxed">{msg.text}</span></div>;
            }
            const isUser = msg.sender === "user";
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                {!isUser && (
                  <span className="text-[10px] text-purple-300 mb-1 ml-1 font-medium">
                    {msg.sender === "agent" && currentAgent ? `${currentAgent.name} | ${currentAgent.role}` : "المساعد الذكي"}
                  </span>
                )}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative whitespace-pre-line ${isUser ? "bg-purple-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-purple-500/30 rounded-tl-sm"}`}>
                  {msg.text}
                  
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map((att, idx) => {
                        if (att.type === 'image' && att.url) {
                          return <img key={idx} src={att.url} alt="attachment" className="rounded-lg max-w-full h-auto border border-gray-600" />;
                        }
                        if ((att.type === 'link' || att.type === 'card' || att.type === 'product') && att.url) {
                          return (
                            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="block bg-[#0b0f1a]/50 hover:bg-[#0b0f1a] border border-purple-500/30 rounded-lg p-2 transition-colors">
                              {att.title && <div className="font-bold text-xs text-purple-300 mb-1">{att.title}</div>}
                              {att.description && <div className="text-[10px] text-gray-400">{att.description}</div>}
                              <div className="text-[10px] text-blue-400 mt-1 truncate">{att.url}</div>
                            </a>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1 flex items-center gap-1">
                  {msg.time}{isUser && <span>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                </span>
              </div>
            );
          })}

          {showDepartmentSelection && currentSpeaker === "bot" && (
            <div className="space-y-2 mt-2 animate-slide-in-right">
              {DEPARTMENT_OPTIONS.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => initiateDepartmentTransfer(dept.id)}
                  className="w-full text-right bg-[#1f2937] hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500 rounded-xl p-3 transition-all duration-200 group"
                >
                  <div className="font-bold text-sm text-purple-300 group-hover:text-purple-200">{dept.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{dept.description}</div>
                </button>
              ))}
            </div>
          )}

          {chatStatus === "typing" && !showDepartmentSelection && (
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-gray-400 mb-1 ml-1">{currentSpeaker === "agent" && currentAgent ? currentAgent.name : "المساعد الذكي"}</span>
              <div className="bg-[#1f2937] border border-purple-500/30 rounded-2xl rounded-tl-sm p-3 flex gap-1.5 items-center h-10">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '200ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '400ms' }}></span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-700 bg-[#1f2937]/50 rounded-b-2xl">
          <div className="flex gap-2 items-end">
            <textarea
              id="chat-input"
              value={text}
              placeholder={showDepartmentSelection ? "يرجى اختيار قسم من الأعلى..." : "اكتب رسالتك هنا..."}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={1}
              disabled={showDepartmentSelection || isProcessing}
              className="flex-1 bg-[#0b0f1a] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700 placeholder-gray-500 resize-none overflow-y-auto max-h-32 min-h-[42px] leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
              dir="rtl"
            />
            <button 
              onClick={sendMessage} 
              disabled={!text.trim() || chatStatus === "typing" || showDepartmentSelection || isSendingRef.current || isProcessing} 
              className="p-3 rounded-xl text-sm font-bold transition mb-0.5 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>
        </div>
      </div>

      <footer className="bg-[#0b0f1a] border-t border-gray-800 text-gray-400 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm font-medium border-t border-gray-800 pt-6 w-full">
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300">سياسة الخصوصية</a>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300">الشروط والأحكام</a>
              <a href="/about" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300">من نحن</a>
              <a href="/contact" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300">اتصل بنا</a>
            </div>
            <span className="block text-center text-xs text-gray-500 mt-4">جميع الحقوق محفوظة © قناة مجلة دار النجوم 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}