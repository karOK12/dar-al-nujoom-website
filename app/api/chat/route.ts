// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv'; // استيراد قاعدة KV
import { v4 as uuidv4 } from 'uuid'; // لإنشاء معرفات فريدة

interface ChatMessage {
  role: string;
  content: string;
}

// --- مصفوفة الموظفين الوهمية (المحاكاة) ---
// مستقبلاً، بدل هذه المصفوفة، تجيب البيانات من قاعدة البيانات الحقيقية
const MOCK_AGENTS = [
  { id: 'agent_001', name: 'خالد', department: 'الدعم الفني', isOnline: true },
  { id: 'agent_002', name: 'سارة', department: 'خدمة العملاء', isOnline: true },
  { id: 'agent_003', name: 'أحمد', department: 'الدعم المالي', isOnline: false },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    // معرف الجلسة (يفضل إرساله من الواجهة الأمامية، أو نولده هنا)
    const sessionId = body.sessionId || uuidv4(); 

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { isEscalation: false, text: '❌ خطأ في الإعدادات: GROQ_API_KEY غير موجود.' },
        { status: 500 }
      );
    }

    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const lowerText = lastUserMessage.toLowerCase();

    // 1. تسجيل المحادثة في قاعدة البيانات (KV) بغض النظر عن الرد
    try {
      const logEntry = {
        sessionId,
        role: 'user',
        content: lastUserMessage,
        timestamp: new Date().toISOString(),
      };
      // نضيف الرسالة إلى قائمة المحادثات لهذه الجلسة (نخزن آخر 50 رسالة مثلاً)
      await kv.lpush(`chat:${sessionId}`, JSON.stringify(logEntry));
      await kv.ltrim(`chat:${sessionId}`, 0, 49); // نحتفظ بآخر 50 رسالة فقط عشان لا تمتلئ
    } catch (error) {
      console.error('فشل تسجيل المحادثة في KV:', error);
      // نكمل التنفيذ حتى لو فشل التسجيل عشان الخدمة ما توقف
    }

    // 2. التحقق من كلمات التحويل
    const escalationKeywords = ['مدير', 'بشر', 'شكوى', 'تحويل', 'موظف', 'دعم فني', 'خدمة عملاء'];
    const isEscalation = escalationKeywords.some(keyword => lowerText.includes(keyword));

    if (isEscalation) {
      // --- نختار موظف وهمي عشوائي (متصل) لتحويل المستخدم إليه ---
      const onlineAgents = MOCK_AGENTS.filter(agent => agent.isOnline);
      // لو ما في موظف متصل، نختار أول واحد ونعتبره متصل بشكل افتراضي للمحاكاة
      const assignedAgent = onlineAgents.length > 0 
        ? onlineAgents[Math.floor(Math.random() * onlineAgents.length)] 
        : MOCK_AGENTS[0];

      // توليد معرف فريد لطلب التحويل (التذكرة)
      const ticketId = uuidv4();

      // 3. تسجيل طلب التحويل في قاعدة البيانات
      try {
        const escalationRecord = {
          ticketId,
          sessionId,
          agentId: assignedAgent.id,
          agentName: assignedAgent.name,
          department: assignedAgent.department,
          userMessage: lastUserMessage,
          status: 'pending', // pending, assigned, closed
          createdAt: new Date().toISOString(),
          messages: messages, // نخزن سياق المحادثة كامل
        };
        // نضيف التذكرة إلى قائمة التذاكر المعلقة
        await kv.lpush('escalations:pending', JSON.stringify(escalationRecord));
        // ممكن نخزن التذكرة بمفتاح خاص بها عشان نعدل حالتها بعدين
        await kv.set(`ticket:${ticketId}`, JSON.stringify(escalationRecord));
      } catch (error) {
        console.error('فشل تسجيل طلب التحويل:', error);
      }

      // الرد على المستخدم مع ذكر اسم الموظف ومعرفه (هذي المحاكاة)
      return NextResponse.json({
        isEscalation: true,
        text: `🔄 جاري تحويلك إلى ${assignedAgent.name} (${assignedAgent.department}) - المعرف: ${assignedAgent.id}. سيتم التواصل معك قريباً...`,
        // نرسل معلومات إضافية للواجهة الأمامية لعرضها (اختياري)
        agentInfo: {
          id: assignedAgent.id,
          name: assignedAgent.name,
          department: assignedAgent.department
        },
        ticketId: ticketId, // نرسله عشان الواجهة تتابع حالة التذكرة
        sessionId: sessionId
      });
    }

    // --- باقي الكود الخاص بالذكاء الاصطناعي (الردود العادية) ---
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              "أنت المساعد الذكي الرسمي لقناة 'مجلة دار النجوم'. أجب بالعربية الفصحى الواضحة والمفيدة والودية. احتفظ بسياق المحادثة وأجب على جميع الأسئلة بدقة وتفصيل. جميع الأسعار المذكورة تكون بالدينار العراقي (IQD) ما لم يذكر العميل خلاف ذلك.",
          },
          ...messages.map((m) => ({
            role: m.role === 'assistant' || m.role === 'bot' ? 'assistant' : 'user',
            content: m.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Groq API Error:', response.status, errorData);
      return NextResponse.json(
        { isEscalation: false, text: `❌ خطأ من الخادم (${response.status}): ${errorData}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content?.trim() || 'عذراً، لم أتمكن من توليد رد.';

    // تسجيل رد المساعد في قاعدة البيانات
    try {
      const logEntry = {
        sessionId,
        role: 'assistant',
        content: aiText,
        timestamp: new Date().toISOString(),
      };
      await kv.lpush(`chat:${sessionId}`, JSON.stringify(logEntry));
      await kv.ltrim(`chat:${sessionId}`, 0, 49);
    } catch (error) {
      console.error('فشل تسجيل رد المساعد:', error);
    }

    return NextResponse.json({
      isEscalation: false,
      text: aiText,
      sessionId: sessionId, // نرجعه عشان الواجهة تحتفظ به
    });
  } catch (error: any) {
    console.error('Chat API Crash:', error);
    return NextResponse.json(
      { isEscalation: false, text: `❌ خطأ برمجي: ${error.message}` },
      { status: 500 }
    );
  }
}