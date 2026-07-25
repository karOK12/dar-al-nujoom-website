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
  department: 'support' | 'ads' | 'technical';
}

// فريق الدعم بأقسامه المتعددة
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

// تم تبسيط الحالة لتعكس المتصل واليكتب فقط
type ChatStatus = "typing" | "online";

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
  
  // تم الاحتفاظ بالمرجعيات لتجنب الأخطاء ولكن لن يتم استخدامها للمؤقتات
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout |