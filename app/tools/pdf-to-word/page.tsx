'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Dropzone } from '@/components/ui/Dropzone'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { convertPdfToWord, downloadBlob, type WordResult } from '@/lib/services/converterService'

type Stage = 'idle' | 'file_selected' | 'preparing' | 'converting' | 'generating' | 'ocr_processing' | 'done' | 'error'

const STAGES = [
  { key: 'preparing' as Stage,  label: 'Preparing file…',   progress: 15 },
  { key: 'converting' as Stage, label: 'Converting pages…', progress: 50 },
  { key: 'generating' as Stage, label: 'Generating DOCX…',  progress: 85 },
]

interface OcrProgress {
  stage: 'idle' | 'loading_pdfjs' | 'rendering_page' | 'running_ocr' | 'generating_docx'
  current: number
  total: number
  percent: number
  label: string
}

export default function PdfToWordPage() {
  const [file, setFile]           = useState<File | null>(null)
  const [stage, setStage]         = useState<Stage>('idle')
  const [progress, setProgress]   = useState(0)
  const [stageLabel, setLabel]    = useState('')
  const [result, setResult]       = useState<WordResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)

  const [ocrProgress, setOcrProgress] = useState<OcrProgress>({
    stage: 'idle',
    current: 0,
    total: 0,
    percent: 0,
    label: '',
  })

  // AI Assistant states
  const [aiText, setAiText] = useState<string | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [activeView, setActiveView] = useState<'original' | 'ai'>('original')
  const [aiAction, setAiAction] = useState<'summarize' | 'clean' | 'format' | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const handleAiProcess = async (action: 'summarize' | 'clean' | 'format') => {
    if (!result?.text) return
    setIsAiLoading(true)
    setAiError(null)
    setAiAction(action)
    try {
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result.text, action })
      })
      const data = await response.json()
      if (data.success && data.text) {
        setAiText(data.text)
        setActiveView('ai')
      } else {
        setAiError(data.error || 'AI processing failed')
      }
    } catch (err: any) {
      console.error('AI processing error:', err)
      setAiError(err.message || 'An error occurred during AI processing')
    } finally {
      setIsAiLoading(false)
    }
  }

  const generateDocxBlob = async (text: string) => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx')
    const paragraphs = text.split('\n').map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return new Paragraph({ children: [] })
      if (trimmed.startsWith('--- Page') || trimmed.includes('Break ---')) {
        return new Paragraph({
          children: [new TextRun({ text: '─'.repeat(40), color: 'AAAAAA' })],
        })
      }
      return new Paragraph({ children: [new TextRun({ text: trimmed })] })
    })
    const doc = new Document({ sections: [{ children: paragraphs }] })
    return Packer.toBlob(doc)
  }

  const handleDownload = async () => {
    if (!result) return
    if (activeView === 'ai' && aiText) {
      setIsAiLoading(true)
      try {
        const blob = await generateDocxBlob(aiText)
        const base = file?.name.replace(/\.pdf$/i, '') || 'document'
        downloadBlob(blob, `${base}_ai_${aiAction}.docx`)
      } catch (err) {
        console.error('Failed to compile AI Word document:', err)
      } finally {
        setIsAiLoading(false)
      }
    } else {
      downloadBlob(result.blob, result.fileName)
    }
  }

  const handleFileSelect = useCallback((f: File) => {
    setFile(f); setStage('file_selected')
    setError(null); setFileError(null); setResult(null)
  }, [])

  const handleConvert = async () => {
    if (!file) return
    setError(null)

    for (const s of STAGES) {
      setStage(s.key); setLabel(s.label); setProgress(s.progress)
      await new Promise((r) => setTimeout(r, 700))
    }

    const res = await convertPdfToWord(file)

    if (res.success && res.data) {
      setProgress(100)
      setResult(res.data); setStage('done')
    } else if (res.error?.includes('OCR is required') || res.error?.includes('No text could be extracted')) {
      // Scanned PDF: Automatically trigger high-accuracy Browser OCR in background
      await runClientSideOcr()
    } else {
      setProgress(100)
      setError(res.error ?? 'Conversion failed.'); setStage('error')
    }
  }

  const runClientSideOcr = async () => {
    if (!file) return
    setError(null)
    setStage('ocr_processing')
    setOcrProgress({
      stage: 'loading_pdfjs',
      current: 0,
      total: 0,
      percent: 0,
      label: 'Loading high-accuracy OCR engine…',
    })

    try {
      // 1. Load PDF.js from CDN dynamically
      const pdfjs = await new Promise<any>((resolve, reject) => {
        if ((window as any).pdfjsLib) {
          resolve((window as any).pdfjsLib)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        script.onload = () => resolve((window as any).pdfjsLib)
        script.onerror = () => reject(new Error('Failed to load local PDF rendering component.'))
        document.body.appendChild(script)
      })

      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

      // 2. Load PDF file data
      setOcrProgress((prev) => ({ ...prev, label: 'Reading PDF pages…' }))
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      const total = pdf.numPages

      setOcrProgress((prev) => ({
        ...prev,
        total,
        label: `Parsed document successfully (${total} pages found). Initializing OCR engine…`,
      }))

      // 3. Import Tesseract.js dynamically
      const Tesseract = (await import('tesseract.js')).default

      let accumulatedText = ''

      for (let pageNum = 1; pageNum <= total; pageNum++) {
        setOcrProgress((prev) => ({
          ...prev,
          stage: 'rendering_page',
          current: pageNum,
          percent: 0,
          label: `Rendering Page ${pageNum} of ${total} to high-resolution image…`,
        }))

        // Render page onto high-resolution canvas
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.height = viewport.height
        canvas.width = viewport.width

        if (!context) {
          throw new Error('Canvas render context error.')
        }

        await page.render({ canvasContext: context, viewport }).promise
        const dataUrl = canvas.toDataURL('image/png')

        setOcrProgress((prev) => ({
          ...prev,
          stage: 'running_ocr',
          label: `Scanning characters on Page ${pageNum} of ${total}…`,
        }))

        // Run OCR on the page image
        const ocrResult = await Tesseract.recognize(dataUrl, 'eng', {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              const pct = Math.round(m.progress * 100)
              setOcrProgress((prev) => ({
                ...prev,
                percent: pct,
                label: `Scanning characters on Page ${pageNum} of ${total}… (${pct}%)`,
              }))
            }
          },
        })

        accumulatedText += ocrResult.data.text + `\n\n--- Page ${pageNum} Break ---\n\n`
      }

      // 4. Generate the DOCX file client-side using docx
      setOcrProgress((prev) => ({
        ...prev,
        stage: 'generating_docx',
        percent: 90,
        label: 'Generating DOCX file…',
      }))

      const { Document, Packer, Paragraph, TextRun } = await import('docx')

      const paragraphs = accumulatedText.split('\n').map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return new Paragraph({ children: [] })
        if (trimmed.startsWith('--- Page') || trimmed.includes('Break ---')) {
          return new Paragraph({
            children: [new TextRun({ text: '─'.repeat(40), color: 'AAAAAA' })],
          })
        }
        return new Paragraph({ children: [new TextRun({ text: trimmed })] })
      })

      const doc = new Document({ sections: [{ children: paragraphs }] })
      const docxBlob = await Packer.toBlob(doc)

      const baseName = file.name.replace(/\.pdf$/i, '')
      const finalText = accumulatedText.trim().replace(new RegExp(`\\n\\n--- Page ${total} Break ---\\n\\n$`), '')
      const words = finalText.trim().split(/\s+/).filter(Boolean)

      setResult({
        blob: docxBlob,
        fileName: `${baseName}.docx`,
        text: finalText,
        charCount: finalText.length,
        wordCount: words.length,
      })
      setStage('done')
    } catch (err: any) {
      console.error('OCR failed:', err)
      setError(err.message || 'Browser-side OCR extraction failed. Please try again.')
      setStage('error')
    }
  }

  const handleReset = () => {
    setFile(null); setStage('idle'); setProgress(0)
    setResult(null); setError(null); setFileError(null)
    setAiText(null); setIsAiLoading(false)
    setActiveView('original'); setAiAction(null); setAiError(null)
  }

  const handleCopy = async () => {
    const textToCopy = activeView === 'ai' && aiText ? aiText : result?.text
    if (!textToCopy) return
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isProcessing = ['preparing', 'converting', 'generating', 'ocr_processing'].includes(stage)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#2d1b4e] to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition group">
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Home</span>
          </Link>
          <div className="w-px h-5 bg-white/20" />
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">AI</div>
            <span className="text-white font-bold">ai2026</span>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-3xl mb-4">📄</div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
            PDF to Word
          </h1>
          <p className="text-gray-400 text-lg">Convert PDFs to editable Word documents</p>
        </div>

        {/* Error banner / OCR recommendation */}
        {(() => {
          const isScannedError = error?.includes('OCR is required') || error?.includes('No text could be extracted')
          if (isScannedError) {
            return (
              <div className="bg-gradient-to-br from-[#2a1a3a] to-[#120a1c] border border-purple-500/30 rounded-2xl p-6 mb-8 text-center animate-fade-in-up shadow-xl shadow-black/30">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 text-3xl mb-4">
                  ✨
                </div>
                <h3 className="text-white font-bold text-xl mb-2">OCR Conversion Available</h3>
                <p className="text-gray-300 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                  This PDF appears to be a scanned document or image-based. We can scan it using high-accuracy **local OCR** in your browser and build an editable Word document from it!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                  <button
                    onClick={runClientSideOcr}
                    className="flex-1 py-3 px-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25 transition text-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Run Browser OCR
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 px-5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-semibold rounded-xl transition text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
          }
          if (error || fileError) {
            return (
              <div className="flex items-start gap-3 bg-red-900/50 border border-red-500/40 rounded-xl px-5 py-4 mb-6">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-300 font-semibold">Error</p>
                  <p className="text-red-400 text-sm mt-0.5">{error ?? fileError}</p>
                </div>
                <button onClick={() => { setError(null); setFileError(null) }} className="text-red-400 hover:text-red-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          }
          return null
        })()}

        {stage === 'done' && result ? (
          (() => {
            const displayedText = activeView === 'ai' && aiText ? aiText : result.text
            const activeWords = displayedText ? displayedText.split(/\s+/).filter(Boolean).length : 0
            const activeChars = displayedText ? displayedText.length : 0

            return (
              <div className="grid lg:grid-cols-3 gap-6 animate-fade-in-up">
                {/* Text preview */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-white/10 bg-white/[0.02]">
                    <div>
                      <h2 className="text-white font-semibold">
                        {activeView === 'ai' ? `AI Processed Word Content (${aiAction})` : 'Extracted Word Content'}
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {activeWords.toLocaleString()} words ·{' '}
                        {activeChars.toLocaleString()} characters
                      </p>
                    </div>

                    {/* AI View Toggles */}
                    {aiText && (
                      <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl">
                        <button
                          onClick={() => setActiveView('original')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeView === 'original'
                              ? 'bg-white/10 text-white'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Original
                        </button>
                        <button
                          onClick={() => setActiveView('ai')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeView === 'ai'
                              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/30'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          AI Version
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-5 h-96 lg:h-[500px] overflow-y-auto relative bg-slate-950/20">
                    {/* Glowing AI Spinner */}
                    {isAiLoading && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center animate-fade-in z-10">
                        <Spinner size="md" color="purple" />
                        <p className="text-purple-400 font-bold text-sm mt-4 tracking-wide uppercase">AI Assistant active</p>
                        <p className="text-gray-400 text-xs mt-1">Analyzing and refining your Word document text with Mistral AI…</p>
                      </div>
                    )}

                    {displayedText ? (
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {displayedText}
                      </pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <p className="text-gray-500">No text available.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions column */}
                <div className="flex flex-col gap-5">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
                    <h3 className="text-white font-semibold mb-4">Actions</h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => downloadBlob(result.blob, result.fileName)}
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:opacity-90 transition shadow-lg shadow-purple-500/20"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Word Document
                      </button>

                      <button
                        onClick={handleCopy}
                        className={`flex items-center justify-center gap-2 w-full py-3 px-4 font-semibold rounded-xl border transition ${
                          copied
                            ? 'bg-green-500/20 border-green-500/40 text-green-300'
                            : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                        }`}
                      >
                        {copied ? (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Text
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleReset}
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white/5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition"
                      >
                        Convert Another File
                      </button>

                      <Link
                        href="/"
                        className="flex items-center justify-center w-full py-3 text-gray-400 hover:text-white text-sm transition"
                      >
                        ← Back Home
                      </Link>
                    </div>
                  </div>

                  {/* SaaS AI Assistant Panel */}
                  <div className="bg-gradient-to-br from-[#1b102b] to-[#120a1e] border border-purple-500/30 rounded-2xl p-5 shadow-xl shadow-purple-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">
                      <span className="text-purple-400 animate-pulse">✨</span> AI Assistant
                    </h3>
                    <p className="text-gray-400 text-xs mb-4">SaaS document processing powered by Mistral AI.</p>

                    {aiError && (
                      <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-500/30 rounded-xl text-xs text-red-300">
                        {aiError}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <button
                        disabled={isAiLoading || !result?.text}
                        onClick={() => handleAiProcess('clean')}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition ${
                          aiAction === 'clean' && isAiLoading
                            ? 'bg-purple-500/25 border-purple-500/40 text-purple-300'
                            : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50'
                        }`}
                      >
                        <span>🧹</span>
                        <div className="flex-1">
                          <div>Clean OCR Typos</div>
                          <div className="text-[9px] text-gray-500 font-normal">Fix spelling errors and formatting</div>
                        </div>
                        {aiAction === 'clean' && isAiLoading && <Spinner size="sm" color="purple" />}
                      </button>

                      <button
                        disabled={isAiLoading || !result?.text}
                        onClick={() => handleAiProcess('summarize')}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition ${
                          aiAction === 'summarize' && isAiLoading
                            ? 'bg-purple-500/25 border-purple-500/40 text-purple-300'
                            : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50'
                        }`}
                      >
                        <span>📊</span>
                        <div className="flex-1">
                          <div>Summarize Document</div>
                          <div className="text-[9px] text-gray-500 font-normal">Create clear executive bullets</div>
                        </div>
                        {aiAction === 'summarize' && isAiLoading && <Spinner size="sm" color="purple" />}
                      </button>

                      <button
                        disabled={isAiLoading || !result?.text}
                        onClick={() => handleAiProcess('format')}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition ${
                          aiAction === 'format' && isAiLoading
                            ? 'bg-purple-500/25 border-purple-500/40 text-purple-300'
                            : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50'
                        }`}
                      >
                        <span>🏢</span>
                        <div className="flex-1">
                          <div>Professional Formatting</div>
                          <div className="text-[9px] text-gray-500 font-normal">Structure clean layout and headings</div>
                        </div>
                        {aiAction === 'format' && isAiLoading && <Spinner size="sm" color="purple" />}
                      </button>
                    </div>
                  </div>

                  {/* File stats */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
                    <h3 className="text-white font-semibold mb-3">File Info</h3>
                    <dl className="space-y-2 text-sm">
                      {[
                        { label: 'Name', value: file?.name ?? '-' },
                        { label: 'Size', value: file ? `${(file.size / 1024).toFixed(1)} KB` : '-' },
                        { label: 'Original Words', value: result.wordCount ? result.wordCount.toLocaleString() : '0' },
                        { label: 'Original Characters', value: result.charCount ? result.charCount.toLocaleString() : '0' },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between gap-2">
                          <dt className="text-gray-400">{row.label}</dt>
                          <dd className="text-white font-medium truncate max-w-[140px]" title={row.value}>
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                </div>
              </div>
            )
          })()
        ) : isProcessing && stage !== 'ocr_processing' ? (
          /* Processing */
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
            <div className="flex justify-center mb-6">
              <Spinner size="lg" color="purple" />
            </div>
            <h3 className="text-white font-semibold text-xl mb-2">{stageLabel}</h3>
            <p className="text-gray-400 text-sm mb-8">Converting your PDF to Word format…</p>
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              {STAGES.map((s) => (
                <span key={s.key} className={stageLabel === s.label ? 'text-purple-400 font-semibold' : ''}>
                  {s.label.replace('…', '')}
                </span>
              ))}
            </div>
            <ProgressBar progress={progress} color="purple" />
          </div>

        ) : stage === 'ocr_processing' ? (
          /* OCR Processing UI */
          <div className="bg-gradient-to-br from-[#1d122d] to-[#0f0a18] border border-purple-500/20 rounded-2xl p-10 text-center relative overflow-hidden shadow-2xl glass">
            {/* Laser scan line anim */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-pink-400 to-purple-500 animate-scan" />
            
            <div className="flex justify-center mb-6">
              <div className="relative w-16 h-16 flex items-center justify-center bg-purple-500/10 border border-purple-500/30 rounded-2xl text-3xl shadow-lg shadow-purple-500/10 animate-pulse">
                🔍
              </div>
            </div>
            <h3 className="text-white font-bold text-xl mb-1">OCR Scan Active</h3>
            <p className="text-purple-400 text-xs font-bold tracking-wider uppercase mb-4">Processing Locally In-Browser</p>
            <p className="text-gray-300 text-sm max-w-md mx-auto mb-6">
              {ocrProgress.label}
            </p>

            {ocrProgress.total > 0 && (
              <div className="text-xs text-gray-500 mb-8 font-medium">
                Processing Page <span className="text-white font-bold">{ocrProgress.current}</span> of <span className="text-white font-bold">{ocrProgress.total}</span>
              </div>
            )}
            
            <div className="max-w-md mx-auto">
              <ProgressBar progress={ocrProgress.percent} color="purple" />
              <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono tracking-wider">
                <span>PROGRESS</span>
                <span>{ocrProgress.percent}%</span>
              </div>
            </div>
          </div>

        ) : !file ? (
          <Dropzone onFileSelect={handleFileSelect} onError={(msg) => setFileError(msg)} />
        ) : (
          /* File selected */
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl">📄</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{file.name}</p>
                  <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(1)} KB • PDF</p>
                </div>
                <button onClick={handleReset} className="text-gray-500 hover:text-gray-300 transition" aria-label="Remove file">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              onClick={handleConvert}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-purple-500/25"
            >
              Convert to Word
            </button>
            <button onClick={handleReset} className="w-full py-3 text-gray-400 hover:text-white text-sm transition">
              Choose a different file
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
