"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// TYPES & INTERFACES
// ============================================================

type Sender = "user" | "bot" | "agent" | "system";
type AgentStatus = "online" | "away" | "offline";
type Department = 'support' | 'ads' | 'technical';
type ChatStatus = "typing" | "online" | "waiting" | "inactive" | "closed";
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

// 🔴 العملة قابلة للتعديل من هنا - يمكن تغييرها لأي عملة أخرى
const CURRENCY_CONFIG = {
  symbol: "USD",        // USD, IQD, SAR, EUR, etc.
  symbolAr: "دولار",    // الاسم بالعربية
  position: "after" as "before" | "after", // before = 500$ | after = 500 دولار
  format: (amount: number) => `${amount} ${CURRENCY_CONFIG.symbolAr}`
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
  IDLE_TO_INACTIVE: 60,
  INACTIVE_TO_CLOSED: 50, // 🔴 50 ثانية قبل العودة للمساعد الذكي
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
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const wantsHumanContact = (inputText: string): boolean => {
  const normalized = normalizeArabicText(inputText);
  const humanRequestKeywords = [
    "موظف", "شخص", "انسان", "بشري", "حقيقي", "ممثل", "خدمة العملاء", 
    "فريق الدعم", "اكلم", "اتحدث", "اتواصل", "حولني", "تحويل", "ادارة", "مسؤول"
  ];
  return humanRequestKeywords.some(keyword => normalized.includes(keyword));
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
  
  // شريط التحميل
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const chatButtonRef = useRef<HTMLDivElement>(null);

  const currentSpeakerRef = useRef(currentSpeaker);
  const chatStatusRef = useRef(chatStatus);
  const lastActivityTimeRef = useRef(Date.now());
  const isSendingRef = useRef(false);
  const previousAgentRepliesRef = useRef<Set<string>>(new Set());
  
  // 🔴 تتبع مرحلة الختام والسياق
  const awaitingFinalConfirmationRef = useRef(false);
  const lastTopicRef = useRef<string>("");
  const conversationContextRef = useRef<string[]>([]);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { chatStatusRef.current = chatStatus; }, [chatStatus]);

  // ============================================================
  // شريط التحميل الاحترافي
  // ============================================================
  useEffect(() => {
    let progress = 0;
    let isComplete = false;
    let fallbackTimeout: NodeJS.Timeout;

    const smoothProgress = (target: number, duration: number = 400) => {
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
        
        if (progressRatio < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    };

    // بدء تدريجي
    smoothProgress(20, 200);
    
    const t1 = setTimeout(() => smoothProgress(45, 500), 100);
    const t2 = setTimeout(() => smoothProgress(70, 600), 400);
    const t3 = setTimeout(() => smoothProgress(90, 500), 800);

    const handleReadyState = () => {
      if (document.readyState === 'interactive') {
        smoothProgress(95, 300);
      }
    };

    const handleLoad = () => {
      isComplete = true;
      clearTimeout(fallbackTimeout);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 500);
    };

    document.addEventListener('readystatechange', handleReadyState);
    window.addEventListener('load', handleLoad);

    fallbackTimeout = setTimeout(() => {
      if (!isComplete) {
        isComplete = true;
        setLoadingProgress(100);
        setTimeout(() => setLoadingProgress(0), 500);
      }
    }, 8000);

    return () => {
      document.removeEventListener('readystatechange', handleReadyState);
      window.removeEventListener('load', handleLoad);
      clearTimeout(fallbackTimeout);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // ============================================================
  // LOCAL STORAGE
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
        isQueued
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
      awaitingFinalConfirmationRef.current = false;
      lastTopicRef.current = "";
      conversationContextRef.current = [];
      return true;
    } catch (e) { 
      console.error('Load state error:', e); 
      return false; 
    }
  }, []);

  // ============================================================
  // SESSION LIFECYCLE MANAGEMENT
  // ============================================================

  useEffect(() => {
    if (currentSpeaker === "agent" || currentSpeaker === "bot") {
      lastActivityTimeRef.current = Date.now();
      if (chatStatus === "inactive") {
        setChatStatus("online");
      }
    }
  }, [messages, currentSpeaker]);

  useEffect(() => {
    if (currentSpeaker !== "agent" && !isQueued) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - lastActivityTimeRef.current) / 1000;

      if (currentSpeakerRef.current === "agent") {
        const totalTimeout = SESSION_TIMEOUTS.IDLE_TO_INACTIVE + SESSION_TIMEOUTS.INACTIVE_TO_CLOSED;
        
        if (elapsedSeconds >= totalTimeout) {
          closeAgentSession();
        } else if (elapsedSeconds >= SESSION_TIMEOUTS.IDLE_TO_INACTIVE && chatStatusRef.current !== "inactive" && chatStatusRef.current !== "closed") {
          setChatStatus("inactive");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSpeaker, isQueued]);

  const closeAgentSession = useCallback(() => {
    const freshBotMessage = createMessage(
      "bot",
      "أهلاً بك مجدداً!  أنا المساعد الذكي. كيف يمكنني خدمتك اليوم؟",
      "assistant"
    );

    setMessages([freshBotMessage]);
    setCurrentSpeaker("bot");
    setCurrentAgent(null);
    setSessionAgents([]);
    setIsQueued(false);
    setShowDepartmentSelection(false);
    setChatStatus("online");
    lastActivityTimeRef.current = Date.now();
    previousAgentRepliesRef.current.clear();
    awaitingFinalConfirmationRef.current = false;
    lastTopicRef.current = "";
    conversationContextRef.current = [];

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "dar-alnujum-chat-state",
        JSON.stringify({
          messages: [freshBotMessage],
          currentSpeaker: "bot",
          currentAgent: null,
          sessionAgents: [],
          chatStatus: "online",
          isQueued: false
        })
      );
    }
  }, []);

  const startAgentSession = useCallback((agent: Agent) => {
    setCurrentAgent(agent);
    setSessionAgents([agent]);
    setCurrentSpeaker("agent");
    setIsQueued(false);
    setShowDepartmentSelection(false);
    previousAgentRepliesRef.current.clear();
    awaitingFinalConfirmationRef.current = false;
    lastTopicRef.current = "";
    conversationContextRef.current = [];
    
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
    setChatStatus("typing");
    const deptOption = DEPARTMENT_OPTIONS.find(d => d.id === dept);
    
    setMessages(prev => [...prev, createMessage("system", `جاري البحث عن موظف متاح في ${deptOption?.name}...`)]);
    setShowDepartmentSelection(false);

    setTimeout(() => {
      const availableAgent = findAvailableAgent(dept);
      if (availableAgent) {
        startAgentSession(availableAgent);
      } else {
        setIsQueued(true);
        setMessages(prev => [...prev, createMessage("system", `جميع موظفي ${deptOption?.name} مشغولون حالياً. تم وضعك في قائمة الانتظار.`)]);
        setChatStatus("waiting");
        
        setTimeout(() => {
          const fallbackAgent = findAvailableAgent(dept) || SUPPORT_AGENTS.find(a => a.department === dept);
          if (fallbackAgent) {
            startAgentSession(fallbackAgent);
            setMessages(prev => [...prev, createMessage("system", "تم توصيلك بأحد موظفينا. نعتذر عن الانتظار.")]);
          }
        }, SESSION_TIMEOUTS.QUEUE_CHECK_INTERVAL);
      }
    }, 1500);
  }, [startAgentSession]);

  const checkAndPerformEscalation = useCallback((userText: string): boolean => {
    if (wantsHumanContact(userText) && currentSpeaker === "bot" && !showDepartmentSelection) {
      handleHumanRequest();
      return true;
    }
    return false;
  }, [currentSpeaker, showDepartmentSelection, handleHumanRequest]);

  // ============================================================
  // INTERNAL TRANSFER BETWEEN AGENTS
  // ============================================================

  const performInternalTransfer = useCallback((targetDept: Department, currentAgentName: string) => {
    const targetAgent = findAvailableAgent(targetDept) || SUPPORT_AGENTS.find(a => a.department === targetDept);
    
    if (!targetAgent) return;

    const transferMsg = createMessage(
      "agent",
      `لحظة واحدة، سأحولك الآن إلى زميلي المختص بهذا النوع من الطلبات.`,
      "assistant"
    );
    
    setMessages(prev => [...prev, transferMsg]);
    
    setTimeout(() => {
      setSessionAgents(prev => {
        if (prev.find(a => a.employeeId === targetAgent!.employeeId)) return prev;
        return [...prev, targetAgent!];
      });
      
      setCurrentAgent(targetAgent);
      awaitingFinalConfirmationRef.current = false;
      lastTopicRef.current = "";
      conversationContextRef.current = [];
      
      setTimeout(() => {
        const newAgentWelcome = createMessage(
          "agent",
          `مرحباً، أنا ${targetAgent!.name} من قسم ${targetDept === 'ads' ? 'الإعلانات' : targetDept === 'technical' ? 'الدعم الفني' : 'خدمة العملاء'}. اطلعت على كامل المحادثة بينك وبين الأستاذ ${currentAgentName}، وسأتابع معك من هذه النقطة. كيف أقدر أساعدك؟`,
          "assistant"
        );
        
        setMessages(prev => [...prev, newAgentWelcome]);
        setChatStatus("online");
        isSendingRef.current = false;
      }, 1000);
    }, 1500);
  }, []);

  // ============================================================
  // SEND MESSAGE & API HANDLING
  // ============================================================

  const sendMessage = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingRef.current) return;

    isSendingRef.current = true;
    setMessages(prev => [...prev, createMessage("user", trimmedText, "user", "sent")]);
    setText("");
    
    // حفظ السياق
    conversationContextRef.current.push(trimmedText);
    if (conversationContextRef.current.length > 5) {
      conversationContextRef.current.shift();
    }

    if (checkAndPerformEscalation(trimmedText)) {
      isSendingRef.current = false;
      return;
    }

    // ============================================================
    // سلوك الموظف المحاكي المحسّن
    // ============================================================
    if (currentSpeaker === "agent" && currentAgent) {
      setChatStatus("typing");
      setTimeout(() => {
        const normalized = normalizeArabicText(trimmedText);
        const currentDept = currentAgent.department;
        const context = conversationContextRef.current.join(" ");

        // 🔴 التحقق: هل المستخدم يرد على سؤال "هل تحتاج شيئاً آخر؟"
        if (awaitingFinalConfirmationRef.current) {
          const isDeclining = 
            normalized === "لا" || 
            normalized.includes("خلاص") || 
            normalized.includes("كفى") ||
            normalized.includes("ما احتاج") ||
            normalized.includes("لا شكرا") ||
            normalized.includes("لا شكرًا") ||
            normalized.includes("انتهى") ||
            normalized.includes("هذا كل شيء") ||
            normalized.includes("بس هيك") ||
            (normalized.includes("لا") && normalized.length < 15 && !normalized.includes("لا اريد") && !normalized.includes("لا احتاج"));
          
          const isContinuing = 
            normalized.includes("نعم") || 
            normalized.includes("اي") || 
            normalized.includes("ابي") || 
            normalized.includes("عندي") ||
            normalized.includes("احتاج") ||
            normalized.includes("اريد") ||
            normalized.includes("كيف") ||
            normalized.includes("وش") ||
            normalized.includes("ماذا") ||
            normalized.includes("متى") ||
            normalized.includes("اين") ||
            normalized.includes("ليش") ||
            normalized.includes("لماذا") ||
            normalized.includes("كم") ||
            normalized.includes("شنو") ||
            normalized.includes("ماهو");

          if (isDeclining && !isContinuing) {
            // 🔴 ختام المحادثة بأسلوب احترافي متنوع
            const closingReplies = [
              "أشكرك على تواصلك معنا. نتمنى لك يوماً سعيداً، وإذا احتجت أي مساعدة مستقبلاً فنحن في خدمتك دائماً.",
              "شكراً لثقتك بنا. أتمنى لك التوفيق، ولا تتردد في التواصل معنا في أي وقت.",
              "على الرحب والسعة. نتمنى لك يوماً مباركاً، ونحن دائماً هنا لخدمتك.",
              "تشرفنا بخدمتك. نتمنى لك كل التوفيق والنجاح، وفي أي وقت تحتاجنا نحن موجودين."
            ];
            
            const agentReply = closingReplies[Math.floor(Math.random() * closingReplies.length)];
            previousAgentRepliesRef.current.add(agentReply);
            setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
            setChatStatus("online");
            awaitingFinalConfirmationRef.current = false;
            lastTopicRef.current = "";
            isSendingRef.current = false;
            return;
          } else if (isContinuing || normalized.length > 10) {
            // المستخدم يحتاج شيئاً آخر - يستمر الحوار
            awaitingFinalConfirmationRef.current = false;
            // يكمل معالجة الرسالة كاستفسار جديد
          } else {
            // رد غامض - نسأل مرة أخرى
            setMessages(prev => [...prev, createMessage("agent", "عذراً أستاذ، هل تقصد أنك لا تحتاج شيئاً آخر أم لديك استفسار جديد؟", "assistant")]);
            setChatStatus("online");
            isSendingRef.current = false;
            return;
          }
        }

        // 🔴 ردود الشكر - لا تغلق الجلسة مباشرة
        if (normalized.includes("شكر") || normalized.includes("مشكور") || normalized.includes("يسلمو") || 
            normalized.includes("ممتاز") || normalized.includes("تمام") || normalized.includes("أوكي") || 
            normalized.includes("الله يعطيك") || normalized.includes("حلو") || normalized.includes("زين")) {
          
          const thanksReplies = [
            "العفو أستاذ، هذا واجبنا. هل تحتاج أي استفسار آخر؟",
            "تدلل أستاذ، بأي وقت. هل هناك شيء آخر أقدر أساعدك فيه؟",
            "بالعفو أستاذ، تحت أمرك. هل لديك أي سؤال آخر؟",
            "يسعدنا خدمتك أستاذ. هل تحتاج أي شيء آخر؟",
            "العفو، هذا من واجبنا. هل هناك استفسار آخر؟"
          ];
          
          const availableReplies = thanksReplies.filter(r => !previousAgentRepliesRef.current.has(r));
          let agentReply;
          if (availableReplies.length > 0) {
            agentReply = availableReplies[Math.floor(Math.random() * availableReplies.length)];
          } else {
            previousAgentRepliesRef.current.clear();
            agentReply = thanksReplies[Math.floor(Math.random() * thanksReplies.length)];
          }
          
          previousAgentRepliesRef.current.add(agentReply);
          setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
          setChatStatus("online");
          awaitingFinalConfirmationRef.current = true; // 🔴 ننتظر تأكيد المستخدم
          isSendingRef.current = false;
          return;
        }

        // 🔴 الاستفسار عن الأسعار/الإعلانات - ردود متنوعة حسب السياق
        if (normalized.includes("سعر") || normalized.includes("كلفه") || normalized.includes("كم")) {
          lastTopicRef.current = "pricing";
          
          if (currentDept === 'ads') {
            // 🔴 ردود متنوعة لا تتكرر
            const pricingReplies = [
              `أسعارنا تبدأ من ${CURRENCY_CONFIG.format(500)} للباقة الأسبوعية التي تصل إلى 50,000 ظهور. هل تود معرفة تفاصيل الباقات الأخرى؟`,
              `الباقة الأساسية بـ ${CURRENCY_CONFIG.format(500)} أسبوعياً، والمتوسطة بـ ${CURRENCY_CONFIG.format(1500)} شهرياً. أيهما يناسب مشروعك؟`,
              `لدينا ثلاث باقات: أسبوعية بـ ${CURRENCY_CONFIG.format(500)}، شهرية بـ ${CURRENCY_CONFIG.format(1500)}، ومميزة بـ ${CURRENCY_CONFIG.format(3000)}. هل تريد تفاصيل أكثر عن باقة معينة؟`
            ];
            
            const availableReplies = pricingReplies.filter(r => !previousAgentRepliesRef.current.has(r));
            let agentReply;
            if (availableReplies.length > 0) {
              agentReply = availableReplies[Math.floor(Math.random() * availableReplies.length)];
            } else {
              previousAgentRepliesRef.current.clear();
              agentReply = pricingReplies[Math.floor(Math.random() * pricingReplies.length)];
            }
            
            previousAgentRepliesRef.current.add(agentReply);
            setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
            setChatStatus("online");
            isSendingRef.current = false;
            return;
          } else {
            performInternalTransfer('ads', currentAgent.name);
            return;
          }
        }

        // 🔴 الاستفسار عن المدة
        if (normalized.includes("مدة") || normalized.includes("فترة") || normalized.includes("كم يوم") || normalized.includes("كم شهر")) {
          lastTopicRef.current = "duration";
          
          if (currentDept === 'ads') {
            const durationReplies = [
              "الباقة الأسبوعية تمتد 7 أيام، والشهرية 30 يوم، والمميزة يمكن تخصيصها حسب حاجتك. أي مدة تناسب حملتك؟",
              "المدة تعتمد على الباقة: أسبوع، شهر، أو مدة مخصصة للباقة المميزة. ما المدة التي تفكر بها؟",
              "نوفر مرونة في المدة: من أسبوع واحد إلى شهر كامل أو أكثر. هل لديك مدة محددة في ذهنك؟"
            ];
            
            const availableReplies = durationReplies.filter(r => !previousAgentRepliesRef.current.has(r));
            let agentReply;
            if (availableReplies.length > 0) {
              agentReply = availableReplies[Math.floor(Math.random() * availableReplies.length)];
            } else {
              previousAgentRepliesRef.current.clear();
              agentReply = durationReplies[Math.floor(Math.random() * durationReplies.length)];
            }
            
            previousAgentRepliesRef.current.add(agentReply);
            setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
            setChatStatus("online");
            isSendingRef.current = false;
            return;
          } else {
            performInternalTransfer('ads', currentAgent.name);
            return;
          }
        }

        // 🔴 الاستفسار عن المنصات
        if (normalized.includes("منص") || normalized.includes("وين") || normalized.includes("اين") || normalized.includes("مكان")) {
          lastTopicRef.current = "platforms";
          
          if (currentDept === 'ads') {
            const platformReplies = [
              "نغطي جميع المنصات الرئيسية: فيسبوك، إنستغرام، تويتر، تيك توك، ويوتيوب. هل تركز على منصة معينة؟",
              "إعلاناتنا تظهر على منصات التواصل الاجتماعي الرئيسية. هل لديك تفضيل لمنصة محددة؟",
              "نوفر وصولاً واسعاً عبر منصات متعددة. أخبرني عن جمهورك المستهدف وسأنصحك بالمنصات الأنسب."
            ];
            
            const availableReplies = platformReplies.filter(r => !previousAgentRepliesRef.current.has(r));
            let agentReply;
            if (availableReplies.length > 0) {
              agentReply = availableReplies[Math.floor(Math.random() * availableReplies.length)];
            } else {
              previousAgentRepliesRef.current.clear();
              agentReply = platformReplies[Math.floor(Math.random() * platformReplies.length)];
            }
            
            previousAgentRepliesRef.current.add(agentReply);
            setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
            setChatStatus("online");
            isSendingRef.current = false;
            return;
          } else {
            performInternalTransfer('ads', currentAgent.name);
            return;
          }
        }

        // 🔴 الاستفسار التقني
        if (normalized.includes("مشكله") || normalized.includes("خطأ") || normalized.includes("لا يعمل") || 
            normalized.includes("معلق")) {
          
          lastTopicRef.current = "technical";
          
          if (currentDept === 'technical') {
            const techReplies = [
              "حاضر، يسعدني مساعدتك في حل هذه المشكلة. لكي أتمكن من فحص الأمر بدقة، هل يمكنك تزويدي برقم الطلب أو لقطة شاشة (Screenshot) للخطأ الذي يظهر لك؟",
              "أكيد، أنا هنا لمساعدتك. يرجى تزويدي بتفاصيل أكثر عن المشكلة: متى بدأت؟ وهل تظهر رسالة خطأ معينة؟",
              "حاضر، سأقوم بمراجعة الأمر فوراً. هل يمكنك وصف ما يحدث بالضبط؟ وأي خطوة تقوم بها عندما تظهر المشكلة؟"
            ];
            
            const availableTechReplies = techReplies.filter(r => !previousAgentRepliesRef.current.has(r));
            let agentReply;
            if (availableTechReplies.length > 0) {
              agentReply = availableTechReplies[Math.floor(Math.random() * availableTechReplies.length)];
            } else {
              previousAgentRepliesRef.current.clear();
              agentReply = techReplies[Math.floor(Math.random() * techReplies.length)];
            }
            
            previousAgentRepliesRef.current.add(agentReply);
            setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
            setChatStatus("online");
            isSendingRef.current = false;
            return;
          } else {
            performInternalTransfer('technical', currentAgent.name);
            return;
          }
        }

        // 🔴 تحية جديدة
        if (normalized.includes("مرحبا") || normalized.includes("هلو") || normalized.includes("السلام")) {
          const greetingReplies = [
            "أهلاً بك مجدداً. كيف يمكنني خدمتك الآن؟",
            "أهلاً وسهلاً. تفضل، أنا أستمع إليك.",
            "مرحباً بك. كيف أقدر أساعدك؟"
          ];
          
          const availableGreetings = greetingReplies.filter(r => !previousAgentRepliesRef.current.has(r));
          let agentReply;
          if (availableGreetings.length > 0) {
            agentReply = availableGreetings[Math.floor(Math.random() * availableGreetings.length)];
          } else {
            previousAgentRepliesRef.current.clear();
            agentReply = greetingReplies[Math.floor(Math.random() * greetingReplies.length)];
          }
          
          previousAgentRepliesRef.current.add(agentReply);
          setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
          setChatStatus("online");
          isSendingRef.current = false;
          return;
        }

        // 🔴 رد عام حسب اختصاص الموظف
        const generalReplies: string[] = [];
        
        if (currentDept === 'ads') {
          generalReplies.push(
            "أكيد، يسعدني ذلك. هل تود أن نبدأ بتجهيز إحدى الباقات الإعلانية لمتجرك، أم لديك استفسار عن ميزة معينة في الحملات؟",
            "بكل سرور. أنا هنا لمساعدتك في جميع استفساراتك المتعلقة بالإعلانات. تفضل بطرح سؤالك.",
            "حاضر، أنا معك. ما الذي تود معرفته عن خدماتنا الإعلانية؟"
          );
        } else if (currentDept === 'technical') {
          generalReplies.push(
            "حاضر، أنا أتابع معك. يرجى تزويدي بأي تفاصيل إضافية وسأقوم بمعالجتها فوراً.",
            "أكيد، سأقوم بمساعدتك. هل يمكنك توضيح المشكلة أكثر؟",
            "حاضر، أنا هنا. ما التفاصيل الأخرى التي تحتاجها؟"
          );
        } else {
          generalReplies.push(
            "بكل سرور. تفضل، أنا أستمع إليك وسأقوم باللازم فوراً.",
            "أكيد، يسعدني مساعدتك. كيف أقدر أخدمك؟",
            "حاضر، أنا معك. تفضل بطرح استفسارك."
          );
        }
        
        const availableGeneral = generalReplies.filter(r => !previousAgentRepliesRef.current.has(r));
        let agentReply;
        if (availableGeneral.length > 0) {
          agentReply = availableGeneral[Math.floor(Math.random() * availableGeneral.length)];
        } else {
          previousAgentRepliesRef.current.clear();
          agentReply = generalReplies[Math.floor(Math.random() * generalReplies.length)];
        }
        
        previousAgentRepliesRef.current.add(agentReply);
        setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
        
        // 🔴 بعد الرد العام، يسأل عن حاجة أخرى
        setTimeout(() => {
          const followUpQuestions = [
            "هل تحتاج إلى شيء آخر أستاذ؟",
            "هل لديك أي استفسار آخر؟",
            "هل هناك شيء آخر أقدر أساعدك فيه؟"
          ];
          const followUp = followUpQuestions[Math.floor(Math.random() * followUpQuestions.length)];
          setMessages(prev => [...prev, createMessage("agent", followUp, "assistant")]);
          awaitingFinalConfirmationRef.current = true;
          setChatStatus("online");
          isSendingRef.current = false;
        }, 1200);
      }, 1500);
      return; 
    }

    // ============================================================
    // منطق المساعد الذكي (AI API)
    // ============================================================
    setChatStatus("typing");
    try {
      const apiMessages = messages
        .filter(m => m.sender !== "system")
        .map(m => ({ 
          role: (m.sender === "bot" || m.sender === "agent") ? "assistant" : "user", 
          content: m.text 
        }));
      
      if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].role !== "user") {
         apiMessages.push({ role: "user", content: trimmedText });
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
    }
  }, [text, currentSpeaker, currentAgent, checkAndPerformEscalation, showDepartmentSelection, handleHumanRequest, messages, performInternalTransfer]);

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => { saveStateToStorage(); }, [saveStateToStorage]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!chatButtonRef.current) return;
      const rect = chatButtonRef.current.getBoundingClientRect();
      setMousePos({ 
        x: Math.max(-4, Math.min(4, (e.clientX - (rect.left + rect.width / 2)) / 30)),
        y: Math.max(-4, Math.min(4, (e.clientY - (rect.top + rect.height / 2)) / 30))
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    const hasSaved = loadStateFromStorage();
    if (!hasSaved) {
      setChatStatus("typing");
      setTimeout(() => {
        setMessages([createMessage("bot", "أهلاً بك في قناة مجلة دار النجوم! 🌟 أنا المساعد الذكي. كيف يمكنني خدمتك اليوم؟ يمكنك سؤالي عن الأخبار، البرامج، أسعار الإعلانات، أو أي استفسار آخر.", "assistant")]);
        setChatStatus("online");
      }, 800);
    }
  }, [open, messages.length, loadStateFromStorage]);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const getStatusText = () => {
    switch (chatStatus) {
      case "typing": return "يكتب الآن...";
      case "online": return "متصل الآن";
      case "waiting": return "في قائمة الانتظار...";
      case "inactive": return "انتهت المحادثة مؤقتاً (بانتظار ردك)";
      case "closed": return "عاد المساعد الذكي";
      default: return "غير نشط";
    }
  };

  const getStatusColor = () => {
    switch (chatStatus) {
      case "typing": return "bg-yellow-400 animate-pulse";
      case "online": return "bg-green-400 animate-pulse";
      case "waiting": return "bg-orange-400 animate-pulse";
      case "inactive": return "bg-gray-500";
      case "closed": return "bg-green-400 animate-pulse";
      default: return "bg-gray-400";
    }
  };

  const renderSeamlessItems = () => {
    const products = [...TRENDING_PRODUCTS, ...TRENDING_PRODUCTS];
    const shapeMap: Record<ProductShape, string> = {
      'circle': 'w-16 h-16 rounded-full',
      'rectangle': 'w-20 h-14 rounded-xl',
      'portrait': 'w-14 h-20 rounded-2xl',
      'square': 'w-16 h-16 rounded-md'
    };

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
  };

  // ============================================================
  // JSX
  // ============================================================

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white font-sans flex flex-col">
      <style jsx global>{`
        @keyframes seamless-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-seamless-scroll { animation: seamless-scroll 50s linear infinite; will-change: transform; }
        .animate-seamless-scroll:hover { animation-play-state: paused; }
        @keyframes slide-in-right { 0% { transform: translateX(100px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        .animate-blink { animation: blink 4s infinite; transform-origin: center; }
        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }
      `}</style>

      {/* شريط التحميل الاحترافي */}
      {loadingProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gray-800/50">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.7)]"
            style={{ 
              width: `${loadingProgress}%`,
              transition: loadingProgress === 100 ? 'width 0.4s ease-out, opacity 0.4s ease-out' : 'width 0.3s ease-out',
              opacity: loadingProgress === 100 ? 0 : 1
            }}
          />
        </div>
      )}

      <header className="sticky top-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="w-full px-2 md:px-4 py-3 flex flex-wrap md:flex-nowrap justify-between items-center gap-2 md:gap-4">
          <a href="/" className="flex items-center gap-2 md:gap-3 shrink-0">
            <img src="https://iili.io/Bsjh2M7.png" alt="شعار" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border-2 border-purple-500 shadow-md" />
            <span className="text-base md:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">قناة مجلة دار النجوم</span>
          </a>
          <div className="flex-1 max-w-md mx-2 hidden md:block">
            <input type="text" placeholder="🔎 ابحث عن مشاهير، برامج، أو محتوى..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500 text-sm" />
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <a href="/upgrade" className="hidden sm:flex items-center gap-1 px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition">ترقية 👑</a>
            <a href="/login" className="px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition">اشتراك</a>
          </div>
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

      <div ref={chatButtonRef} onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/40 cursor-pointer hover:scale-110 transition-transform duration-300 z-50 border-2 border-white/10 animate-slide-in-right" title="مركز المساعدة">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="animate-blink"><circle cx="10" cy="14" r="5" fill="white" /><circle cx="10" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.1s ease-out' }} /></g>
          <g className="animate-blink"><circle cx="22" cy="14" r="5" fill="white" /><circle cx="22" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.1s ease-out' }} /></g>
          <path d="M10 22C10 22 14 26 16 26C18 26 22 22 22 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
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