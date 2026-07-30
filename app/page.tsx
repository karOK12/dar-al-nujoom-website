"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// TYPES & INTERFACES
// ============================================================

type Sender = "user" | "bot" | "agent" | "system";
type AgentStatus = "online" | "busy" | "away" | "offline";
type Department = 'customer_service' | 'sales' | 'technical' | 'accounting' | 'ads' | 'management';
type ChatStatus = "typing" | "online" | "waiting" | "inactive" | "closed";
type ProductShape = "circle" | "rectangle" | "square" | "portrait";
type AttachmentType = 'image' | 'link' | 'card' | 'product' | 'file' | 'video';

interface Attachment {
  type: AttachmentType;
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
  greeting?: string; // إضافة رسالة ترحيب مخصصة لكل موظف
}

interface DepartmentOption {
  id: Department;
  name: string;
  icon: string;
  description: string;
}

interface TrendingProduct {
  id: number;
  name: string;
  desc: string;
  img: string;
  shape: ProductShape;
}

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  type: 'image' | 'video' | 'document';
}

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

// تم إضافة أكثر من موظف لكل قسم مع رسائل ترحيب فريدة تعكس شخصية كل قسم
const SUPPORT_AGENTS: Agent[] = [
  { employeeId: "EMP-001", name: "فاطمة الخدمة", img: "https://i.pravatar.cc/150?img=5", role: "خدمة العملاء", department: 'customer_service', status: 'online', lastActivity: new Date().toISOString(), isBusy: false, greeting: "أهلاً بك! معك فاطمة من خدمة العملاء. اطلعت على استفسارك، كيف يمكنني توجيهك بشكل صحيح اليوم؟" },
  { employeeId: "EMP-002", name: "خالد الأحمد", img: "https://i.pravatar.cc/150?img=68", role: "ممثل مبيعات أول", department: 'sales', status: 'online', lastActivity: new Date().toISOString(), isBusy: false, greeting: "أهلاً بك! معك خالد من قسم المبيعات. اطلعت على طلبك، كيف يمكنني مساعدتك في اختيار الباقة أو العرض الأنسب اليوم؟" },
  { employeeId: "EMP-003", name: "منى سعيد", img: "https://i.pravatar.cc/150?img=9", role: "أخصائية عروض", department: 'sales', status: 'online', lastActivity: new Date().toISOString(), isBusy: false, greeting: "مرحباً! أنا منى من فريق المبيعات. يسعدني جداً مساعدتك في معرفة تفاصيل عروضنا الحالية والبدء معك." },
  { employeeId: "EMP-004", name: "نورة السالم", img: "https://i.pravatar.cc/150?img=44", role: "مهندسة دعم فني", department: 'technical', status: 'online', lastActivity: new Date().toISOString(), isBusy: false, greeting: "أهلاً بك. معك نورة من الدعم الفني. اطلعت على المشكلة المذكورة في المحادثة، دعني أساعدك في فحصها وحلها فوراً." },
  { employeeId: "EMP-005", name: "ياسر التقني", img: "https://i.pravatar.cc/150?img=12", role: "فني شبكات", department: 'technical', status: 'online', lastActivity: new Date().toISOString(), isBusy: false, greeting: "مرحباً، ياسر هنا من الدعم الفني. قرأت تفاصيل طلبك وسأقوم بفحص الأمر تقنياً الآن لضمان حله." },
  { employeeId: "EMP-006", name: "ليلى المحاسبة", img: "https://i.pravatar.cc/150?img=32", role: "مراجعة حسابات", department: 'accounting', status: 'online', lastActivity: new Date().toISOString(), isBusy: false, greeting: "مرحباً، معك ليلى من القسم المالي. اطلعت على استفسارك المتعلق بالفواتير أو الدفع، تفضل كيف أساعدك؟" },
  { employeeId: "EMP-007", name: "سارة المالكي", img: "https://i.pravatar.cc/150?img=47", role: "مديرة حملات", department: 'ads', status: 'online', lastActivity: new Date().toISOString(), isBusy: false, greeting: "أهلاً بك! أنا سارة من قسم الإعلانات. اطلعت على اهتمامك، دعنا نناقش أفضل استراتيجية لإعلانك أو حجز مساحتك." },
  { employeeId: "EMP-008", name: "أحمد المدير", img: "https://i.pravatar.cc/150?img=11", role: "مدير عام", department: 'management', status: 'online', lastActivity: new Date().toISOString(), isBusy: false, greeting: "أهلاً بك. معك أحمد، المدير العام. اطلعت على ملاحظتك أو طلب التصعيد، وأنا هنا لضمان حلها بأعلى معايير الجودة." },
];

