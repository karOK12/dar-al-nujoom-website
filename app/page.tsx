"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// TYPES & INTERFACES
// ============================================================

type Sender = "user" | "bot" | "agent" | "system";
type AgentStatus = "online" | "away" | "offline";
type Department = 'support' | 'ads' | 'technical';
type ChatStatus = "typing" | "online";

interface Message {
  id: string;
  sender: Sender;
  role?: "user" | "assistant";
  text: string;
  time: string;
  status?: "sent" | "delivered" | "read";
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

interface ChatState {
  messages: Message[];
  currentSpeaker: "bot" | "agent";
  currentAgent: Agent | null;
  sessionAgents: Agent[];
  chatStatus: ChatStatus;
  isQueued: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const AGENT_TIMEOUT_MINUTES = 30;

const SUPPORT_AGENTS: Agent[] = [
  { 
    employeeId: "EMP-001", name: "خالد الأحمد", 
    img: "https://i.pravatar.cc/150?img=68", role: "خدمة العملاء", 
    department: 'support', status: 'online', lastActivity: new Date().toISOString(), isBusy: false 
  },
  { 
    employeeId: "EMP-002", name: "نورة السالم", 
    img: "https://i.pravatar.cc/150?img=44", role: "دعم فني متقدم", 
    department: 'technical', status: 'online', lastActivity: new Date().toISOString(), isBusy: false 
  },
  { 
    employeeId: "EMP-003", name: "سارة المالكي", 
    img: "https://i.pravatar.cc/150?img=47", role: "مسؤولة الإعلانات", 
    department: 'ads', status: 'online', lastActivity: new Date().toISOString(), isBusy: false 
  },
  { 
    employeeId: "EMP-004", name: "محمد العتيبي", 
    img: "https://i.pravatar.cc/150?img=12", role: "خدمة العملاء", 
    department: 'support', status: 'away', lastActivity: new Date().toISOString(), isBusy: false 
  },
  { 
    employeeId: "EMP-005", name: "فاطمة الحربي", 
    img: "https://i.pravatar.cc/150?img=32", role: "دعم فني", 
    department: 'technical', status: 'online', lastActivity: new Date().toISOString(), isBusy: false 
  },
];

const TRENDING_PRODUCTS = [
  { id: 1, name: "كاميرا تصوير احترافية", desc: "خصم 25% لفترة محدودة", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&h=150&fit=crop", shape: "circle" },
  { id: 2, name: "سماعات استوديو", desc: "عزل ضوضاء فائق الجودة", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=150&fit=crop", shape: "rectangle" },
  { id: 3, name: "إضاءة Ring Light", desc: "مثالية لصناع المحتوى", img: "https://images.unsplash.com/photo-1615469062329-5f23633c1182?w=150&h=150&fit=crop", shape: "square" },
  { id: 4, name: "ميكروفون بث مباشر", desc: "جودة صوت استثنائية", img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=150&h=200&fit=crop", shape: "portrait" },
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** تطبيع النص العربي للمطابقة المرنة */
const normalizeArabicText = (text: string): string => {
  return text
    .normalize("NFKD")
    .replace(/[\u064B-\u065F]/g, "") // إزالة التشكيل
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

/** فحص نية التواصل البشري */
const wantsHumanContact = (inputText: string): boolean => {
  const normalized = normalizeArabicText(inputText);
  
  const keywords = [
    // عبارات التحويل المباشرة
    "حولني", "تحويل", "حولني مباشره", "حولني مباشر",
    // عبارات التواصل
    "اتواصل", "اكلم", "كلم", "اتصل", "اتحدث", "احجي",
    // طلب موظف/شخص
    "موظف", "شخص", "انسان", "بشري", "حقيقي", "ممثل",
    // أقسام الدعم
    "خدمه العملاء", "خدمة العملاء", "دعم", "دعم فني", "فريق الدعم",
    // رفض الروبوت
    "روبوت", "مو روبوت", "ليس روبوت", "لا اريد روبوت",
    // عبارات المساعدة البشرية
    "مساعده بشريه", "مساعدة بشرية", "احتاج مساعده", "احتاج مساعدة",
    // عبارات الحاجة
    "اريد", "ابي", "ابغى", "احتاج", "ممكن",
  ];

  return keywords.some(keyword => normalized.includes(keyword));
};

/** تحديد القسم المطلوب من نص المستخدم */
const detectDepartment = (userText: string): Department => {
  const text = userText.toLowerCase();
  
  if (["اعلان", "اعلانات", "ترويج", "سبونسر", "بانر", "فيديو", "اسعار"].some(k => text.includes(k))) {
    return 'ads';
  }
  if (["مشكلة", "خطأ", "لا يعمل", "تعطل", "فشل", "بطئ", "معلق", "دخول", "كلمة مرور", "فني", "تقني"].some(k => text.includes(k))) {
    return 'technical';
  }
  return 'support';
};

/** البحث عن موظف متاح في قسم معين */
const findAvailableAgent = (department: Department): Agent | null => {
  return SUPPORT_AGENTS.find(agent => 
    agent.department === department && 
    agent.status === 'online' && 
    !agent.isBusy
  ) || null;
};

/** إنشاء رسالة مع الوقت الحالي */
const createMessage = (
  sender: Sender, 
  text: string, 
  role?: "user" | "assistant",
  status: "sent" | "delivered" | "read" = "read"
): Message => ({
  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  sender,
  text,
  role,
  time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
  status,
});

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Home() {
  // ============================================================
  // STATE
  // ============================================================
  
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  
  const [currentSpeaker, setCurrentSpeaker] = useState<"bot" | "agent">("bot");
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [sessionAgents, setSessionAgents] = useState<Agent[]>([]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("online");
  const [isQueued, setIsQueued] = useState(false);
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const chatButtonRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // REFS (لمنع Stale Closures)
  // ============================================================
  
  const currentSpeakerRef = useRef(currentSpeaker);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef(messages);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ============================================================
  // LOCAL STORAGE FUNCTIONS
  // ============================================================

  const saveStateToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const state: ChatState = {
      messages,
      currentSpeaker,
      currentAgent,
      sessionAgents,
      chatStatus,
      isQueued,
    };
    
    try {
      localStorage.setItem('dar-alnujum-chat-state', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save chat state:', e);
    }
  }, [messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, isQueued]);

  const loadStateFromStorage = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    
    try {
      const saved = localStorage.getItem('dar-alnujum-chat-state');
      if (!saved) return false;

      const parsed = JSON.parse(saved) as Partial<ChatState>;
      
      // تحميل الرسائل فقط - الجلسة تنتهي دائماً عند إعادة التحميل
      setMessages(parsed.messages || []);
      
      // دائماً نعود للمساعد الذكي عند التحميل (منع جلسات عالقة)
      setCurrentSpeaker("bot");
      setCurrentAgent(null);
      setSessionAgents([]);
      setChatStatus("online");
      setIsQueued(false);
      
      return true;
    } catch (e) {
      console.error('Failed to load chat state:', e);
      return false;
    }
  }, []);

  // ============================================================
  // AGENT SESSION MANAGEMENT
  // ============================================================

  /** إنهاء جلسة الموظف (ليس المحادثة) */
  const endAgentSession = useCallback(() => {
    // إضافة رسالة نظام واحدة فقط
    const endMessage = createMessage(
      "system",
      "تم إنهاء جلسة الدعم بسبب عدم وجود نشاط. يمكنك إرسال أي رسالة في أي وقت لبدء جلسة جديدة."
    );
    
    setMessages(prev => [...prev, endMessage]);
    
    // تصفير جلسة الموظف فقط - الرسائل تبقى محفوظة
    setCurrentSpeaker("bot");
    setCurrentAgent(null);
    setSessionAgents([]);
    setChatStatus("online");
    setIsQueued(false);
    
    // حفظ الحالة الجديدة
    setTimeout(() => saveStateToStorage(), 0);
  }, [saveStateToStorage]);

  /** إعادة ضبط مؤقت عدم النشاط */
  const resetInactivityTimer = useCallback(() => {
    // مسح المؤقت القديم
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // بدء مؤقت جديد فقط إذا كانت جلسة موظف نشطة
    if (currentSpeakerRef.current === "agent") {
      inactivityTimerRef.current = setTimeout(() => {
        endAgentSession();
      }, AGENT_TIMEOUT_MINUTES * 60 * 1000);
    }
  }, [endAgentSession]);

  /** بدء جلسة مع موظف */
  const startAgentSession = useCallback((agent: Agent) => {
    setCurrentAgent(agent);
    setSessionAgents([agent]);
    setCurrentSpeaker("agent");
    setIsQueued(false);
    
    // إضافة رسالة ترحيب الموظف
    const welcomeMsg = createMessage(
      "agent",
      `أهلاً بك، أنا ${agent.name} (${agent.role}). تفضل، كيف يمكنني مساعدتك؟`,
      "assistant"
    );
    
    setMessages(prev => [...prev, welcomeMsg]);
    setChatStatus("online"); // إيقاف مؤشر الكتابة
    
    // بدء مؤقت عدم النشاط
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  /** وضع المستخدم في Queue */
  const enterQueue = useCallback((department: Department) => {
    setIsQueued(true);
    
    const queueMsg = createMessage(
      "system",
      `جميع موظفي ${department === 'ads' ? 'الإعلانات' : department === 'technical' ? 'الدعم الفني' : 'خدمة العملاء'} مشغولون حالياً. تم وضعك في قائمة الانتظار. سيتم تحويلك عند توفر موظف.`
    );
    
    setMessages(prev => [...prev, queueMsg]);
    
    // محاكاة: بعد 10 ثواني يصبح موظف متاح (في الواقع سيكون WebSocket)
    setTimeout(() => {
      if (isQueued) {
        const agent = findAvailableAgent(department) || SUPPORT_AGENTS[0];
        startAgentSession(agent);
      }
    }, 10000);
  }, [isQueued, startAgentSession]);

  // ============================================================
  // ESCALATION LOGIC
  // ============================================================

  const checkAndPerformEscalation = useCallback((userText: string): boolean => {
    // التحويل فقط إذا كان المتحدث هو البوت
    if (!wantsHumanContact(userText) || currentSpeaker !== "bot") {
      return false;
    }

    // إظهار مؤشر الكتابة أثناء التحويل
    setChatStatus("typing");
    
    const targetDept = detectDepartment(userText);
    const deptNames = {
      'ads': 'قسم الإعلانات والترويج',
      'technical': 'الدعم الفني المتخصص',
      'support': 'خدمة العملاء'
    };
    
    const transferMsg = createMessage(
      "bot",
      `يرجى الانتظار، جاري تحويلك إلى ${deptNames[targetDept]}...`,
      "assistant"
    );
    
    setMessages(prev => [...prev, transferMsg]);

    // محاكاة وقت التحويل
    setTimeout(() => {
      const availableAgent = findAvailableAgent(targetDept);
      
      if (availableAgent) {
        // موظف متاح - بدء الجلسة مباشرة
        startAgentSession(availableAgent);
      } else {
        // لا يوجد موظف متاح - دخول Queue
        enterQueue(targetDept);
        setChatStatus("online");
      }
    }, 1500);

    return true;
  }, [currentSpeaker, startAgentSession, enterQueue]);

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  const sendMessage = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // 1. إضافة رسالة المستخدم
    const userMsg = createMessage("user", trimmedText, "user", "sent");
    setMessages(prev => [...prev, userMsg]);
    
    // مسح حقل الإدخال
    setText("");

    // 2. إعادة ضبط مؤقت عدم النشاط
    resetInactivityTimer();

    // 3. التحقق من طلب التحويل للموظف
    if (checkAndPerformEscalation(trimmedText)) {
      return;
    }

    // 4. حاجز الحماية: إذا كان المتحدث هو الموظف، لا نستدعي API
    if (currentSpeaker === "agent") {
      // في الإنتاج: إرسال عبر WebSocket للموظف
      return;
    }

    // 5. استدعاء API المساعد الذكي
    setChatStatus("typing");
    
    try {
      const apiMessages = messagesRef.current
        .filter(m => m.sender !== "system")
        .map(m => ({ role: m.role || "user", content: m.text }));
      
      apiMessages.push({ role: "user", content: trimmedText });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      
      const botReply = createMessage(
        "bot",
        data.text || "عذراً، لم أتمكن من الرد حالياً.",
        "assistant"
      );
      
      setMessages(prev => [...prev, botReply]);
    } catch (error) {
      const errorMsg = createMessage(
        "system",
        "عذراً، حدث خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى."
      );
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatStatus("online");
    }
  }, [text, currentSpeaker, resetInactivityTimer, checkAndPerformEscalation]);

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  const getStatusText = useCallback((): string => {
    if (chatStatus === "typing") return "يكتب الآن...";
    if (isQueued) return "في قائمة الانتظار...";
    return "متصل الآن";
  }, [chatStatus, isQueued]);

  const getStatusColor = useCallback((): string => {
    if (chatStatus === "typing") return "bg-yellow-400 animate-pulse";
    if (isQueued) return "bg-orange-400 animate-pulse";
    return "bg-green-400 animate-pulse";
  }, [chatStatus, isQueued]);

  // ============================================================
  // EFFECTS
  // ============================================================

  // حفظ الحالة عند التغيير
  useEffect(() => {
    saveStateToStorage();
  }, [saveStateToStorage]);

  // تنظيف المؤقتات عند unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  // تتبع حركة الماوس
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!chatButtonRef.current) return;
      
      const rect = chatButtonRef.current.getBoundingClientRect();
      const deltaX = Math.max(-4, Math.min(4, (e.clientX - (rect.left + rect.width / 2)) / 30));
      const deltaY = Math.max(-4, Math.min(4, (e.clientY - (rect.top + rect.height / 2)) / 30));
      setMousePos({ x: deltaX, y: deltaY });
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // التحميل الأولي
  useEffect(() => {
    if (!open || messages.length > 0) return;
    
    const hasSavedState = loadStateFromStorage();
    
    if (!hasSavedState) {
      setChatStatus("typing");
      setTimeout(() => {
        const welcomeMsg = createMessage(
          "bot",
          "أهلاً بك في قناة مجلة دار النجوم! 🌟 أنا المساعد الذكي. كيف يمكنني خدمتك اليوم؟",
          "assistant"
        );
        setMessages([welcomeMsg]);
        setChatStatus("online");
      }, 800);
    }
  }, [open, messages.length, loadStateFromStorage]);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const renderSeamlessItems = () => {
    const products = [...TRENDING_PRODUCTS, ...TRENDING_PRODUCTS];
    
    return products.map((product, index) => {
      const shapeClass = {
        'circle': 'w-16 h-16 rounded-full',
        'rectangle': 'w-20 h-14 rounded-xl',
        'portrait': 'w-14 h-20 rounded-2xl',
        'square': 'w-16 h-16 rounded-md'
      }[product.shape] || 'w-16 h-16 rounded-md';

      return (
        <div 
          key={`${product.id}-${index}`}
          className="flex-shrink-0 inline-flex items-center gap-4 mx-4 bg-[#1f2937]/90 backdrop-blur-sm px-4 py-3 border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 w-[300px]"
        >
          <img 
            src={product.img} 
            alt={product.name}
            className={`object-cover border-2 border-purple-500 shadow-md flex-shrink-0 ${shapeClass}`}
          />
          <div className="flex flex-col text-right flex-1 min-w-0">
            <span className="text-sm md:text-base font-bold text-white leading-tight mb-1 line-clamp-2">
              {product.name}
            </span>
            <span className="text-xs md:text-sm text-purple-400 font-medium leading-tight line-clamp-2">
              {product.desc}
            </span>
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

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="w-full px-2 md:px-4 py-3 flex flex-wrap md:flex-nowrap justify-between items-center gap-2 md:gap-4">
          <a href="/" className="logo-container flex items-center gap-2 md:gap-3 shrink-0">
            <img src="https://iili.io/Bsjh2M7.png" alt="شعار" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border-2 border-purple-500 shadow-md" />
            <span className="brand-name text-base md:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              قناة مجلة دار النجوم
            </span>
          </a>
          
          <div className="search-box flex-1 max-w-md mx-2 hidden md:block">
            <input 
              type="text"
              placeholder="🔎 ابحث عن مشاهير، برامج، أو محتوى..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500 text-sm"
            />
          </div>
          
          <div className="actions flex items-center gap-2 md:gap-3 shrink-0">
            <a href="/upgrade" className="btn upgrade hidden sm:flex items-center gap-1 px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs md:text-sm font-bold hover:shadow-lg hover:shadow-orange-500/30 transition">
              ترقية 👑
            </a>
            <a href="/login" className="btn subscribe px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs md:text-sm font-bold hover:shadow-lg hover:shadow-purple-500/30 transition">
              اشتراك
            </a>
          </div>
        </div>
        
        <div className="md:hidden px-2 pb-3">
          <input 
            type="text"
            placeholder="🔎 ابحث عن محتوى..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
      </header>

      {/* TRENDING PRODUCTS SCROLL */}
      <div className="bg-[#111827] border-b border-gray-800 overflow-hidden relative py-3">
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="flex animate-seamless-scroll w-max">
          {renderSeamlessItems()}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="container mx-auto px-4 py-8 flex-1">
        <section className="hero text-center mb-12">
          <div className="youtube-ad-marquee bg-purple-900/30 border border-purple-500/30 rounded-full py-2.5 mb-8 overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0b0f1a] to-transparent z-10 pointer-events-none rounded-r-full"></div>
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0b0f1a] to-transparent z-10 pointer-events-none rounded-l-full"></div>
            <div className="flex whitespace-nowrap animate-seamless-scroll w-max">
              {[...Array(20)].map((_, i) => (
                <span key={i} className="mx-8 text-purple-300 text-sm font-semibold flex items-center gap-2">
                  إعلان حصري: تابعوا أحدث البرامج واللقاءات على قناة مجلة دار النجوم
                </span>
              ))}
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            مرحبًا بكم في <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">دار النجوم</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            منصتكم الإعلامية الأولى لعالم المشاهير والمحتوى الحصري.
          </p>
        </section>
      </main>

      {/* CHAT BUTTON */}
      <div
        ref={chatButtonRef}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/40 cursor-pointer hover:scale-110 transition-transform duration-300 z-50 border-2 border-white/10 animate-slide-in-right"
        title="مركز المساعدة والدعم"
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="animate-blink">
            <circle cx="10" cy="14" r="5" fill="white" />
            <circle cx="10" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.1s ease-out' }} />
          </g>
          <g className="animate-blink">
            <circle cx="22" cy="14" r="5" fill="white" />
            <circle cx="22" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.1s ease-out' }} />
          </g>
          <path d="M10 22C10 22 14 26 16 26C18 26 22 22 22 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* CHAT WINDOW */}
      <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl transition-all duration-300 z-50 flex flex-col ${open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}>
        
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-700 flex items-center gap-3 bg-[#1f2937]/50 rounded-t-2xl">
          <div className="flex items-center gap-2 flex-shrink-0">
            {sessionAgents.length === 0 ? (
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center border-2 border-purple-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="8" width="16" height="12" rx="3" fill="white" opacity="0.95"/>
                    <circle cx="9" cy="14" r="1.5" fill="#7c3aed"/>
                    <circle cx="15" cy="14" r="1.5" fill="#7c3aed"/>
                    <path d="M9 17 Q12 19 15 17" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                    <line x1="12" y1="8" x2="12" y2="5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="4" r="1.5" fill="white"/>
                  </svg>
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111827] bg-green-500"></span>
              </div>
            ) : (
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {sessionAgents.map((agent, idx) => (
                  <div key={agent.employeeId} className="relative group" title={`${agent.name} - ${agent.role}`}>
                    <img
                      src={agent.img}
                      alt={agent.name}
                      className={`w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-[#111827] object-cover transition-all ${idx === sessionAgents.length - 1 ? "border-purple-500 z-10 ring-2 ring-purple-500/30" : "border-gray-500 z-0 opacity-60 grayscale"}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-sm truncate">
              {sessionAgents.length === 0 ? "المساعد الذكي" : currentAgent?.name}
            </h4>
            <p className="text-xs flex items-center gap-1 truncate text-green-400">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusColor()}`}></span>
              <span className="truncate">{getStatusText()}</span>
            </p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="h-80 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#0b0f1a]/50">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            const isSystem = msg.sender === "system";
            
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700 text-center">
                    {msg.text}
                  </span>
                </div>
              );
            }
            
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                {!isUser && (
                  <span className="text-[10px] text-gray-400 mb-1 ml-1">
                    {msg.sender === "agent" && currentAgent ? `${currentAgent.name} (${currentAgent.role})` : "المساعد الذكي"}
                  </span>
                )}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative ${isUser ? "bg-purple-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-purple-500/30 rounded-tl-sm"}`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1 flex items-center gap-1">
                  {msg.time}
                  {isUser && <span>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                </span>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {chatStatus === "typing" && (
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-gray-400 mb-1 ml-1">
                {currentSpeaker === "agent" && currentAgent ? currentAgent.name : "المساعد الذكي"}
              </span>
              <div className="bg-[#1f2937] border border-purple-500/30 rounded-2xl rounded-tl-sm p-3 flex gap-1.5 items-center h-10">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '200ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '400ms' }}></span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-gray-700 bg-[#1f2937]/50 rounded-b-2xl">
          <div className="flex gap-2 items-end">
            <textarea
              id="chat-input"
              value={text}
              placeholder="اكتب رسالتك هنا..."
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              className="flex-1 bg-[#0b0f1a] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700 placeholder-gray-500 resize-none overflow-y-auto max-h-32 min-h-[42px] leading-relaxed"
            />
            <button
              onClick={sendMessage}
              disabled={!text.trim() || chatStatus === "typing"}
              className="p-3 rounded-xl text-sm font-bold transition mb-0.5 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-[#0b0f1a] border-t border-gray-800 text-gray-400 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm font-medium border-t border-gray-800 pt-6 w-full">
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300">سياسة الخصوصية</a>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300">الشروط والأحكام</a>
              <a href="/about" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300">من نحن</a>
              <a href="/contact" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300">اتصل بنا</a>
            </div>
            <span className="block text-center text-xs text-gray-500 mt-4">
              جميع الحقوق محفوظة © قناة مجلة دار النجوم 2026
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}