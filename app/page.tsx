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
  type: 'image' | 'link' | 'card' | 'product' | 'file' | 'video';
  url?: string;
  title?: string;
  description?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
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
  IDLE_TO_INACTIVE: 59000, // 59 ثانية
  INACTIVE_TO_CLOSED: 2000, // ثانيتين
  QUEUE_CHECK_INTERVAL: 8000,
};

const TRENDING_PRODUCTS: TrendingProduct[] = [
  { id: 1, name: "كاميرا تصوير احترافية", desc: "خصم 25% لفترة محدودة", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&h=150&fit=crop", shape: "circle" },
  { id: 2, name: "سماعات استوديو", desc: "عزل ضوضاء فائق الجودة", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=150&fit=crop", shape: "rectangle" },
  { id: 3, name: "إضاءة Ring Light", desc: "مثالية لصناع المحتوى", img: "https://images.unsplash.com/photo-1615469062329-5f23633c1182?w=150&h=150&fit=crop", shape: "square" },
  { id: 4, name: "ميكروفون بث مباشر", desc: "جودة صوت استثنائية", img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=150&h=200&fit=crop", shape: "portrait" },
];

// ============================================================
// SMART CONTEXTUAL OPTIONS & LINKS
// ============================================================
const CONTEXTUAL_DATA = {
  pricing: {
    keywords: ["سعر", "اسعار", "اعلان", "باقة", "اشتراك", "تكلفة", "عروض", "بكم", "كم", "اشتراكات"],
    response: "يسعدني تزويدك بالتفاصيل. يمكنك الاطلاع على خياراتنا أدناه، أو اختيار أحد الخيارات السريعة:",
    quickReplies: ["أسعار الإعلانات", "الباقات والاشتراكات", "طلب عرض سعر مخصص", "التواصل مع المبيعات"],
    link: { title: "صفحة الأسعار والباقات", url: "/pricing", description: "اطلع على جميع التفاصيل" }
  },
  content: {
    keywords: ["برامج", "محتوى", "فيديو", "مهرجان", "خبر", "اخبار", "معرض", "فيديوهات", "مقالات"],
    response: "يسعدني مساعدتك في استكشاف محتوى قناة دار النجوم. يرجى اختيار ما تبحث عنه:",
    quickReplies: ["أحدث البرامج", "الأخبار العاجلة", "المهرجانات والتغطيات", "معرض الصور والفيديو"],
    link: { title: "استكشف المحتوى", url: "/content", description: "برامج، أخبار، ومهرجانات" }
  },
  support: {
    keywords: ["دعم", "مشكلة", "خطأ", "دخول", "حساب", "كلمة مرور", "فني", "تسجيل"],
    response: "أعتذر عن أي إزعاج. فريق الدعم الفني جاهز لمساعدتك. يرجى تحديد المشكلة أو اختيار خيار سريع:",
    quickReplies: ["مشكلة في تسجيل الدخول", "استعادة كلمة المرور", "الإبلاغ عن خطأ في الموقع", "التواصل مع موظف الدعم"],
    link: { title: "مركز المساعدة", url: "/support", description: "حلول سريعة للأسئلة الشائعة" }
  },
  contact: {
    keywords: ["تواصل", "اتصل", "واتساب", "بريد", "موقع"],
    response: "يسعدنا تواصلك معنا. يمكنك اختيار الطريقة الأنسب لك:",
    quickReplies: ["تواصل عبر واتساب", "البريد الإلكتروني", "نموذج التواصل في الموقع"],
    link: { title: "صفحة اتصل بنا", url: "/contact", description: "جميع قنوات التواصل الرسمية" }
  }
};

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
  const humanRequestKeywords = ["موظف", "شخص", "انسان", "بشري", "حقيقي", "ممثل", "خدمة العملاء", "فريق الدعم", "اكلم", "اتحدث", "اتواصل", "حولني", "تحويل", "ادارة", "مسؤول"];
  return humanRequestKeywords.some(keyword => normalized.includes(keyword));
};

const findAvailableAgent = (department: Department): Agent | null => {
  return SUPPORT_AGENTS.find(agent => agent.department === department && agent.status === 'online' && !agent.isBusy) || null;
};

const createMessage = (sender: Sender, text: string, role?: "user" | "assistant", status: "sent" | "delivered" | "read" = "read", attachments?: Attachment[]): Message => ({
  id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  sender, text, role,
  time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
  status, attachments
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
  
  // استخدام x و y لتسهيل حسابات السحب والالتصاق بالحواف
  const [iconPos, setIconPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 80 : 0, y: typeof window !== 'undefined' ? window.innerHeight - 80 : 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const targetEyePos = useRef({ x: 0, y: 0 });
  const currentEyePos = useRef({ x: 0, y: 0 });
  
  const chatButtonRef = useRef<HTMLDivElement>(null);

  const currentSpeakerRef = useRef(currentSpeaker);
  const chatStatusRef = useRef(chatStatus);
  const lastActivityTimeRef = useRef(Date.now());
  const isSendingRef = useRef(false);
  const previousAgentRepliesRef = useRef<Set<string>>(new Set());
  
  const awaitingFinalConfirmationRef = useRef(false);
  const conversationContextRef = useRef<string[]>([]);
  const lastHandledTopicRef = useRef<string | null>(null);
  const conversationPhaseRef = useRef<"initial" | "ongoing" | "clarifying" | "closing" | "ended">("initial");
  const lastAgentMessageRef = useRef<string>("");
  const messageCountRef = useRef<number>(0);

  // متغيرات السحب والإفلات
  const dragStartPos = useRef({ x: 0, y: 0 });
  const pointerStartPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  // حالة الاختيارات الذكية
  const [activeQuickReplies, setActiveQuickReplies] = useState<string[]>([]);
  const [contextualLink, setContextualLink] = useState<{title: string, url: string, description: string} | null>(null);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { chatStatusRef.current = chatStatus; }, [chatStatus]);

  // ============================================================
  // 5. إدارة حالة الموظف والوقت (Online -> Inactive -> Closed -> Bot)
  // ============================================================
  useEffect(() => {
    if (currentSpeaker !== "agent") return;

    let inactivityTimer: NodeJS.Timeout;
    let closedTimer: NodeJS.Timeout;

    // إعادة ضبط المؤقتات فقط عند إرسال المستخدم لرسالة جديدة
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender === "user") {
      clearTimeout(inactivityTimer);
      clearTimeout(closedTimer);
      setChatStatus("online");

      inactivityTimer = setTimeout(() => {
        setChatStatus("inactive"); // 🟡 غير نشط
        
        closedTimer = setTimeout(() => {
          setChatStatus("closed"); // ⚫ انتهت المحادثة
          
          setTimeout(() => {
            // العودة للمساعد الآلي
            setMessages(prev => [...prev, createMessage("bot", "انتهت جلسة الدعم الحالية، يسعدني مساعدتك بأي استفسار جديد.", "assistant")]);
            setCurrentSpeaker("bot");
            setCurrentAgent(null);
            setSessionAgents([]);
            setChatStatus("online");
            setActiveQuickReplies([]);
            setContextualLink(null);
            lastActivityTimeRef.current = Date.now();
          }, 2000);
        }, SESSION_TIMEOUTS.INACTIVE_TO_CLOSED);
      }, SESSION_TIMEOUTS.IDLE_TO_INACTIVE);
    }

    return () => {
      clearTimeout(inactivityTimer);
      clearTimeout(closedTimer);
    };
  }, [messages, currentSpeaker]);

  // ============================================================
  // 1. حركة الأيقونة العائمة (Floating Animation)
  // ============================================================
  useEffect(() => {
    // الحركة تتوقف تلقائياً عند السحب بسبب شرط !isDragging في الـ className
  }, [isDragging]);

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
      awaitingFinalConfirmationRef.current = false;
      conversationContextRef.current = [];
      lastHandledTopicRef.current = null;
      conversationPhaseRef.current = "initial";
      lastAgentMessageRef.current = "";
      messageCountRef.current = 0;
      return true;
    } catch (e) { 
      console.error('Load state error:', e); 
      return false; 
    }
  }, []);

  // ============================================================
  // 2. تطوير السحب والإفلات (Snap to Edge)
  // ============================================================
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    hasDragged.current = false;
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { x: iconPos.x, y: iconPos.y };
    chatButtonRef.current?.setPointerCapture(e.pointerId);
  }, [iconPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - pointerStartPos.current.x;
    const deltaY = e.clientY - pointerStartPos.current.y;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasDragged.current = true;
    }
    
    if (hasDragged.current) {
      let newX = Math.max(0, Math.min(window.innerWidth - 64, dragStartPos.current.x + deltaX));
      let newY = Math.max(0, Math.min(window.innerHeight - 64, dragStartPos.current.y + deltaY));
      setIconPos({ x: newX, y: newY });
    }
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    chatButtonRef.current?.releasePointerCapture(e.pointerId);
    
    // الالتصاق بأقرب حافة (يمين أو يسار)
    const distToLeft = iconPos.x;
    const distToRight = window.innerWidth - iconPos.x - 64;
    const finalX = distToLeft < distToRight ? 16 : window.innerWidth - 80;
    const finalY = Math.max(16, Math.min(window.innerHeight - 80, iconPos.y));
    
    setIconPos({ x: finalX, y: finalY });
  }, [isDragging, iconPos]);

  const handleClick = useCallback(() => {
    // لا تفتح المحادثة إذا كان المستخدم يسحب
    if (!hasDragged.current) {
      setOpen(prev => !prev);
    }
    hasDragged.current = false;
  }, []);

  // ============================================================
  // 8. تحليل التخصص والتوجيه الذكي للموظف
  // ============================================================
  const getAgentResponseData = (userText: string, agentDept: Department) => {
    const n = normalizeArabicText(userText);
    
    const isAds = ["سعر", "اسعار", "اعلان", "باقة", "اشتراك", "تكلفة", "عروض", "بكم", "كم"].some(k => n.includes(k));
    const isTech = ["دعم", "مشكلة", "خطأ", "دخول", "حساب", "كلمة مرور", "فني"].some(k => n.includes(k));
    const isContent = ["برامج", "محتوى", "فيديو", "مهرجان", "خبر", "اخبار", "معرض", "فيديوهات"].some(k => n.includes(k));

    // التحويل الذكي إذا كان الطلب خارج التخصص
    if (agentDept === 'technical' && isAds) {
      return { 
        shouldTransfer: true, 
        targetDept: 'ads' as Department, 
        text: "يرجى الانتظار قليلاً، سأقوم بتحويلك إلى الزميل المختص في قسم المبيعات والإعلانات حتى تحصل على أفضل مساعدة.",
        quickReplies: [],
        link: null
      };
    }
    if (agentDept === 'ads' && isTech) {
      return { 
        shouldTransfer: true, 
        targetDept: 'technical' as Department, 
        text: "يرجى الانتظار قليلاً، سأقوم بتحويلك إلى الزميل المختص في قسم الدعم الفني حتى تحصل على أفضل مساعدة.",
        quickReplies: [],
        link: null
      };
    }

    // الردود السياقية الذكية
    if (isAds) {
      return { shouldTransfer: false, ...CONTEXTUAL_DATA.pricing };
    }
    if (isContent) {
      return { shouldTransfer: false, ...CONTEXTUAL_DATA.content };
    }
    if (isTech) {
      return { shouldTransfer: false, ...CONTEXTUAL_DATA.support };
    }

    // ردود افتراضية احترافية غير مكررة
    const defaultReplies = [
      "أشكرك على تواصلك معنا. سأراجع طلبك الآن.",
      "يرجى الانتظار لحظة أثناء التحقق من المعلومات.",
      "تم العثور على المعلومات المطلوبة، يسعدني تزويدك بالتفاصيل.",
      "إذا احتجت أي مساعدة إضافية فأنا حاضر."
    ];
    
    const availableReplies = defaultReplies.filter(r => !previousAgentRepliesRef.current.has(r));
    const chosenReply = availableReplies.length > 0 ? availableReplies[Math.floor(Math.random() * availableReplies.length)] : defaultReplies[0];
    previousAgentRepliesRef.current.add(chosenReply);
    if (previousAgentRepliesRef.current.size > 5) previousAgentRepliesRef.current.clear();

    return {
      shouldTransfer: false,
      text: chosenReply,
      quickReplies: ["هل يوجد أي استفسار آخر يمكنني مساعدتك به؟", "تصفح قسم الأسعار", "تواصل مع الدعم الفني"],
      link: null
    };
  };

  // ============================================================
  // SEND MESSAGE & API HANDLING
  // ============================================================
  const sendMessage = useCallback(async (forcedText?: string) => {
    const trimmedText = (forcedText || text).trim();
    if (!trimmedText || isSendingRef.current) return;

    isSendingRef.current = true;
    setMessages(prev => [...prev, createMessage("user", trimmedText, "user", "sent")]);
    if (!forcedText) setText("");
    
    lastActivityTimeRef.current = Date.now();
    conversationContextRef.current.push(trimmedText);
    if (conversationContextRef.current.length > 5) conversationContextRef.current.shift();

    // إخفاء الاختيارات السابقة عند إرسال رسالة جديدة
    setActiveQuickReplies([]);
    setContextualLink(null);

    if (wantsHumanContact(trimmedText) && currentSpeaker === "bot" && !showDepartmentSelection) {
      setShowDepartmentSelection(true);
      setChatStatus("online");
      setMessages(prev => [...prev, createMessage("system", "يرجى اختيار القسم الذي ترغب في التواصل معه:", "assistant")]);
      isSendingRef.current = false;
      return;
    }

    if (currentSpeaker === "agent" && currentAgent) {
      setChatStatus("typing");
      setTimeout(() => {
        const normalized = normalizeArabicText(trimmedText);
        
        // 7. إنهاء المحادثة عند رد المستخدم بكلمات الإنهاء
        const closingKeywords = ["لا", "شكراً", "شكرا", "هذا كل شيء", "انتهيت", "خلص", "لا شكرا", "لا احتاج"];
        const isClosing = closingKeywords.some(k => normalized.includes(k));

        if (isClosing) {
          const finalReply = "شكراً لتواصلك معنا، نتمنى لك يوماً سعيداً، ويسعدنا خدمتك في أي وقت.";
          setMessages(prev => [...prev, createMessage("agent", finalReply, "assistant")]);
          setChatStatus("online");
          isSendingRef.current = false;
          
          // بدء تسلسل الإغلاق
          setTimeout(() => {
            setChatStatus("inactive");
            setTimeout(() => {
              setMessages(prev => [...prev, createMessage("bot", "انتهت جلسة الدعم الحالية، يسعدني مساعدتك بأي استفسار جديد.", "assistant")]);
              setCurrentSpeaker("bot");
              setCurrentAgent(null);
              setSessionAgents([]);
              setChatStatus("online");
            }, 2000);
          }, 1000);
          return;
        }

        // الحصول على الرد الذكي والتحقق من الحاجة للتحويل
        const responseData = getAgentResponseData(trimmedText, currentAgent.department);
        
        if (responseData.shouldTransfer && responseData.targetDept) {
          setMessages(prev => [...prev, createMessage("agent", responseData.text, "assistant")]);
          setTimeout(() => {
            const targetAgent = findAvailableAgent(responseData.targetDept!) || SUPPORT_AGENTS.find(a => a.department === responseData.targetDept);
            if (targetAgent) {
              setSessionAgents(prev => prev.find(a => a.employeeId === targetAgent!.employeeId) ? prev : [...prev, targetAgent!]);
              setCurrentAgent(targetAgent);
              setTimeout(() => {
                setMessages(prev => [...prev, createMessage("agent", `مرحباً، أنا ${targetAgent!.name}. اطلعت على المحادثة، تفضل كيف يمكنني مساعدتك؟`, "assistant")]);
                setChatStatus("online");
                isSendingRef.current = false;
              }, 1000);
            }
          }, 1500);
          return;
        }

        // إرسال الرد الذكي مع الاختيارات السياقية
        setMessages(prev => [...prev, createMessage("agent", responseData.text, "assistant")]);
        if (responseData.quickReplies && responseData.quickReplies.length > 0) {
          setActiveQuickReplies(responseData.quickReplies);
        }
        if (responseData.link) {
          setContextualLink(responseData.link);
        }
        
        setChatStatus("online");
        isSendingRef.current = false;
      }, 1500);
      return; 
    }

    // Bot Flow
    setChatStatus("typing");
    try {
      const normalized = normalizeArabicText(trimmedText);
      const isJustGreeting = ["مرحبا", "هلا", "سلام", "صباح", "مساء"].some(k => normalized.includes(k)) && normalized.length < 20;

      if (isJustGreeting) {
        setMessages(prev => [...prev, createMessage("bot", "أهلاً وسهلاً بك في قناة مجلة دار النجوم. يسعدني مساعدتك، كيف أستطيع خدمتك اليوم؟", "assistant")]);
        setChatStatus("online");
        isSendingRef.current = false;
        return;
      }

      const apiMessages = messages.filter(m => m.sender !== "system").map(m => ({ role: (m.sender === "bot" || m.sender === "agent") ? "assistant" : "user", content: m.text }));
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
        data.attachments || [] 
      );

      setMessages(prev => [...prev, botResponse]);

    } catch (error) {
      console.error("Chat API Error:", error);
      setMessages(prev => [...prev, createMessage("system", "عذراً، حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.")]);
    } finally {
      setChatStatus("online");
      isSendingRef.current = false;
    }
  }, [text, currentSpeaker, currentAgent, showDepartmentSelection, messages]);

  // ============================================================
  // EFFECTS
  // ============================================================
  useEffect(() => { saveStateToStorage(); }, [saveStateToStorage]);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    const hasSaved = loadStateFromStorage();
    if (!hasSaved) {
      setChatStatus("typing");
      setTimeout(() => {
        setMessages([createMessage("bot", "أهلاً وسهلاً بك في قناة مجلة دار النجوم. يسعدني مساعدتك، كيف أستطيع خدمتك اليوم؟", "assistant")]);
        setChatStatus("online");
      }, 800);
    }
  }, [open, messages.length, loadStateFromStorage]);

  const getStatusText = () => {
    switch (chatStatus) {
      case "typing": return "يكتب الآن...";
      case "online": return "متصل الآن";
      case "waiting": return "في قائمة الانتظار...";
      case "inactive": return "غير نشط";
      case "closed": return "انتهت المحادثة";
      default: return "غير نشط";
    }
  };

  const getStatusColor = () => {
    switch (chatStatus) {
      case "typing": return "bg-yellow-400 animate-pulse";
      case "online": return "bg-green-400 animate-pulse";
      case "waiting": return "bg-orange-400 animate-pulse";
      case "inactive": return "bg-yellow-500";
      case "closed": return "bg-gray-500";
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
        
        @keyframes blink-human { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.1); } }
        .animate-blink-human { animation: blink-human 0.15s ease-in-out; transform-origin: center; }
        
        @keyframes cartoon-breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        .animate-cartoon-breathe { animation: cartoon-breathe 3s ease-in-out infinite; }
        
        @keyframes cartoon-smile { 0%, 100% { d: path("M 10 22 C 10 22, 14 26, 16 26 C 18 26, 22 22, 22 22"); } 50% { d: path("M 10 22 C 10 22, 14 25, 16 25 C 18 25, 22 22, 22 22"); } }
        .animate-cartoon-smile { animation: cartoon-smile 4s ease-in-out infinite; }

        @keyframes cartoon-talk { 0%, 100% { d: path("M 10 22 C 10 22, 13 27, 16 27 C 19 27, 22 22, 22 22"); } 50% { d: path("M 10 22 C 10 22, 13 28, 16 28 C 19 28, 22 22, 22 22"); } }
        .animate-cartoon-talk { animation: cartoon-talk 0.4s ease-in-out infinite; }
        
        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }

        /* 1. حركة الأيقونة العائمة (Floating Animation) */
        @keyframes float-icon {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-6px) rotate(-2deg); }
          50% { transform: translateX(-3px) rotate(1deg); }
          75% { transform: translateX(-6px) rotate(-1deg); }
        }
        .animate-float-icon {
          animation: float-icon 4s ease-in-out infinite;
        }
      `}</style>

      {loadingProgress > 0 && (
        <div className="fixed top-0 right-0 left-auto z-[100] h-1 bg-gray-800/50 w-full">
          <div 
            className="h-full bg-gradient-to-l from-purple-500 via-blue-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.7)]"
            style={{ 
              width: `${loadingProgress}%`,
              transition: loadingProgress === 100 ? 'width 0.5s ease-out, opacity 0.5s ease-out' : 'width 0.4s ease-out',
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

      {/* 1 & 2. أيقونة المساعد: حركة عائمة، سحب وإفلات، التصاق بالحواف، بدون خلفية سوداء */}
      <div 
        ref={chatButtonRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        className="fixed z-50 cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ 
          left: `${iconPos.x}px`, 
          top: `${iconPos.y}px`, 
          width: '64px', 
          height: '64px'
        }}
        title="مركز المساعدة"
      >
        <div className={`w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/40 border-2 border-white/10 animate-slide-in-right ${!isDragging ? 'animate-float-icon' : ''}`}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g className="animate-cartoon-breathe">
              <g className={isBlinking ? "animate-blink-human" : ""}>
                <circle cx="10" cy="14" r="5" fill="white" />
                <circle cx="10" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.1s linear' }} />
              </g>
              <g className={isBlinking ? "animate-blink-human" : ""} style={{ animationDelay: '0.05s' }}>
                <circle cx="22" cy="14" r="5" fill="white" />
                <circle cx="22" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.1s linear' }} />
              </g>
              <path 
                d="M10 22C10 22 14 26 16 26C18 26 22 22 22 22" 
                stroke="white" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                className={chatStatus === "typing" ? "animate-cartoon-talk" : "animate-cartoon-smile"} 
              />
            </g>
          </svg>
        </div>
      </div>

      {/* صندوق الدردشة */}
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
                        if (att.type === 'video' && att.url) return <video key={idx} controls className="rounded-lg max-w-full h-auto border border-gray-600"><source src={att.url} type={att.fileType || 'video/mp4'} />المتصفح لا يدعم تشغيل الفيديو</video>;
                        if ((att.type === 'link' || att.type === 'card' || att.type === 'product' || att.type === 'file') && att.url) {
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

          {/* 10. عرض الاختيارات الذكية والرابط السياقي أسفل آخر رسالة من البوت/الموظف */}
          {messages.length > 0 && messages[messages.length - 1].sender !== "user" && (activeQuickReplies.length > 0 || contextualLink) && (
            <div className="flex flex-col items-start mt-2 animate-slide-in-right">
              {contextualLink && (
                <a href={contextualLink.url} target="_blank" rel="noopener noreferrer" className="mb-2 flex items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded-lg px-3 py-2 transition-all w-full max-w-[85%]">
                  <span className="text-purple-300 font-bold text-sm">{contextualLink.title}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
              )}
              {activeQuickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeQuickReplies.map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(reply)}
                      className="text-xs bg-[#1f2937] hover:bg-purple-600/30 border border-purple-500/30 hover:border-purple-500 text-purple-300 hover:text-white px-3 py-1.5 rounded-full transition-all duration-200"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {chatStatus === "typing" && (
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
              onClick={() => sendMessage()} 
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