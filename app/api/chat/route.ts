// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  role: string;
  content: string;
}

import { getRandomOnlineAgent } from "@/lib/agents";

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
    const assignedAgent = getRandomOnlineAgent();
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
              "أنت المساعد الذكي الرسمي لقناة 'مجلة دار النجوم'. أجب بالعربية الفصحى الواضحة والمفيدة والودية.\n\n**تعليمات العملة الصارمة:**\n1. **القاعدة الأساسية:** جميع الأسعار والمبالغ المالية تُذكر بالدينار العراقي (IQD) فقط.\n2. **لا تذكر الدولار أو أي عملة أخرى** في أي رد، إلا إذا طلب العميل ذلك بشكل صريح في رسالته الحالية (مثل: 'كم بالدولار؟' أو 'سعر الإعلان بالدولار').\n3. إذا طلب العميل التحويل لعملة أخرى، يمكنك ذكر السعر بالعملة المطلوبة مع الإشارة بوضوح إلى أن هذا تحويل للاسترشاد، والسعر الأساسي بالدينار العراقي.\n4. مثال للرد المثالي: 'سعر الإعلان الأسبوعي هو 50,000 دينار عراقي.'\n5. مثال عند طلب التحويل: 'السعر الأصلي 50,000 دينار عراقي، أي ما يعادل تقريباً 35 دولار أمريكي للتحويل فقط.'",
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
    // 🔥 المعالجة اللاحقة (تصحيح العملات)
    // ====================================================

    const replaceCurrency = (text: string): string => {
      // 1. استبدال الريال السعودي (ممنوع)
      text = text.replace(/\b(ريال سعودي|ريال|SAR|sar|ر\.س|ر.س)\b/g, 'دينار عراقي');
      
      // 2. استبدال العملات الخليجية الأخرى (ممنوعة)
      text = text.replace(/\b(درهم|دينار كويتي|دينار بحريني|ريال قطري|ريال عماني|ريال يمني)\b/g, 'دينار عراقي');
      
      // 3. الدولار مسموح به فقط إذا طلبه المستخدم (لا نستبدله)
      // ولكن نضبط الصياغة لتكون واضحة
      
      // 4. إزالة كلمة "سعودي" وتحويلها إلى "عراقي"
      text = text.replace(/\bسعودي\b/g, 'عراقي');
      
      // 5. تنظيف التكرارات
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