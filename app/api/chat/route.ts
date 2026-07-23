// app/api/chat/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. فحص وجود المفتاح وطوله (للتأكد من أنه تم قراءته)
    console.log("🔑 هل المفتاح موجود؟:", !!apiKey);
    console.log("🔑 طول المفتاح:", apiKey ? apiKey.length : 0);

    if (!apiKey) {
      return NextResponse.json({
        isEscalation: false,
        text: "❌ خطأ في الإعدادات: لم يتم العثور على GEMINI_API_KEY في متغيرات بيئة فيرسيل."
      }, { status: 500 });
    }

    // 2. كشف طلب التحويل
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

    // 3. تجهيز الرسائل
    const geminiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // 4. استدعاء API (استخدام 1.5-flash لأنه المستقر والمجاني تماماً)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `أنت المساعد الذكي الرسمي لـ "قناة مجلة دار النجوم". أجب بدقة وتفصيل، واحتفظ بسياق المحادثة، وتحدث بالعربية الفصحى الودية.`
            }]
          },
          contents: geminiMessages,
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        })
      }
    );

    // 5. إذا فشل الاتصال، اعرض الخطأ الحقيقي من جوجل للمستخدم
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API Failed:", response.status, errorText);
      return NextResponse.json({
        isEscalation: false,
        text: `❌ خطأ من Google (Code: ${response.status}): ${errorText}`
      }, { status: response.status });
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أتمكن من توليد رد.";

    return NextResponse.json({
      isEscalation: false,
      text: aiText.trim()
    });

  } catch (error: any) {
    // عرض الخطأ البرمجي الحقيقي
    console.error("💥 CRITICAL ERROR:", error);
    return NextResponse.json({
      isEscalation: false,
      text: `❌ خطأ برمجي: ${error.message}`
    }, { status: 500 });
  }
}