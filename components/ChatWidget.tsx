"use client";

import { useState, useEffect, useRef } from "react";
import { analyzeAndRespond, getTypingDelay } from "@/lib/chat-engine";

type Message = {
  id: string;
  sender: "user" | "bot" | "agent" | "system";
  text: string;
  time: string;
};

interface Agent {
  employeeId: string;
  name: string;
  img: string;
  role: string;
}

// موظفو الدعم البشري (المحاكاة)
const supportAgents: Agent[] = [
  { employeeId: "EMP-1001", name: "أحمد", img: "https://i.pravatar.cc/150?img=11", role: "أخصائي دعم فني" },
  { employeeId: "EMP-1002", name: "سارة", img: "https://i.pravatar.cc/150?img=5", role: "مديرة علاقات العملاء" },
  { employeeId: "EMP-1003", name: "عمر", img: "https://i.pravatar.cc/150?img=3", role: "دعم تقني متقدم" }
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const [chatState, setChatState] = useState<"online" | "warning" | "closed">("online");
  const [countdown, setCountdown] = useState(60);
  
  // حالات الدعم البشري
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [sessionAgents, setSessionAgents] = useState<Agent[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatButtonRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, chatState, currentAgent]);

  // تتبع الماوس لأيقونة العيون
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (chatButtonRef.current) {
        const rect = chatButtonRef.current.getBoundingClientRect();
        const deltaX = Math.max(-3, Math.min(3, (e.clientX - (rect.left + rect.width / 2)) / 30));
        const deltaY = Math.max(-3, Math.min(3, (e.clientY - (rect.top + rect.height / 2)) / 30));
        setMousePos({ x: deltaX, y: deltaY });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // ─── منطق المؤقتات الذكية (الإغلاق التلقائي) ───
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    
    setChatState("online");
    setCountdown(60);

    inactivityTimerRef.current = setTimeout(() => {
      if (chatState !== "closed") {
        setChatState("warning");
        startCountdown();
      }
    }, 120000); // دقيقتين من الخمول
  };

  const startCountdown = () => {
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!);
          handleAutoClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAutoClose = () => {
    setChatState("closed");
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "system",
        text: "🔒 تم إنهاء المحادثة تلقائياً بسبب عدم النشاط. يمكنك بدء محادثة جديدة في أي وقت.",
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setIsTyping(true);
      setTimeout(() => {
        setMessages([
          {
            id: "welcome",
            sender: "bot",
            text: "أهلاً بك في قناة مجلة دار النجوم! 🌟 أنا المساعد الذكي. كيف يمكنني خدمتك اليوم؟",
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setIsTyping(false);
        resetInactivityTimer();
      }, 1000);
    }
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || chatState === "closed") return;

    const userText = inputValue;
    setInputValue("");
    resetInactivityTimer();

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsTyping(true);

    const delay = getTypingDelay();
    setTimeout(() => {
      const lastBotMsg = messages.filter((m) => m.sender === "bot" || m.sender === "agent").pop()?.text;
      const { text, isEscalation } = analyzeAndRespond(userText, lastBotMsg);

      if (isEscalation && !currentAgent) {
        // التصعيد لموظف بشري
        const firstAgent = supportAgents[0];
        setCurrentAgent(firstAgent);
        setSessionAgents([firstAgent]);
        
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: "agent",
              text: `أهلاً بك، أنا ${firstAgent.name} (${firstAgent.role}). لقد استلمت محادثتك، تفضل، كيف يمكنني مساعدتك؟`,
              time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setIsTyping(false);
          resetInactivityTimer();
        }, 2000);
      } else {
        // رد طبيعي
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: currentAgent ? "agent" : "bot",
            text: text,
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setIsTyping(false);
        resetInactivityTimer();
      }
    }, delay);
  };

  const handleRestartChat = () => {
    setMessages([]);
    setCurrentAgent(null);
    setSessionAgents([]);
    setChatState("online");
    setIsOpen(true);
  };

  return (
    <>
      {/* زر الدردشة العائم مع أيقونة العيون المتحركة */}
      <div 
        ref={chatButtonRef}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && messages.length === 0) resetInactivityTimer();
        }}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-purple-600/50 cursor-pointer hover:scale-110 transition-transform duration-300 z-50 border-2 border-white/20 group"
        title="مركز المساعدة والدعم"
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform">
          <line x1="12" y1="2" x2="12" y2="5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="2" r="1.5" fill="white"/>
          <rect x="4" y="6" width="16" height="12" rx="3" fill="white" opacity="0.95"/>
          {/* العيون التي تتحرك مع الماوس */}
          <circle cx="9" cy="11" r="1.8" fill="#7c3aed"/>
          <circle cx="9" cy="11" r="0.8" fill="#0b0f1a" style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.1s ease-out' }}/>
          <circle cx="15" cy="11" r="1.8" fill="#7c3aed"/>
          <circle cx="15" cy="11" r="0.8" fill="#0b0f1a" style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.1s ease-out' }}/>
          <path d="M9 15 Q12 17 15 15" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <rect x="2" y="9" width="2" height="4" rx="1" fill="white" opacity="0.9"/>
          <rect x="20" y="9" width="2" height="4" rx="1" fill="white" opacity="0.9"/>
        </svg>
      </div>

      {/* نافذة الدردشة */}
      <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl transition-all duration-300 z-50 flex flex-col overflow-hidden ${isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-95 pointer-events-none"}`}>
        
        {/* الرأس */}
        <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {sessionAgents.length === 0 ? (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </div>
              ) : (
                <img src={currentAgent?.img} alt="agent" className="w-10 h-10 rounded-full border-2 border-white object-cover" />
              )}
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-purple-600 ${chatState === "online" ? "bg-green-400" : chatState === "warning" ? "bg-yellow-400 animate-pulse" : "bg-red-500"}`}></span>
            </div>
            <div>
              <h4 className="font-bold text-sm">{sessionAgents.length === 0 ? "المساعد الذكي" : currentAgent?.name}</h4>
              <p className="text-xs text-purple-100">
                {chatState === "online" ? "متصل الآن" : chatState === "warning" ? "خامل..." : "انتهت المحادثة"}
              </p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* تنبيه العداد التنازلي */}
        {chatState === "warning" && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-2 text-center">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
              ⚠️ سيتم إنهاء المحادثة تلقائياً خلال <span className="font-bold">{countdown}</span> ثانية بسبب عدم النشاط.
            </p>
          </div>
        )}

        {/* منطقة الرسائل */}
        <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#0b0f1a]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              {msg.sender === "system" ? (
                <div className="w-full text-center">
                  <span className="text-[10px] bg-gray-200 dark:bg-gray-800 text-gray-500 px-3 py-1 rounded-full">{msg.text}</span>
                </div>
              ) : (
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === "user" 
                    ? "bg-purple-600 text-white rounded-br-none" 
                    : "bg-white dark:bg-[#1f2937] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm"
                }`}>
                  {msg.sender !== "user" && (
                    <span className="text-[10px] text-gray-400 mb-1 block">
                      {msg.sender === "agent" && currentAgent ? `${currentAgent.name} (${currentAgent.role})` : "المساعد الذكي"}
                    </span>
                  )}
                  {msg.text}
                  <div className={`text-[10px] mt-1 text-right ${msg.sender === "user" ? "text-purple-200" : "text-gray-400"}`}>
                    {msg.time}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 p-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1.5 items-center h-10">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* حقل الإدخال */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111827]">
          {chatState === "closed" ? (
            <button 
              onClick={handleRestartChat}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" /><path d="M3 3v9h9" /></svg>
              بدء محادثة جديدة
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  resetInactivityTimer();
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="اكتب رسالتك هنا..."
                className="flex-1 bg-gray-100 dark:bg-[#0b0f1a] text-gray-900 dark:text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-transparent focus:border-purple-500 transition"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}