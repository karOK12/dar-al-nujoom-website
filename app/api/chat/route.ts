// app/api/chat/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, currentStage } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        isEscalation: false,
        text: "عذراً، لم يتم إعداد مفتاح الذكاء الاصطناعي. يرجى إضافة GEMINI_API_KEY في ملف .env"
      }, { status: 500 });
    }

    // كشف طلب التحويل لخدمة العملاء
    const lastMessage = messages[messages.length - 1].content.toLowerCase();
    const isEscalation = lastMessage.includes('مدير') || 
                         lastMessage.includes('بشر') || 
                         lastMessage.includes('شكوى') || 
                         lastMessage.includes('تحويل') || 
                         lastMessage.includes('موظف') ||
                         lastMessage.includes('خدمة عملاء');

    if (isEscalation) {
      return NextResponse.json({
        isEscalation: true,
        text: "يرجى الانتظار، سيتم تحويلك إلى القسم المختص..."
      });
    }

    // تحويل الرسائل إلى صيغة Gemini
    const geminiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // استدعاء Google Gemini API (مجاني 100%)
    const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `أنت المساعد الذكي الرسمي لـ "قناة مجلة دار النجوم". 
قواعدك الصارمة:
1. أجب على أي سؤال يطرحه المستخدم بدقة وتفصيل، مهما كان موضوعه (عام، تقني، ثقافي، علمي، ترفيهي...).
2. احتفظ بسياق المحادثة وتذكر ما قيل سابقاً.
3. تحدث بالعربية الفصحى الودية والمهنية.
4. لا تقدم إجابات قصيرة أو عامة. اشرح بالتفصيل وقدم حلولاً عملية.
5. استخدم الإيموجي عند المناسبة لجعل الردود أكثر ودية.
6. كن صبوراً ومتعاطفاً مع جميع استفسارات المستخدمين.`
            }]
          },
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                   "عذراً، لم أتمكن من معالجة طلبك حالياً.";

    return NextResponse.json({
      isEscalation: false,
      text: aiText.trim()
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ 
      isEscalation: false, 
      text: "عذراً، حدث خطأ مؤقت في الاتصال. يرجى المحاولة مرة أخرى." 
    }, { status: 500 });
  }
}