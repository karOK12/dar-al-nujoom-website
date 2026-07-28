"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

type Sender = "user" | "bot" | "agent" | "system";

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
  department: 'support' | 'ads' | 'technical';
}

const supportAgents: Agent[] = [
  { employeeId: "EMP-TEMP-001", name: "خالد", img: "https://i.pravatar.cc/150?img=68", role: "خدمة العملاء", department: 'support' },
  { employeeId: "EMP-TEMP-002", name: "نورة", img: "https://i.pravatar.cc/150?img=44", role: "دعم فني متقدم", department: 'technical' },
  { employeeId: "EMP-TEMP-003", name: "سارة", img: "https://i.pravatar.cc/150?img=47", role: "مسؤولة الإعلانات", department: 'ads' }
];

const trendingProducts = [
  { id: 1, name: "كاميرا تصوير احترافية", desc: "خصم 25% لفترة محدودة", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&h=150&fit=crop", shape: "circle" },
  { id: 2, name: "سماعات استوديو", desc: "عزل ضوضاء فائق الجودة", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=150&fit=crop", shape: "rectangle" },
  { id: 3, name: "إضاءة Ring Light", desc: "مثالية لصناع المحتوى", img: "https://images.unsplash.com/photo-1615469062329-5f23633c1182?w=150&h=150&fit=crop", shape: "square" },
  { id: 4, name: "ميكروفون بث مباشر", desc: "جودة صوت استثنائية", img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=150&h=200&fit=crop", shape: "portrait" },
];

type ChatStatus = "typing" | "online" | "idle" | "ended";

const welcomeMessages = [
  "أهلاً! كيف أقدر أساعدك اليوم؟",
  "مرحباً، تفضل كيف أخدمك؟",
  "هلا والله، أمر؟",
  "أهلاً وسهلاً، شو تحتاج؟",
  "مرحبتين، أنا بخدمتك."
];

const agentWelcomeMessages: Record<string, string[]> = {
  "EMP-TEMP-001": ["أهلاً، أنا خالد من خدمة العملاء. كيف أقدر أساعدك؟", "مرحباً، خالد معك. تفضل ما تحتاجه.", "هلا، خالد بخدمتك. شو استفسارك؟"],
  "EMP-TEMP-002": ["أهلاً، أنا نورة من الدعم الفني. شو المشكلة اللي تواجهها؟", "مرحباً، نورة معك. خلني أساعدك تحل المشكلة.", "هلا، نورة من الدعم الفني. تفضل اشرح لي المشكلة."],
  "EMP-TEMP-003": ["أهلاً، أنا سارة من قسم الإعلانات. كيف أقدر أخدمك؟", "مرحباً، سارة معك. تفضل بخصوص الإعلان.", "هلا، سارة من الإعلانات. شو نوع الخدمة اللي تبحث عنها؟"]
};

const agentReturnMessages = [
  "أنا موجود، تفضل.",
  "رجعت معك، أكمل.",
  "أنا هنا، كيف أقدر أساعدك؟",
  "تفضل، أنا معك."
];

const closingMessages = [
  "شكراً لك، سعدت بخدمتك.",
  "يسعدنا خدمتك دائماً.",
  "أهلاً بك في أي وقت.",
  "نتمنى لك يوماً سعيداً.",
  "إذا احتجت أي مساعدة فنحن هنا.",
  "مع السلامة، حفظك الله.",
  "في أمان الله، نتمنى أن نراك قريباً.",
  "كل التوفيق لك، يومك سعيد."
];

const thanksResponses = [
  "العفو، سعدت بخدمتك. هل يوجد أي شيء آخر أستطيع مساعدتك به؟",
  "لا شكر على واجب. هل تحتاج مساعدة في شيء آخر؟",
  "العفو، هذا واجبي. هل في شي ثاني أقدر أساعدك فيه؟",
  "تسلم، يسعدني خدمتك. هل عندك استفسار ثاني؟"
];

const politeEndResponses = [
  "تمام، سعدت بخدمتك. مع السلامة!",
  "حسناً، نتمنى لك يوماً سعيداً. في أمان الله.",
  "العفو، إذا احتجتنا مرة ثانية نحن هنا. مع السلامة.",
  "تمام، حفظك الله. نتمنى أن نراك قريباً."
];

const transferMessages = {
  support: "جاري تحويلك لموظف خدمة العملاء...",
  ads: "جاري تحويلك لقسم الإعلانات...",
  technical: "جاري تحويلك للدعم الفني..."
};

interface PricingInfo {
  basePrice?: number;
  range?: { min: number; max: number };
  unit?: string;
  needsDetails?: boolean;
  detailsQuestions?: string[];
}

const pricingSystem: Record<string, PricingInfo> = {
  "banner-ad": { range: { min: 500, max: 5000 }, unit: "ريال/أسبوع", needsDetails: true, detailsQuestions: ["المدة المطلوبة؟", "حجم البانر؟", "مكان الظهور؟"] },
  "video-ad": { range: { min: 1500, max: 15000 }, unit: "ريال/فيديو", needsDetails: true, detailsQuestions: ["مدة الفيديو؟", "نوع الإنتاج؟"] },
  "sponsored-post": { range: { min: 300, max: 3000 }, unit: "ريال/منشور", needsDetails: true, detailsQuestions: ["نوع المحتوى؟", "المنصة المستهدفة؟"] },
  "full-campaign": { range: { min: 5000, max: 50000 }, unit: "ريال/حملة", needsDetails: true, detailsQuestions: ["الميزانية المتاحة؟", "الجمهور المستهدف؟", "مدة الحملة؟"] },
  "technical-support": { basePrice: 0, unit: "مجاني" },
  "general-inquiry": { needsDetails: true, detailsQuestions: ["ممكن توضيح أكثر عن الخدمة المطلوبة؟"] }
};

interface MessagesTracker {
  welcome: Set<number>;
  agents: Record<string, Set<number>>;
  closing: Set<number>;
  thanks: Set<number>;
  politeEnd: Set<number>;
}

const usedMessagesTracker: MessagesTracker = {
  welcome: new Set(),
  agents: {},
  closing: new Set(),
  thanks: new Set(),
  politeEnd: new Set()
};

const getRandomUniqueMessage = (messages: string[], category: keyof MessagesTracker, subCategory?: string): string => {
  if (category === 'welcome' || category === 'closing' || category === 'thanks' || category === 'politeEnd') {
    const tracker = usedMessagesTracker[category];
    if (tracker.size >= messages.length) tracker.clear();
    let randomIndex: number;
    do { randomIndex = Math.floor(Math.random() * messages.length); } while (tracker.has(randomIndex));
    tracker.add(randomIndex);
    return messages[randomIndex];
  } else {
    const key = subCategory || 'default';
    if (!usedMessagesTracker.agents[key]) usedMessagesTracker.agents[key] = new Set();
    const tracker = usedMessagesTracker.agents[key];
    if (tracker.size >= messages.length) tracker.clear();
    let randomIndex: number;
    do { randomIndex = Math.floor(Math.random() * messages.length); } while (tracker.has(randomIndex));
    tracker.add(randomIndex);
    return messages[randomIndex];
  }
};

export default function Home() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  
  const [currentSpeaker, setCurrentSpeaker] = useState<"bot" | "agent">("bot");
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [sessionAgents, setSessionAgents] = useState<Agent[]>([]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("online");
  const [hasInteractedWithCurrentAgent, setHasInteractedWithCurrentAgent] = useState(false);
  const [awaitingFollowUp, setAwaitingFollowUp] = useState(false);
  
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [headTilt, setHeadTilt] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const [isLookingAtUser, setIsLookingAtUser] = useState(false);
  
  const eyeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);

  const scrollToBottom = useCallback((smooth: boolean = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, chatStatus, scrollToBottom]);

  const loadStateFromStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('dar-alnujum-chat-state');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          if (parsedState.chatStatus === "ended" || (parsedState.currentSpeaker === "bot" && (!parsedState.messages || parsedState.messages.length === 0))) {
            localStorage.removeItem('dar-alnujum-chat-state');
            return false;
          }
          setMessages(parsedState.messages || []);
          setCurrentSpeaker(parsedState.currentSpeaker || "bot");
          setCurrentAgent(parsedState.currentAgent || null);
          setSessionAgents(parsedState.sessionAgents || []);
          setChatStatus(parsedState.chatStatus || "online");
          setHasInteractedWithCurrentAgent(parsedState.hasInteractedWithCurrentAgent || false);
          resetIdleTimer();
          return true; 
        } catch (e) { 
          localStorage.removeItem('dar-alnujum-chat-state');
        }
      }
    }
    return false; 
  }, []);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  const handleIconMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isLookingAtUser) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);
    
    setEyePos({ 
      x: Math.max(-3.5, Math.min(3.5, deltaX * 3.5)), 
      y: Math.max(-3.5, Math.min(3.5, deltaY * 3.5)) 
    });
    setHeadTilt(deltaX * 1.5);
  }, [isLookingAtUser]);

  const handleIconMouseLeave = useCallback(() => {
    if (isLookingAtUser) return;
    setEyePos({ x: 0, y: 0 });
    setHeadTilt(0);
    startRandomEyeMovement();
  }, [isLookingAtUser]);

  const startRandomEyeMovement = useCallback(() => {
    if (eyeTimerRef.current) clearInterval(eyeTimerRef.current);
    eyeTimerRef.current = setInterval(() => {
      if (!open || Math.random() > 0.3 || isLookingAtUser) {
        setEyePos({ 
          x: (Math.random() - 0.5) * 5, 
          y: (Math.random() - 0.5) * 3 
        });
        setHeadTilt((Math.random() - 0.5) * 2.5);
      }
    }, 3000 + Math.random() * 2000);
  }, [open, isLookingAtUser]);

  const scheduleBlink = useCallback(() => {
    const delay = 3000 + Math.random() * 3000;
    blinkTimerRef.current = setTimeout(() => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        if (Math.random() < 0.25) {
          setTimeout(() => {
            setIsBlinking(true);
            setTimeout(() => {
              setIsBlinking(false);
              scheduleBlink();
            }, 140);
          }, 180);
        } else {
          scheduleBlink();
        }
      }, 140);
    }, delay);
  }, []);

  useEffect(() => {
    startRandomEyeMovement();
    scheduleBlink();
    return () => {
      if (eyeTimerRef.current) clearInterval(eyeTimerRef.current);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [startRandomEyeMovement, scheduleBlink]);

  useEffect(() => {
    if (open) {
      setJustOpened(true);
      setIsLookingAtUser(true);
      setEyePos({ x: 0, y: 0 });
      setHeadTilt(0);
      
      const lookTimer = setTimeout(() => {
        setIsLookingAtUser(false);
        setJustOpened(false);
        startRandomEyeMovement();
      }, 1500);
      
      return () => clearTimeout(lookTimer);
    }
  }, [open, startRandomEyeMovement]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (currentSpeaker === "agent" && chatStatus !== "ended") {
      idleTimerRef.current = setTimeout(() => {
        initiateEmployeeExit(true);
      }, 59000);
    }
  }, [currentSpeaker, chatStatus]);

  const initiateEmployeeExit = useCallback((dueToInactivity: boolean = false) => {
    setChatStatus("typing");
    const closingMsg = getRandomUniqueMessage(closingMessages, 'closing');
    
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      sender: "agent",
      role: "assistant",
      text: closingMsg,
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      status: "read"
    }]);

    setTimeout(() => {
      if (dueToInactivity) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: "system",
          text: "انتهت جلسة الموظف بسبب عدم وجود أي رد من المستخدم لمدة 59 ثانية، وتم تحويلك تلقائياً إلى المساعد الذكي.",
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          status: "read"
        }]);
      }

      setCurrentSpeaker("bot");
      setCurrentAgent(null);
      setSessionAgents([]);
      setHasInteractedWithCurrentAgent(false);
      setAwaitingFollowUp(false);
      setChatStatus("online");
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('dar-alnujum-chat-state');
      }

      setChatStatus("typing");
      setIsLoading(true);
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: "welcome-new-" + Date.now(),
          sender: "bot",
          role: "assistant",
          text: getRandomUniqueMessage(welcomeMessages, 'welcome'),
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          status: "read"
        }]);
        setChatStatus("online");
        setIsLoading(false);
      }, 800);
    }, 2000);
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      const hasSavedState = loadStateFromStorage();
      if (!hasSavedState) {
        setChatStatus("typing");
        setIsLoading(true);
        setTimeout(() => {
          setMessages([{
            id: "welcome-1", sender: "bot", role: "assistant",
            text: getRandomUniqueMessage(welcomeMessages, 'welcome'),
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
            status: "read"
          }]);
          setChatStatus("online");
          setIsLoading(false);
        }, 800);
      }
    }
  }, [open, loadStateFromStorage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentSpeaker === "agent" && chatStatus !== "ended" && messages.length > 0) {
      localStorage.setItem('dar-alnujum-chat-state', JSON.stringify({
        messages, currentSpeaker, currentAgent, sessionAgents, chatStatus, hasInteractedWithCurrentAgent
      }));
    }
  }, [messages, currentAgent, sessionAgents, currentSpeaker, chatStatus, hasInteractedWithCurrentAgent]);

  const wantsHumanContact = useCallback((text: string): boolean => {
    const t = text.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    return ["حولني لموظف", "اتواصل مع الدعم", "اكلم شخص", "رد بشري", "مو روبوت"].some(k => t.includes(k));
  }, []);

  const detectDepartment = useCallback((userText: string): 'support' | 'ads' | 'technical' => {
    const text = userText.toLowerCase();
    if (["إعلان", "ترويج", "سبونسر", "بانر"].some(k => text.includes(k))) return 'ads';
    if (["مشكلة", "خطأ", "لا يعمل", "دعم فني"].some(k => text.includes(k))) return 'technical';
    return 'support'; 
  }, []);

  const detectPricingRequest = useCallback((text: string): { isPricing: boolean; type: string } => {
    const t = text.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!["سعر", "تكلفة", "كم", "ثمن", "اسعار"].some(k => t.includes(k))) return { isPricing: false, type: "" };
    if (t.includes("بانر")) return { isPricing: true, type: "banner-ad" };
    if (t.includes("فيديو")) return { isPricing: true, type: "video-ad" };
    if (t.includes("منشور") || t.includes("ممول")) return { isPricing: true, type: "sponsored-post" };
    if (t.includes("حمل") || t.includes("باقة")) return { isPricing: true, type: "full-campaign" };
    return { isPricing: true, type: "general-inquiry" };
  }, []);

  const generatePricingResponse = useCallback((pricingType: string): string => {
    const info = pricingSystem[pricingType];
    if (!info || pricingType === "general-inquiry") return "ممكن توضح لي أكثر عن الخدمة اللي تبي تعرف سعرها؟ (بانر، فيديو، منشور ممول، حملة؟)";
    if (info.needsDetails && info.detailsQuestions) {
      const q = info.detailsQuestions.join(" • ");
      return info.range ? `تبدأ الأسعار من ${info.range.min} إلى ${info.range.max} ${info.unit}.\nعشان أعطيك سعر دقيق، أحتاج أعرف:\n${q}` : `أحتاج تفاصيل:\n${q}`;
    }
    return info.basePrice === 0 ? "هذه الخدمة مجانية تماماً." : `السعر ${info.basePrice} ${info.unit}.`;
  }, []);

  const detectThanksOrEnd = useCallback((text: string): { type: 'thanks' | 'end' | 'none' } => {
    const t = text.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    
    const endKeywords = ["لا", "لا شكرا", "لا شكراً", "لا شيء", "لا شي", "هذا كل شيء", "هذا كل شي", "خلاص", "يكفي", "كل شي", "كل شيء", "ما عندي شي", "ما عندي شيء", "بس كذا", "بسكذا"];
    if (endKeywords.some(k => t === k || t.includes(k))) {
      return { type: 'end' };
    }
    
    const thanksKeywords = ["شكرا", "شكراً", "مشكور", "الله يعطيك العافية", "تسلم", "يعطيك العافية", "جزاك الله خير", "ممنون", "ممتن", "thanks", "thank you", "thx"];
    if (thanksKeywords.some(k => t.includes(k))) {
      return { type: 'thanks' };
    }
    
    return { type: 'none' };
  }, []);

  const checkAndPerformEscalation = useCallback((userText: string): boolean => {
    if (!wantsHumanContact(userText)) return false;
    
    setChatStatus("typing");
    const targetDept = detectDepartment(userText);
    
    setMessages((prev) => [...prev, {
      id: (Date.now() + 1).toString(), sender: currentSpeaker, role: "assistant",
      text: transferMessages[targetDept], time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
    }]);

    setTimeout(() => {
      let assignedAgent = supportAgents.find(a => a.department === targetDept) || supportAgents[0];
      const isSameAgent = currentAgent?.employeeId === assignedAgent.employeeId;
      
      if (!isSameAgent || !currentAgent) {
        setCurrentAgent(assignedAgent);
        if (!sessionAgents.find(a => a.employeeId === assignedAgent.employeeId)) {
          setSessionAgents(prev => [...prev, assignedAgent]);
        }
        setCurrentSpeaker("agent");
        setHasInteractedWithCurrentAgent(true);
        
        setMessages((prev) => [...prev, {
          id: (Date.now() + 2).toString(), sender: "agent", role: "assistant",
          text: `تم تحويلك إلى ${assignedAgent.name}.\n${getRandomUniqueMessage(agentWelcomeMessages[assignedAgent.employeeId], 'agents', assignedAgent.employeeId)}`,
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 2).toString(), sender: "agent", role: "assistant",
          text: getRandomUniqueMessage(agentReturnMessages, 'agents', 'return'),
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
        }]);
      }
      
      setChatStatus("online");
      resetIdleTimer();
    }, 1200);

    return true;
  }, [wantsHumanContact, detectDepartment, currentAgent, currentSpeaker, sessionAgents, resetIdleTimer]);

  const sendMessage = useCallback(async () => {
    if (!text.trim() || chatStatus === "ended") return; 
    
    setChatStatus("typing");
    setIsLoading(true);
    const userText = text;
    setText("");
    resetIdleTimer();

    setMessages((prev) => [...prev, {
      id: Date.now().toString(), sender: "user", role: "user",
      text: userText, time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "sent"
    }]);

    if (currentSpeaker === "agent" && awaitingFollowUp) {
      const checkEnd = detectThanksOrEnd(userText);
      if (checkEnd.type === 'end') {
        setAwaitingFollowUp(false);
        setChatStatus("typing");
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            id: (Date.now() + 1).toString(), sender: "agent", role: "assistant",
            text: getRandomUniqueMessage(politeEndResponses, 'politeEnd'),
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
          }]);
          setChatStatus("online");
          setIsLoading(false);
          setTimeout(() => initiateEmployeeExit(false), 1500);
        }, 600);
        return;
      } else if (checkEnd.type === 'thanks') {
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            id: (Date.now() + 1).toString(), sender: "agent", role: "assistant",
            text: "العفو! هل يوجد أي شيء آخر أستطيع مساعدتك به؟",
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
          }]);
          setChatStatus("online");
          setIsLoading(false);
          resetIdleTimer();
        }, 600);
        return;
      } else {
        setAwaitingFollowUp(false);
      }
    }

    if (currentSpeaker === "agent") {
      const checkEnd = detectThanksOrEnd(userText);
      if (checkEnd.type === 'end') {
        setChatStatus("typing");
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            id: (Date.now() + 1).toString(), sender: "agent", role: "assistant",
            text: getRandomUniqueMessage(politeEndResponses, 'politeEnd'),
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
          }]);
          setChatStatus("online");
          setIsLoading(false);
          setTimeout(() => initiateEmployeeExit(false), 1500);
        }, 600);
        return;
      }
      if (checkEnd.type === 'thanks') {
        setChatStatus("typing");
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            id: (Date.now() + 1).toString(), sender: "agent", role: "assistant",
            text: getRandomUniqueMessage(thanksResponses, 'thanks'),
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
          }]);
          setChatStatus("online");
          setIsLoading(false);
          setAwaitingFollowUp(true);
          resetIdleTimer();
        }, 600);
        return;
      }
    }

    const pricingCheck = detectPricingRequest(userText);
    if (pricingCheck.isPricing) {
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(), sender: currentSpeaker, role: "assistant",
          text: generatePricingResponse(pricingCheck.type),
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
        }]);
        setChatStatus("online");
        setIsLoading(false);
        resetIdleTimer();
      }, 600);
      return;
    }

    if (checkAndPerformEscalation(userText)) {
      setIsLoading(false);
      return;
    }

    try {
      const apiMessages = messages.filter(m => m.sender !== "system").map(m => ({ role: m.role || "user", content: m.text }));
      apiMessages.push({ role: "user", content: userText });

      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });
      const data = await response.json();
      
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), sender: currentSpeaker, role: "assistant",
        text: data.text || "عذراً، لم أتمكن من الرد حالياً.",
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
      }]);
      setChatStatus("online");
      resetIdleTimer();
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(), sender: "system",
        text: "عذراً، حدث خطأ في الاتصال.",
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read"
      }]);
      setChatStatus("online");
    } finally {
      setIsLoading(false);
    }
  }, [text, chatStatus, resetIdleTimer, currentSpeaker, awaitingFollowUp, detectThanksOrEnd, detectPricingRequest, generatePricingResponse, checkAndPerformEscalation, messages, initiateEmployeeExit]);

  const renderSeamlessItems = useMemo(() => {
    return [...trendingProducts, ...trendingProducts].map((product, index) => {
      const shapeClass = product.shape === 'circle' ? 'w-16 h-16 rounded-full' : product.shape === 'rectangle' ? 'w-20 h-14 rounded-xl' : product.shape === 'portrait' ? 'w-14 h-20 rounded-2xl' : 'w-16 h-16 rounded-md';
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
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0b0f1a] text-white font-sans flex flex-col">
      <style jsx global>{`
        .google-loader {
          position: fixed; top: 0; right: 0; width: 100%; height: 3px; z-index: 9999; pointer-events: none; overflow: hidden;
        }
        .google-loader::before {
          content: ''; position: absolute; top: 0; right: 100%; height: 100%; width: 40%;
          background: linear-gradient(90deg, transparent, #7c3aed, #3b82f6, #8b5cf6, transparent);
          box-shadow: 0 0 10px rgba(124, 58, 237, 0.6);
        }
        .google-loader.loading::before {
          animation: google-slide-rtl 2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
        .google-loader.done::before {
          animation: google-finish-rtl 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes google-slide-rtl {
          0% { right: 100%; width: 20%; opacity: 0; }
          20% { opacity: 1; width: 40%; }
          80% { right: 20%; width: 60%; }
          100% { right: 0%; width: 100%; opacity: 1; }
        }
        @keyframes google-finish-rtl {
          0% { right: 0%; width: 100%; opacity: 1; }
          100% { right: 0%; width: 100%; opacity: 0; }
        }
        @keyframes chatOpenRTL {
          0% { transform: translateX(30px) scale(0.95); opacity: 0; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        .animate-chat-open-rtl { animation: chatOpenRTL 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        @keyframes seamless-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-seamless-scroll { animation: seamless-scroll 50s linear infinite; will-change: transform; }
        .animate-seamless-scroll:hover { animation-play-state: paused; }
        
        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .animate-typing { animation: typing 1.4s infinite ease-in-out; }

        @keyframes messageFadeIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .message-appear {
          animation: messageFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .chat-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .chat-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-scroll::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 10px;
          transition: background 0.2s;
        }
        .chat-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.6);
        }
        .chat-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
        }

        .msg-bubble-user {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25), 0 1px 2px rgba(0,0,0,0.1);
        }
        .msg-bubble-bot {
          background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0,0,0,0.15);
        }
      `}</style>

      <div className={`google-loader ${isLoading ? 'loading' : 'done'}`}></div>

      <header className="sticky top-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="w-full px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <a href="/upgrade" className="btn upgrade flex items-center gap-1 px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs md:text-sm font-bold hover:shadow-lg hover:shadow-orange-500/30 transition whitespace-nowrap">ترقية 👑</a>
            <a href="/login" className="btn subscribe px-3 md:px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs md:text-sm font-bold hover:shadow-lg hover:shadow-purple-500/30 transition whitespace-nowrap">اشتراك</a>
          </div>

          <div className="search-box flex-1 max-w-md hidden md:flex justify-center">
            <div className="relative w-full">
              <input 
                type="text" 
                placeholder="🔎 ابحث عن مشاهير، برامج، أو محتوى..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition placeholder-gray-500 text-sm text-right" 
              />
            </div>
          </div>

          <a href="/" className="logo-container flex items-center gap-2 md:gap-3 shrink-0">
            <span className="brand-name text-base md:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent whitespace-nowrap">قناة مجلة دار النجوم</span>
            <img src="https://iili.io/Bsjh2M7.png" alt="شعار" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border-2 border-purple-500 shadow-md" />
          </a>
        </div>

        <div className="md:hidden px-4 pb-3">
          <input 
            type="text" 
            placeholder="🔎 ابحث عن محتوى..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-right" 
          />
        </div>
      </header>

      <div className="bg-[#111827] border-b border-gray-800 overflow-hidden relative py-3">
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="flex animate-seamless-scroll w-max">{renderSeamlessItems}</div>
      </div>

      <main className="container mx-auto px-4 py-8 flex-1">
        <section className="hero text-center mb-12">
          <div className="youtube-ad-marquee bg-purple-900/30 border border-purple-500/30 rounded-full py-2.5 mb-8 overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0b0f1a] to-transparent z-10 pointer-events-none rounded-r-full"></div>
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0b0f1a] to-transparent z-10 pointer-events-none rounded-l-full"></div>
            <div className="flex whitespace-nowrap animate-seamless-scroll w-max">
              {[...Array(10), ...Array(10)].map((_, i) => (
                <span key={i} className="mx-8 text-purple-300 text-sm font-semibold flex items-center gap-2"> إعلان حصري: تابعوا أحدث البرامج واللقاءات على قناة مجلة دار النجوم</span>
              ))}
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight"> مرحبًا بكم في <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">دار النجوم</span></h1>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">منصتكم الإعلامية الأولى لعالم المشاهير والمحتوى الحصري.</p>
        </section>
      </main>

      <div 
        onMouseMove={handleIconMouseMove}
        onMouseLeave={handleIconMouseLeave}
        onClick={() => { 
          setOpen(!open); 
          if (!open) resetIdleTimer();
        }} 
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-purple-600/30 cursor-pointer transition-all duration-300 z-50 border-2 border-white/20 hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-110 active:scale-95"
        title="مركز المساعدة والدعم"
      >
        <div style={{ 
          transform: `rotate(${headTilt}deg) ${justOpened ? 'scale(1.1)' : 'scale(1)'}`, 
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' 
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
            <g style={{ transform: `scaleY(${isBlinking ? 0.1 : 1})`, transformOrigin: '10px 14px', transition: 'transform 0.14s ease-in-out' }}>
              <circle cx="10" cy="14" r="5" fill="white" />
              <circle cx="10" cy="14" r="3.2" fill="#3b2410" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
              <circle cx="10" cy="14" r="1.8" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
              <circle cx="10.8" cy="13.2" r="0.9" fill="white" opacity="0.95" style={{ transform: `translate(${eyePos.x * 0.3}px, ${eyePos.y * 0.3}px)`, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
              <circle cx="9.3" cy="15" r="0.4" fill="white" opacity="0.6" style={{ transform: `translate(${eyePos.x * 0.3}px, ${eyePos.y * 0.3}px)`, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
            </g>
            <g style={{ transform: `scaleY(${isBlinking ? 0.1 : 1})`, transformOrigin: '22px 14px', transition: 'transform 0.14s ease-in-out' }}>
              <circle cx="22" cy="14" r="5" fill="white" />
              <circle cx="22" cy="14" r="3.2" fill="#3b2410" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
              <circle cx="22" cy="14" r="1.8" fill="#0b0f1a" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)`, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
              <circle cx="22.8" cy="13.2" r="0.9" fill="white" opacity="0.95" style={{ transform: `translate(${eyePos.x * 0.3}px, ${eyePos.y * 0.3}px)`, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
              <circle cx="21.3" cy="15" r="0.4" fill="white" opacity="0.6" style={{ transform: `translate(${eyePos.x * 0.3}px, ${eyePos.y * 0.3}px)`, transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
            </g>
            <path 
              d={chatStatus === "typing" ? "M10 22C10 22 14 27 16 27C18 27 22 22 22 22" : "M10 22C10 22 14 26 16 26C18 26 22 22 22 22"} 
              stroke="white" strokeWidth="2.5" strokeLinecap="round" 
            />
          </svg>
        </div>
        <div className="absolute -inset-1 rounded-full border-2 border-purple-400/30 animate-ping opacity-75 pointer-events-none"></div>
        <div className="absolute -inset-2 rounded-full border border-purple-300/20 animate-ping opacity-50 pointer-events-none" style={{ animationDelay: '0.8s' }}></div>
      </div>

      <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl z-50 flex flex-col ${open ? 'animate-chat-open-rtl' : 'opacity-0 translate-x-8 scale-95 pointer-events-none'}`} style={{ transition: open ? 'none' : 'opacity 0.3s ease-out, transform 0.3s ease-out' }}>
        <div className="p-4 border-b border-gray-700 flex items-center gap-3 bg-[#1f2937]/50 rounded-t-2xl">
          <div className="flex items-center gap-2 flex-shrink-0">
            {(sessionAgents.length === 0 || chatStatus === "ended") ? (
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center border-2 border-purple-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="8" width="16" height="12" rx="3" fill="white" opacity="0.95"/>
                    <circle cx="9" cy="14" r="1.5" fill="#7c3aed"/><circle cx="15" cy="14" r="1.5" fill="#7c3aed"/>
                    <path d="M9 17 Q12 19 15 17" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                    <line x1="12" y1="8" x2="12" y2="5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="4" r="1.5" fill="white"/>
                  </svg>
                </div>
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111827] ${chatStatus === "online" ? "bg-green-500" : chatStatus === "typing" ? "bg-yellow-500 animate-pulse" : chatStatus === "ended" ? "bg-red-500" : "bg-gray-500"}`}></span>
              </div>
            ) : (
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {sessionAgents.map((agent, idx) => (
                  <div key={agent.employeeId} className="relative group" title={`${agent.name} - ${agent.role}`}>
                    <img src={agent.img} alt={agent.name} className={`w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-[#111827] object-cover transition-all ${idx === sessionAgents.length - 1 ? "border-purple-500 z-10 ring-2 ring-purple-500/30" : "border-gray-500 z-0 opacity-60 grayscale"}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <h4 className="font-bold text-white text-sm truncate">
              {chatStatus === "ended" ? "المحادثة منتهية" : (sessionAgents.length === 0 ? "المساعد الذكي" : currentAgent?.name)}
            </h4>
            <p className={`text-xs flex items-center gap-1 justify-end truncate ${chatStatus === "online" || chatStatus === "typing" ? "text-green-400" : chatStatus === "idle" ? "text-yellow-400" : chatStatus === "ended" ? "text-red-400 font-bold" : "text-gray-400"}`}>
              <span className="truncate">{chatStatus === "typing" ? "يكتب الآن..." : chatStatus === "online" ? "متصل الآن" : chatStatus === "idle" ? "سينتهي قريباً..." : "انتهت المحادثة"}</span>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chatStatus === "online" ? "bg-green-400 animate-pulse" : chatStatus === "typing" ? "bg-yellow-400 animate-pulse" : chatStatus === "idle" ? "bg-yellow-400" : chatStatus === "ended" ? "bg-red-400" : "bg-gray-400"}`}></span>
            </p>
          </div>
        </div>

        <div 
          ref={chatContainerRef}
          className="h-80 overflow-y-auto p-4 space-y-3 chat-scroll bg-[#0b0f1a]/50" 
          onClick={resetIdleTimer}
          dir="rtl"
        >
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            const isSystem = msg.sender === "system";
            if (isSystem) return (
              <div key={msg.id} className="flex justify-center my-2 message-appear">
                <span className="text-[10px] bg-gray-800/80 text-gray-400 px-3 py-1.5 rounded-full border border-gray-700 text-center max-w-[90%] leading-relaxed">
                  {msg.text}
                </span>
              </div>
            );
            return (
              <div key={msg.id} className={`flex flex-col message-appear ${isUser ? "items-end" : "items-start"}`}>
                {!isUser && (
                  <span className="text-[10px] text-gray-400 mb-1 mr-1">
                    {msg.sender === "agent" && currentAgent && chatStatus !== "ended" ? `${currentAgent.name} (${currentAgent.role})` : "المساعد الذكي"}
                  </span>
                )}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative whitespace-pre-line break-words ${isUser ? "msg-bubble-user text-white rounded-tl-sm" : "msg-bubble-bot text-gray-200 border border-purple-500/20 rounded-tr-sm"}`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1 flex items-center gap-1">
                  {msg.time}{isUser && <span>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                </span>
              </div>
            );
          })}
          
          {chatStatus === "typing" && (
            <div className="flex items-start gap-2 message-appear">
              {currentSpeaker === "agent" && currentAgent ? (
                <img src={currentAgent.img} alt={currentAgent.name} className="w-7 h-7 rounded-full border border-purple-500/50 flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="8" width="16" height="12" rx="3" fill="white" opacity="0.95"/>
                    <circle cx="9" cy="14" r="1.5" fill="#7c3aed"/><circle cx="15" cy="14" r="1.5" fill="#7c3aed"/>
                  </svg>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 mb-1 mr-1">
                  {currentSpeaker === "agent" && currentAgent ? `${currentAgent.name} • يكتب الآن...` : "المساعد الذكي • يكتب الآن..."}
                </span>
                <div className="bg-[#1f2937] border border-purple-500/20 rounded-2xl rounded-tr-sm px-4 py-3 flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-typing" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-typing" style={{ animationDelay: '200ms' }}></span>
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-typing" style={{ animationDelay: '400ms' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-gray-700 bg-[#1f2937]/50 rounded-b-2xl">
          {chatStatus === "ended" ? (
            <button onClick={() => {
                setMessages([]); setCurrentSpeaker("bot"); setCurrentAgent(null); setSessionAgents([]);
                setHasInteractedWithCurrentAgent(false); setAwaitingFollowUp(false); setChatStatus("online");
                if (typeof window !== 'undefined') localStorage.removeItem('dar-alnujum-chat-state');
                setChatStatus("typing"); setIsLoading(true);
                setTimeout(() => {
                  setMessages([{ id: "welcome-new", sender: "bot", role: "assistant", text: getRandomUniqueMessage(welcomeMessages, 'welcome'), time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }), status: "read" }]);
                  setChatStatus("online"); setIsLoading(false);
                }, 800);
              }} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" /><path d="M3 3v9h9" /></svg>
              بدء محادثة جديدة
            </button>
          ) : (
            <div className="flex gap-2 items-end">
              {chatStatus === "idle" ? (
                <div onClick={resetIdleTimer} className="flex-1 bg-[#0b0f1a]/50 border border-dashed border-yellow-500/50 rounded-xl p-3 text-center cursor-pointer hover:bg-[#0b0f1a] hover:border-yellow-500 transition-colors group">
                  <p className="text-yellow-400 text-sm font-medium group-hover:text-yellow-300">⚡ انقر هنا للعودة للمحادثة</p>
                </div>
              ) : (
                <textarea value={text} placeholder="اكتب رسالتك هنا..." 
                  onChange={(e) => { setText(e.target.value); resetIdleTimer(); }} 
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  rows={1} className="flex-1 bg-[#0b0f1a] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700 placeholder-gray-500 resize-none overflow-y-auto max-h-32 min-h-[42px] leading-relaxed text-right" dir="rtl" />
              )}
              <button onClick={sendMessage} disabled={!text.trim() || chatStatus === "typing" || chatStatus === "idle"} className={`p-3 rounded-xl text-sm font-bold transition mb-0.5 ${chatStatus === "idle" ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          )}
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