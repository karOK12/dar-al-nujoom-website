"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// TYPES & INTERFACES
// ============================================================

type Sender = "user" | "bot" | "agent" | "system";
type AgentStatus = "online" | "away" | "offline";
type Department = 'support' | 'ads' | 'technical';
type ChatStatus = "typing" | "online" | "waiting" | "warning" | "inactive" | "closed";
type ProductShape = "circle" | "rectangle" | "square" | "portrait";

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

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

const AD_PACKAGES = {
  weekly: { price: 135, duration: 'أسبوع واحد', impressions: '50,000 ظهور', platforms: 'منصتين رئيسيتين', features: 'تصميم إعلان واحد + تقرير أداء أساسي' },
  monthly: { price: 405, duration: 'شهر كامل', impressions: '200,000 ظهور', platforms: '3 منصات رئيسية', features: 'تصميمين إعلان + تقرير أداء أسبوعي + دعم مخصص' },
  premium: { price: 810, duration: 'شهر كامل', impressions: '500,000+ ظهور', platforms: 'جميع المنصات المتاحة', features: 'حملة شاملة + مدير حساب مخصص + تقارير يومية' }
};

const EXCHANGE_RATES: Record<string, number> = {
  'USD': 1, 'SAR': 3.75, 'IQD': 1320, 'AED': 3.67, 'JOD': 0.71, 'EGP': 47.5, 'KWD': 0.31,
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

const SESSION_TIMEOUTS = {
  IDLE_TO_CLOSED: 45,
  QUEUE_CHECK_INTERVAL: 8000,
};

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
    .replace(/گ/g, "ك").replace(/چ/g, "ج").replace(/پ/g, "ب").replace(/ڤ/g, "ف")
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const wantsHumanContact = (inputText: string): boolean => {
  const normalized = normalizeArabicText(inputText);
  const humanRequestKeywords = ["موظف", "شخص", "انسان", "بشري", "حقيقي", "ممثل", "خدمة العملاء", "فريق الدعم", "اكلم", "اتحدث", "اتواصل", "حولني", "تحويل", "ادارة", "مسؤول"];
  return humanRequestKeywords.some(keyword => normalized.includes(keyword));
};

const findAvailableAgent = (department: Department): Agent | null => {
  return SUPPORT_AGENTS.find(agent => agent.department === department && agent.status === 'online' && !agent.isBusy) || null;
};

const createMessage = (sender: Sender, text: string, role?: "user" | "assistant", status: "sent" | "delivered" | "read" = "read", attachments?: Attachment[]): Message => ({
  id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  sender, text, role, time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status, attachments
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMouseMoving, setIsMouseMoving] = useState(false);
  
  const chatButtonRef = useRef<HTMLDivElement>(null);
  const mouseStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSpeakerRef = useRef(currentSpeaker);
  const chatStatusRef = useRef(chatStatus);
  const lastActivityTimeRef = useRef(Date.now());
  const isSendingRef = useRef(false);
  const previousAgentRepliesRef = useRef<Set<string>>(new Set());
  
  const awaitingFinalConfirmationRef = useRef(false);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { chatStatusRef.current = chatStatus; }, [chatStatus]);

  // ============================================================
  // شريط التحميل الاحترافي (RTL)
  // ============================================================
  useEffect(() => {
    let progress = 0;
    let isComplete = false;

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
        
        if (progressRatio < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    };

    updateProgress(15, 300);
    const t1 = setTimeout(() => updateProgress(40, 500), 200);
    const t2 = setTimeout(() => updateProgress(75, 600), 600);
    const t3 = setTimeout(() => updateProgress(95, 500), 1200);

    const handleReadyState = () => { if (document.readyState === 'interactive') updateProgress(98, 300); };
    const handleLoad = () => {
      isComplete = true;
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 600);
    };

    document.addEventListener('readystatechange', handleReadyState);
    window.addEventListener('load', handleLoad);
    const fallback = setTimeout(() => { if (!isComplete) { isComplete = true; setLoadingProgress(100); setTimeout(() => setLoadingProgress(0), 600); } }, 8000);

    return () => {
      document.removeEventListener('readystatechange', handleReadyState);
      window.removeEventListener('load', handleLoad);
      clearTimeout(fallback); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  // ============================================================
  // LOCAL STORAGE
  // ============================================================
  const saveStateToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('dar-alnujum-chat-state', JSON.stringify({ messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, isQueued }));
    } catch (e) { console.error('Save state error:', e); }
  }, [messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, isQueued]);

  const loadStateFromStorage = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('dar-alnujum-chat-state');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      setMessages(parsed.messages || []);
      setCurrentSpeaker("bot"); setCurrentAgent(null); setSessionAgents([]);
      setChatStatus("online"); setIsQueued(false); setShowDepartmentSelection(false);
      previousAgentRepliesRef.current.clear(); awaitingFinalConfirmationRef.current = false;
      return true;
    } catch (e) { console.error('Load state error:', e); return false; }
  }, []);

  // ============================================================
  // SESSION LIFECYCLE & 45s TIMEOUT
  // ============================================================
  const clearAllTimers = useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    if (followUpTimerRef.current) { clearTimeout(followUpTimerRef.current); followUpTimerRef.current = null; }
  }, []);

  useEffect(() => {
    if (currentSpeaker === "agent" || currentSpeaker === "bot") {
      lastActivityTimeRef.current = Date.now();
      if (chatStatus === "warning" || chatStatus === "inactive") setChatStatus("online");
    }
  }, [messages, currentSpeaker]);

  useEffect(() => {
    if (currentSpeaker !== "agent" && !isQueued) return;
    const interval = setInterval(() => {
      const elapsedSeconds = (Date.now() - lastActivityTimeRef.current) / 1000;
      if (currentSpeakerRef.current === "agent" && elapsedSeconds >= SESSION_TIMEOUTS.IDLE_TO_CLOSED) {
        closeAgentSession(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentSpeaker, isQueued]);

  const closeAgentSession = useCallback((isTimeout = false) => {
    clearAllTimers();
    const timeoutMsg = isTimeout 
      ? "تم إنهاء جلسة الموظف بسبب عدم وجود نشاط، وتمت إعادتك إلى المساعد الذكي."
      : "مرحباً بك مجدداً 🌟 أنا المساعد الذكي، كيف يمكنني مساعدتك اليوم؟";

    const freshMessage = createMessage(isTimeout ? "system" : "bot", timeoutMsg, "assistant");
    setMessages(prev => {
      const newMessages = [...prev, freshMessage];
      if (typeof window !== "undefined") {
        localStorage.setItem("dar-alnujum-chat-state", JSON.stringify({
          messages: newMessages, currentSpeaker: "bot", currentAgent: null, sessionAgents: [], chatStatus: "online", isQueued: false
        }));
      }
      return newMessages;
    });

    setCurrentSpeaker("bot"); setCurrentAgent(null); setSessionAgents([]);
    setIsQueued(false); setShowDepartmentSelection(false); setChatStatus("online");
    lastActivityTimeRef.current = Date.now();
    previousAgentRepliesRef.current.clear(); awaitingFinalConfirmationRef.current = false;
  }, [clearAllTimers]);

  const startAgentSession = useCallback((agent: Agent) => {
    clearAllTimers();
    setCurrentAgent(agent);
    setSessionAgents(prev => prev.find(a => a.employeeId === agent.employeeId) ? prev : [...prev, agent]);
    setCurrentSpeaker("agent");
    setIsQueued(false); setShowDepartmentSelection(false);
    previousAgentRepliesRef.current.clear(); awaitingFinalConfirmationRef.current = false;
    
    setMessages(prev => [...prev, createMessage("agent", `أهلاً بك، أنا ${agent.name} (${agent.role}). تفضل، كيف يمكنني مساعدتك؟`, "assistant")]);
    setChatStatus("online");
    lastActivityTimeRef.current = Date.now();
  }, [clearAllTimers]);

  // ============================================================
  // ESCALATION & TRANSFER LOGIC
  // ============================================================
  const handleHumanRequest = useCallback(() => {
    setShowDepartmentSelection(true); setChatStatus("online");
    setMessages(prev => [...prev, createMessage("system", "يرجى اختيار القسم الذي ترغب في التواصل معه:", "assistant")]);
  }, []);

  const initiateDepartmentTransfer = useCallback((dept: Department) => {
    setChatStatus("typing");
    const deptOption = DEPARTMENT_OPTIONS.find(d => d.id === dept);
    setMessages(prev => [...prev, createMessage("system", `جاري البحث عن موظف متاح في ${deptOption?.name}...`, "assistant")]);
    setShowDepartmentSelection(false);

    setTimeout(() => {
      const availableAgent = findAvailableAgent(dept);
      if (availableAgent) {
        startAgentSession(availableAgent);
      } else {
        setIsQueued(true); setChatStatus("waiting");
        setMessages(prev => [...prev, createMessage("system", `جميع موظفي ${deptOption?.name} مشغولون حالياً. تم وضعك في قائمة الانتظار.`, "assistant")]);
        setTimeout(() => {
          const fallbackAgent = findAvailableAgent(dept) || SUPPORT_AGENTS.find(a => a.department === dept);
          if (fallbackAgent) {
            startAgentSession(fallbackAgent);
            setMessages(prev => [...prev, createMessage("system", "تم توصيلك بأحد موظفينا. نعتذر عن الانتظار.", "assistant")]);
          }
        }, SESSION_TIMEOUTS.QUEUE_CHECK_INTERVAL);
      }
    }, 1500);
  }, [startAgentSession]);

  const checkAndPerformEscalation = useCallback((userText: string): boolean => {
    if (wantsHumanContact(userText) && currentSpeaker === "bot" && !showDepartmentSelection) {
      handleHumanRequest(); return true;
    }
    return false;
  }, [currentSpeaker, showDepartmentSelection, handleHumanRequest]);

  const performInternalTransfer = useCallback((targetDept: Department, currentAgentName: string, userQuery: string) => {
    const targetAgent = findAvailableAgent(targetDept) || SUPPORT_AGENTS.find(a => a.department === targetDept);
    if (!targetAgent) return;

    setMessages(prev => [...prev, createMessage("agent", `لحظة واحدة أستاذ، سأقوم بتحويلك الآن إلى زميلي المختص في قسم ${targetDept === 'ads' ? 'الإعلانات' : 'الدعم الفني'} لخدمتك بشكل أفضل.`, "assistant")]);
    setChatStatus("typing");
    
    setTimeout(() => {
      setSessionAgents(prev => prev.find(a => a.employeeId === targetAgent!.employeeId) ? prev : [...prev, targetAgent!]);
      setCurrentAgent(targetAgent);
      awaitingFinalConfirmationRef.current = false;
      
      setTimeout(() => {
        setMessages(prev => [...prev, createMessage("agent", `مرحباً، أنا ${targetAgent!.name} من قسم ${targetDept === 'ads' ? 'الإعلانات' : 'الدعم الفني'}. اطلعت على محادثتك السابقة بخصوص: "${userQuery}" مع الأستاذ ${currentAgentName}، وسأتابع معك من هذه النقطة مباشرة. تفضل.`, "assistant")]);
        setChatStatus("online");
        isSendingRef.current = false;
        lastActivityTimeRef.current = Date.now();
      }, 1200);
    }, 1000);
  }, []);

  // ============================================================
  // SEND MESSAGE & API HANDLING
  // ============================================================
  const sendMessage = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingRef.current) return;

    clearAllTimers();
    isSendingRef.current = true;
    setMessages(prev => [...prev, createMessage("user", trimmedText, "user", "sent")]);
    setText("");
    lastActivityTimeRef.current = Date.now();

    if (checkAndPerformEscalation(trimmedText)) { isSendingRef.current = false; return; }

    if (currentSpeaker === "agent" && currentAgent) {
      setChatStatus("typing");
      setTimeout(() => {
        const normalized = normalizeArabicText(trimmedText);
        const currentDept = currentAgent.department;

        if (awaitingFinalConfirmationRef.current) {
          const isDeclining = ["لا", "خلاص", "كفى", "ما احتاج", "لا شكرا", "انتهى", "هذا كل شيء", "شكرا", "شكراً"].some(k => normalized.includes(k));
          if (isDeclining) {
            const closingReplies = ["شكراً لتواصلك معنا، سعدنا بخدمتك ونتمنى لك يوماً سعيداً.", "نتشرف بخدمتك دائماً، وإذا احتجت أي شيء مستقبلاً فنحن في خدمتك.", "نسعد دائماً بخدمتك، ونتمنى لك كل التوفيق والنجاح."];
            const reply = closingReplies.find(r => !previousAgentRepliesRef.current.has(r)) || closingReplies[0];
            previousAgentRepliesRef.current.add(reply);
            setMessages(prev => [...prev, createMessage("agent", reply, "assistant")]);
            setChatStatus("online"); awaitingFinalConfirmationRef.current = false; isSendingRef.current = false;
            return;
          }
          awaitingFinalConfirmationRef.current = false;
        }

        if (["شكر", "تسلم", "الله يعطيك", "تمام", "مشكور", "يعطيك العافيه"].some(k => normalized.includes(k))) {
          const thanksReplies = ["العفو أستاذ، هذا واجبنا.", "تدلل أستاذ، يسعدني أن تم حل الأمر.", "بالعفو أستاذ، تحت أمرك بأي وقت."];
          const reply = thanksReplies.find(r => !previousAgentRepliesRef.current.has(r)) || thanksReplies[0];
          previousAgentRepliesRef.current.add(reply);
          setMessages(prev => [...prev, createMessage("agent", reply, "assistant")]);
          followUpTimerRef.current = setTimeout(() => {
            setMessages(prev => [...prev, createMessage("agent", "هل هناك أي استفسار آخر يمكنني مساعدتك به؟", "assistant")]);
            awaitingFinalConfirmationRef.current = true; setChatStatus("online"); isSendingRef.current = false;
          }, 3000);
          return;
        }

        if (["سعر", "باقه", "اعلان", "ترويج", "تكلفه"].some(k => normalized.includes(k))) {
          if (currentDept === 'ads') {
            let targetCurrency = 'USD', currencySymbol = 'دولار', rate = 1;
            if (normalized.includes("عراقي") || normalized.includes("دينار")) { targetCurrency = 'IQD'; currencySymbol = 'دينار عراقي'; rate = EXCHANGE_RATES['IQD']; }
            else if (normalized.includes("ريال") || normalized.includes("سعودي")) { targetCurrency = 'SAR'; currencySymbol = 'ريال سعودي'; rate = EXCHANGE_RATES['SAR']; }
            else if (normalized.includes("درهم") || normalized.includes("امارات")) { targetCurrency = 'AED'; currencySymbol = 'درهم إماراتي'; rate = EXCHANGE_RATES['AED']; }
            else if (normalized.includes("جنيه") || normalized.includes("مصري")) { targetCurrency = 'EGP'; currencySymbol = 'جنيه مصري'; rate = EXCHANGE_RATES['EGP']; }

            const formatPrice = (usdPrice: number) => `${Math.round(usdPrice * rate)} ${currencySymbol}`;
            const reply = `أهلاً بك أستاذ. باقاتنا الإعلانية المعتمدة هي:\n\n🔹 الباقة الأسبوعية: ${formatPrice(AD_PACKAGES.weekly.price)}\n- المدة: ${AD_PACKAGES.weekly.duration}\n- الظهور: ${AD_PACKAGES.weekly.impressions}\n- المنصات: ${AD_PACKAGES.weekly.platforms}\n\n🔹 الباقة الشهرية: ${formatPrice(AD_PACKAGES.monthly.price)}\n- المدة: ${AD_PACKAGES.monthly.duration}\n- الظهور: ${AD_PACKAGES.monthly.impressions}\n- المنصات: ${AD_PACKAGES.monthly.platforms}\n\n🔹 الباقة الاحترافية: ${formatPrice(AD_PACKAGES.premium.price)}\n- المدة: ${AD_PACKAGES.premium.duration}\n- الظهور: ${AD_PACKAGES.premium.impressions}\n- المنصات: ${AD_PACKAGES.premium.platforms}\n\n${targetCurrency !== 'USD' ? '(ملاحظة: الأسعار أعلاه تم تحويلها تقريباً بناءً على سعر الصرف الحالي)' : ''}\n\nيسعدني مساعدتك في اختيار الباقة الأنسب.`;
            
            setMessages(prev => [...prev, createMessage("agent", reply, "assistant")]);
            followUpTimerRef.current = setTimeout(() => {
              setMessages(prev => [...prev, createMessage("agent", "هل تود أن أرشح لك باقة معينة بناءً على ميزانيتك؟", "assistant")]);
              awaitingFinalConfirmationRef.current = true; setChatStatus("online"); isSendingRef.current = false;
            }, 4000);
            return;
          } else {
            performInternalTransfer('ads', currentAgent.name, trimmedText); return;
          }
        }

        if (["مشكله", "خطأ", "لا يعمل", "عطل", "شكوى", "معلق", "ما يشتغل"].some(k => normalized.includes(k))) {
          if (currentDept === 'technical') {
            const techReplies = ["حاضر أستاذ، يسعدني مساعدتك. لكي أتمكن من فحص الأمر بدقة، هل يمكنك تزويدي برقم الطلب أو لقطة شاشة للخطأ؟", "أكيد، أنا هنا لمساعدتك. يرجى تزويدي بتفاصيل أكثر: متى بدأت المشكلة؟ وهل تظهر رسالة خطأ معينة؟"];
            const reply = techReplies.find(r => !previousAgentRepliesRef.current.has(r)) || techReplies[0];
            previousAgentRepliesRef.current.add(reply);
            setMessages(prev => [...prev, createMessage("agent", reply, "assistant")]);
            setChatStatus("online"); isSendingRef.current = false;
            return;
          } else {
            performInternalTransfer('technical', currentAgent.name, trimmedText); return;
          }
        }

        const generalReplies = currentDept === 'ads' 
          ? ["أكيد أستاذ، تفضل كيف أقدر أساعدك؟", "حاضر، أنا معك. ما الذي تود معرفته عن خدماتنا؟", "بكل سرور، أنا جاهز لمساعدتك في اختيار الأنسب."]
          : currentDept === 'technical'
          ? ["حاضر أستاذ، أنا أتابع معك. يرجى تزويدي بأي تفاصيل إضافية.", "أكيد، سأقوم بمساعدتك. هل يمكنك توضيح المشكلة أكثر؟", "مفهوم، دعني أتحقق من ذلك فوراً."]
          : ["بكل سرور أستاذ، تفضل أنا أستمع إليك.", "حاضر، يسعدني خدمتك. كيف أقدر أساعدك؟", "أهلاً بك، أنا هنا لتسهيل الأمور عليك."];
        
        const reply = generalReplies.find(r => !previousAgentRepliesRef.current.has(r)) || generalReplies[0];
        previousAgentRepliesRef.current.add(reply);
        setMessages(prev => [...prev, createMessage("agent", reply, "assistant")]);
        
        followUpTimerRef.current = setTimeout(() => {
          setMessages(prev => [...prev, createMessage("agent", "هل يوجد أي استفسار آخر يمكنني مساعدتك به؟", "assistant")]);
          awaitingFinalConfirmationRef.current = true; setChatStatus("online"); isSendingRef.current = false;
        }, 3500);
      }, 1500);
      return; 
    }

    setChatStatus("typing");
    try {
      const apiMessages = messages.filter(m => m.sender !== "system").map(m => ({ role: (m.sender === "bot" || m.sender === "agent") ? "assistant" : "user", content: m.text }));
      apiMessages.push({ role: "user", content: trimmedText });

      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: apiMessages }) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      setMessages(prev => [...prev, createMessage("bot", data.text || "عذراً، لم أتمكن من الرد حالياً.", "assistant", "read", data.attachments || [])]);
      if (data.escalate === true && currentSpeaker === "bot" && !showDepartmentSelection) handleHumanRequest();
    } catch (error) {
      setMessages(prev => [...prev, createMessage("system", "عذراً، حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.", "assistant")]);
    } finally {
      setChatStatus("online"); isSendingRef.current = false;
    }
  }, [text, currentSpeaker, currentAgent, checkAndPerformEscalation, showDepartmentSelection, handleHumanRequest, messages, performInternalTransfer, clearAllTimers]);

  // ============================================================
  // EFFECTS & ANIMATIONS
  // ============================================================
  useEffect(() => { saveStateToStorage(); }, [saveStateToStorage]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setIsMouseMoving(true);
      if (mouseStopTimerRef.current) clearTimeout(mouseStopTimerRef.current);
      mouseStopTimerRef.current = setTimeout(() => setIsMouseMoving(false), 1000);
      if (chatButtonRef.current) {
        const rect = chatButtonRef.current.getBoundingClientRect();
        const deltaX = Math.max(-6, Math.min(6, (e.clientX - (rect.left + rect.width / 2)) / 40));
        const deltaY = Math.max(-6, Math.min(6, (e.clientY - (rect.top + rect.height / 2)) / 40));
        setMousePos({ x: deltaX, y: deltaY });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => { window.removeEventListener("mousemove", handleMouseMove); if (mouseStopTimerRef.current) clearTimeout(mouseStopTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    const hasSaved = loadStateFromStorage();
    if (!hasSaved) {
      setChatStatus("typing");
      setTimeout(() => { setMessages([createMessage("bot", "أهلاً بك في قناة مجلة دار النجوم! 🌟 أنا المساعد الذكي. كيف يمكنني خدمتك اليوم؟", "assistant")]); setChatStatus("online"); }, 800);
    }
  }, [open, messages.length, loadStateFromStorage]);

  const getStatusText = () => {
    switch (chatStatus) {
      case "typing": return "يكتب الآن..."; case "online": return "متصل الآن"; case "waiting": return "في قائمة الانتظار...";
      case "warning": return "بانتظار تأكيد استمرارك..."; case "closed": return "عاد المساعد الذكي"; default: return "غير نشط";
    }
  };

  const getStatusColor = () => {
    switch (chatStatus) {
      case "typing": return "bg-yellow-400 animate-pulse"; case "online": return "bg-green-400 animate-pulse";
      case "waiting": return "bg-orange-400 animate-pulse"; case "warning": return "bg-red-400 animate-pulse";
      case "closed": return "bg-green-400 animate-pulse"; default: return "bg-gray-400";
    }
  };

  const renderSeamlessItems = () => {
    const products = [...TRENDING_PRODUCTS, ...TRENDING_PRODUCTS];
    const shapeMap: Record<ProductShape, string> = { 'circle': 'w-16 h-16 rounded-full', 'rectangle': 'w-20 h-14 rounded-xl', 'portrait': 'w-14 h-20 rounded-2xl', 'square': 'w-16 h-16 rounded-md' };
    return products.map((product, index) => (
      <div key={`${product.id}-${index}`} className="flex-shrink-0 inline-flex items-center gap-4 mx-4 bg-[#1f2937]/90 backdrop-blur-sm px-4 py-3 border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 w-[300px]">
        <img src={product.img} alt={product.name} className={`object-cover border-2 border-purple-500 shadow-md flex-shrink-0 ${shapeMap[product.shape]}`} />
        <div className="flex flex-col text-right flex-1 min-w-0">
          <span className="text-sm md:text-base font-bold text-white leading-tight mb-1 line-clamp-2">{product.name}</span>
          <span className="text-xs md:text-sm text-purple-400 font-medium leading-tight line-clamp-2">{product.desc}</span>
        </div>
      </div>
    ));
  };

  // ============================================================
  // JSX
  // ============================================================
  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white font-sans flex flex-col" dir="rtl">
      <style jsx global>{`
        @keyframes seamless-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-seamless-scroll { animation: seamless-scroll 50s linear infinite; will-change: transform; }
        .animate-seamless-scroll:hover { animation-play-state: paused; }
        
        @keyframes fade-in-right { 0% { opacity: 0; transform: translateX(30px); } 100% { opacity: 1; transform: translateX(0); } }
        .animate-fade-in-right { animation: fade-in-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes natural-blink { 0%, 45%, 55%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.1); } }
        .animate-natural-blink { animation: natural-blink 4s infinite; transform-origin: center; }

        @keyframes micro-smile { 0%, 100% { d: path("M 10 22 C 10 22, 14 25, 16 25 C 18 25, 22 22, 22 22"); } 50% { d: path("M 10 22 C 10 22, 14 26, 16 26 C 18 26, 22 22, 22 22"); } }
        .animate-micro-smile { animation: micro-smile 5s ease-in-out infinite; }

        @keyframes talking-mouth {
          0%, 100% { d: path("M 10 22 C 10 22, 14 25, 16 25 C 18 25, 22 22, 22 22"); }
          50% { d: path("M 10 21 C 10 21, 14 27.5, 16 27.5 C 18 27.5, 22 21, 22 21"); }
        }
        .animate-talking-mouth { animation: talking-mouth 0.4s ease-in-out infinite; }

        @keyframes gentle-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        .animate-gentle-float { animation: gentle-float 3s ease-in-out infinite; }

        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }
      `}</style>

      {loadingProgress > 0 && (
        <div className="fixed top-0 right-0 left-auto z-[100] h-1 bg-gray-800/50 w-full">
          <div 
            className="h-full bg-gradient-to-l from-purple-500 via-blue-500 to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]"
            style={{ 
              width: `${loadingProgress}%`,
              transition: loadingProgress === 100 ? 'width 0.5s ease-out, opacity 0.5s ease-out' : 'width 0.4s ease-out',
              opacity: loadingProgress === 100 ? 0 : 1
            }}
          />
        </div>
      )}

      {/* 🔴 تم عكس ترتيب عناصر الهيدر فقط: الأزرار أولاً (يمين)، البحث ثانياً (وسط)، الشعار والاسم ثالثاً (يسار) */}
      <header className="sticky top-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="w-full px-2 md:px-4 py-3 flex flex-wrap md:flex-nowrap justify-between items-center gap-2 md:gap-4">
          
          {/* 1. الأزرار (الجهة اليمنى في RTL) */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <a href="/upgrade" className="hidden sm:flex items-center gap-1 px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition">ترقية 👑</a>
            <a href="/login" className="px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition">اشتراك</a>
          </div>

          {/* 2. شريط البحث (المنتصف) */}
          <div className="flex-1 max-w-md mx-2 hidden md:block">
            <input type="text" placeholder="🔎 ابحث عن مشاهير، برامج، أو محتوى..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500 text-sm" />
          </div>

          {/* 3. الشعار والاسم (الجهة اليسرى في RTL) */}
          <a href="/" className="flex items-center gap-2 md:gap-3 shrink-0">
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
        <div className="flex animate-seamless-scroll w-max">{renderSeamlessItems()}</div>
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

      <div ref={chatButtonRef} onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/40 cursor-pointer hover:scale-110 transition-transform duration-300 z-50 border-2 border-white/10 animate-fade-in-right" title="مركز المساعدة">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="animate-gentle-float">
            <g className="animate-natural-blink">
              <circle cx="10" cy="14" r="5" fill="white" />
              <circle cx="10" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${isMouseMoving ? mousePos.x : Math.sin(Date.now() / 1000) * 2}px, ${isMouseMoving ? mousePos.y : Math.cos(Date.now() / 1000) * 2}px)`, transition: 'transform 0.3s ease-out' }} />
            </g>
            <g className="animate-natural-blink" style={{ animationDelay: '0.1s' }}>
              <circle cx="22" cy="14" r="5" fill="white" />
              <circle cx="22" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${isMouseMoving ? mousePos.x : Math.sin(Date.now() / 1000) * 2}px, ${isMouseMoving ? mousePos.y : Math.cos(Date.now() / 1000) * 2}px)`, transition: 'transform 0.3s ease-out' }} />
            </g>
            <path 
              className={chatStatus === "typing" ? "animate-talking-mouth" : "animate-micro-smile"} 
              d={chatStatus === "typing" ? "M 10 22 C 10 22, 14 27, 16 27 C 18 27, 22 22, 22 22" : "M 10 22 C 10 22, 14 25, 16 25 C 18 25, 22 22, 22 22"} 
              stroke="white" strokeWidth="2.5" strokeLinecap="round" 
            />
          </g>
        </svg>
      </div>

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
              return <div key={msg.id} className="flex justify-center my-2"><span className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700 text-center max-w-[90%]">{msg.text}</span></div>;
            }
            const isUser = msg.sender === "user";
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                {!isUser && <span className="text-[10px] text-gray-400 mb-1 ml-1">{msg.sender === "agent" && currentAgent ? `${currentAgent.name} (${currentAgent.role})` : "المساعد الذكي"}</span>}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative ${isUser ? "bg-purple-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-purple-500/30 rounded-tl-sm"}`}>
                  {msg.text}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map((att, idx) => {
                        if (att.type === 'image' && att.url) return <img key={idx} src={att.url} alt="attachment" className="rounded-lg max-w-full h-auto border border-gray-600" />;
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
            <div className="space-y-2 mt-2 animate-fade-in-right">
              {DEPARTMENT_OPTIONS.map((dept) => (
                <button key={dept.id} onClick={() => initiateDepartmentTransfer(dept.id)} className="w-full text-right bg-[#1f2937] hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500 rounded-xl p-3 transition-all duration-200 group">
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
              disabled={showDepartmentSelection}
              className="flex-1 bg-[#0b0f1a] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700 placeholder-gray-500 resize-none overflow-y-auto max-h-32 min-h-[42px] leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button 
              onClick={sendMessage} 
              disabled={!text.trim() || chatStatus === "typing" || showDepartmentSelection || isSendingRef.current} 
              className="p-3 rounded-xl text-sm font-bold transition mb-0.5 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
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