// تم إعادة ترتيب الأقسام لتكون أكثر منطقية ووضوحاً للمستخدم
const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { id: 'customer_service', name: 'خدمة العملاء', icon: '🎧', description: 'استفسارات عامة، متابعة الطلبات، والمساعدة المبدئية' },
  { id: 'sales', name: 'المبيعات', icon: '🛒', description: 'الأسعار، الباقات، العروض، وحجز الخدمات' },
  { id: 'technical', name: 'الدعم الفني', icon: '🛠️', description: 'حل المشاكل التقنية، الأخطاء، ومساعدة تسجيل الدخول' },
  { id: 'accounting', name: 'المحاسبة والمالية', icon: '💳', description: 'الفواتير، المدفوعات، الاشتراكات، والاسترجاع' },
  { id: 'ads', name: 'الإعلانات', icon: '📢', description: 'حجز مساحات إعلانية، ورعاية البرامج والمحتوى' },
  { id: 'management', name: 'الإدارة', icon: '👨‍💼', description: 'الشكاوى، التصعيد، والقرارات الإدارية الخاصة' },
];

const SESSION_TIMEOUTS = { SOFT_INACTIVE: 59, HARD_RESET: 600, QUEUE_CHECK_INTERVAL: 8000 };

const TRENDING_PRODUCTS: TrendingProduct[] = [
  { id: 1, name: "كاميرا تصوير احترافية", desc: "خصم 25% لفترة محدودة", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&h=150&fit=crop", shape: "circle" },
  { id: 2, name: "سماعات استوديو", desc: "عزل ضوضاء فائق الجودة", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=150&fit=crop", shape: "rectangle" },
  { id: 3, name: "إضاءة Ring Light", desc: "مثالية لصناع المحتوى", img: "https://images.unsplash.com/photo-1615469062329-5f23633c1182?w=150&h=150&fit=crop", shape: "square" },
  { id: 4, name: "ميكروفون بث مباشر", desc: "جودة صوت استثنائية", img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=150&h=200&fit=crop", shape: "portrait" },
];

const EXACT_WELCOME_MESSAGE = "أهلاً وسهلاً بك في قناة مجلة دار النجوم. يسعدني مساعدتك، كيف أستطيع خدمتك اليوم؟";

const GREETING_KEYWORDS = ["مرحبا", "هلا", "سلام", "صباح", "مساء", "اهلين", "السلام"];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/mov', 'video/webm'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

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
  const humanRequestKeywords = ["موظف", "شخص", "انسان", "بشري", "حقيقي", "ممثل", "خدمة العملاء", "فريق الدعم", "اكلم", "اتحدث", "اتواصل", "حولني", "تحويل", "ادارة", "مسؤول", "دعم", "مساعدة", "مبيعات", "إدارة", "إعلانات", "محاسبة"];
  return humanRequestKeywords.some(keyword => normalized.includes(keyword));
};

const getAvailableAgents = (department?: Department) => {
  return SUPPORT_AGENTS.filter(agent => {
    const isAvailable = agent.status === 'online' && !agent.isBusy;
    return department ? (agent.department === department && isAvailable) : isAvailable;
  });
};

const createMessage = (sender: Sender, text: string, role?: "user" | "assistant", status: "sent" | "delivered" | "read" = "read", attachments?: Attachment[]): Message => ({
  id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  sender, text, role,
  time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
  status, attachments
});

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const getFileType = (file: File): 'image' | 'video' | 'document' => {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) return 'video';
  return 'document';
};

// ============================================================
// SMART REPLY LOGIC
// ============================================================
const generateSmartAgentReply = (userText: string, agent: Agent, history: Message[]): string => {
  const normalized = normalizeArabicText(userText);
  
  const isPricing = normalized.includes("سعر") || normalized.includes("كم") || normalized.includes("باقة") || normalized.includes("تكلفة");
  const isTechnical = normalized.includes("مشكلة") || normalized.includes("لا يعمل") || normalized.includes("خطأ") || normalized.includes("معلق");
  const isThanks = normalized.includes("شكر") || normalized.includes("مشكور") || normalized.includes("يسلمو");
  const isClosing = normalized.includes("مع السلامة") || normalized.includes("انتهيت") || normalized.includes("خلاص");

  if (isPricing) {
    return `بخصوص استفسارك عن الأسعار، باقاتنا تبدأ من 135$ للباقة الأسبوعية و 405$ للشهرية. لكي أرشح لك الأنسب، هل يمكنك إخباري بالميزانية التقريبية أو المنصة المفضلة لديك؟`;
  }
  
  if (isTechnical) {
    return `أعتذر لسماع وجود مشكلة. لكي أتمكن من حلها بدقة، هل يمكنك تزويدي برقم الخطأ أو وصف ما يحدث بالضبط عند المحاولة؟`;
  }

  if (isThanks) {
    return "على الرحب والسعة! هذا واجبنا. أنا هنا دائماً إذا احتجت لأي مساعدة أخرى.";
  }

  if (isClosing) {
    return "شكراً لتواصلك معنا. نتمنى لك يوماً سعيداً، ولا تتردد في العودة إلينا في أي وقت.";
  }

  const lastAgentMsg = history.filter(m => m.sender === 'agent' || m.sender === 'bot').pop();
  if (lastAgentMsg && (lastAgentMsg.text.includes("تفاصيل") || lastAgentMsg.text.includes("رقم الخطأ"))) {
    return "أنا في انتظار تزويدي بالتفاصيل المطلوبة لكي أتمكن من خدمتك بشكل أسرع وأدق.";
  }

  return `عذراً، لم يتضح لي طلبك تماماً. هل يمكنك إعادة صياغة سؤالك أو تزويدي بالمزيد من التفاصيل حول ما تحتاجه بالضبط لكي أتمكن من مساعدتك؟`;
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
  const [showAgentTransferMenu, setShowAgentTransferMenu] = useState(false);
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const [iconPos, setIconPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 80 : 0, y: typeof window !== 'undefined' ? window.innerHeight - 80 : 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [springScale, setSpringScale] = useState(1);
  const [headTransform, setHeadTransform] = useState("translateY(0px) rotate(0deg)");
  
  const [isIconShifted, setIsIconShifted] = useState(false);
  
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const targetEyePos = useRef({ x: 0, y: 0 });
  const currentEyePos = useRef({ x: 0, y: 0 });
  const microSaccade = useRef({ x: 0, y: 0 });
  const chatButtonRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const dragStartPos = useRef({ x: 0, y: 0 });
  const pointerStartPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const currentIconPos = useRef({ x: iconPos.x, y: iconPos.y });
  const targetIconPos = useRef({ x: iconPos.x, y: iconPos.y });

  const currentSpeakerRef = useRef(currentSpeaker);
  const chatStatusRef = useRef(chatStatus);
  const isSendingRef = useRef(false);
  const isFirstUserMessageAfterTransferRef = useRef(true);
  const hasIconAnimatedRef = useRef(false);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { chatStatusRef.current = chatStatus; }, [chatStatus]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, chatStatus, showAgentTransferMenu]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPos = localStorage.getItem('chat-icon-pos');
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          const x = Math.min(Math.max(parsed.x, 10), window.innerWidth - 74);
          const y = Math.min(Math.max(parsed.y, 10), window.innerHeight - 74);
          setIconPos({ x, y });
          currentIconPos.current = { x, y };
          targetIconPos.current = { x, y };
        } catch (e) { console.error("Failed to parse icon position", e); }
      }
    }
  }, []);

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
    const fallback = setTimeout(() => {
      if (!isComplete) { isComplete = true; setLoadingProgress(100); setTimeout(() => setLoadingProgress(0), 600); }
    }, 10000);
    return () => {
      document.removeEventListener('readystatechange', handleReadyState);
      window.removeEventListener('load', handleLoad);
      clearTimeout(fallback); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    let rafId: number;
    let time = 0;
    const animate = () => {
      time += 0.015;
      const breathY = Math.sin(time) * 1.0;
      const tilt = Math.sin(time * 0.7) * 1.0;
      setHeadTransform(`translateY(${breathY}px) rotate(${tilt}deg)`);

      if (Math.random() < 0.008) {
        microSaccade.current = { x: (Math.random() - 0.5) * 0.8, y: (Math.random() - 0.5) * 0.8 };
      }
      
      currentEyePos.current.x += (targetEyePos.current.x - currentEyePos.current.x) * 0.08;
      currentEyePos.current.y += (targetEyePos.current.y - currentEyePos.current.y) * 0.08;
      setEyePos({ x: currentEyePos.current.x + microSaccade.current.x, y: currentEyePos.current.y + microSaccade.current.y });

      if (!isDragging) {
        currentIconPos.current.x += (targetIconPos.current.x - currentIconPos.current.x) * 0.15;
        currentIconPos.current.y += (targetIconPos.current.y - currentIconPos.current.y) * 0.15;
        if (Math.abs(currentIconPos.current.x - targetIconPos.current.x) < 0.5 && Math.abs(currentIconPos.current.y - targetIconPos.current.y) < 0.5) {
          currentIconPos.current.x = targetIconPos.current.x;
          currentIconPos.current.y = targetIconPos.current.y;
        }
        setIconPos({ x: currentIconPos.current.x, y: currentIconPos.current.y });
        setSpringScale(prev => prev + (1.0 - prev) * 0.15);
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isDragging]);

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!chatButtonRef.current || isDragging) return;
      const rect = chatButtonRef.current.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      const angle = Math.atan2(dy, dx);
      const distance = Math.min(Math.hypot(dx, dy), 300);
      const moveDist = (distance / 300) * 2.2;
      let targetX = Math.cos(angle) * moveDist;
      let targetY = Math.sin(angle) * moveDist;
      if (chatStatusRef.current === "typing") targetY -= 0.8;
      targetEyePos.current = { x: targetX, y: targetY };
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
        if(e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("touchmove", handleTouchMove); };
  }, [isDragging]);

  useEffect(() => {
    if (open) {
      targetEyePos.current = { x: 0, y: -2.5 };
      if (chatStatus === "typing") targetEyePos.current = { x: 0, y: -3.0 };
    } else {
      targetEyePos.current = { x: 0, y: 0 };
    }
  }, [open, chatStatus]);

  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    let idleTimeout: NodeJS.Timeout;
    const scheduleBlink = () => {
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => { setIsBlinking(false); scheduleBlink(); }, 120);
      }, 2000 + Math.random() * 4000);
    };
    const scheduleIdleGlance = () => {
      if (!isDragging && chatStatusRef.current === "online" && !open) {
        idleTimeout = setTimeout(() => {
          const angle = Math.random() * Math.PI * 2;
          const dist = 1.0 + Math.random() * 1.0;
          targetEyePos.current = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
          setTimeout(() => { targetEyePos.current = { x: 0, y: 0 }; }, 1000 + Math.random() * 1000);
          scheduleIdleGlance();
        }, 5000 + Math.random() * 5000);
      }
    };
    scheduleBlink();
    scheduleIdleGlance();
    return () => { clearTimeout(blinkTimeout); clearTimeout(idleTimeout); };
  }, [isDragging, open]);

  const snapToEdge = useCallback((x: number, y: number) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const iconSize = 64;
    const margin = 10;
    
    const distToLeft = x;
    const distToRight = screenWidth - x - iconSize;
    const distToTop = y;
    const distToBottom = screenHeight - y - iconSize;
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    
    let snappedX = x, snappedY = y;
    if (minDist === distToLeft) snappedX = margin;
    else if (minDist === distToRight) snappedX = screenWidth - iconSize - margin;
    else if (minDist === distToTop) snappedY = margin;
    else snappedY = screenHeight - iconSize - margin;
    
    return { x: snappedX, y: snappedY };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    hasDragged.current = false;
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { x: currentIconPos.current.x, y: currentIconPos.current.y };
    chatButtonRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - pointerStartPos.current.x;
    const deltaY = e.clientY - pointerStartPos.current.y;
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) hasDragged.current = true;
    if (hasDragged.current) {
      let newX = Math.max(10, Math.min(dragStartPos.current.x + deltaX, window.innerWidth - 74));
      let newY = Math.max(10, Math.min(dragStartPos.current.y + deltaY, window.innerHeight - 74));
      targetIconPos.current = { x: newX, y: newY };
      currentIconPos.current = { x: newX, y: newY };
      setIconPos({ x: newX, y: newY });
    }
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    chatButtonRef.current?.releasePointerCapture(e.pointerId);
    const snapped = snapToEdge(currentIconPos.current.x, currentIconPos.current.y);
    targetIconPos.current = snapped;
    currentIconPos.current = snapped;
    setIconPos(snapped);
    if (typeof window !== 'undefined') localStorage.setItem('chat-icon-pos', JSON.stringify(snapped));
  }, [isDragging, snapToEdge]);

  const handleClick = useCallback(() => {
    if (!hasDragged.current) {
      setIsIconShifted(prev => !prev);
      setOpen(prev => !prev);
    }
    hasDragged.current = false;
  }, []);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) { alert(`حجم الملف "${file.name}" يتجاوز الحد المسموح (10MB)`); return; }
      const isAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOC_TYPES].includes(file.type);
      if (!isAllowed) { alert(`نوع الملف "${file.name}" غير مدعوم`); return; }
      
      const fileType = getFileType(file);
      const uploadedFile: UploadedFile = { id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, file, progress: 0, type: fileType };
      
      if (fileType === 'image' || fileType === 'video') {
        const reader = new FileReader();
        reader.onload = (e) => { uploadedFile.preview = e.target?.result as string; setUploadedFiles(prev => [...prev, uploadedFile]); };
        reader.readAsDataURL(file);
      } else {
        setUploadedFiles(prev => [...prev, uploadedFile]);
      }
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 100) { progress = 100; clearInterval(interval); }
        setUploadedFiles(prev => prev.map(f => f.id === uploadedFile.id ? { ...f, progress } : f));
      }, 100);
    });
  }, []);

  const removeFile = useCallback((fileId: string) => setUploadedFiles(prev => prev.filter(f => f.id !== fileId)), []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); handleFileSelect(e.dataTransfer.files); }, [handleFileSelect]);

  const saveStateToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem('dar-alnujum-chat-state', JSON.stringify({ messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, isQueued })); } 
    catch (e) { console.error('Save state error:', e); }
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
      setShowAgentTransferMenu(false);
      isFirstUserMessageAfterTransferRef.current = true;
      return true;
    } catch (e) { return false; }
  }, []);

  // نظام تحويل المحادثة بين الموظفين
  const handleAgentTransfer = useCallback((targetAgent: Agent) => {
    setChatStatus("typing");
    setShowAgentTransferMenu(false);

    setTimeout(() => {
      setCurrentAgent(targetAgent);
      if (!sessionAgents.find(a => a.employeeId === targetAgent.employeeId)) {
        setSessionAgents(prev => [...prev, targetAgent]);
      }
      setCurrentSpeaker("agent");
      isFirstUserMessageAfterTransferRef.current = true;
      
      // استخدام رسالة الترحيب المخصصة للموظف
      const greetingText = targetAgent.greeting || `أهلاً بك، أنا ${targetAgent.name} (${targetAgent.role}). اطلعت على المحادثة السابقة، تفضل كيف يمكنني مساعدتك؟`;
      
      setMessages(prev => [...prev, createMessage("agent", greetingText, "assistant")]);
      setChatStatus("online");
    }, 1500);
  }, [sessionAgents]);

  const handleHumanRequest = useCallback(() => {
    setShowDepartmentSelection(true); 
    setChatStatus("online");
    setMessages(prev => [...prev, createMessage("system", "يسعدنا خدمتك! يرجى اختيار القسم الذي ترغب في التواصل معه مباشرة:", "assistant")]);
  }, []);

  // تحسين نظام انتقال المحادثات: رسالة انتقال واضحة + اختيار موظف عشوائي متاح برسالة ترحيب فريدة
  const initiateDepartmentTransfer = useCallback((dept: Department) => {
    const deptOption = DEPARTMENT_OPTIONS.find(d => d.id === dept);
    setShowDepartmentSelection(false);
    
    // ظهور رسالة الانتقال المطلوبة حرفياً
    setMessages(prev => [...prev, createMessage("system", "يرجى الانتظار، سيتم تحويلك الآن إلى زميلي المختص لمساعدتك بأسرع وقت ممكن.", "assistant")]);
    setChatStatus("typing");
    
    setTimeout(() => {
      const availableAgents = getAvailableAgents(dept);
      if (availableAgents.length > 0) {
        const randomAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)];
        handleAgentTransfer(randomAgent);
      } else {
        setMessages(prev => [...prev, createMessage("system", `عذراً، جميع زملاء قسم ${deptOption?.name} مشغولون حالياً. سيتم الرد على استفسارك في أقرب وقت ممكن.`, "assistant")]);
        setChatStatus("online");
      }
    }, 1500);
  }, [handleAgentTransfer]);

  const sendMessage = useCallback(async () => {
    const trimmedText = text.trim();
    if ((!trimmedText && uploadedFiles.length === 0) || isSendingRef.current) return;

    isSendingRef.current = true;
    
    const fileAttachments: Attachment[] = uploadedFiles.map(f => ({
      type: f.type as AttachmentType, url: f.preview || URL.createObjectURL(f.file),
      fileName: f.file.name, fileSize: formatFileSize(f.file.size), fileType: f.file.type
    }));
    
    setMessages(prev => [...prev, createMessage("user", trimmedText, "user", "sent", fileAttachments.length > 0 ? fileAttachments : undefined)]);
    setText("");
    setUploadedFiles([]);

    if (currentSpeaker === "agent" && currentAgent) {
      setChatStatus("typing");
      setTimeout(() => {
        const smartReply = generateSmartAgentReply(trimmedText, currentAgent, messages);
        setMessages(prev => [...prev, createMessage("agent", smartReply, "assistant")]);
        setChatStatus("online");
        isSendingRef.current = false;
      }, 1200);
      return; 
    }

    setChatStatus("typing");
    try {
      const normalized = normalizeArabicText(trimmedText);
      const isJustGreeting = GREETING_KEYWORDS.some(k => normalized.includes(k)) && normalized.length < 20;

      if (wantsHumanContact(trimmedText) && !showDepartmentSelection && !showAgentTransferMenu) {
        handleHumanRequest(); isSendingRef.current = false; return;
      }

      if (isJustGreeting) {
        setMessages(prev => [...prev, createMessage("bot", EXACT_WELCOME_MESSAGE, "assistant")]);
        setChatStatus("online"); isSendingRef.current = false; return;
      }

      const apiMessages = messages.filter(m => m.sender !== "system").map(m => ({ role: (m.sender === "bot" || m.sender === "agent") ? "assistant" : "user", content: m.text }));
      if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].role !== "user") {
         apiMessages.push({ role: "user", content: trimmedText });
      }

      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      setMessages(prev => [...prev, createMessage("bot", data.text || data.message || "عذراً، لم أتمكن من فهم طلبك بدقة. هل يمكنك إعادة صياغته؟", "assistant", "read", data.attachments || [])]);

    } catch (error) {
      console.error("Chat API Error:", error);
      setMessages(prev => [...prev, createMessage("system", "عذراً، حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.")]);
    } finally {
      setChatStatus("online"); 
      isSendingRef.current = false;
    }
  }, [text, currentSpeaker, currentAgent, showDepartmentSelection, showAgentTransferMenu, handleHumanRequest, messages, initiateDepartmentTransfer, uploadedFiles, chatStatus, handleAgentTransfer]);

  useEffect(() => { saveStateToStorage(); }, [saveStateToStorage]);
  
  useEffect(() => {
    if (!open || messages.length > 0) return;
    const hasSaved = loadStateFromStorage();
    if (!hasSaved) {
      setChatStatus("typing");
      setTimeout(() => {
        setMessages([createMessage("bot", EXACT_WELCOME_MESSAGE, "assistant")]);
        setChatStatus("online");
      }, 800);
    }
  }, [open, messages.length, loadStateFromStorage]);

  const getStatusText = () => {
    if (currentAgent) {
      return currentAgent.status === 'online' ? "متصل الآن" : currentAgent.status === 'busy' ? "مشغول حالياً" : "غير متاح";
    }
    switch (chatStatus) {
      case "typing": return "يكتب الآن..."; 
      case "online": return "متصل الآن";
      case "waiting": return "في قائمة الانتظار..."; 
      case "inactive": return "انتهى مؤقتاً"; 
      case "closed": return "عاد المساعد الذكي"; 
      default: return "غير نشط";
    }
  };

  const getStatusColor = () => {
    if (currentAgent) {
      switch (currentAgent.status) {
        case 'online': return "bg-green-400 animate-pulse";
        case 'busy': return "bg-yellow-400 animate-pulse";
        default: return "bg-gray-400";
      }
    }
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
    const shapeMap: Record<ProductShape, string> = { 'circle': 'w-16 h-16 rounded-full', 'rectangle': 'w-20 h-14 rounded-xl', 'portrait': 'w-14 h-20 rounded-2xl', 'square': 'w-16 h-16 rounded-md' };
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

  const renderAttachments = (attachments: Attachment[]) => {
    return (
      <div className="mt-2 space-y-2">
        {attachments.map((att, idx) => {
          if (att.type === 'image' && att.url) return <img key={idx} src={att.url} alt="attachment" className="rounded-lg max-w-full h-auto border border-gray-600" />;
          if (att.type === 'video' && att.url) return <video key={idx} controls className="rounded-lg max-w-full h-auto border border-gray-600"><source src={att.url} type={att.fileType || 'video/mp4'} />المتصفح لا يدعم تشغيل الفيديو</video>;
          if (att.type === 'file' && att.url) {
            return (
              <a key={idx} href={att.url} download={att.fileName} className="block bg-[#0b0f1a]/50 hover:bg-[#0b0f1a] border border-purple-500/30 rounded-lg p-3 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-purple-300 truncate">{att.fileName}</div>
                    <div className="text-[10px] text-gray-400">{att.fileSize}</div>
                  </div>
                </div>
              </a>
            );
          }
          if ((att.type === 'link' || att.type === 'card' || att.type === 'product') && att.url) {
            return (
              <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="block bg-gradient-to-r from-purple-600/10 to-blue-600/10 hover:from-purple-600/20 hover:to-blue-600/20 border border-purple-500/30 rounded-lg p-3 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    {att.title && <div className="font-bold text-sm text-purple-300 mb-1">{att.title}</div>}
                    {att.description && <div className="text-xs text-gray-400 mb-2">{att.description}</div>}
                    <div className="text-xs text-blue-400 flex items-center gap-1"><span>فتح الرابط</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>
                  </div>
                </div>
              </a>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white font-sans flex flex-col">
      <style jsx global>{`
        @keyframes seamless-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-seamless-scroll { animation: seamless-scroll 50s linear infinite; will-change: transform; }
        .animate-seamless-scroll:hover { animation-play-state: paused; }
        @keyframes slide-in-right { 0% { transform: translateX(100px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes blink-human { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.1); } }
        .animate-blink-human { animation: blink-human 0.12s ease-in-out; transform-origin: center; }
        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }
        
        .scrollbar-hide::-webkit-scrollbar { width: 6px; }
        .scrollbar-hide::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-hide::-webkit-scrollbar-thumb { background-color: rgba(139, 92, 246, 0.3); border-radius: 20px; }
        .scrollbar-hide::-webkit-scrollbar-thumb:hover { background-color: rgba(139, 92, 246, 0.5); }
      `}</style>

      {loadingProgress > 0 && (
        <div className="fixed top-0 right-0 left-0 z-[100] h-1 bg-gray-800/30">
          <div className="absolute top-0 right-0 h-full bg-gradient-to-l from-purple-500 via-blue-500 to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.6)]"
            style={{ width: `${loadingProgress}%`, transition: loadingProgress === 100 ? 'width 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease-out' : 'width 0.4s cubic-bezier(0.25, 1, 0.5, 1)', opacity: loadingProgress === 100 ? 0 : 1 }} />
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
        <div className="flex animate-seamless-scroll w-max">{renderSeamlessItems()}</div>
      </div>

      <main className="container mx-auto px-4 py-8 flex-1">
        <section className="text-center mb-12">
          <div className="youtube-ad-marquee bg-purple-900/30 border border-purple-500/30 rounded-full py-2.5 mb-8 overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0b0f1a] to-transparent z-10 pointer-events-none rounded-r-full"></div>
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0b0f1a] to-transparent z-10 pointer-events-none rounded-l-full"></div>
            <div className="flex whitespace-nowrap animate-seamless-scroll w-max">
              {[...Array(10), ...Array(10)].map((_, i) => (<span key={i} className="mx-8 text-purple-300 text-sm font-semibold flex items-center gap-2"> إعلان حصري: تابعوا أحدث البرامج واللقاءات على قناة مجلة دار النجوم</span>))}
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">مرحبًا بكم في <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">دار النجوم</span></h1>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">منصتكم الإعلامية الأولى لعالم المشاهير والمحتوى الحصري.</p>
        </section>
      </main>

      {/* 
        تعديل واجهة الأيقونة العائمة: 
        تم التأكد من إزالة أي خلفية سوداء. الأيقونة الآن تعتمد فقط على التدرج اللوني البنفسجي/الأزرق 
        مع إضافة bg-transparent للـ SVG لضمان النقاء التام، مع الحفاظ على السحب والإفلات والمكان.
      */}
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
          height: '64px', 
          transform: `translateX(${isIconShifted ? '-100px' : '0px'}) scale(${springScale})`, 
          transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)', 
          boxShadow: isDragging 
            ? '0 20px 25px -5px rgba(147, 51, 234, 0.5), 0 8px 10px -6px rgba(147, 51, 234, 0.5)' 
            : '0 10px 15px -3px rgba(147, 51, 234, 0.3), 0 4px 6px -2px rgba(147, 51, 234, 0.2)' 
        }} 
        title="مركز المساعدة"
      >
        <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center border-2 border-white/20 shadow-lg shadow-purple-500/30 animate-slide-in-right">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="bg-transparent">
            <g style={{ transform: headTransform, transformOrigin: '18px 18px', transition: 'transform 0.3s ease-out' }}>
              <g className={isBlinking ? "animate-blink-human" : ""}>
                <circle cx="12" cy="15" r="5.5" fill="white" />
                <circle cx="12" cy="15" r="2.8" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x + 0.3}px, ${eyePos.y}px)`, transition: 'transform 0.1s linear' }} />
                <circle cx="13.5" cy="13.5" r="1.2" fill="white" opacity="0.9" style={{ transform: `translate(${eyePos.x * 0.3}px, ${eyePos.y * 0.3}px)` }} />
              </g>
              <g className={isBlinking ? "animate-blink-human" : ""} style={{ animationDelay: '0.05s' }}>
                <circle cx="24" cy="15" r="5.5" fill="white" />
                <circle cx="24" cy="15" r="2.8" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x - 0.3}px, ${eyePos.y}px)`, transition: 'transform 0.1s linear' }} />
                <circle cx="25.5" cy="13.5" r="1.2" fill="white" opacity="0.9" style={{ transform: `translate(${eyePos.x * 0.3}px, ${eyePos.y * 0.3}px)` }} />
              </g>
              <path d={chatStatus === "typing" ? "M 11 24 Q 18 31 25 24" : "M 12 24 Q 18 28 24 24"} stroke="white" strokeWidth="2.5" strokeLinecap="round" fill={chatStatus === "typing" ? "white" : "none"} className="transition-all duration-500 ease-in-out" style={{ transformOrigin: '18px 24px' }} />
            </g>
          </svg>
        </div>
      </div>

      <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl transition-all duration-300 z-40 flex flex-col ${open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}>
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
          {currentAgent && !showAgentTransferMenu && (
            <button 
              onClick={() => setShowAgentTransferMenu(true)}
              className="text-xs bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 px-2 py-1 rounded-lg transition-colors border border-purple-500/30"
              title="تحويل لموظف آخر"
            >
              تحويل ↗
            </button>
          )}
        </div>

        <div ref={chatContainerRef} className="h-80 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#0b0f1a]/50" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          {isDragOver && (
            <div className="absolute inset-0 bg-purple-600/20 border-2 border-dashed border-purple-500 rounded-xl flex items-center justify-center z-10">
              <div className="text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-2 text-purple-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <p className="text-purple-300 font-bold">أفلت الملفات هنا</p>
              </div>
            </div>
          )}
          
          {messages.map((msg) => {
            if (msg.sender === "system") return <div key={msg.id} className="flex justify-center my-2"><span className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700 text-center max-w-[90%] whitespace-pre-line">{msg.text}</span></div>;
            const isUser = msg.sender === "user";
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-slide-in-right`}>
                {!isUser && <span className="text-[10px] text-gray-400 mb-1 ml-1">{msg.sender === "agent" && currentAgent ? `${currentAgent.name} (${currentAgent.role})` : "المساعد الذكي"}</span>}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative whitespace-pre-line ${isUser ? "bg-purple-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-purple-500/30 rounded-tl-sm"}`}>
                  {msg.text}
                  {msg.attachments && msg.attachments.length > 0 && renderAttachments(msg.attachments)}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1 flex items-center gap-1">{msg.time}{isUser && <span>{msg.status === "read" ? "✓✓" : "✓"}</span>}</span>
              </div>
            );
          })}

          {/* تحسين ترتيب الخيارات: شبكة أكثر تنظيماً، مسافات أفضل، وأيقونات دائرية خلفية للخيارات */}
          {showDepartmentSelection && currentSpeaker === "bot" && (
            <div className="grid grid-cols-1 gap-3 mt-3 animate-slide-in-right">
              {DEPARTMENT_OPTIONS.map((dept) => (
                <button 
                  key={dept.id} 
                  onClick={() => initiateDepartmentTransfer(dept.id)} 
                  className="w-full text-right bg-[#1f2937]/80 hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500 rounded-xl p-4 transition-all duration-200 group flex items-center gap-4 shadow-sm hover:shadow-purple-500/10"
                >
                  <span className="text-3xl bg-[#0b0f1a] w-12 h-12 rounded-full flex items-center justify-center border border-purple-500/20 group-hover:border-purple-500/50 transition-colors flex-shrink-0">
                    {dept.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-purple-200 group-hover:text-purple-100 mb-1">{dept.name}</div>
                    <div className="text-xs text-gray-400 leading-relaxed">{dept.description}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 group-hover:text-purple-400 transform group-hover:-translate-x-1 transition-all duration-200 flex-shrink-0">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              ))}
            </div>
          )}

          {showAgentTransferMenu && (
            <div className="grid grid-cols-1 gap-2 mt-2 animate-slide-in-right">
              <div className="text-xs text-gray-400 mb-1 px-1">اختر موظفاً متاحاً للتحويل:</div>
              {getAvailableAgents().map((agent) => (
                <button 
                  key={agent.employeeId} 
                  onClick={() => handleAgentTransfer(agent)} 
                  className="w-full text-right bg-[#1f2937] hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500 rounded-xl p-3 transition-all duration-200 group flex items-center gap-3"
                >
                  <img src={agent.img} alt={agent.name} className="w-8 h-8 rounded-full border border-purple-500/50" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-purple-300 group-hover:text-purple-200">{agent.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{agent.role} - {DEPARTMENT_OPTIONS.find(d=>d.id===agent.department)?.name}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                </button>
              ))}
              <button 
                onClick={() => setShowAgentTransferMenu(false)}
                className="text-xs text-gray-500 hover:text-white mt-2 transition-colors"
              >
                إلغاء التحويل
              </button>
            </div>
          )}

          {chatStatus === "typing" && !showDepartmentSelection && !showAgentTransferMenu && (
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

        {uploadedFiles.length > 0 && (
          <div className="p-3 border-t border-gray-700 bg-[#1f2937]/30">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {uploadedFiles.map(file => (
                <div key={file.id} className="relative flex-shrink-0 w-20 h-20 bg-[#0b0f1a] rounded-lg border border-gray-700 overflow-hidden">
                  {file.preview && (file.type === 'image' || file.type === 'video') ? (
                    file.type === 'image' ? <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" /> : <video src={file.preview} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>
                  )}
                  {file.progress < 100 && (<div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="text-xs text-white font-bold">{file.progress}%</div></div>)}
                  <button onClick={() => removeFile(file.id)} className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-gray-700 bg-[#1f2937]/50 rounded-b-2xl">
          <div className="flex gap-2 items-end">
            <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl text-sm font-bold transition mb-0.5 bg-gray-700 text-white hover:bg-gray-600" title="إرفاق ملف">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </button>
            <input ref={fileInputRef} type="file" multiple accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOC_TYPES].join(',')} onChange={(e) => handleFileSelect(e.target.files)} className="hidden" />
            <textarea
              id="chat-input" value={text}
              placeholder={showDepartmentSelection || showAgentTransferMenu ? "يرجى اختيار من القائمة أعلاه..." : "اكتب رسالتك هنا..."}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={1} disabled={showDepartmentSelection || showAgentTransferMenu}
              className="flex-1 bg-[#0b0f1a] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700 placeholder-gray-500 resize-none overflow-y-auto max-h-32 min-h-[42px] leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button onClick={sendMessage} disabled={(!text.trim() && uploadedFiles.length === 0) || chatStatus === "typing" || showDepartmentSelection || showAgentTransferMenu || isSendingRef.current} className="p-3 rounded-xl text-sm font-bold transition mb-0.5 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
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