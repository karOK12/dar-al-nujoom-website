// app/api/chat/route.ts
import { NextResponse } from 'next/server';

interface ChatMessage {
  role: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    
    const apiKey = process.env.GROQ_API_KEY; 

    if (!apiKey) {
      return NextResponse.json(
        { isEscalation: false, text: "❌ خطأ في الإعدادات: المتغير GROQ_API_KEY غير موجود في فيرسيل." },
        { status: 500 }
      );
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const lowerText = lastUserMessage.toLowerCase();

    const escalationKeywords = ['مدير', 'بشر', 'شكوى', 'تحويل', 'موظف', 'دعم فني', 'خدمة عملاء'];
    const isEscalation = escalationKeywords.some(keyword => lowerText.includes(keyword));

    if (isEscalation) {
      return NextResponse.json({
        isEscalation: true,
        text: "يرجى الانتظار، سيتم تحويلك إلى قسم الدعم الفني المختص..."
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: "system",
            content: "أنت المساعد الذكي الرسمي لقناة 'مجلة دار النجوم'. أجب بالعربية الفصحى الواضحة والمفيدة والودية. احتفظ بسياق المحادثة وأجب على جميع الأسئلة بدقة وتفصيل."
          },
          ...messages.map(m => ({ 
            role: (m.role === 'assistant' || m.role === 'bot') ? 'assistant' : 'user', 
            content: m.content 
          }))
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Groq API Raw Error:", response.status, errorData);
      return NextResponse.json({
        isEscalation: false,
        text: `❌ خطأ من الخادم (${response.status}): ${errorData}`
      }, { status: response.status });
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content?.trim() || "عذراً، لم أتمكن من توليد رد.";

    return NextResponse.json({ isEscalation: false, text: aiText });

  } catch (error: any) {
    console.error("Chat API Crash:", error);
    return NextResponse.json({
      isEscalation: false,
      text: `❌ خطأ برمجي: ${error.message}`
    }, { status: 500 });
  }
}