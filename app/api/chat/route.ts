// app/api/chat/route.ts
import { NextResponse } from 'next/server';

const MODEL_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const lowerText = lastUserMessage.toLowerCase();

    // كشف التحويل (يمكن توسيعه)
    const escalationKeywords = ['مدير', 'بشر', 'شكوى', 'تحويل', 'موظف', 'دعم فني', 'مشكلة معقدة'];
    const isEscalation = escalationKeywords.some(keyword => lowerText.includes(keyword));

    if (isEscalation) {
      return NextResponse.json({
        isEscalation: true,
        text: "يرجى الانتظار، سيتم تحويلك إلى قسم الدعم الفني..."
      });
    }

    // بناء السياق للمحادثة
    const conversation = messages
      .filter(m => m.role !== 'system') // تجاهل رسائل النظام
      .map(m => `${m.role === 'assistant' ? 'المساعد:' : 'المستخدم:'} ${m.content}`)
      .join('\n');

    const prompt = `<s>[INST] أنت مساعد ذكي لقناة "مجلة دار النجوم". أجب بالعربية الفصحى الوضحة والمفيدة. احتفظ بسياق المحادثة.
${conversation}
المساعد: [/INST>`;

    // محاولة أولى
    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,  // أقل من 500 لتسريع الاستجابة
          temperature: 0.7,
          return_full_text: false,
          do_sample: true,
          use_cache: true       // تسريع الاستجابات المتكررة
        },
        options: { wait_for_model: true } // انتظار تحميل النموذج إذا كان نائمًا
      })
    });

    if (!response.ok) {
      // إذا كان النموذج نائمًا (503), انتظر 10 ثوانٍ وأعد المحاولة
      if (response.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        const retryResponse = await fetch(MODEL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 200,
              temperature: 0.7,
              return_full_text: false,
              use_cache: true
            },
            options: { wait_for_model: true }
          })
        });
        const retryData = await retryResponse.json();
        const aiText = retryData[0]?.generated_text?.trim() || "عذراً، النموذج قيد التحميل. حاول مرة أخرى بعد قليل.";
        return NextResponse.json({ isEscalation: false, text: aiText });
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const aiText = data[0]?.generated_text?.trim() || "عذراً، لم أتمكن من توليد رد.";

    return NextResponse.json({ isEscalation: false, text: aiText });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({
      isEscalation: false,
      text: "❌ حدث خطأ في الاتصال بالنموذج. حاول مرة أخرى بعد قليل."
    });
  }
}