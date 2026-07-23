// app/api/chat/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastUserMessage = messages[messages.length - 1].content;
    const lowerText = lastUserMessage.toLowerCase();

    // كشف التحويل
    const isEscalation = lowerText.includes('مدير') || lowerText.includes('بشر') || lowerText.includes('شكوى') || lowerText.includes('تحويل') || lowerText.includes('موظف');

    if (isEscalation) {
      return NextResponse.json({ isEscalation: true, text: "يرجى الانتظار، سيتم تحويلك إلى القسم المختص..." });
    }

    // بناء المحادثة كاملة للسياق
    const conversation = messages.map(m => 
      m.role === 'assistant' ? `المساعد: ${m.content}` : `المستخدم: ${m.content}`
    ).join('\n');

    const prompt = `أنت المساعد الذكي الرسمي لقناة "مجلة دار النجوم". أجب على جميع الأسئلة بدقة وتفصيل بالعربية الفصحى الودية. احتفظ بسياق المحادثة.

${conversation}
المساعد:`;

    // استدعاء Hugging Face Inference API (مجاني 100% بدون أي مفتاح)
    const response = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: `<s>[INST] ${prompt} [/INST]`,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            return_full_text: false,
            do_sample: true
          },
          options: { wait_for_model: true }
        })
      }
    );

    if (!response.ok) {
      // إذا النموذج نائم، ننتظر ويشتغل تلقائياً
      if (response.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 20000));
        const retry = await fetch(
          'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inputs: `<s>[INST] ${prompt} [/INST]`,
              parameters: { max_new_tokens: 500, temperature: 0.7, return_full_text: false },
              options: { wait_for_model: true }
            })
          }
        );
        const retryData = await retry.json();
        const aiText = retryData[0]?.generated_text || "عذراً، النموذج قيد التحميل. حاول بعد 30 ثانية.";
        return NextResponse.json({ isEscalation: false, text: aiText.trim() });
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const aiText = data[0]?.generated_text || "عذراً، لم أتمكن من توليد رد.";

    return NextResponse.json({ isEscalation: false, text: aiText.trim() });

  } catch (error: any) {
    return NextResponse.json({
      isEscalation: false,
      text: `❌ خطأ: ${error.message}`
    });
  }
}