// app/api/chat/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, currentStage } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. فحص وجود المفتاح
    if (!apiKey) {
      console.error("❌ ERROR: GEMINI_API_KEY is missing in Vercel Environment Variables");
      return NextResponse.json({
        isEscalation: false,
        text: "خطأ في الإعدادات: لم يتم العثور على GEMINI_API_KEY في فيرسيل."
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

    // 4. استدعاء API (تم العودة إلى gemini-1.5-flash لضمان الاستقرار والتوافق مع الخطة المجانية)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `أنت المساعد الذكي الرسمي لـ "قناة مجلة دار النجوم". 
قواعدك الصارمة:
1. أجب على أي سؤال بدقة وتفصيل.
2. احتفظ بسياق المحادثة.
3. تحدث بالعربية الفصحى الودية والمهنية.
4. استخدم الإيموجي عند المناسبة.`
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

    // 5. معالجة أخطاء API بدقة
    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Gemini API Error:", response.status, errorData);
      throw new Error(`فشل الاتصال بـ Gemini (Code: ${response.status}). التفاصيل: ${errorData}`);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أتمكن من توليد رد.";

    return NextResponse.json({
      isEscalation: false,
      text: aiText.trim()
    });

  } catch (error: any) {
    // طباعة الخطأ الحقيقي في سجلات فيرسيل وإرجاعه للمستخدم مؤقتاً للتشخيص
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("💥 CRITICAL CHAT ERROR:", errorMessage);
    
    return NextResponse.json({ 
      isEscalation: false, 
      text: `عذراً، حدث خطأ تقني: ${errorMessage}` // هذا السطر سيساعدنا في معرفة السبب فوراً
    }, { status: 500 });
  }
}