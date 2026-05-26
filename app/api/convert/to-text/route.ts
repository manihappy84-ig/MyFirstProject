import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPDF, isPDFFile, getPDFInfo } from '@/lib/pdf/utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!(await isPDFFile(buffer))) {
      return NextResponse.json({ error: 'Invalid PDF file (bad header)' }, { status: 400 })
    }

    // Get page info
    let pageCount = 0
    try {
      const info = await getPDFInfo(buffer)
      pageCount = info.pageCount
    } catch {
      // non-fatal — continue with extraction
    }

    // Extract text
    const text = await extractTextFromPDF(buffer)

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            'No text could be extracted. This PDF may be image-based or scanned. OCR is required for scanned PDFs.',
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        text,
        fileName: file.name,
        fileSize: file.size,
        pageCount,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[to-text] error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to convert PDF to text' },
      { status: 500 }
    )
  }
}
