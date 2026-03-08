import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF, isPDFFile } from '@/lib/pdf/utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF
    const isPDF = await isPDFFile(buffer);
    if (!isPDF) {
      return NextResponse.json(
        { error: 'Invalid PDF file' },
        { status: 400 }
      );
    }

    // Extract text from PDF
    const text = await extractTextFromPDF(buffer);

    return NextResponse.json(
      {
        success: true,
        text: text.slice(0, 10000), // Limit to first 10k chars for demo
        fileName: file.name,
        fileSize: file.size,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('PDF to text conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to convert PDF to text' },
      { status: 500 }
    );
  }
}
