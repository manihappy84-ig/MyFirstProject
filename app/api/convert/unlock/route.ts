import { NextRequest, NextResponse } from 'next/server';
import { removePDFPassword, isPDFFile, getPDFInfo } from '@/lib/pdf/utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const password = formData.get('password') as string;

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

    // Get PDF info
    const info = await getPDFInfo(buffer);

    if (!info.isEncrypted) {
      return NextResponse.json(
        { error: 'This PDF is not password protected' },
        { status: 400 }
      );
    }

    // Remove password from PDF
    const unlockedPDF = await removePDFPassword(buffer, password || '');

    const baseFileName = file.name.replace('.pdf', '');
    const fileName = `${baseFileName}_unlocked.pdf`;

    return new NextResponse(unlockedPDF, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error: any) {
    console.error('PDF unlock error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to unlock PDF' },
      { status: 500 }
    );
  }
}
