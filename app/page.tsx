"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// TYPES & INTERFACES (لم يتم تغييرها للحفاظ على هيكل المشروع)
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
  weekly: { usd: 50, duration: "أسبوع واحد", platforms: "Facebook, Instagram", views: "10,000 ظهور" },
  monthly: { usd: 150, duration: "شهر كامل", platforms: "Facebook, Instagram, TikTok", views: "50,000 ظهور" },
  premium: { usd: 300, duration: "حملة مخصصة", platforms: "جميع المنصات + Website", views: "150,000+ ظهور" }
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
  IDLE_TO_ENDED: 45, // 45 ثانية كما طلبت
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

// تحسين بسيط ليشمل لهجات وأخطاء إملائية شائعة
const normalizeArabicText = (text: string): string => {
  return text
    .normalize("NFKD")
    .replace(/[\u064B-\u065F]/g, "") // إزالة التشكيل
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/گ/g, "ك") // لهجة خليجية/عراقية
    .replace(/چ/g, "ج") 
    .replace(/پ/g, "ب")
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
  
  // حالات حركة الأيقونة
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [isMouseNear, setIsMouseNear] = useState(false);

  const chatButtonRef = useRef<HTMLDivElement>(null);
  const currentSpeakerRef = useRef(currentSpeaker);
  const lastActivityTimeRef = useRef(Date.now());
  const isSendingRef = useRef(false);
  
  // مراجع منطق المحادثة المتقدم
  const isFirstMessageRef = useRef(true);
  const awaitingFollowUpRef = useRef(false);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);

  // ============================================================
  // 1. شريط التحميل RTL (ينمو من اليمين لليسار بسلاسة)
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
  // 2. حركة الأيقونة الطبيعية (تتبع الماوس بالعينين + ابتسامة تفاعلية)
  // ============================================================
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (chatButtonRef.current) {
        const rect = chatButtonRef.current.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - (rect.left + rect.width/2), e.clientY - (rect.top + rect.height/2));
        setIsMouseNear(dist < 150);
        
        // تحريك بؤبؤ العين فقط بمقدار طبيعي ومحدود
        const x = Math.max(-4, Math.min(4, (e.clientX - (rect.left + rect.width/2)) / 25));
        const y = Math.max(-4, Math.min(4, (e.clientY - (rect.top + rect.height/2)) / 25));
        setEyePos({ x, y });
      }
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // ============================================================
  // 3. إدارة الجلسة ومؤقت الـ 45 ثانية للعودة للمساعد الذكي
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
    const endMsg = createMessage("system", "تم إنهاء جلسة الدعم تلقائياً بسبب عدم وجود نشاط لمدة 45 ثانية. عاد المساعد الذكي لخدمتك.", "assistant");
    setMessages(prev => [...prev, endMsg]);
    
    setCurrentSpeaker("bot");
    setCurrentAgent(null);
    setSessionAgents([]);
    setChatStatus("online");
    isFirstMessageRef.current = true;
    awaitingFollowUpRef.current = false;
    lastActivityTimeRef.current = Date.now();

    if (typeof window !== "undefined") {
      localStorage.setItem("dar-alnujum-chat-state", JSON.stringify({
        messages: [endMsg], currentSpeaker: "bot", currentAgent: null,
        sessionAgents: [], chatStatus: "online", isQueued: false
      }));
    }
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
  // 4. منطق التحويل الداخلي الذكي (مع الحفاظ على سياق المحادثة)
  // ============================================================
  const performInternalTransfer = useCallback((targetDept: Department, currentAgentName: string, userQuery: string) => {
    const targetAgent = SUPPORT_AGENTS.find(a => a.department === targetDept && a.status === 'online') || SUPPORT_AGENTS.find(a => a.department === targetDept)!;
    
    setMessages(prev => [...prev, createMessage("agent", `لحظة واحدة أستاذ، هذا الطلب يخص قسم ${targetDept === 'ads' ? 'الإ