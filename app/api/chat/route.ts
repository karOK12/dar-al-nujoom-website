// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  role: string;
  content: string;
}

// --- مصفوفة الموظفين الوهمية (المحاكاة) ---
const MOCK_AGENTS = [
  { id: 'agent_001', name: 'خالد', department: 'الدعم الفني', isOnline: true },
  { id: 'agent_002', name: 'سارة', department: 'خدمة العملاء', isOnline: true },
  { id: 'agent_003', name: 'أحمد', department: 'الدعم المالي', isOnline: false },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
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

    // تسجيل المحادثة
    try {
      const logEntry = {
        sessionId,
        role: 'user',
        content: lastUserMessage,
        timestamp: new Date().toISOString(),
      };
      await kv.lpush(`chat:${sessionId}`, JSON.stringify(logEntry));
      await kv.ltrim(`chat:${sessionId}`, 0, 49);
    } catch (error) {
      console.error('فشل تسجيل المحادثة في KV:', error);
    }

    // التحقق من كلمات التحويل
    const escalationKeywords = ['مدير', 'بشر', 'شكوى', 'تحويل', 'موظف', 'دعم فني', 'خدمة عملاء'];
    const isEscalation = escalationKeywords.some(keyword => lowerText.includes(keyword));

    if (isEscalation) {
      const onlineAgents = MOCK_AGENTS.filter(agent => agent.isOnline);
      const assignedAgent = onlineAgents.length > 0
        ? onlineAgents[Math.floor(Math.random() * onlineAgents.length)]
        : MOCK_AGENTS[0];

      const ticketId = uuidv4();

      try {
        const escalationRecord = {
          ticketId,
          sessionId,
          agentId: assignedAgent.id,
          agentName: assignedAgent.name,
          department: assignedAgent.department,
          userMessage: lastUserMessage,
          status: 'pending',
          createdAt: new Date().toISOString(),
          messages: messages,
        };
        await kv.lpush('escalations:pending', JSON.stringify(escalationRecord));
        await kv.set(`ticket:${ticketId}`, JSON.stringify(escalationRecord));
      } catch (error) {
        console.error('فشل تسجيل طلب التحويل:', error);
      }

      return NextResponse.json({
        isEscalation: true,
        text: `🔄 جاري تحويلك إلى ${assignedAgent.name} (${assignedAgent.department}) - المعرف: ${assignedAgent.id}. سيتم التواصل معك قريباً...`,
        agentInfo: {
          id: assignedAgent.id,
          name: assignedAgent.name,
          department: assignedAgent.department,
        },
        ticketId: ticketId,
        sessionId: sessionId,
      });
    }

    // --- الذكاء الاصطناعي ---
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
              "أنت المساعد الذكي الرسمي لقناة 'مجلة دار النجوم'. أجب بالعربية الفصحى الواضحة والمفيدة والودية.\n\n**تعليمات صارمة جداً:**\n1. جميع الأسعار والمبالغ المالية يجب أن تكون بالدينار العراقي (IQD) فقط.\n2. ممنوع منعاً باتاً ذكر الريال السعودي أو الدولار أو أي عملة أخرى.\n3. اذكر المبلغ ثم كلمة 'دينار عراقي' (مثال: 500 دينار عراقي).\n4. لا تستخدم أي اختصارات عملة مثل SAR, USD, $ إلخ.",
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
    let aiText = data.choices?.[0]?.message?.content?.trim() || 'عذراً، لم أتمكن من توليد رد.';

    // ====================================================
    // 🔥 المعالجة اللاحقة الشاملة للعملات (تضمن الدينار العراقي)
    // ====================================================

    // دالة مساعدة لاستبدال العملات المختلفة بـ "دينار عراقي"
    const replaceCurrency = (text: string): string => {
      // 1. استبدال الريال السعودي بجميع أشكاله
      text = text.replace(/\b(ريال سعودي|ريال|SAR|sar|ر\.س)\b/g, 'دينار عراقي');
      
      // 2. استبدال الدولار بجميع أشكاله
      text = text.replace(/\b(دولار|USD|usd|\$)\b/g, 'دينار عراقي');
      
      // 3. استبدال العملات الخليجية الأخرى
      text = text.replace(/\b(درهم|دينار كويتي|دينار بحريني|ريال قطري|ريال عماني|ريال يمني)\b/g, 'دينار عراقي');
      
      // 4. استبدال العملات الأجنبية الشائعة
      text = text.replace(/\b(يورو|جنيه استرليني|ليرة|ين|فرنك)\b/g, 'دينار عراقي');
      
      // 5. التعامل مع الأرقام التي تتبعها عملة (مثل "500$" أو "500 دولار")
      text = text.replace(/(\d+)\s*[\$](\s|$)/g, '$1 دينار عراقي ');
      text = text.replace(/(\d+)\s*(ريال|دولار|درهم|SAR|USD)\b/g, '$1 دينار عراقي');
      
      // 6. التأكد من أن كل رقم (مبلغ) يتبعه "دينار عراقي" إذا لم يسبقه عملة
      // لكن نتحاشى تكرارها إذا كانت موجودة
      text = text.replace(/(\d+[,.]?\d*)\s*(?!دينار)(?!ريال)(?!دولار)/g, (match, num) => {
        // نتحقق من أن الرقم ليس جزءاً من تاريخ أو رقم هاتف (قد يكون ٥ أرقام فأكثر)
        // نترك الأرقام الطويلة (مثل ١٢٣٤٥) بدون تغيير حتى لا تشوه النص
        if (num.replace(/[,.]/g, '').length >= 5) {
          return match; // محتمل أنه رقم هاتف أو تاريخ
        }
        return `${num} دينار عراقي`;
      });

      // 7. تنظيف التكرارات (مثل "دينار عراقي دينار عراقي")
      text = text.replace(/(دينار عراقي)\s+\1/g, '$1');
      
      return text;
    };

    // تطبيق المعالجة
    aiText = replaceCurrency(aiText);

    // تسجيل رد المساعد
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
      sessionId: sessionId,
    });
  } catch (error: any) {
    console.error('Chat API Crash:', error);
    return NextResponse.json(
      { isEscalation: false, text: `❌ خطأ برمجي: ${error.message}` },
      { status: 500 }
    );
  }
}