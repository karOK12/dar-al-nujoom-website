// app/api/chat/route.ts
import { NextResponse } from 'next/server';

// 1. تعريف نوع الرسالة صراحةً لحل مشكلة TypeScript (Implicit Any)
interface ChatMessage {
  role: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 2. تحديد النوع للمصفوفة
    const messages: ChatMessage[] = body.messages || [];
    
    // تأكد أن هذا الاسم يطابق تماماً ما أضفته في إعدادات فيرسيل
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
      return NextResponse.json(
        { isEscalation: false, text: "❌ خطأ في الإعدادات: المتغير GEMINI_API_KEY غير موجود في فيرسيل." },
        { status: 500 }
      );
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const lowerText = lastUserMessage.toLowerCase();

    // كشف التحويل
    const escalationKeywords = ['مدير', 'بشر', 'شكوى', 'تحويل', 'موظف', 'دعم فني', 'خدمة عملاء'];
    const isEscalation = escalationKeywords.some(keyword => lowerText.includes(keyword));

    if (isEscalation) {
      return NextResponse.json({
        isEscalation: true,
        text: "يرجى الانتظار، سيتم تحويلك إلى قسم الدعم الفني المختص..."
      });
    }

    // 3. بناء السياق مع تحديد النوع (m: ChatMessage) لحل الخطأ نهائياً
    const conversation = messages.map((m: ChatMessage) => {
      const roleText = (m.role === 'assistant' || m.role === 'bot') ? 'المساعد' : 'المستخدم';
      return `${roleText}: ${m.content}`;
    }).join('\n');

    // استدعاء Google Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "أنت المساعد الذكي الرسمي لقناة 'مجلة دار النجوم'. أجب بالعربية الفصحى الواضحة والمفيدة والودية. احتفظ بسياق المحادثة وأجب على جميع الأسئلة بدقة وتفصيل."
            }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ 
                text: `سجل المحادثة السابق:\n${conversation}\n\nالرد المطلوب:` 
              }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API Raw Error:", response.status, errorData);
      return NextResponse.json({
        isEscalation: false,
        text: `❌ خطأ من Google (${response.status}): ${errorData}`
      }, { status: response.status });
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "عذراً، لم أتمكن من توليد رد.";

    return NextResponse.json({ isEscalation: false, text: aiText });

  } catch (error: any) {
    console.error("Chat API Crash:", error);
    return NextResponse.json({
      isEscalation: false,
      text: `❌ خطأ برمجي: ${error.message}`
    }, { status: 500 });
  }
}