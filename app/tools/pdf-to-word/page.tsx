'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Dropzone } from '@/components/ui/Dropzone'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { convertPdfToWord, downloadBlob, type WordResult } from '@/lib/services/converterService'

type Stage = 'idle' | 'file_selected' | 'preparing' | 'converting' | 'generating' | 'done' | 'error'

const STAGES = [
  { key: 'preparing' as Stage,  label: 'Preparing file…',   progress: 15 },
  { key: 'converting' as Stage, label: 'Converting pages…', progress: 50 },
  { key: 'generating' as Stage, label: 'Generating DOCX…',  progress: 85 },
]

export default function PdfToWordPage() {
  const [file, setFile]           = useState<File | null>(null)
  const [stage, setStage]         = useState<Stage>('idle')
  const [progress, setProgress]   = useState(0)
  const [stageLabel, setLabel]    = useState('')
  const [result, setResult]       = useState<WordResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

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
    setProgress(100)

    if (res.success && res.data) {
      setResult(res.data); setStage('done')
    } else {
      setError(res.error ?? 'Conversion failed.'); setStage('error')
    }
  }

  const handleReset = () => {
    setFile(null); setStage('idle'); setProgress(0)
    setResult(null); setError(null); setFileError(null)
  }

  const isProcessing = ['preparing', 'converting', 'generating'].includes(stage)

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

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-3xl mb-4">📄</div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
            PDF to Word
          </h1>
          <p className="text-gray-400 text-lg">Convert PDFs to editable Word documents</p>
        </div>

        {/* Error */}
        {(error || fileError) && (
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
        )}

        {/* DONE */}
        {stage === 'done' && result ? (
          <div className="space-y-5 animate-fade-in-up">
            <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Conversion Complete!</h2>
              <p className="text-gray-400 mb-1">Your Word document is ready</p>
              <p className="text-green-400 text-sm font-medium">{result.fileName}</p>
            </div>

            {/* Stage checklist */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex justify-between text-sm mb-3">
                {['Prepared ✓', 'Converted ✓', 'Generated ✓', 'Done! 🎉'].map((s) => (
                  <span key={s} className="text-green-400 font-medium">{s}</span>
                ))}
              </div>
              <ProgressBar progress={100} color="green" />
            </div>

            <button
              onClick={() => result && downloadBlob(result.blob, result.fileName)}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-purple-500/25 flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Word Document
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleReset} className="py-3 px-4 bg-white/5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">
                Convert Another
              </button>
              <Link href="/" className="flex items-center justify-center py-3 px-4 bg-white/5 border border-white/20 text-gray-400 hover:text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">
                Back Home
              </Link>
            </div>
          </div>

        ) : isProcessing ? (
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
