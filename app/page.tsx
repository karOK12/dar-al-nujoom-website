"use client";

import { useState, useEffect, useRef } from "react";

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
}

const supportAgents: Agent[] = [
  { employeeId: "EMP-TEMP-001", name: "خالد", img: "https://i.pravatar.cc/150?img=68", role: "خدمة العملاء" },
  { employeeId: "EMP-TEMP-002", name: "نورة", img: "https://i.pravatar.cc/150?img=44", role: "دعم فني متقدم" }
];

const trendingProducts = [
  { id: 1, name: "كاميرا تصوير احترافية", desc: "خصم 25% لفترة محدودة", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&h=200&fit=crop", shape: "circle" },
  { id: 2, name: "سماعات استوديو", desc: "عزل ضوضاء فائق الجودة", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=200&fit=crop", shape: "rectangle" },
  { id: 3, name: "إضاءة Ring Light", desc: "مثالية لصناع المحتوى", img: "https://images.unsplash.com/photo-1615469062329-5f23633c1182?w=200&h=200&fit=crop", shape: "square" },
  { id: 4, name: "ميكروفون بث مباشر", desc: "جودة صوت استثنائية", img: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=300&fit=crop", shape: "portrait" },
];

type ChatStatus = "typing" | "online" | "ended";

export default function Home() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  
  const [currentSpeaker, setCurrentSpeaker] = useState<"bot" | "agent">("bot");
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [sessionAgents, setSessionAgents] = useState<Agent[]>([]);
  
  const [chatStatus, setChatStatus] = useState<ChatStatus>("online");
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const chatButtonRef = useRef<HTMLDivElement>(null);

  // مؤقتات تتبع نشاط المستخدم للإغلاق التلقائي
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (chatButtonRef.current) {
        const rect = chatButtonRef.current.getBoundingClientRect();
        const deltaX = Math.max(-4, Math.min(4, (e.clientX - (rect.left + rect.width / 2)) / 30));
        const deltaY = Math.max(-4, Math.min(4, (e.clientY - (rect.top + rect.height / 2)) / 30));
        setMousePos({ x: deltaX, y: deltaY });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 🔴 دالة عرض الحالة المدمجة (متصل الآن / انتهى)
  const getStatusText = () => {
    if (chatStatus === "typing") return "يكتب الآن...";
    if (chatStatus === "online") return "متصل الآن";
    return "انتهى"; 
  };

  // 🔴 إعادة ضبط المؤقتات عند كل نشاط من المستخدم
  const resetActivityTimers = () => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);

    // 1. إرجاع الحالة إلى "متصل الآن" فوراً عند رد المستخدم
    setChatStatus("online");

    // 2. بعد 5 دقائق من عدم رد المستخدم، تتغير الكلمة إلى "انتهى" (المحادثة تبقى مفتوحة)
    statusTimerRef.current = setTimeout(() => {
      setChatStatus("ended");
    }, 5 * 60 * 1000); 

    // 3. بعد 15 دقيقة من عدم النشاط، يتم إغلاق المحادثة تماماً والعودة للمساعد الذكي
    autoCloseTimerRef.current = setTimeout(() => {
      performAutoClose();
    }, 15 * 60 * 1000);
  };

  //  دالة الإغلاق التلقائي والعودة للمساعد الذكي
  const performAutoClose = () => {
    setChatStatus("ended");
    setCurrentSpeaker("bot");
    setCurrentAgent(null);
    setSessionAgents([]);
    
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      sender: "system",
      text: "⏱️ تم إنهاء المحادثة تلقائياً بسبب عدم النشاط. يمكنك بدء محادثة جديدة.",
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      status: "read"
    }]);
  };

  useEffect(() => {
    if (open && messages.length === 0) {
      setChatStatus("typing");
      setTimeout(() => {
        setMessages([{
          id: "welcome-1",
          sender: "bot",
          role: "assistant",
          text: "أهلاً بك في قناة مجلة دار النجوم! 🌟 أنا المساعد الذكي. يمكنني إخبارك بالتفصيل عن أسعارنا، باقاتنا، ومميزات خدماتنا. كيف يمكنني مساعدتك اليوم؟",
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          status: "read"
        }]);
        setChatStatus("online");
        resetActivityTimers();
      }, 1000);
    }
    
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, [open]);

  // 🔴 قاعدة معرفة البوت الدقيقة للأسعار والتفاصيل
  const getBotKnowledgeResponse = (userText: string): string | null => {
    const lowerText = userText.toLowerCase();
    if (['سعر', 'كم', 'تكلفة', 'أسعار', 'باقات', 'اشتراك', 'دفع', 'فلوس', 'ثمن', 'قيمة'].some(k => lowerText.includes(k))) {
      return `💰 تفاصيل باقاتنا وأسعارها:

📦 الباقة الأساسية: 100$ / شهرياً
• وصول كامل للمحتوى بجودة HD

⭐ الباقة المتقدمة: 200$ / شهرياً
• جودة بث 4K ودعم فني مباشر 24/7

👑 الباقة الاحترافية: 350$ / شهرياً
• بث غير محدود وأولوية في الدعم

هل تريد مساعدة في اختيار الباقة المناسبة؟`;
    }
    return null;
  };

  //  كشف دقيق لطلب الدعم البشري فقط
  const checkEscalation = (userText: string): boolean => {
    const lowerText = userText.toLowerCase();
    return ['حولني', 'تحويل', 'موظف', 'بشر', 'دعم فني', 'خدمة عملاء', 'مدير', 'شكوى'].some(k => lowerText.includes(k));
  };

  const performEscalation = () => {
    setChatStatus("typing");
    setMessages((prev) => [...prev, {
      id: (Date.now() + 1).toString(),
      sender: currentSpeaker,
      role: "assistant",
      text: "يرجى الانتظار، جاري تحويلك إلى قسم خدمة عملائنا المختص...",
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      status: "read"
    }]);

    setTimeout(() => {
      if (sessionAgents.length === 0) {
        const firstAgent = supportAgents[0];
        setCurrentAgent(firstAgent);
        setSessionAgents([firstAgent]);
        setCurrentSpeaker("agent");
        setMessages((prev) => [...prev, {
          id: (Date.now() + 2).toString(),
          sender: "agent",
          role: "assistant",
          text: `أهلاً بك، أنا ${firstAgent.name} (${firstAgent.role}). تفضل كيف يمكنني مساعدتك؟`,
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          status: "read"
        }]);
      } else {
        const nextAgent = supportAgents.find(a => a.employeeId !== currentAgent?.employeeId) || supportAgents[1];
        setSessionAgents(prev => [...prev, nextAgent]);
        setCurrentAgent(nextAgent);
        setMessages((prev) => [...prev, {
          id: (Date.now() + 3).toString(),
          sender: "agent",
          role: "assistant",
          text: `مرحباً، أنا ${nextAgent.name}. زميلي أحال لي حالتك لحلها بشكل نهائي. تفضل؟`,
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          status: "read"
        }]);
      }
      setChatStatus("online");
      resetActivityTimers();
    }, 3000);
  };

  const sendMessage = async () => {
    if (!text.trim() || chatStatus === "ended") return;
    
    setChatStatus("typing");
    const userText = text;
    setText("");

    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      sender: "user",
      role: "user",
      text: userText,
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      status: "sent"
    }]);

    //  أهم سطر: إعادة ضبط المؤقتات عند إرسال المستخدم لأي رسالة
    resetActivityTimers();

    // 1. التحقق أولاً: هل يطلب الدعم البشري بكلمات محددة؟
    if (checkEscalation(userText)) {
      performEscalation();
      return;
    }

    // 2. التحقق ثانياً: هل السؤال ضمن معرفة البوت المسبقة (أسعار، تفاصيل)؟
    const knownResponse = getBotKnowledgeResponse(userText);
    if (knownResponse) {
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: currentSpeaker,
          role: "assistant",
          text: knownResponse,
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          status: "read"
        }]);
        setChatStatus("online");
      }, 1000);
      return;
    }

    // 3. إذا لم يكن أي مما سبق، نستخدم الذكاء الاصطناعي العام للإجابة على باقي الأسئلة
    try {
      const apiMessages = messages.filter(m => m.sender !== "system").map(m => ({ role: m.role || "user", content: m.text }));
      apiMessages.push({ role: "user", content: userText });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      const data = await response.json();
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: currentSpeaker,
        role: "assistant",
        text: data.text || "عذراً، لم أتمكن من الرد حالياً.",
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        status: "read"
      }]);
      setChatStatus("online");
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        sender: "system",
        text: "عذراً، حدث خطأ في الاتصال.",
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        status: "read"
      }]);
      setChatStatus("online");
    }
  };

  const renderSeamlessItems = () => {
    const repeatedProducts = [...trendingProducts, ...trendingProducts];
    return repeatedProducts.map((product, index) => {
      const shapeClass = product.shape === 'circle' ? 'w-20 h-20 rounded-full' : product.shape === 'rectangle' ? 'w-28 h-20 rounded-xl' : product.shape === 'portrait' ? 'w-20 h-28 rounded-2xl' : 'w-20 h-20 rounded-xl';
      return (
        <div key={`${product.id}-${index}`} className="flex-shrink-0 inline-flex items-center gap-4 mx-4 bg-[#1f2937]/90 backdrop-blur-sm px-5 py-4 border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 w-[380px]">
          <img src={product.img} alt={product.name} className={`object-cover border-2 border-purple-500 shadow-md flex-shrink-0 ${shapeClass}`} />
          <div className="flex flex-col text-right flex-1 min-w-0">
            <span className="text-base md:text-lg font-bold text-white leading-tight mb-2 line-clamp-2">{product.name}</span>
            <span className="text-sm md:text-base text-purple-400 font-medium leading-tight line-clamp-2">{product.desc}</span>
          </div>
        </div>
      );
    });
  };

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

      <header className="sticky top-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="w-full px-2 md:px-4 py-3 flex flex-wrap md:flex-nowrap justify-between items-center gap-2 md:gap-4">
          <a href="/" className="logo-container flex items-center gap-2 md:gap-3 shrink-0">
            <img src="https://iili.io/Bsjh2M7.png" alt="شعار" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border-2 border-purple-500 shadow-md" />
            <span className="brand-name text-base md:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">قناة مجلة دار النجوم</span>
          </a>
          <div className="search-box flex-1 max-w-md mx-2 hidden md:block">
            <input type="text" placeholder="🔎 ابحث عن محتوى..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#1f2937] text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
          </div>
        </div>
      </header>

      <div className="bg-[#111827] border-b border-gray-800 overflow-hidden relative py-4">
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#111827] to-transparent z-10 pointer-events-none"></div>
        <div className="flex animate-seamless-scroll w-max">{renderSeamlessItems()}</div>
      </div>

      <main className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-4xl md:text-6xl font-black mb-4 text-center leading-tight">🌟 مرحبًا بكم في <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">دار النجوم</span></h1>
        <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto text-center">منصتكم الإعلامية الأولى لعالم المشاهير والمحتوى الحصري.</p>
      </main>

      <div ref={chatButtonRef} onClick={() => { setOpen(!open); if (!open) resetActivityTimers(); }} className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/40 cursor-pointer hover:scale-110 transition-transform duration-300 z-50 border-2 border-white/10 animate-slide-in-right" title="مركز المساعدة">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="animate-blink"><circle cx="10" cy="14" r="5" fill="white" /><circle cx="10" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.1s ease-out' }} /></g>
          <g className="animate-blink"><circle cx="22" cy="14" r="5" fill="white" /><circle cx="22" cy="14" r="2.5" fill="#0b0f1a" style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.1s ease-out' }} /></g>
          <path d="M10 22C10 22 14 26 16 26C18 26 22 22 22 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl transition-all duration-300 z-50 flex flex-col ${open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}>
        <div className="p-4 border-b border-gray-700 flex items-center gap-3 bg-[#1f2937]/50 rounded-t-2xl">
          <div className="flex items-center gap-2 flex-shrink-0">
            {(sessionAgents.length === 0 || chatStatus === "ended" && messages.some(m => m.sender === "system" && m.text.includes("تم إنهاء"))) ? (
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
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111827] ${chatStatus === "online" ? "bg-green-500" : chatStatus === "typing" ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`}></span>
              </div>
            ) : (
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {sessionAgents.map((agent, idx) => (
                  <div key={agent.employeeId} className="relative group">
                    <img src={agent.img} alt={agent.name} className={`w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-[#111827] object-cover transition-all ${idx === sessionAgents.length - 1 ? "border-purple-500 z-10 ring-2 ring-purple-500/30" : "border-gray-500 z-0 opacity-60 grayscale"}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-sm truncate">
              {(chatStatus === "ended" && messages.some(m => m.sender === "system" && m.text.includes("تم إنهاء"))) ? "المحادثة منتهية" : (sessionAgents.length === 0 ? "المساعد الذكي" : currentAgent?.name)}
            </h4>
            
            {/* 🔴 هنا يتم دمج الحالة: تظهر "متصل الآن" أو "انتهى" في نفس المكان بدون زر إضافي */}
            <p className={`text-xs flex items-center gap-1 truncate ${chatStatus === "online" || chatStatus === "typing" ? "text-green-400" : "text-red-400 font-bold"}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chatStatus === "online" ? "bg-green-400 animate-pulse" : chatStatus === "typing" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`}></span>
              <span className="truncate">{getStatusText()}</span>
            </p>
          </div>
        </div>

        <div className="h-80 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#0b0f1a]/50">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            const isSystem = msg.sender === "system";
            if (isSystem) {
              return <div key={msg.id} className="flex justify-center my-2"><span className="text-[10px] bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700">{msg.text}</span></div>;
            }
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                {!isUser && <span className="text-[10px] text-gray-400 mb-1 ml-1">{msg.sender === "agent" && currentAgent ? `${currentAgent.name} (${currentAgent.role})` : "المساعد الذكي"}</span>}
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed relative ${isUser ? "bg-purple-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-purple-500/30 rounded-tl-sm"}`} style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1 flex items-center gap-1">
                  {msg.time}
                  {isUser && <span>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                </span>
              </div>
            );
          })}
          
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
          {(chatStatus === "ended" && messages.some(m => m.sender === "system" && m.text.includes("تم إنهاء"))) ? (
            <button onClick={() => { setMessages([]); setChatStatus("online"); setOpen(true); resetActivityTimers(); }} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" /><path d="M3 3v9h9" /></svg>
              بدء محادثة جديدة
            </button>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea value={text} placeholder="اكتب رسالتك هنا..." onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} rows={1} className="flex-1 bg-[#0b0f1a] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700 placeholder-gray-500 resize-none overflow-y-auto max-h-32 min-h-[42px] leading-relaxed" />
              <button onClick={sendMessage} disabled={!text.trim() || chatStatus === "typing"} className="bg-purple-600 text-white p-3 rounded-xl text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed mb-0.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}