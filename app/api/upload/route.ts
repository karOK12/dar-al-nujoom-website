// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم العثور على ملف' }, { status: 400 });
    }

    // التحقق من حجم الملف (10MB كحد أقصى)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز الحد المسموح (10MB)' }, { status: 400 });
    }

    // رفع الملف إلى Vercel Blob وجعله عاماً للوصول إليه
    const blob = await put(`uploads/${Date.now()}-${file.name}`, file, {
      access: 'public',
    });

    return NextResponse.json({
      url: blob.url,
      fileName: file.name,
      fileType: file.type,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'فشل رفع الملف إلى الخادم' }, { status: 500 });
  }
}