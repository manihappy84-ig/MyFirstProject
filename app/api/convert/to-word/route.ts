import { NextRequest, NextResponse } from 'next/server';
import { convertPDFToWord, isPDFFile, extractTextFromPDF } from '@/lib/pdf/utils';

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

    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isPDF = await isPDFFile(buffer);
    if (!isPDF) {
      return NextResponse.json(
        { error: 'Invalid PDF file' },
        { status: 400 }
      );
    }

    // Extract text for preview
    const text = await extractTextFromPDF(buffer);

    // Convert PDF to proper Word document
    const docxBuffer = await convertPDFToWord(buffer);

    const baseFileName = file.name.replace(/\.pdf$/i, '');
    const fileName = `${baseFileName}.docx`;

    return NextResponse.json({
      success: true,
      text,
      docxBase64: docxBuffer.toString('base64'),
      fileName,
    });
  } catch (error: any) {
    console.error('PDF to Word conversion error:', error);
    const status = error.message?.includes('No text could be extracted') || error.message?.includes('OCR is required') ? 422 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to convert PDF to Word' },
      { status }
    );
  }
}
