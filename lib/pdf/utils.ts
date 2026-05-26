/**
 * PDF Utilities — server-side only.
 * Uses pdfjs-dist/legacy for Node.js-compatible text extraction.
 *
 * VERCEL FIX: pdfjs-dist tries to require('./pdf.worker.js') using a relative
 * path, which Node.js resolves relative to CWD (/var/task) — not the module
 * location. We must set an absolute path via require.resolve() so the worker
 * file is found correctly in both local dev and Vercel serverless.
 */
import { PDFDocument } from 'pdf-lib'
import path from 'path'

// ─── pdfjs setup ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')

// CRITICAL: Use an absolute path so serverless environments (Vercel Lambda)
// can locate pdf.worker.js regardless of the process CWD.
try {
  const workerPath = path.join(
    path.dirname(require.resolve('pdfjs-dist/legacy/build/pdf.js')),
    'pdf.worker.js'
  )
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath
} catch {
  // Fallback: empty string triggers FakeWorker (acceptable for text extraction)
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

/**
 * Extract all text from a PDF buffer using pdfjs-dist.
 * Works with Node.js 18/20/24, handles both text-based and mixed PDFs.
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer)

  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  })

  const pdf = await loadingTask.promise
  const numPages: number = pdf.numPages
  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    let lastY: number | null = null
    let lineText = ''
    const lines: string[] = []

    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = (item as any).transform?.[5] ?? null
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        if (lineText.trim()) lines.push(lineText.trim())
        lineText = ''
      }
      lineText += item.str
      if (y !== null) lastY = y
    }
    if (lineText.trim()) lines.push(lineText.trim())
    pageTexts.push(lines.join('\n'))
  }

  return pageTexts.join('\n\n--- Page Break ---\n\n')
}

// ─── Word Conversion ─────────────────────────────────────────────────────────

/**
 * Convert PDF buffer to a proper .docx Word document.
 */
export async function convertPDFToWord(buffer: Buffer): Promise<Buffer> {
  const text = await extractTextFromPDF(buffer)
  return buildDocx(text)
}

async function buildDocx(text: string): Promise<Buffer> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')

  const paragraphs = text.split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return new Paragraph({ children: [] })
    if (trimmed.startsWith('--- Page Break ---')) {
      return new Paragraph({
        children: [new TextRun({ text: '─'.repeat(40), color: 'AAAAAA' })],
      })
    }
    return new Paragraph({ children: [new TextRun({ text: trimmed })] })
  })

  const doc = new Document({ sections: [{ children: paragraphs }] })
  return Buffer.from(await Packer.toBuffer(doc))
}

// ─── PDF Unlock ───────────────────────────────────────────────────────────────

/**
 * Remove password protection from an encrypted PDF.
 */
export async function removePDFPassword(buffer: Buffer, _password: string): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const newDoc = await PDFDocument.create()
    const pages = await newDoc.copyPages(pdfDoc, pdfDoc.getPageIndices())
    pages.forEach((p) => newDoc.addPage(p))
    return Buffer.from(await newDoc.save())
  } catch (err) {
    throw new Error(`Failed to remove password: ${err}`)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Check PDF magic bytes. */
export async function isPDFFile(buffer: Buffer): Promise<boolean> {
  return buffer.slice(0, 4).toString('utf8') === '%PDF'
}

/** Get page count and encryption flag. */
export async function getPDFInfo(
  buffer: Buffer
): Promise<{ pageCount: number; isEncrypted: boolean }> {
  let isEncrypted = false
  let pageCount = 0

  try {
    const doc = await PDFDocument.load(buffer)
    pageCount = doc.getPageCount()
  } catch (err: any) {
    if (err.message?.includes('encrypted') || err.message?.includes('password')) {
      isEncrypted = true
      try {
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
        pageCount = doc.getPageCount()
      } catch {
        pageCount = 0
      }
    }
  }

  return { pageCount, isEncrypted }
}
