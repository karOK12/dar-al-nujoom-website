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
  IDLE_TO_CLOSED: 60, 
  QUEUE_CHECK_INTERVAL: 8000,
};

const TRENDING_PRODUCTS: TrendingProduct[] = [
  { id: 1, name: "كاميرا تصوير احترافية", desc: "خصم 25% لفترة محدودة", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&h=150&fit=crop", shape: "circle" },
  { id: 2, name: "سماعات استوديو", desc: "عزل ضوضاء فائق الجودة", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=150&fit=crop", shape: "rectangle" },
  { id: 3, name: "إضاءة Ring Light", desc: "مثالية لصناع المحتوى", img: "https://images.unsplash.com/photo-1615469062329-5f23633c1182?w=150&h=150&fit=crop", shape: "square" },
  { id: 4, name: "ميكروفون بث مباشر", desc: "جودة صوت استثنائية", img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=150&h=200&fit=crop", shape: "portrait" },
];

const WELCOME_MESSAGES = [
  "أهلاً بك، كيف أستطيع مساعدتك اليوم؟",
  "أهلاً وسهلاً بك في دار النجوم، يسعدني مساعدتك.",
  "مرحباً، أنا المساعد الذكي، تفضل بأي استفسار.",
  "أهلاً بك، كيف يمكنني خدمتك اليوم؟"
];

const CLOSING_MESSAGES = [
  "سعدنا بخدمتك، نتمنى لك يوماً سعيداً.",
  "شكراً لتواصلك معنا، نحن دائماً في خدمتك.",
  "إذا احتجت أي مساعدة مستقبلاً فنحن هنا.",
  "نتمنى لك كل التوفيق، ونشكرك على ثقتك بنا."
];

const PRICING_KEYWORDS = ["سعر", "اسعار", "اعلان", "باقة", "كم", "تكلفة", "عروض", "اشتراك", "نشر", "حجز"];
const GREETING_KEYWORDS = ["مرحبا", "هلا", "سلام", "صباح", "مساء", "اهلين", "السلام"];

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
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Advanced Animation & Drag States
  const [iconPos, setIconPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 80 : 0, y: typeof window !== 'undefined' ? window.innerHeight - 80 : 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [springScale, setSpringScale] = useState(1);
  
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  
  const targetEyePos = useRef({ x: 0, y: 0 });
  const currentEyePos = useRef({ x: 0, y: 0 });
  const microSaccade = useRef({ x: 0, y: 0 });
  const chatButtonRef = useRef<HTMLDivElement>(null);
  
  // Drag Refs
  const dragStartPos = useRef({ x: 0, y: 0 });
  const pointerStartPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const currentIconPos = useRef({ x: iconPos.x, y: iconPos.y });
  const targetIconPos = useRef({ x: iconPos.x, y: iconPos.y });

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
  
  const lastWelcomeIndex = useRef<number>(-1);
  const lastClosingIndex = useRef<number>(-1);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { chatStatusRef.current = chatStatus; }, [chatStatus]);

  // ============================================================
  // LOAD SAVED POSITION
  // ============================================================
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPos = localStorage.getItem('chat-icon-pos');
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          // Validate bounds
          const x = Math.min(Math.max(parsed.x, 10), window.innerWidth - 74);
          const y = Math.min(Math.max(parsed.y, 10), window.innerHeight - 74);
          setIconPos({ x, y });
          currentIconPos.current = { x, y };
          targetIconPos.current = { x, y };
        } catch (e) {
          console.error("Failed to parse icon position", e);
        }
      }
    }
  }, []);

  // ============================================================
  // شريط التحميل العلوي
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

    const fallback = setTimeout(() => {
      if (!isComplete) {
        isComplete = true;
        setLoadingProgress(100);
        setTimeout(() => setLoadingProgress(0), 600);
      }
    }, 10000);

    return () => {
      document.removeEventListener('readystatechange', handleReadyState);
      window.removeEventListener('load', handleLoad);
      clearTimeout(fallback); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  // ============================================================
  // ADVANCED ANIMATION LOOP (Eyes + Drag Spring)
  // ============================================================
  useEffect(() => {
    let rafId: number;
    let time = 0;
    
    const animate = () => {
      time += 0.015;
      
      // 1. Icon Spring Animation (Smooth return to scale 1)
      const targetScale = isDragging ? 1.15 : 1.0;
      const currentScale = springScale; // We'll update state less frequently to avoid React overhead, but we can use a ref for smooth CSS if needed. 
      // For React, we'll update state only if difference is significant, or use a direct DOM ref for max performance.
      // Let's use direct DOM manipulation for the drag transform to guarantee 60fps without React render cycles.
      
      // 2. Micro-saccades (Random tiny eye movements every ~2 seconds)
      if (Math.random() < 0.008) {
        microSaccade.current = { 
          x: (Math.random() - 0.5) * 0.8, 
          y: (Math.random() - 0.5) * 0.8 
        };
      }

      // 3. Smooth Eye Interpolation (Lerp) with Inertia
      currentEyePos.current.x += (targetEyePos.current.x - currentEyePos.current.x) * 0.08;
      currentEyePos.current.y += (targetEyePos.current.y - currentEyePos.current.y) * 0.08;
      
      setEyePos({ 
        x: currentEyePos.current.x + microSaccade.current.x, 
        y: currentEyePos.current.y + microSaccade.current.y 
      });

      // 4. Smooth Icon Position Interpolation (for spring back)
      if (!isDragging) {
        currentIconPos.current.x += (targetIconPos.current.x - currentIconPos.current.x) * 0.15;
        currentIconPos.current.y += (targetIconPos.current.y - currentIconPos.current.y) * 0.15;
        
        // Update React state only when close enough to stop re-rendering constantly, or use a ref for the style
        if (Math.abs(currentIconPos.current.x - targetIconPos.current.x) < 0.5 && 
            Math.abs(currentIconPos.current.y - targetIconPos.current.y) < 0.5) {
          currentIconPos.current.x = targetIconPos.current.x;
          currentIconPos.current.y = targetIconPos.current.y;
        }
        setIconPos({ x: currentIconPos.current.x, y: currentIconPos.current.y });
        setSpringScale(prev => prev + (targetScale - prev) * 0.15);
      }

      rafId = requestAnimationFrame(animate);
    };
    
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isDragging]);

  // Mouse Tracking with Polar Coordinates & Human-like Constraints
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!chatButtonRef.current || isDragging) return;
      
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const rect = chatButtonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      
      const angle = Math.atan2(dy, dx);
      const distance = Math.min(Math.hypot(dx, dy), 300); // 300px influence radius
      
      // Eye radius is 5.5, pupil is 2.8. Max move = 5.5 - 2.8 - 0.5 (padding) = 2.2px
      // This guarantees white is ALWAYS visible.
      const maxPupilMove = 2.2;
      const moveDist = (distance / 300) * maxPupilMove;
      
      let targetX = Math.cos(angle) * moveDist;
      let targetY = Math.sin(angle) * moveDist;

      // Typing/Thinking state: look up slightly
      if (chatStatusRef.current === "typing") {
        targetY -= 0.8;
      }

      targetEyePos.current = { x: targetX, y: targetY };
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleMouseMove);
    };
  }, [isDragging]);

  // Natural Blinking & Idle Glances
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    let idleTimeout: NodeJS.Timeout;
    
    const scheduleBlink = () => {
      const randomDelay = 2000 + Math.random() * 4000;
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 120);
      }, randomDelay);
    };

    const scheduleIdleGlance = () => {
      if (!isDragging && chatStatusRef.current === "online") {
        const randomDelay = 5000 + Math.random() * 5000;
        idleTimeout = setTimeout(() => {
          // Look slightly to a random direction
          const angle = Math.random() * Math.PI * 2;
          const dist = 1.0 + Math.random() * 1.0;
          targetEyePos.current = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
          
          setTimeout(() => {
            targetEyePos.current = { x: 0, y: 0 }; // Return to center
          }, 1000 + Math.random() * 1000);
          
          scheduleIdleGlance();
        }, randomDelay);
      }
    };
    
    scheduleBlink();
    scheduleIdleGlance();
    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(idleTimeout);
    };
  }, [isDragging]);

  // ============================================================
  // DRAG & DROP LOGIC (Pointer Events for Mouse + Touch)
  // ============================================================
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); // Prevent default touch behaviors
    setIsDragging(true);
    hasDragged.current = false;
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { x: currentIconPos.current.x, y: currentIconPos.current.y };
    
    // Capture pointer to ensure we don't lose drag if mouse moves fast
    chatButtonRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - pointerStartPos.current.x;
    const deltaY = e.clientY - pointerStartPos.current.y;
    
    // Threshold to distinguish between click and drag
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasDragged.current = true;
    }
    
    if (hasDragged.current) {
      let newX = dragStartPos.current.x + deltaX;
      let newY = dragStartPos.current.y + deltaY;
      
      // Boundary Clamping (Keep within screen, assuming 64px icon size + 10px margin)
      const maxX = window.innerWidth - 74;
      const maxY = window.innerHeight - 74;
      
      newX = Math.max(10, Math.min(newX, maxX));
      newY = Math.max(10, Math.min(newY, maxY));
      
      targetIconPos.current = { x: newX, y: newY };
      currentIconPos.current = { x: newX, y: newY }; // Direct update during drag for 1:1 responsiveness
      setIconPos({ x: newX, y: newY });
    }
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    chatButtonRef.current?.releasePointerCapture(e.pointerId);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('chat-icon-pos', JSON.stringify(targetIconPos.current));
    }
  }, [isDragging]);

  const handleClick = useCallback(() => {
    // Only toggle chat if it was a genuine click, not the end of a drag
    if (!hasDragged.current) {
      setOpen(prev => !prev);
    }
    hasDragged.current = false; // Reset for next time
  }, []);

  // ============================================================
  // LOCAL STORAGE & SESSION LOGIC
  // ============================================================
  const saveStateToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('dar-alnujum-chat-state', JSON.stringify({
        messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, isQueued
      }));
    } catch (e) { console.error('Save state error:', e); }
  }, [messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, isQueued]);

  const getRandomMessage = (array: string[], lastIdxRef: React.MutableRefObject<number>) => {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * array.length);
    } while (newIndex === lastIdxRef.current && array.length > 1);
    lastIdxRef.current = newIndex;
    return array[newIndex];
  };

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

  useEffect(() => {
    if (currentSpeaker === "agent" || currentSpeaker === "bot") {
      if (chatStatus === "inactive") setChatStatus("online");
    }
  }, [messages, currentSpeaker]);

  useEffect(() => {
    if (currentSpeaker !== "agent") return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - lastActivityTimeRef.current) / 1000;
      if (elapsedSeconds >= SESSION_TIMEOUTS.IDLE_TO_CLOSED) {
        setMessages(prev => [...prev, createMessage("system", "تم إنهاء جلسة الموظف بسبب عدم وجود رد من المستخدم، ويمكنك متابعة المحادثة مع المساعد الذكي.", "assistant")]);
        setCurrentSpeaker("bot");
        setCurrentAgent(null);
        setSessionAgents([]);
        setChatStatus("online");
        conversationPhaseRef.current = "initial";
        lastHandledTopicRef.current = null;
        lastActivityTimeRef.current = Date.now();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentSpeaker]);

  const closeAgentSession = useCallback(() => {
    const closingMsg = getRandomMessage(CLOSING_MESSAGES, lastClosingIndex);
    setMessages(prev => [...prev, createMessage("agent", closingMsg, "assistant")]);
    
    setTimeout(() => {
      const freshWelcome = getRandomMessage(WELCOME_MESSAGES, lastWelcomeIndex);
      setMessages([createMessage("bot", freshWelcome, "assistant")]);
      setCurrentSpeaker("bot");
      setCurrentAgent(null);
      setSessionAgents([]);
      setIsQueued(false);
      setShowDepartmentSelection(false);
      setChatStatus("online");
      lastActivityTimeRef.current = Date.now();
      previousAgentRepliesRef.current.clear();
      awaitingFinalConfirmationRef.current = false;
      conversationContextRef.current = [];
      lastHandledTopicRef.current = null;
      conversationPhaseRef.current = "initial";
      lastAgentMessageRef.current = "";
      messageCountRef.current = 0;
      if (typeof window !== "undefined") localStorage.removeItem("dar-alnujum-chat-state");
    }, 2500);
  }, []);

  const startAgentSession = useCallback((agent: Agent) => {
    setCurrentAgent(agent);
    setSessionAgents(prev => prev.find(a => a.employeeId === agent.employeeId) ? prev : [...prev, agent]);
    setCurrentSpeaker("agent");
    setIsQueued(false);
    setShowDepartmentSelection(false);
    previousAgentRepliesRef.current.clear();
    awaitingFinalConfirmationRef.current = false;
    conversationContextRef.current = [];
    lastHandledTopicRef.current = null;
    conversationPhaseRef.current = "initial";
    lastAgentMessageRef.current = "";
    messageCountRef.current = 0;
    
    setMessages(prev => [...prev, createMessage("agent", `أهلاً بك، أنا ${agent.name} (${agent.role}). تفضل، كيف يمكنني مساعدتك؟`, "assistant")]);
    setChatStatus("online");
    lastActivityTimeRef.current = Date.now();
  }, []);

  const handleHumanRequest = useCallback(() => {
    setShowDepartmentSelection(true);
    setChatStatus("online");
    setMessages(prev => [...prev, createMessage("system", "يرجى اختيار القسم الذي ترغب في التواصل معه:")]);
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

  const performInternalTransfer = useCallback((targetDept: Department, currentAgentName: string) => {
    const targetAgent = findAvailableAgent(targetDept) || SUPPORT_AGENTS.find(a => a.department === targetDept);
    if (!targetAgent) return;

    setMessages(prev => [...prev, createMessage("agent", `لحظة واحدة، سأحولك الآن إلى زميلي المختص بهذا النوع من الطلبات.`, "assistant")]);
    
    setTimeout(() => {
      setSessionAgents(prev => prev.find(a => a.employeeId === targetAgent!.employeeId) ? prev : [...prev, targetAgent!]);
      setCurrentAgent(targetAgent);
      awaitingFinalConfirmationRef.current = false;
      conversationContextRef.current = [];
      lastHandledTopicRef.current = null;
      conversationPhaseRef.current = "initial";
      lastAgentMessageRef.current = "";
      messageCountRef.current = 0;
      
      setTimeout(() => {
        setMessages(prev => [...prev, createMessage("agent", `مرحباً، أنا ${targetAgent!.name} من قسم ${targetDept === 'ads' ? 'الإعلانات' : targetDept === 'technical' ? 'الدعم الفني' : 'خدمة العملاء'}. اطلعت على كامل المحادثة بينك وبين الأستاذ ${currentAgentName}، وسأتابع معك من هذه النقطة. كيف أقدر أساعدك؟`, "assistant")]);
        setChatStatus("online");
        isSendingRef.current = false;
        lastActivityTimeRef.current = Date.now();
      }, 1000);
    }, 1500);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingRef.current) return;

    isSendingRef.current = true;
    setMessages(prev => [...prev, createMessage("user", trimmedText, "user", "sent")]);
    setText("");
    lastActivityTimeRef.current = Date.now();
    conversationContextRef.current.push(trimmedText);
    if (conversationContextRef.current.length > 5) conversationContextRef.current.shift();

    if (checkAndPerformEscalation(trimmedText)) {
      isSendingRef.current = false;
      return;
    }

    if (currentSpeaker === "agent" && currentAgent) {
      setChatStatus("typing");
      setTimeout(() => {
        const normalized = normalizeArabicText(trimmedText);
        const currentDept = currentAgent.department;
        messageCountRef.current += 1;

        const closingKeywords = ["لا", "شكرا", "شكراً", "هذا كل شيء", "انتهيت", "خلاص", "لا شكرا", "لا احتاج"];
        if (closingKeywords.some(k => normalized.includes(k)) && normalized.length < 20 && (conversationPhaseRef.current === "closing" || conversationPhaseRef.current === "ongoing")) {
          closeAgentSession();
          isSendingRef.current = false;
          return;
        }

        if (currentDept === 'ads') {
          const hasPricingIntent = PRICING_KEYWORDS.some(k => normalized.includes(k));
          const hasCustomIntent = normalized.includes("مخصص") || normalized.includes("حملة") || normalized.includes("ميزانية");

          if (hasPricingIntent) {
            if (hasCustomIntent && lastHandledTopicRef.current !== 'custom_inquiry') {
              lastHandledTopicRef.current = 'custom_inquiry';
              const customReply = "ممتاز، لكي أقدم لك عرض سعر دقيق ومخصص، أحتاج إلى معرفة بعض التفاصيل:\n1. نوع النشاط أو المنتج.\n2. مدة الحملة المطلوبة.\n3. المنصة المفضلة.\n4. الميزانية التقريبية.\n5. الدولة أو المنطقة المستهدفة.\n\nبمجرد تزويدي بهذه التفاصيل، سأقوم بإعداد العرض الأنسب لك فوراً.";
              previousAgentRepliesRef.current.add(customReply);
              setMessages(prev => [...prev, createMessage("agent", customReply, "assistant")]);
              conversationPhaseRef.current = "clarifying";
              lastAgentMessageRef.current = customReply;
              isSendingRef.current = false;
              return;
            }
            
            if (lastHandledTopicRef.current !== 'pricing_details') {
              lastHandledTopicRef.current = 'pricing_details';
              const pricingReply = `أهلاً بك أستاذ. إليك ملخص باقاتنا الإعلانية الأساسية:

🔹 الباقة الأسبوعية: 135 دولار (50,000 ظهور، منصتين).
🔹 الباقة الشهرية: 405 دولار (200,000 ظهور، 3 منصات).
🔹 الباقة الاحترافية: 810 دولار (500,000+ ظهور، جميع المنصات مع مدير حساب).

هل تود حجز إحدى هذه الباقات، أم تفضل أن نصمم لك عرضاً مخصصاً حسب ميزانيتك؟`;
              previousAgentRepliesRef.current.add(pricingReply);
              setMessages(prev => [...prev, createMessage("agent", pricingReply, "assistant")]);
              conversationPhaseRef.current = "ongoing";
              lastAgentMessageRef.current = pricingReply;
              isSendingRef.current = false;
              return;
            }
          }
        }

        const isGratitude = normalized.includes("شكر") || normalized.includes("مشكور") || normalized.includes("يسلمو") || normalized.includes("ممتاز");
        if (isGratitude && conversationPhaseRef.current !== "closing" && conversationPhaseRef.current !== "ended") {
          const gratitudeReplies = ["العفو أستاذ، هذا واجبنا.", "تدلل أستاذ، يسعدني أن تم حل الأمر.", "بالعفو أستاذ، تحت أمرك بأي وقت."];
          const gratitudeReply = gratitudeReplies[Math.floor(Math.random() * gratitudeReplies.length)];
          previousAgentRepliesRef.current.add(gratitudeReply);
          setMessages(prev => [...prev, createMessage("agent", gratitudeReply, "assistant")]);
          
          setTimeout(() => {
            const followUp = "هل هناك أي استفسار آخر أقدر أساعدك فيه؟";
            previousAgentRepliesRef.current.add(followUp);
            setMessages(prev => [...prev, createMessage("agent", followUp, "assistant")]);
            awaitingFinalConfirmationRef.current = true;
            conversationPhaseRef.current = "closing";
            lastAgentMessageRef.current = followUp;
            setChatStatus("online");
            isSendingRef.current = false;
          }, 1000);
          return;
        }

        if (normalized.includes("مشكله") || normalized.includes("خطأ") || normalized.includes("لا يعمل")) {
          if (currentDept === 'technical') {
            if (lastHandledTopicRef.current !== 'technical_details') {
                lastHandledTopicRef.current = 'technical_details';
                const techReply = "حاضر، يسعدني مساعدتك. لكي أتمكن من فحص الأمر بدقة، هل يمكنك تزويدي برقم الطلب أو وصف تفصيلي للخطأ الذي يظهر لك؟";
                previousAgentRepliesRef.current.add(techReply);
                setMessages(prev => [...prev, createMessage("agent", techReply, "assistant")]);
                conversationPhaseRef.current = "clarifying";
                lastAgentMessageRef.current = techReply;
                isSendingRef.current = false;
                return;
            }
          } else {
            setMessages(prev => [...prev, createMessage("agent", "العفو أستاذ، هذا الطلب يخص قسم الدعم الفني. سأحولك الآن إلى زميلي المختص.", "assistant")]);
            setTimeout(() => performInternalTransfer('technical', currentAgent.name), 1000);
            isSendingRef.current = false;
            return;
          }
        }

        const generalReplies = currentDept === 'ads' 
          ? ["بكل سرور. كيف يمكنني مساعدتك في اختيار الباقة الأنسب لمتجرك؟", "حاضر، أنا معك. هل لديك ميزانية محددة في ذهنك لنبدأ منها؟"]
          : currentDept === 'technical'
          ? ["حاضر، أنا أتابع معك. يرجى تزويدي بأي تفاصيل إضافية عن المشكلة.", "أكيد، سأقوم بمساعدتك. هل يمكنك توضيح المشكلة أكثر؟"]
          : ["بكل سرور. تفضل، أنا أستمع إليك وسأقوم باللازم فوراً.", "حاضر، يسعدني خدمتك. كيف أقدر أساعدك؟"];
        
        const agentReply = generalReplies[Math.floor(Math.random() * generalReplies.length)];
        previousAgentRepliesRef.current.add(agentReply);
        setMessages(prev => [...prev, createMessage("agent", agentReply, "assistant")]);
        lastAgentMessageRef.current = agentReply;
        conversationPhaseRef.current = "ongoing";
        isSendingRef.current = false;
      }, 1500);
      return; 
    }

    setChatStatus("typing");
    try {
      const normalized = normalizeArabicText(trimmedText);
      const isGreeting = GREETING_KEYWORDS.some(k => normalized.includes(k));
      const hasPricingIntent = PRICING_KEYWORDS.some(k => normalized.includes(k));

      if (isGreeting && !hasPricingIntent) {
        setMessages(prev => [...prev, createMessage("bot", getRandomMessage(WELCOME_MESSAGES, lastWelcomeIndex), "assistant")]);
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
      
      setMessages(prev => [...prev, createMessage("bot", data.text || data.message || "عذراً، لم أتمكن من فهم طلبك بدقة.", "assistant", "read", data.attachments || data.products || data.cards || [])]);

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
  }, [text, currentSpeaker, currentAgent, checkAndPerformEscalation, showDepartmentSelection, handleHumanRequest, messages, performInternalTransfer, closeAgentSession]);

  useEffect(() => { saveStateToStorage(); }, [saveStateToStorage]);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    const hasSaved = loadStateFromStorage();
    if (!hasSaved) {
      setChatStatus("typing");
      setTimeout(() => {
        setMessages([createMessage("bot", getRandomMessage(WELCOME_MESSAGES, lastWelcomeIndex), "assistant")]);
        setChatStatus("online");
      }, 800);
    }
  }, [open, messages.length, loadStateFromStorage]);

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
        
        @keyframes blink-human {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.1); }
        }
        .animate-blink-human { 
          animation: blink-human 0.12s ease-in-out; 
          transform-origin: center;
        }
        
        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }
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

      {/* Draggable AI Avatar Icon */}
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
          transform: `scale(${springScale})`,
          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: isDragging 
            ? '0 20px 25px -5px rgba(147, 51, 234, 0.5), 0 8px 10px -6px rgba(147, 51, 234, 0.5)' 
            : '0 10px 15px -3px rgba(147, 51, 234, 0.3), 0 4px 6px -2px rgba(147, 51, 234, 0.2)'
        }}
        title="مركز المساعدة"
      >
        <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center border-2 border-white/10 animate-slide-in-right">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g>
              {/* العين اليسرى */}
              <g className={isBlinking ? "animate-blink-human" : ""}>
                <circle cx="12" cy="15" r="5.5" fill="white" />
                <circle cx="12" cy="15" r="2.8" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x + 0.3}px, ${eyePos.y}px)`, transition: 'transform 0.1s linear' }} />
                <circle cx="13.5" cy="13.5" r="1.2" fill="white" opacity="0.9" style={{ transform: `translate(${eyePos.x * 0.3}px, ${eyePos.y * 0.3}px)` }} />
              </g>
              
              {/* العين اليمنى */}
              <g className={isBlinking ? "animate-blink-human" : ""} style={{ animationDelay: '0.05s' }}>
                <circle cx="24" cy="15" r="5.5" fill="white" />
                <circle cx="24" cy="15" r="2.8" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x - 0.3}px, ${eyePos.y}px)`, transition: 'transform 0.1s linear' }} />
                <circle cx="25.5" cy="13.5" r="1.2" fill="white" opacity="0.9" style={{ transform: `translate(${eyePos.x * 0.3}px, ${eyePos.y * 0.3}px)` }} />
              </g>

              {/* الفم */}
              <path 
                d={chatStatus === "typing" ? "M 11 24 Q 18 31 25 24" : "M 12 24 Q 18 28 24 24"}
                stroke="white" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                fill={chatStatus === "typing" ? "white" : "none"}
                className="transition-all duration-500 ease-in-out"
                style={{ transformOrigin: '18px 24px' }}
              />
            </g>
          </svg>
        </div>
      </div>

      {/* صندوق الدردشة */}
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
        </div>

        <div className="h-80 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#0b0f1a]/50">
          {messages.map((msg) => {
            if (msg.sender === "system") {
              return <div key={msg.id} className="flex justify-center my-2"><span className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700 text-center max-w-[90%] whitespace-pre-line">{msg.text}</span></div>;
            }
            const isUser = msg.sender === "user";
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                {!isUser && <span className="text-[10px] text-gray-400 mb-1 ml-1">{msg.sender === "agent" && currentAgent ? `${currentAgent.name} (${currentAgent.role})` : "المساعد الذكي"}</span>}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative whitespace-pre-line ${isUser ? "bg-purple-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-purple-500/30 rounded-tl-sm"}`}>
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
            <div className="space-y-2 mt-2 animate-slide-in-right">
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
            <button onClick={sendMessage} disabled={!text.trim() || chatStatus === "typing" || showDepartmentSelection || isSendingRef.current} className="p-3 rounded-xl text-sm font-bold transition mb-0.5 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
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