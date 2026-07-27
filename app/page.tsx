"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// TYPES & INTERFACES
// ============================================================

type Sender = "user" | "bot" | "agent" | "system";
type AgentStatus = "online" | "away" | "offline";
type Department = 'support' | 'ads' | 'technical';
type ChatStatus = "typing" | "online" | "waiting" | "ended";
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
  weekly: { usd: 50, duration: "أسبوع واحد", views: "10,000 ظهور", platforms: "Facebook, Instagram" },
  monthly: { usd: 150, duration: "شهر كامل", views: "50,000 ظهور", platforms: "Facebook, Instagram, TikTok" },
  premium: { usd: 300, duration: "حملة مخصصة", views: "150,000+ ظهور", platforms: "جميع المنصات + Website" }
};

const EXCHANGE_RATES: Record<string, number> = {
  'USD': 1, 'SAR': 3.75, 'IQD': 1320, 'AED': 3.67, 
  'JOD': 0.71, 'EGP': 47.5, 'IRR': 42000, 'EUR': 0.92
};

const SUPPORT_AGENTS: Agent[] = [
  { employeeId: "EMP-001", name: "خالد الأحمد", img: "https://i.pravatar.cc/150?img=68", role: "خدمة العملاء", department: 'support', status: 'online', lastActivity: new Date().toISOString(), isBusy: false },
  { employeeId: "EMP-002", name: "نورة السالم", img: "https://i.pravatar.cc/150?img=44", role: "دعم فني متقدم", department: 'technical', status: 'online', lastActivity: new Date().toISOString(), isBusy: false },
  { employeeId: "EMP-003", name: "سارة المالكي", img: "https://i.pravatar.cc/150?img=47", role: "مسؤولة الإعلانات", department: 'ads', status: 'online', lastActivity: new Date().toISOString(), isBusy: false },
];

const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { id: 'support', name: 'خدمة العملاء', description: 'للاستفسارات العامة' },
  { id: 'ads', name: 'الإعلانات والمبيعات', description: 'حجز الإعلانات والأسعار' },
  { id: 'technical', name: 'الدعم الفني', description: 'حل المشاكل التقنية' },
];

