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

    // Extract text from PDF
    const text = await extractTextFromPDF(buffer);

    // Create a simple DOCX-like response
    // Note: For full DOCX support, install: npm install docx
    const docxContent = Buffer.from(
      `Document converted from PDF\n\n${text}`
    );

    // Create filename
    const baseFileName = file.name.replace('.pdf', '');
    const fileName = `${baseFileName}.docx`;

    return new NextResponse(new Uint8Array(docxContent), {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    });
  } catch (error: any) {
    console.error('PDF to Word conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to convert PDF to Word' },
      { status: 500 }
    );
  }
}
