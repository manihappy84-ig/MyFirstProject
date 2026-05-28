'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Dropzone } from '@/components/ui/Dropzone'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { convertPdfToText, downloadBlob, type TextResult } from '@/lib/services/converterService'

type Stage = 'idle' | 'file_selected' | 'uploading' | 'reading' | 'extracting' | 'ocr_processing' | 'done' | 'error'

const STAGES = [
  { key: 'uploading' as Stage,   label: 'Uploading file…',   progress: 20 },
  { key: 'reading' as Stage,     label: 'Reading PDF…',       progress: 55 },
  { key: 'extracting' as Stage,  label: 'Extracting text…',  progress: 85 },
]

interface OcrProgress {
  stage: 'idle' | 'loading_pdfjs' | 'rendering_page' | 'running_ocr'
  current: number
  total: number
  percent: number
  label: string
}

export default function PdfToTextPage() {
  const [file, setFile]           = useState<File | null>(null)
  const [stage, setStage]         = useState<Stage>('idle')
  const [progress, setProgress]   = useState(0)
  const [stageLabel, setLabel]    = useState('')
  const [result, setResult]       = useState<TextResult | null>(null)
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

  const handleFileSelect = useCallback((f: File) => {
    setFile(f)
    setStage('file_selected')
    setError(null)
    setFileError(null)
    setResult(null)
    setProgress(0)
  }, [])

  const handleConvert = async () => {
    if (!file) return
    setError(null)
    setResult(null)

    for (const s of STAGES) {
      setStage(s.key)
      setLabel(s.label)
      setProgress(s.progress)
      await new Promise((r) => setTimeout(r, 650))
    }

    const res = await convertPdfToText(file)
    setProgress(100)

    if (res.success && res.data) {
      setResult(res.data)
      setStage('done')
    } else {
      setError(res.error ?? 'Conversion failed. Please try again.')
      setStage('error')
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
      // 1. Load PDF.js from CDN dynamically to avoid compilation/Webpack worker issues in client
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
        const viewport = page.getViewport({ scale: 2.0 }) // Render scale 2.0 for higher OCR fidelity
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

      // 4. Save the results
      const finalText = accumulatedText.trim().replace(new RegExp(`\\n\\n--- Page ${total} Break ---\\n\\n$`), '')
      const words = finalText.trim().split(/\s+/).filter(Boolean)

      setResult({
        text: finalText,
        fileName: file.name,
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

  const handleDownload = () => {
    if (!result) return
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' })
    const base = result.fileName.replace(/\.pdf$/i, '')
    downloadBlob(blob, `${base}.txt`)
  }

  const handleCopy = async () => {
    if (!result?.text) return
    await navigator.clipboard.writeText(result.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setFile(null)
    setStage('idle')
    setProgress(0)
    setResult(null)
    setError(null)
    setFileError(null)
  }

  const isProcessing = ['uploading', 'reading', 'extracting', 'ocr_processing'].includes(stage)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1e3a5f] to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Home</span>
          </Link>
          <div className="w-px h-5 bg-white/20" />
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <span className="text-white font-bold">ai2026</span>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Page title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-3xl mb-4">
            📝
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-3">
            PDF to Text
          </h1>
          <p className="text-gray-400 text-lg">Extract text from any PDF file instantly</p>
        </div>

        {/* ── DONE: split layout ── */}
        {stage === 'done' && result ? (
          <div className="grid lg:grid-cols-3 gap-6 animate-fade-in-up">
            {/* Text preview */}
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <h2 className="text-white font-semibold">Extracted Text</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {result.wordCount.toLocaleString()} words ·{' '}
                    {result.charCount.toLocaleString()} characters
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Success
                </span>
              </div>
              <div className="p-5 h-96 lg:h-[500px] overflow-y-auto">
                {result.text ? (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {result.text}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-gray-500">No text could be extracted from this PDF.</p>
                    <p className="text-gray-600 text-sm mt-2">
                      The PDF may contain only images or be a scanned document.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions panel */}
            <div className="flex flex-col gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">Actions</h3>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:opacity-90 transition shadow-lg shadow-blue-500/20"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download TXT
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

              {/* File stats */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-3">File Info</h3>
                <dl className="space-y-2 text-sm">
                  {[
                    { label: 'Name', value: file?.name ?? '-' },
                    { label: 'Size', value: file ? `${(file.size / 1024).toFixed(1)} KB` : '-' },
                    { label: 'Words', value: result.wordCount.toLocaleString() },
                    { label: 'Characters', value: result.charCount.toLocaleString() },
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
        ) : (
          /* ── UPLOAD / PROCESSING STATE ── */
          <div className="max-w-2xl mx-auto">
            {/* Error banner / OCR recommendation */}
            {(() => {
              const isScannedError = error?.includes('OCR is required') || error?.includes('No text could be extracted')
              if (isScannedError) {
                return (
                  <div className="bg-gradient-to-br from-[#1b2b48] to-[#0f192b] border border-blue-500/30 rounded-2xl p-6 mb-8 text-center animate-fade-in-up shadow-xl shadow-black/30">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-3xl mb-4">
                      ✨
                    </div>
                    <h3 className="text-white font-bold text-xl mb-2">OCR Text Extraction Available</h3>
                    <p className="text-gray-300 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                      This PDF appears to be a scanned document or image-based. We can scan it using high-accuracy **local OCR** entirely inside your browser.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                      <button
                        onClick={runClientSideOcr}
                        className="flex-1 py-3 px-5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition text-sm flex items-center justify-center gap-2"
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
                    <button
                      onClick={() => { setError(null); setFileError(null) }}
                      className="text-red-400 hover:text-red-200 transition"
                      aria-label="Dismiss error"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              }
              return null
            })()}

            {/* Dropzone */}
            {(!file || stage === 'idle') && (
              <Dropzone
                onFileSelect={handleFileSelect}
                disabled={isProcessing}
                onError={(msg) => setFileError(msg)}
              />
            )}

            {/* Regular Processing */}
            {isProcessing && stage !== 'ocr_processing' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                <div className="flex justify-center mb-6">
                  <Spinner size="lg" color="blue" />
                </div>
                <h3 className="text-white font-semibold text-xl mb-2">{stageLabel}</h3>
                <p className="text-gray-400 text-sm mb-8">Please wait while we process your file…</p>
                <ProgressBar progress={progress} color="blue" />
              </div>
            )}

            {/* OCR Processing UI */}
            {stage === 'ocr_processing' && (
              <div className="bg-gradient-to-br from-[#121c2c] to-[#0b121e] border border-cyan-500/20 rounded-2xl p-10 text-center relative overflow-hidden shadow-2xl glass">
                {/* Laser scan line anim */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500 animate-scan" />
                
                <div className="flex justify-center mb-6">
                  <div className="relative w-16 h-16 flex items-center justify-center bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-3xl shadow-lg shadow-cyan-500/10 animate-pulse">
                    🔍
                  </div>
                </div>
                <h3 className="text-white font-bold text-xl mb-1">OCR Scan Active</h3>
                <p className="text-cyan-400 text-xs font-bold tracking-wider uppercase mb-4">Processing Locally In-Browser</p>
                <p className="text-gray-300 text-sm max-w-md mx-auto mb-6">
                  {ocrProgress.label}
                </p>

                {ocrProgress.total > 0 && (
                  <div className="text-xs text-gray-500 mb-8 font-medium">
                    Processing Page <span className="text-white font-bold">{ocrProgress.current}</span> of <span className="text-white font-bold">{ocrProgress.total}</span>
                  </div>
                )}
                
                <div className="max-w-md mx-auto">
                  <ProgressBar progress={ocrProgress.percent} color="blue" />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono tracking-wider">
                    <span>PROGRESS</span>
                    <span>{ocrProgress.percent}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* File selected, ready */}
            {file && !isProcessing && stage !== 'idle' && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-2xl">
                      📄
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{file.name}</p>
                      <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-gray-500 hover:text-gray-300 transition"
                      aria-label="Remove file"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleConvert}
                  disabled={isProcessing}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition text-lg shadow-lg shadow-blue-500/25"
                >
                  Extract Text
                </button>

                <button
                  onClick={handleReset}
                  className="w-full py-3 text-gray-400 hover:text-white text-sm transition"
                >
                  Choose a different file
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
