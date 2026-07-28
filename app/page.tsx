"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ============================================================
// TYPES & INTERFACES
// ============================================================

type Sender = "user" | "bot" | "agent" | "system";
type AgentStatus = "online" | "away" | "offline";
type Department = 'support' | 'ads' | 'technical';
type ChatStatus = "typing" | "online" | "waiting" | "inactive" | "closed";
type ProductShape = "circle" | "rectangle" | "square" | "portrait";
type IntentType = "pricing" | "technical" | "contact" | "greeting" | "farewell" | "general" | "escalation";

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

const WELCOME_MESSAGES = [
  "أهلاً بك، كيف يمكنني مساعدتك اليوم؟",
  "مرحباً بك في دار النجوم، يسعدني مساعدتك.",
  "أهلاً وسهلاً، أخبرني بما تحتاج وسأساعدك.",
  "يسعدني وجودك، كيف أستطيع خدمتك؟"
];

const CLOSING_MESSAGES = [
  "سعدنا بخدمتك، إذا احتجت أي مساعدة مستقبلاً فنحن هنا.",
  "شكراً لتواصلك معنا، نتمنى لك يوماً سعيداً.",
  "نتمنى أن نكون قد قدمنا لك المساعدة المطلوبة."
];

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

const analyzeUserIntent = (inputText: string): UserIntent => {
  const normalized = normalizeArabicText(inputText);
  
  if (normalized.includes("سعر") || normalized.includes("اسعار") || normalized.includes("تكلفة") || normalized.includes("باقه") || normalized.includes("اعلان") || normalized.includes("كم سعر")) {
    return { type: "pricing", targetDepartment: 'ads', confidence: 0.95 };
  }
  if (normalized.includes("خطأ") || normalized.includes("لا يعمل") || normalized.includes("مشكله") || normalized.includes("دخول") || normalized.includes("كلمة مرور")) {
    return { type: "technical", targetDepartment: 'technical', confidence: 0.95 };
  }
  if (normalized.includes("ايميل") || normalized.includes("بريد") || normalized.includes("هاتف") || normalized.includes("تواصل") || normalized.includes("موقع")) {
    return { type: "contact", targetDepartment: 'support', confidence: 0.95 };
  }
  if (normalized.includes("شكرا") || normalized.includes("مع السلامه") || normalized.includes("انتهيت") || normalized.includes("هذا كل شيء")) {
    return { type: "farewell", confidence: 0.95 };
  }
  if (normalized.includes("مرحبا") || normalized.includes("هلا") || normalized.includes("السلام عليكم")) {
    return { type: "greeting", confidence: 0.95 };
  }
  if (normalized.includes("موظف") || normalized.includes("بشري") || normalized.includes("تحويل") || normalized.includes("خدمة عملاء")) {
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
  
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [headTilt, setHeadTilt] = useState({ x: 0, y: 0 });
  const targetEyePos = useRef({ x: 0, y: 0 });
  const currentEyePos = useRef({ x: 0, y: 0 });
  
  const chatButtonRef = useRef<HTMLDivElement>(null);
  const loaderTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const currentSpeakerRef = useRef(currentSpeaker);
  const chatStatusRef = useRef(chatStatus);
  const lastActivityTimeRef = useRef(Date.now());
  const isSendingRef = useRef(false);
  const previousAgentRepliesRef = useRef<Set<string>>(new Set());
  
  const conversationContextRef = useRef<string[]>([]);
  const lastHandledTopicRef = useRef<string | null>(null);
  const conversationPhaseRef = useRef<"initial" | "ongoing" | "clarifying" | "closing" | "ended">("initial");
  const lastAgentMessageRef = useRef<string>("");

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { chatStatusRef.current = chatStatus; }, [chatStatus]);

  // ============================================================
  // سابعاً: شريط التحميل الاحترافي (قابل للاستدعاء في أي عملية)
  // ============================================================
  const startLoading = useCallback(() => {
    loaderTimersRef.current.forEach(clearTimeout);
    loaderTimersRef.current = [];
    setLoadingProgress(10);
    
    const t1 = setTimeout(() => setLoadingProgress(40), 200);
    const t2 = setTimeout(() => setLoadingProgress(70), 500);
    const t3 = setTimeout(() => setLoadingProgress(90), 800);
    
    loaderTimersRef.current.push(t1, t2, t3);
  }, []);

  const finishLoading = useCallback(() => {
    loaderTimersRef.current.forEach(clearTimeout);
    loaderTimersRef.current = [];
    setLoadingProgress(100);
    setTimeout(() => setLoadingProgress(0), 500);
  }, []);

  useEffect(() => {
    return () => {
      loaderTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // ============================================================
  // عاشراً: حركة العين والرأس البشرية الواقعية (GPU Accelerated)
  // ============================================================
  useEffect(() => {
    let rafId: number;
    const animateEye = () => {
      const decay = 0.05;
      currentEyePos.current.x += (targetEyePos.current.x - currentEyePos.current.x) * 0.12;
      currentEyePos.current.y += (targetEyePos.current.y - currentEyePos.current.y) * 0.12;
      
      if (targetEyePos.current.x === 0 && targetEyePos.current.y === 0) {
        currentEyePos.current.x *= (1 - decay);
        currentEyePos.current.y *= (1 - decay);
      }
      
      setEyePos({ x: currentEyePos.current.x, y: currentEyePos.current.y });
      rafId = requestAnimationFrame(animateEye);
    };
    rafId = requestAnimationFrame(animateEye);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (chatButtonRef.current && !open) {
        const rect = chatButtonRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const maxOffset = 2.2;
        const rawX = (e.clientX - centerX) / 45;
        const rawY = (e.clientY - centerY) / 45;
        
        targetEyePos.current = {
          x: Math.max(-maxOffset, Math.min(maxOffset, rawX)),
          y: Math.max(-maxOffset, Math.min(maxOffset, rawY))
        };
        
        // حركة رأس دقيقة ثلاثية الأبعاد (Micro Head Movement)
        setHeadTilt({
          x: Math.max(-5, Math.min(5, rawY * 5)),
          y: Math.max(-5, Math.min(5, rawX * 5))
        });
      }
    };
    
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [open]);

  useEffect(() => {
    if (open) {
      targetEyePos.current = { x: -1.8, y: 1.8 };
      const timer = setTimeout(() => {
        targetEyePos.current = { x: 0, y: 0 };
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      targetEyePos.current = { x: 0, y: 0 };
      setHeadTilt({ x: 0, y: 0 });
    }
  }, [open]);

  // النظر للأعلى أثناء التفكير/الكتابة
  useEffect(() => {
    if (chatStatus === "typing") {
      targetEyePos.current = { x: 0, y: -1.5 };
    }
  }, [chatStatus]);

  useEffect(() => {
    let blinkTimeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const randomDelay = 3000 + Math.random() * 3000;
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
  // LOCAL STORAGE
  // ============================================================
  const saveStateToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('dar-alnujum-chat-state', JSON.stringify({
        messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, isQueued
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
      conversationPhaseRef.current = "initial";
      lastAgentMessageRef.current = "";
      return true;
    } catch (e) { 
      console.error('Load state error:', e); 
      return false; 
    }
  }, []);

  // ============================================================
  // خامساً: حذف المحادثة بعد انتهاء جلسة الموظف بالكامل
  // ============================================================
  const closeAgentSession = useCallback(() => {
    const closingMsg = CLOSING_MESSAGES[Math.floor(Math.random() * CLOSING_MESSAGES.length)];
    setMessages(prev => [...prev, createMessage("agent", closingMsg, "assistant")]);
    
    setTimeout(() => {
      // حذف جميع رسائل جلسة الموظف، البيانات، الطابور، السياق
      setMessages([]);
      setCurrentSpeaker("bot");
      setCurrentAgent(null);
      setSessionAgents([]);
      setIsQueued(false);
      setShowDepartmentSelection(false);
      setChatStatus("online");
      
      conversationContextRef.current = [];
      lastHandledTopicRef.current = null;
      conversationPhaseRef.current = "initial";
      lastAgentMessageRef.current = "";
      previousAgentRepliesRef.current.clear();
      
      if (typeof window !== "undefined") {
        localStorage.removeItem("dar-alnujum-chat-state");
      }

      // إعادة تشغيل المساعد الذكي وترحيب جديد
      setTimeout(() => {
        const randomWelcome = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
        setMessages([createMessage("bot", randomWelcome, "assistant")]);
      }, 600);
    }, 2000);
  }, []);

  // ============================================================
  // ثالثاً: انتهاء جلسة الموظف (59 ثانية)
  // ============================================================
  useEffect(() => {
    if (currentSpeaker !== "agent") return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - lastActivityTimeRef.current) / 1000;

      if (elapsedSeconds >= SESSION_TIMEOUTS.IDLE_TO_CLOSED) {
        closeAgentSession();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSpeaker, closeAgentSession]);

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
    
    const welcomeMsg = createMessage("agent", `أهلاً بك، أنا ${agent.name} (${agent.role}). تفضل، كيف يمكنني مساعدتك؟`, "assistant");
    setMessages(prev => [...prev, welcomeMsg]);
    setChatStatus("online");
    lastActivityTimeRef.current = Date.now();
  }, []);

  // ============================================================
  // ESCALATION & TRANSFER LOGIC
  // ============================================================
  const handleHumanRequest = useCallback(() => {
    setShowDepartmentSelection(true);
    setChatStatus("online");
    const deptMsg = createMessage("system", "يرجى اختيار القسم الذي ترغب في التواصل معه:");
    setMessages(prev => [...prev, deptMsg]);
  }, []);

  const initiateDepartmentTransfer = useCallback((dept: Department) => {
    startLoading();
    setChatStatus("typing");
    const deptOption = DEPARTMENT_OPTIONS.find(d => d.id === dept);
    
    setMessages(prev => [...prev, createMessage("system", `جاري البحث عن موظف متاح في ${deptOption?.name}...`)]);
    setShowDepartmentSelection(false);

    setTimeout(() => {
      const availableAgent = findAvailableAgent(dept);
      if (availableAgent) {
        startAgentSession(availableAgent);
        finishLoading();
      } else {
        setIsQueued(true);
        setMessages(prev => [...prev, createMessage("system", `جميع موظفي ${deptOption?.name} مشغولون حالياً. تم وضعك في قائمة الانتظار.`)]);
        setChatStatus("waiting");
        finishLoading();
        
        setTimeout(() => {
          const fallbackAgent = findAvailableAgent(dept) || SUPPORT_AGENTS.find(a => a.department === dept);
          if (fallbackAgent) {
            startAgentSession(fallbackAgent);
            setMessages(prev => [...prev, createMessage("system", "تم توصيلك بأحد موظفينا. نعتذر عن الانتظار.")]);
          }
        }, SESSION_TIMEOUTS.QUEUE_CHECK_INTERVAL);
      }
    }, 1500);
  }, [startAgentSession, startLoading, finishLoading]);

  const checkAndPerformEscalation = useCallback((userText: string): boolean => {
    const intent = analyzeUserIntent(userText);
    if (intent.type === "escalation" && currentSpeaker === "bot" && !showDepartmentSelection) {
      handleHumanRequest();
      return true;
    }
    if (intent.confidence > 0.85 && intent.targetDepartment && currentSpeaker === "bot" && !showDepartmentSelection) {
       initiateDepartmentTransfer(intent.targetDepartment);
       return true;
    }
    return false;
  }, [currentSpeaker, showDepartmentSelection, handleHumanRequest, initiateDepartmentTransfer]);

  const performInternalTransfer = useCallback((targetDept: Department, currentAgentName: string) => {
    const targetAgent = findAvailableAgent(targetDept) || SUPPORT_AGENTS.find(a => a.department === targetDept);
    if (!targetAgent) return;

    const lastUserMsg = messages.filter(m => m.sender === 'user').pop()?.text || "استفسار عام";
    
    const transferMsg = createMessage(
      "agent",
      `عذراً، هذا الاستفسار خارج نطاق اختصاصي. سأقوم بتحويلك الآن إلى زميلي المختص في قسم ${targetDept === 'ads' ? 'الإعلانات' : 'الدعم الفني'} لمساعدتك بشكل أدق.`,
      "assistant"
    );
    
    setMessages(prev => [...prev, transferMsg]);
    
    setTimeout(() => {
      setSessionAgents(prev => {
        if (prev.find(a => a.employeeId === targetAgent!.employeeId)) return prev;
        return [...prev, targetAgent!];
      });
      
      setCurrentAgent(targetAgent);
      conversationContextRef.current = [];
      lastHandledTopicRef.current = null;
      conversationPhaseRef.current = "initial";
      lastAgentMessageRef.current = "";
      
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
      }, 1000);
    }, 1500);
  }, [messages]);

  // ============================================================
  // SEND MESSAGE & API HANDLING
  // ============================================================
  const sendMessage = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingRef.current) return;

    isSendingRef.current = true;
    startLoading();
    setMessages(prev => [...prev, createMessage("user", trimmedText, "user", "sent")]);
    setText("");
    lastActivityTimeRef.current = Date.now();
    
    conversationContextRef.current.push(trimmedText);
    if (conversationContextRef.current.length > 5) conversationContextRef.current.shift();

    if (checkAndPerformEscalation(trimmedText)) {
      isSendingRef.current = false;
      finishLoading();
      return;
    }

    const intent = analyzeUserIntent(trimmedText);
    const normalized = normalizeArabicText(trimmedText);

    // سادساً: الرد التلقائي على طلبات التواصل
    if (intent.type === "contact") {
      setChatStatus("typing");
      setTimeout(() => {
        const contactReply = `إليك معلومات التواصل الرسمية:\n\n🌐 الموقع: ${CONTACT_INFO.website}\n📧 البريد: ${CONTACT_INFO.email}\n📞 الهاتف: ${CONTACT_INFO.phone}\n🐦 تويتر: ${CONTACT_INFO.social.twitter}\n📸 انستغرام: ${CONTACT_INFO.social.instagram}`;
        setMessages(prev => [...prev, createMessage(currentSpeaker, contactReply, "assistant")]);
        setChatStatus("online");
        isSendingRef.current = false;
        lastActivityTimeRef.current = Date.now();
        finishLoading();
      }, 800);
      return;
    }

    if (currentSpeaker === "agent" && currentAgent) {
      setChatStatus("typing");
      setTimeout(() => {
        const currentDept = currentAgent.department;
        
        // فحص الخروج عن الاختصاص
        const isOutOfScope = (dept: Department, txt: string) => {
          const norm = normalizeArabicText(txt);
          if (dept === 'technical' && (norm.includes("سعر") || norm.includes("اعلان") || norm.includes("باقه"))) return true;
          if (dept === 'ads' && (norm.includes("خطأ") || norm.includes("لا يعمل") || norm.includes("مشكله") || norm.includes("دخول"))) return true;
          return false;
        };

        if (isOutOfScope(currentDept, trimmedText)) {
          const targetDept = currentDept === 'technical' ? 'ads' : 'technical';
          setMessages(prev => [...prev, createMessage("agent", `عذراً، هذا الاستفسار يخص قسماً آخر. سأقوم بتحويلك الآن إلى القسم المختص لمساعدتك بشكل أفضل.`, "assistant")]);
          setTimeout(() => performInternalTransfer(targetDept, currentAgent.name), 1000);
          isSendingRef.current = false;
          finishLoading();
          return;
        }

        // ثالثاً: الختام الذكي
        if (intent.type === "farewell" && (conversationPhaseRef.current === "closing" || conversationPhaseRef.current === "ongoing")) {
          closeAgentSession();
          isSendingRef.current = false;
          finishLoading();
          return;
        }

        // رابعاً: التسعير الذكي حسب الطلب فقط
        if (intent.type === "pricing") {
          if (currentDept === 'ads') {
            if (lastHandledTopicRef.current !== 'pricing_details') {
              lastHandledTopicRef.current = 'pricing_details';
              const pricingReply = `إليك تفاصيل باقاتنا الإعلانية الأساسية:\n\n🔹 ${PRICING_CONFIG.weekly.name}: ${PRICING_CONFIG.weekly.price} ${PRICING_CONFIG.weekly.currency} (مدة ${PRICING_CONFIG.weekly.duration}، ${PRICING_CONFIG.weekly.views} ظهور، ${PRICING_CONFIG.weekly.platforms}).\n🔹 ${PRICING_CONFIG.monthly.name}: ${PRICING_CONFIG.monthly.price} ${PRICING_CONFIG.monthly.currency} (مدة ${PRICING_CONFIG.monthly.duration}، ${PRICING_CONFIG.monthly.views} ظهور، ${PRICING_CONFIG.monthly.platforms}).\n🔹 ${PRICING_CONFIG.professional.name}: ${PRICING_CONFIG.professional.price} ${PRICING_CONFIG.professional.currency} (مدة ${PRICING_CONFIG.professional.duration}، ${PRICING_CONFIG.professional.views} ظهور، ${PRICING_CONFIG.professional.platforms}).\n\nهل تود أن نبدأ بحجز إحدى هذه الباقات، أو لديك استفسار عن باقة مخصصة؟`;
              
              setMessages(prev => [...prev, createMessage("agent", pricingReply, "assistant")]);
              conversationPhaseRef.current = "ongoing";
              lastAgentMessageRef.current = pricingReply;
              isSendingRef.current = false;
              finishLoading();
              return;
            }
          } else {
            setMessages(prev => [...prev, createMessage("agent", `عذراً، استفسارات الأسعار والباقات تخص قسم الإعلانات. سأقوم بتحويلك الآن إلى زميلتي المختصة.`, "assistant")]);
            setTimeout(() => performInternalTransfer('ads', currentAgent.name), 1000);
            isSendingRef.current = false;
            finishLoading();
            return;
          }
        }

        // طلب توضيح طبيعي إذا كان السؤال عاماً وغير واضح
        if (intent.type === "general" && conversationPhaseRef.current === "initial" && normalized.length < 15) {
            const clarificationReplies = [
                "عذراً، لم أفهم السؤال تماماً. هل يمكنك توضيح ما تحتاجه بالضبط؟",
                "هل يمكنك تزويدي بمزيد من التفاصيل حول استفسارك لأتمكن من مساعدتك بشكل أفضل؟"
            ];
            const reply = clarificationReplies[Math.floor(Math.random() * clarificationReplies.length)];
            setMessages(prev => [...prev, createMessage("agent", reply, "assistant")]);
            conversationPhaseRef.current = "clarifying";
            isSendingRef.current = false;
            finishLoading();
            return;
        }

        if (intent.type === "technical" || currentDept === 'technical') {
          if (currentDept === 'technical') {
            if (lastHandledTopicRef.current !== 'technical_details') {
                lastHandledTopicRef.current = 'technical_details';
                const techReply = "حاضر، يسعدني مساعدتك. لكي أتمكن من فحص الأمر بدقة، هل يمكنك تزويدي برقم الطلب أو صورة واضحة للمشكلة؟";
                setMessages(prev => [...prev, createMessage("agent", techReply, "assistant")]);
                conversationPhaseRef.current = "clarifying";
                lastAgentMessageRef.current = techReply;
                isSendingRef.current = false;
                finishLoading();
                return;
            }
          }
        }

        const generalReplies = currentDept === 'ads' 
          ? ["بكل سرور. كيف يمكنني مساعدتك في اختيار الباقة الأنسب؟", "حاضر، أنا معك. هل لديك ميزانية محددة في ذهنك؟"]
          : currentDept === 'technical'
          ? ["حاضر، أنا أتابع معك. يرجى تزويدي بأي تفاصيل إضافية.", "أكيد، سأقوم بمساعدتك. هل يمكنك توضيح المشكلة أكثر؟"]
          : ["بكل سرور. تفضل، أنا أستمع إليك وسأقوم باللازم فوراً.", "حاضر، يسعدني خدمتك. كيف أقدر أساعدك؟"];
        
        const agentReply = generalReplies[Math.floor(Math.random() * generalReplies.length)];
        setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
        lastAgentMessageRef.current = agentReply;
        conversationPhaseRef.current = "ongoing";
        isSendingRef.current = false;
        finishLoading();
      }, 1500);
      return; 
    }

    // منطق المساعد الذكي (AI API)
    setChatStatus("typing");
    try {
      const apiMessages = messages
        .filter(m => m.sender !== "system")
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

      if (data.escalate === true && currentSpeaker === "bot" && !showDepartmentSelection) {
        handleHumanRequest();
      }

    } catch (error) {
      console.error("Chat API Error:", error);
      setMessages(prev => [...prev, createMessage("system", "عذراً، حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.")]);
    } finally {
      setChatStatus("online");
      isSendingRef.current = false;
      finishLoading();
    }
  }, [text, currentSpeaker, currentAgent, checkAndPerformEscalation, showDepartmentSelection, handleHumanRequest, messages, performInternalTransfer, closeAgentSession, startLoading, finishLoading]);

  // ============================================================
  // EFFECTS
  // ============================================================
  useEffect(() => { saveStateToStorage(); }, [saveStateToStorage]);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    startLoading();
    const hasSaved = loadStateFromStorage();
    if (!hasSaved) {
      setChatStatus("typing");
      setTimeout(() => {
        const randomWelcome = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
        setMessages([createMessage("bot", randomWelcome, "assistant")]);
        setChatStatus("online");
        finishLoading();
      }, 800);
    } else {
      finishLoading();
    }
  }, [open, messages.length, loadStateFromStorage, startLoading, finishLoading]);

  // ============================================================
  // RENDER HELPERS (محسّنة للأداء و GPU Accelerated)
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
  // JSX
  // ============================================================
  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white font-sans flex flex-col" dir="rtl">
      <style jsx global>{`
        @keyframes seamless-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-seamless-scroll { animation: seamless-scroll 50s linear infinite; will-change: transform; }
        .animate-seamless-scroll:hover { animation-play-state: paused; }
        @keyframes slide-in-right { 0% { transform: translateX(100px) scale(0.9); opacity: 0; } 100% { transform: translateX(0) scale(1); opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
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
          50% { transform: translateY(-2px) scale(1.01); }
        }
        .animate-cartoon-breathe {
          animation: cartoon-breathe 4s ease-in-out infinite;
        }
        
        @keyframes cartoon-smile {
          0%, 100% { d: path("M 10 22 C 10 22, 13 25, 16 25 C 19 25, 22 22, 22 22"); }
          50% { d: path("M 10 22 C 10 22, 13 25.5, 16 25.5 C 19 25.5, 22 22, 22 22"); }
        }
        .animate-cartoon-smile {
          animation: cartoon-smile 4s ease-in-out infinite;
        }

        @keyframes cartoon-talk {
          0%, 100% { d: path("M 10 22 C 10 22, 13 25, 16 25 C 19 25, 22 22, 22 22"); }
          50% { d: path("M 10 22 C 10 22, 13 27, 16 27 C 19 27, 22 22, 22 22"); }
        }
        .animate-cartoon-talk {
          animation: cartoon-talk 0.3s ease-in-out infinite;
        }
        
        @keyframes typing { 0%, 100% { opacity: 0.3; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }

        @keyframes message-appear {
          0% { opacity: 0; transform: translateY(10px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .message-appear {
          animation: message-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* سابعاً: شريط التحميل الاحترافي */}
      {loadingProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gray-800/50 overflow-hidden">
          <div 
            className="absolute top-0 right-0 h-full bg-gradient-to-l from-purple-500 via-blue-500 to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]"
            style={{ 
              width: `${loadingProgress}%`,
              transition: loadingProgress === 100 ? 'width 0.4s ease-out, opacity 0.4s ease-out' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: loadingProgress === 100 ? 0 : 1
            }}
          />
        </div>
      )}

      {/* أولاً: الهيدر (يمين: أزرار، وسط: بحث، يسار: شعار + اسم) */}
      <header className="sticky top-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="w-full px-2 md:px-4 py-3 flex flex-wrap md:flex-nowrap justify-between items-center gap-2 md:gap-4">
          
          <div className="flex items-center gap-2 md:gap-3 shrink-0 order-1">
            <a href="/login" className="px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition-transform duration-200 hover:scale-105">اشتراك</a>
            <a href="/upgrade" className="hidden sm:flex items-center gap-1 px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition-transform duration-200 hover:scale-105">ترقية 👑</a>
          </div>

          <div className="flex-1 max-w-md mx-2 hidden md:block order-2">
            <input 
              type="text" 
              placeholder="🔎 ابحث عن مشاهير، برامج، أو محتوى..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 placeholder-gray-500 text-sm" 
            />
          </div>

          <a href="/" className="flex items-center gap-2 md:gap-3 shrink-0 order-3 transition-transform duration-200 hover:scale-105">
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

      {/* عاشراً: أيقونة المساعد بحركة عين ورأس وفم احترافية (GPU Accelerated) */}
      <div 
        ref={chatButtonRef} 
        onClick={() => {
          setOpen(!open);
          if (!open) startLoading();
        }} 
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/40 cursor-pointer transition-all duration-300 z-50 border-2 border-white/10 animate-slide-in-right hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-110 active:scale-95" 
        title="مركز المساعدة"
      >
        <svg 
          width="32" 
          height="32" 
          viewBox="0 0 32 32" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transform: `perspective(500px) rotateX(${headTilt.x}deg) rotateY(${headTilt.y}deg)`,
            transition: 'transform 0.2s ease-out'
          }}
        >
          <g className="animate-cartoon-breathe">
            <g className={isBlinking ? "animate-blink-human" : ""}>
              <circle cx="10" cy="14" r="5" fill="white" />
              <circle cx="10" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }} />
            </g>
            <g className={isBlinking ? "animate-blink-human" : ""} style={{ animationDelay: '0.05s' }}>
              <circle cx="22" cy="14" r="5" fill="white" />
              <circle cx="22" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }} />
            </g>
            <path 
              d="M10 22C10 22 13 25 16 25C19 25 22 22 22 22" 
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              className={chatStatus === "typing" ? "animate-cartoon-talk" : "animate-cartoon-smile"} 
            />
          </g>
        </svg>
      </div>

      {/* تاسعاً: صندوق الدردشة بانتقالات سلسة (Cubic Bezier) */}
      <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl z-50 flex flex-col origin-bottom-right transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95 pointer-events-none"}`}>
        <div className="p-4 border-b border-gray-700 flex items-center gap-3 bg-[#1f2937]/50 rounded-t-2xl backdrop-blur-sm">
          <div className="flex items-center gap-2 flex-shrink-0">
            {sessionAgents.length === 0 ? (
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center border-2 border-purple-400 shadow-md">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="12" rx="3" fill="white" opacity="0.95"/><circle cx="9" cy="14" r="1.5" fill="#7c3aed"/><circle cx="15" cy="14" r="1.5" fill="#7c3aed"/><path d="M9 17 Q12 19 15 17" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" fill="none"/><line x1="12" y1="8" x2="12" y2="5" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="4" r="1.5" fill="white"/></svg>
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111827] bg-green-500 shadow-sm"></span>
              </div>
            ) : (
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {sessionAgents.map((agent, idx) => (
                  <img key={agent.employeeId} src={agent.img} alt={agent.name} className={`w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-[#111827] object-cover shadow-md transition-all duration-300 ${idx === sessionAgents.length - 1 ? "border-purple-500 z-10 ring-2 ring-purple-500/30" : "border-gray-500 z-0 opacity-60 grayscale"}`} />
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-sm truncate">{sessionAgents.length === 0 ? "المساعد الذكي" : currentAgent?.name}</h4>
            <p className="text-xs flex items-center gap-1.5 truncate">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 shadow-sm ${getStatusColor()}`}></span>
              <span className="truncate">{getStatusText()}</span>
            </p>
          </div>
        </div>

        <div className="h-80 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#0b0f1a]/50">
          {messages.map((msg) => {
            if (msg.sender === "system") {
              return <div key={msg.id} className="flex justify-center my-2 message-appear"><span className="text-[10px] bg-gray-800/80 text-gray-400 px-3 py-1.5 rounded-full border border-gray-700 text-center max-w-[90%] leading-relaxed">{msg.text}</span></div>;
            }
            const isUser = msg.sender === "user";
            return (
              <div key={msg.id} className={`flex flex-col message-appear ${isUser ? "items-end" : "items-start"}`}>
                {!isUser && (
                  <span className="text-[10px] text-purple-300 mb-1 ml-1 font-medium">
                    {msg.sender === "agent" && currentAgent ? `${currentAgent.name} | ${currentAgent.role}` : "المساعد الذكي"}
                  </span>
                )}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative whitespace-pre-line shadow-sm ${isUser ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-purple-500/20 rounded-tl-sm"}`}>
                  {msg.text}
                  
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map((att, idx) => {
                        if (att.type === 'image' && att.url) {
                          return <img key={idx} src={att.url} alt="attachment" className="rounded-lg max-w-full h-auto border border-gray-600 shadow-sm" />;
                        }
                        if ((att.type === 'link' || att.type === 'card' || att.type === 'product') && att.url) {
                          return (
                            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="block bg-[#0b0f1a]/50 hover:bg-[#0b0f1a] border border-purple-500/30 rounded-lg p-2 transition-colors duration-200">
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
                  {msg.time}{isUser && <span className="text-purple-400">{msg.status === "read" ? "✓✓" : "✓"}</span>}
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
                  className="w-full text-right bg-[#1f2937] hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500 rounded-xl p-3 transition-all duration-200 group shadow-sm"
                >
                  <div className="font-bold text-sm text-purple-300 group-hover:text-purple-200">{dept.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{dept.description}</div>
                </button>
              ))}
            </div>
          )}

          {/* ثامناً: مؤشر الكتابة الاحترافي داخل المحادثة */}
          {chatStatus === "typing" && !showDepartmentSelection && (
            <div className="flex flex-col items-start message-appear">
              <span className="text-[10px] text-gray-400 mb-1 ml-1">{currentSpeaker === "agent" && currentAgent ? currentAgent.name : "المساعد الذكي"}</span>
              <div className="bg-[#1f2937] border border-purple-500/20 rounded-2xl rounded-tl-sm p-3 flex gap-1.5 items-center h-10 shadow-sm">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-typing" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-typing" style={{ animationDelay: '200ms' }}></span>
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-typing" style={{ animationDelay: '400ms' }}></span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-700 bg-[#1f2937]/50 rounded-b-2xl backdrop-blur-sm">
          <div className="flex gap-2 items-end">
            <textarea
              id="chat-input"
              value={text}
              placeholder={showDepartmentSelection ? "يرجى اختيار قسم من الأعلى..." : "اكتب رسالتك هنا..."}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={1}
              disabled={showDepartmentSelection}
              className="flex-1 bg-[#0b0f1a] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 border border-gray-700 placeholder-gray-500 resize-none overflow-y-auto max-h-32 min-h-[42px] leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              dir="rtl"
            />
            <button 
              onClick={sendMessage} 
              disabled={!text.trim() || chatStatus === "typing" || showDepartmentSelection || isSendingRef.current} 
              className="p-3 rounded-xl text-sm font-bold transition-all duration-200 mb-0.5 bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:scale-105 active:scale-95"
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