const SESSION_TIMEOUTS = {
  IDLE_TO_ENDED: 45, 
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
  return text.normalize("NFKD").replace(/[\u064B-\u065F]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
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
  
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [isMouseNear, setIsMouseNear] = useState(false);

  const chatButtonRef = useRef<HTMLDivElement>(null);
  const currentSpeakerRef = useRef(currentSpeaker);
  const lastActivityTimeRef = useRef(Date.now());
  const isSendingRef = useRef(false);
  
  const isFirstMessageRef = useRef(true);
  const awaitingFollowUpRef = useRef(false);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const randomLookTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);

  // ============================================================
  // 1. شريط التحميل RTL
  // ============================================================
  useEffect(() => {
    let progress = 0;
    let isComplete = false;
    const updateProgress = (target: number, duration = 400) => {
      if (isComplete) return;
      const start = performance.now();
      const animate = (now: number) => {
        if (isComplete) return;
        const ratio = Math.min((now - start) / duration, 1);
        progress += (target - progress) * (1 - Math.pow(1 - ratio, 3));
        setLoadingProgress(Math.min(progress, 99));
        if (ratio < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    };

    updateProgress(20, 300);
    const t1 = setTimeout(() => updateProgress(50, 500), 200);
    const t2 = setTimeout(() => updateProgress(85, 600), 600);

    const handleLoad = () => {
      isComplete = true;
      clearTimeout(t1); clearTimeout(t2);
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 500);
    };
    window.addEventListener('load', handleLoad);
    const fallback = setTimeout(handleLoad, 5000);

    return () => { window.removeEventListener('load', handleLoad); clearTimeout(fallback); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ============================================================
  // 2. حركة الأيقونة الطبيعية
  // ============================================================
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (chatButtonRef.current) {
        const rect = chatButtonRef.current.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - (rect.left + rect.width/2), e.clientY - (rect.top + rect.height/2));
        setIsMouseNear(dist < 150);
        
        if (dist < 150) {
          const x = Math.max(-4, Math.min(4, (e.clientX - (rect.left + rect.width/2)) / 30));
          const y = Math.max(-4, Math.min(4, (e.clientY - (rect.top + rect.height/2)) / 30));
          setEyePos({ x, y });
        }
      }
    };
    
    const startRandomLook = () => {
      if (!isMouseNear) {
        setEyePos({ x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 });
      }
      randomLookTimerRef.current = setTimeout(startRandomLook, 2000 + Math.random() * 3000);
    };
    startRandomLook();

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (randomLookTimerRef.current) clearTimeout(randomLookTimerRef.current);
    };
  }, [isMouseNear]);

  // ============================================================
  // 3. إدارة الجلسة ومؤقت الـ 45 ثانية
  // ============================================================
  const clearAllTimers = useCallback(() => {
    if (followUpTimerRef.current) { clearTimeout(followUpTimerRef.current); followUpTimerRef.current = null; }
  }, []);

  useEffect(() => {
    if (currentSpeaker === "agent") {
      lastActivityTimeRef.current = Date.now();
      if (chatStatus === "ended") setChatStatus("online");
    }
  }, [messages, currentSpeaker]);

  useEffect(() => {
    if (currentSpeaker !== "agent") return;
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivityTimeRef.current) / 1000;
      if (elapsed >= SESSION_TIMEOUTS.IDLE_TO_ENDED) {
        endAgentSession();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentSpeaker]);

  const endAgentSession = useCallback(() => {
    clearAllTimers();
    
    const endMsg = createMessage("system", "تم إنهاء جلسة الدعم مؤقتاً بسبب عدم النشاط. عاد المساعد الذكي لخدمتك.", "assistant");
    setMessages(prev => [...prev, endMsg]);
    
    setCurrentSpeaker("bot");
    setCurrentAgent(null);
    setSessionAgents([]);
    setChatStatus("online");
    isFirstMessageRef.current = true;
    awaitingFollowUpRef.current = false;
    lastActivityTimeRef.current = Date.now();
  }, [clearAllTimers]);

  const startAgentSession = useCallback((agent: Agent) => {
    clearAllTimers();
    setCurrentAgent(agent);
    setSessionAgents(prev => prev.find(a => a.employeeId === agent.employeeId) ? prev : [...prev, agent]);
    setCurrentSpeaker("agent");
    setIsQueued(false);
    setShowDepartmentSelection(false);
    isFirstMessageRef.current = true;
    awaitingFollowUpRef.current = false;
    
    setMessages(prev => [...prev, createMessage("agent", `أهلاً بك، أنا ${agent.name} (${agent.role}). تفضل، كيف يمكنني مساعدتك؟`, "assistant")]);
    setChatStatus("online");
    lastActivityTimeRef.current = Date.now();
  }, [clearAllTimers]);

  // ============================================================
  // 4. منطق التحويل الداخلي
  // ============================================================
  const performInternalTransfer = useCallback((targetDept: Department, currentAgentName: string, userQuery: string) => {
    const targetAgent = SUPPORT_AGENTS.find(a => a.department === targetDept && a.status === 'online') || SUPPORT_AGENTS[0];
    setMessages(prev => [...prev, createMessage("agent", `لحظة واحدة أستاذ، سأقوم بتحويلك الآن إلى زميلي المختص في قسم ${targetDept === 'ads' ? 'الإعلانات' : 'الدعم الفني'} لخدمة أفضل.`, "assistant")]);
    setChatStatus("typing");
    
    setTimeout(() => {
      setCurrentAgent(targetAgent);
      setSessionAgents(prev => prev.find(a => a.employeeId === targetAgent!.employeeId) ? prev : [...prev, targetAgent!]);
      
      setTimeout(() => {
        setMessages(prev => [...prev, createMessage("agent", `أهلاً بك، أنا ${targetAgent!.name}. لقد اطلعت على طلبك بخصوص "${userQuery}"، وأنا هنا لمساعدتك. تفضل.`, "assistant")]);
        setChatStatus("online");
        isSendingRef.current = false;
        lastActivityTimeRef.current = Date.now();
      }, 1200);
    }, 1000);
  }, []);

  // ============================================================
  // 5. منطق المحادثة الرئيسي
  // ============================================================
  const sendMessage = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingRef.current) return;

    clearAllTimers();
    isSendingRef.current = true;
    setMessages(prev => [...prev, createMessage("user", trimmedText, "user", "sent")]);
    setText("");
    lastActivityTimeRef.current = Date.now();

    const normalized = normalizeArabicText(trimmedText);

    if (["موظف", "شخص", "دعم", "حولني"].some(k => normalized.includes(k)) && currentSpeaker === "bot" && !showDepartmentSelection) {
      setShowDepartmentSelection(true);
      setMessages(prev => [...prev, createMessage("system", "يرجى اختيار القسم الذي ترغب في التواصل معه:", "assistant")]);
      isSendingRef.current = false;
      return;
    }

    if (currentSpeaker === "agent" && currentAgent) {
      setChatStatus("typing");
      const typingDelay = Math.floor(Math.random() * 500) + 700;
      
      setTimeout(() => {
        let agentReply = "";
        let triggerFollowUp = false;

        if (isFirstMessageRef.current && ["مرحبا", "هلو", "السلام", "مساء", "صباح"].some(k => normalized.includes(k))) {
          agentReply = `أهلاً وسهلاً بك أستاذ. أنا ${currentAgent.name} من ${currentAgent.department === 'ads' ? 'قسم الإعلانات' : currentAgent.department === 'technical' ? 'الدعم الفني' : 'خدمة العملاء'}. كيف أستطيع مساعدتك اليوم؟`;
          isFirstMessageRef.current = false;
        }
        else if (["شكر", "تسلم", "عافيه", "تمام", "ممتاز", "خلاص"].some(k => normalized.includes(k))) {
          if (awaitingFollowUpRef.current) {
            agentReply = "شكراً لتواصلك معنا. نتمنى لك يوماً سعيداً، ونحن دائماً في خدمتك.";
            awaitingFollowUpRef.current = false;
          } else {
            agentReply = "العفو أستاذ، يسعدني خدمتك دائماً.";
            triggerFollowUp = true;
          }
        }
        else if (normalized.includes("سعر") || normalized.includes("كم") || normalized.includes("باقه") || normalized.includes("اعلان")) {
          isFirstMessageRef.current = false;
          
          let currency = "USD";
          let symbol = "دولار";
          let rate = 1;
          if (normalized.includes("عراقي") || normalized.includes("دينار")) { currency = "IQD"; symbol = "دينار عراقي"; rate = EXCHANGE_RATES.IQD; }
          else if (normalized.includes("سعودي") || normalized.includes("ريال")) { currency = "SAR"; symbol = "ريال سعودي"; rate = EXCHANGE_RATES.SAR; }
          else if (normalized.includes("تومان") || normalized.includes("ايراني")) { currency = "IRR"; symbol = "تومان إيراني"; rate = EXCHANGE_RATES.IRR; }
          else if (normalized.includes("يورو") || normalized.includes("اورو")) { currency = "EUR"; symbol = "يورو"; rate = EXCHANGE_RATES.EUR; }

          const formatPrice = (usd: number) => `${Math.round(usd * rate)} ${symbol}`;
          
          if (currentAgent.department === 'ads') {
            agentReply = `أسعار باقاتنا الأساسية (بالدولار الأمريكي كمرجع):\n🔹 الأسبوعية: ${formatPrice(AD_PACKAGES.weekly.usd)}\n🔹 الشهرية: ${formatPrice(AD_PACKAGES.monthly.usd)}\n الاحترافية: ${formatPrice(AD_PACKAGES.premium.usd)}\n${currency !== 'USD' ? `\n(ملاحظة: الأسعار أعلاه هي التقريبية بالعملة المطلوبة بناءً على سعر الصرف الحالي)` : ''}`;
            triggerFollowUp = true;
          } else {
            performInternalTransfer('ads', currentAgent.name, "استفسار عن أسعار الإعلانات");
            isSendingRef.current = false;
            return;
          }
        }
        else if (normalized.includes("مدة") || normalized.includes("يوم") || normalized.includes("شهر")) {
          agentReply = `مدة الإعلان تعتمد على الباقة المختارة:\n• الأسبوعية: ${AD_PACKAGES.weekly.duration}\n• الشهرية: ${AD_PACKAGES.monthly.duration}\n• الاحترافية: ${AD_PACKAGES.premium.duration}`;
          triggerFollowUp = true;
        }
        else if (normalized.includes("منصه") || normalized.includes("فيسبوك") || normalized.includes("انستقرام")) {
          agentReply = `نغطي عدة منصات حسب الباقة:\n• الأسبوعية: ${AD_PACKAGES.weekly.platforms}\n• الشهرية: ${AD_PACKAGES.monthly.platforms}\n• الاحترافية: ${AD_PACKAGES.premium.platforms}`;
          triggerFollowUp = true;
        }
        else if (normalized.includes("مشاهدات") || normalized.includes("ظهور") || normalized.includes("reach")) {
          agentReply = `عدد مرات الظهور المضمون لكل باقة:\n• الأسبوعية: ${AD_PACKAGES.weekly.views}\n• الشهرية: ${AD_PACKAGES.monthly.views}\n• الاحترافية: ${AD_PACKAGES.premium.views}`;
          triggerFollowUp = true;
        }
        else if (currentAgent.department === 'support' && (normalized.includes("مشكله") || normalized.includes("خطأ"))) {
          performInternalTransfer('technical', currentAgent.name, "مشكلة تقنية");
          isSendingRef.current = false;
          return;
        }
        else {
          isFirstMessageRef.current = false;
          const defaults = [
            "أفهمك تماماً أستاذ. هل يمكنك تزويدي بمزيد من التفاصيل لأتمكن من مساعدتك بشكل أفضل؟",
            "حاضر أستاذ، أنا هنا لخدمتك. تفضل بطرح استفسارك.",
            "بالتأكيد، يسعدني ذلك. كيف يمكنني توجيهك بشكل أدق؟"
          ];
          agentReply = defaults[Math.floor(Math.random() * defaults.length)];
          triggerFollowUp = true;
        }

        setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
        setChatStatus("online");

        if (triggerFollowUp) {
          followUpTimerRef.current = setTimeout(() => {
            setMessages(prev => [...prev, createMessage("agent", "هل تحتاج إلى شيء آخر أستاذ؟", "assistant")]);
            awaitingFollowUpRef.current = true;
            setChatStatus("online");
            isSendingRef.current = false;
          }, 1000);
        } else {
          isSendingRef.current = false;
        }

      }, typingDelay);
      return;
    }

    setChatStatus("typing");
    try {
      const apiMessages = messages.filter(m => m.sender !== "system").map(m => ({ role: (m.sender === "bot" || m.sender === "agent") ? "assistant" : "user", content: m.text }));
      apiMessages.push({ role: "user", content: trimmedText });

      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: apiMessages }) });
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      
      setMessages(prev => [...prev, createMessage("bot", data.text || "عذراً، لم أتمكن من الرد حالياً.", "assistant", "read", data.attachments)]);
    } catch (error) {
      setMessages(prev => [...prev, createMessage("system", "عذراً، حدث خطأ في الاتصال.", "assistant")]);
    } finally {
      setChatStatus("online");
      isSendingRef.current = false;
    }
  }, [text, currentSpeaker, currentAgent, showDepartmentSelection, messages, performInternalTransfer, clearAllTimers]);

  // ============================================================
  // 6. دوال مساعدة للواجهة
  // ============================================================
  const getStatusText = () => {
    if (chatStatus === "typing") return "يكتب الآن...";
    if (chatStatus === "ended") return "عاد المساعد الذكي";
    return "متصل الآن";
  };

  const getStatusColor = () => {
    if (chatStatus === "typing") return "bg-yellow-400 animate-pulse";
    if (chatStatus === "ended") return "bg-green-400 animate-pulse";
    return "bg-green-400 animate-pulse";
  };

  const renderSeamlessItems = () => {
    const products = [...TRENDING_PRODUCTS, ...TRENDING_PRODUCTS];
    const shapeMap: Record<ProductShape, string> = { 'circle': 'w-16 h-16 rounded-full', 'rectangle': 'w-20 h-14 rounded-xl', 'portrait': 'w-14 h-20 rounded-2xl', 'square': 'w-16 h-16 rounded-md' };
    return products.map((p, i) => (
      <div key={`${p.id}-${i}`} className="flex-shrink-0 inline-flex items-center gap-4 mx-4 bg-[#1f2937]/90 backdrop-blur-sm px-4 py-3 border border-gray-700 hover:border-purple-500 transition-all duration-300 w-[300px]">
        <img src={p.img} alt={p.name} className={`object-cover border-2 border-purple-500 shadow-md flex-shrink-0 ${shapeMap[p.shape]}`} />
        <div className="flex flex-col text-right flex-1 min-w-0">
          <span className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">{p.name}</span>
          <span className="text-xs text-purple-400 line-clamp-2">{p.desc}</span>
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
        
        @keyframes slide-in-right { 0% { opacity: 0; transform: translateX(50px); } 100% { opacity: 1; transform: translateX(0); } }
        .animate-slide-in-right { animation: slide-in-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes natural-blink { 0%, 45%, 55%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.1); } }
        .animate-natural-blink { animation: natural-blink 4s infinite; transform-origin: center; }

        @keyframes micro-smile { 0%, 100% { d: path("M 10 22 C 10 22, 14 25, 16 25 C 18 25, 22 22, 22 22"); } 50% { d: path("M 10 22 C 10 22, 14 26, 16 26 C 18 26, 22 22, 22 22"); } }
        .animate-micro-smile { animation: micro-smile 5s ease-in-out infinite; }

        @keyframes gentle-breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
        .animate-gentle-breathe { animation: gentle-breathe 3s ease-in-out infinite; }

        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }
      `}</style>

      {/* شريط التحميل RTL */}
      {loadingProgress > 0 && (
        <div className="fixed top-0 right-0 left-auto z-[100] h-1 bg-gray-800/50">
          <div className="h-full bg-gradient-to-l from-purple-500 via-blue-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.7)]"
            style={{ width: `${loadingProgress}%`, transition: loadingProgress === 100 ? 'width 0.5s ease-out, opacity 0.5s ease-out' : 'width 0.4s ease-out', opacity: loadingProgress === 100 ? 0 : 1 }} />
        </div>
      )}

      {/* 🔴 الهيدر الكامل مع الشعار والبحث والأزرار */}
      <header className="sticky top-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="w-full px-2 md:px-4 py-3 flex flex-wrap md:flex-nowrap justify-between items-center gap-2 md:gap-4">
          {/* الشعار واسم الموقع على اليمين */}
          <a href="/" className="flex items-center gap-2 md:gap-3 shrink-0">
            <img src="https://iili.io/Bsjh2M7.png" alt="شعار" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border-2 border-purple-500 shadow-md" />
            <span className="text-base md:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">قناة مجلة دار النجوم</span>
          </a>
          
          {/* شريط البحث في الوسط */}
          <div className="flex-1 max-w-md mx-2 hidden md:block">
            <input type="text" placeholder="🔎 ابحث عن مشاهير، برامج، أو محتوى..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500 text-sm" />
          </div>
          
          {/* أزرار الترقية والاشتراك على اليسار */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <a href="/upgrade" className="hidden sm:flex items-center gap-1 px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition">ترقية 👑</a>
            <a href="/login" className="px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs md:text-sm font-bold hover:shadow-lg transition">اشتراك</a>
          </div>
        </div>
        <div className="md:hidden px-2 pb-3">
          <input type="text" placeholder=" ابحث عن محتوى..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
        </div>
      </header>

      {/* شريط المنتجات المتحركة */}
      <div className="bg-[#111827] border-b border-gray-800 overflow-hidden relative py-3">
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="flex animate-seamless-scroll w-max">{renderSeamlessItems()}</div>
      </div>

      {/* المحتوى الرئيسي */}
      <main className="container mx-auto px-4 py-12 flex-1 text-center">
        <div className="youtube-ad-marquee bg-purple-900/30 border border-purple-500/30 rounded-full py-2.5 mb-8 overflow-hidden relative max-w-4xl mx-auto">
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
      </main>

      {/* أيقونة المحادثة الحية */}
      <div ref={chatButtonRef} onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/40 cursor-pointer hover:scale-110 transition-transform duration-300 z-50 border-2 border-white/10 animate-slide-in-right" title="مركز المساعدة">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="animate-gentle-breathe">
            <g className="animate-natural-blink">
              <circle cx="10" cy="14" r="5" fill="white" />
              <circle cx="10" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.2s ease-out' }} />
            </g>
            <g className="animate-natural-blink" style={{ animationDelay: '0.1s' }}>
              <circle cx="22" cy="14" r="5" fill="white" />
              <circle cx="22" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.2s ease-out' }} />
            </g>
            <path className="animate-micro-smile" d="M 10 22 C 10 22, 14 25, 16 25 C 18 25, 22 22, 22 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {/* نافذة الدردشة */}
      <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl transition-all duration-300 z-50 flex flex-col ${open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}>
        <div className="p-4 border-b border-gray-700 flex items-center gap-3 bg-[#1f2937]/50 rounded-t-2xl">
          <div className="relative">
            <img src={currentAgent?.img || "https://iili.io/Bsjh2M7.png"} alt="Agent" className="w-10 h-10 rounded-full border-2 border-purple-500" />
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111827] ${getStatusColor()}`}></span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-sm truncate">{currentAgent ? currentAgent.name : "المساعد الذكي"}</h4>
            <p className="text-xs text-gray-400 truncate">{getStatusText()}</p>
          </div>
        </div>

        <div className="h-80 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#0b0f1a]/50">
          {messages.map((msg) => {
            if (msg.sender === "system") return <div key={msg.id} className="flex justify-center my-2"><span className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700 text-center max-w-[90%]">{msg.text}</span></div>;
            const isUser = msg.sender === "user";
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                {!isUser && <span className="text-[10px] text-gray-400 mb-1 ml-1">{currentAgent ? `${currentAgent.name}` : "المساعد الذكي"}</span>}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative whitespace-pre-line ${isUser ? "bg-purple-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-purple-500/30 rounded-tl-sm"}`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1">{msg.time}</span>
              </div>
            );
          })}
          {chatStatus === "typing" && (
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-gray-400 mb-1 ml-1">{currentAgent ? currentAgent.name : "المساعد الذكي"}</span>
              <div className="bg-[#1f2937] border border-purple-500/30 rounded-2xl rounded-tl-sm p-3 flex gap-1.5 items-center h-10">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '200ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '400ms' }}></span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-700 bg-[#1f2937]/50 rounded-b-2xl">
          {showDepartmentSelection && currentSpeaker === "bot" ? (
            <div className="space-y-2">
              {DEPARTMENT_OPTIONS.map((dept) => (
                <button key={dept.id} onClick={() => { setShowDepartmentSelection(false); startAgentSession(SUPPORT_AGENTS.find(a => a.department === dept.id)!); }} className="w-full text-right bg-[#1f2937] hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500 rounded-xl p-3 transition-all">
                  <div className="font-bold text-sm text-purple-300">{dept.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{dept.description}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea id="chat-input" value={text} placeholder="اكتب رسالتك هنا..." onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} rows={1} className="flex-1 bg-[#0b0f1a] text-white px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 border border-gray-700 placeholder-gray-500 resize-none overflow-y-auto max-h-32 min-h-[42px]" />
              <button onClick={sendMessage} disabled={!text.trim() || chatStatus === "typing" || isSendingRef.current} className="p-3 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🔴 الفوتر الكامل مع جميع الروابط */}
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