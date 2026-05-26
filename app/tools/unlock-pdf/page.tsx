'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Dropzone } from '@/components/ui/Dropzone'
import { Spinner } from '@/components/ui/Spinner'
import { unlockPdf, downloadBlob, type UnlockResult } from '@/lib/services/converterService'

type Stage = 'idle' | 'file_selected' | 'unlocking' | 'done' | 'error'

export default function UnlockPdfPage() {
  const [file, setFile]           = useState<File | null>(null)
  const [stage, setStage]         = useState<Stage>('idle')
  const [password, setPassword]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [result, setResult]       = useState<UnlockResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [attempts, setAttempts]   = useState(0)

  const handleFileSelect = useCallback((f: File) => {
    setFile(f); setStage('file_selected')
    setError(null); setFileError(null); setResult(null); setPassword('')
  }, [])

  const handleUnlock = async () => {
    if (!file || !password) return
    setError(null); setStage('unlocking')

    const res = await unlockPdf(file, password)

    if (res.success && res.data) {
      setResult(res.data); setStage('done')
    } else {
      setAttempts((a) => a + 1)
      setError(res.error ?? 'Failed to unlock PDF. Check your password.')
      setStage('error')
    }
  }

  const handleReset = () => {
    setFile(null); setStage('idle'); setPassword('')
    setResult(null); setError(null); setFileError(null); setAttempts(0)
  }

  const handleRetry = () => {
    setError(null); setStage('file_selected'); setPassword('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1a3a2a] to-slate-900">
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

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 text-3xl mb-4">🔓</div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-3">
            Unlock PDF
          </h1>
          <p className="text-gray-400 text-lg">Remove password protection from PDF files</p>
        </div>

        {/* File error */}
        {fileError && (
          <div className="bg-yellow-900/30 border border-yellow-500/40 rounded-xl px-5 py-3 mb-5 text-sm text-yellow-300">
            ⚠️ {fileError}
          </div>
        )}

        {/* Unlock error with retry */}
        {stage === 'error' && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-6 mb-6 text-center animate-fade-in-up">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-red-300 font-semibold text-lg mb-1">Unlock Failed</h3>
            <p className="text-red-400 text-sm mb-2">{error}</p>
            {attempts > 0 && (
              <p className="text-gray-500 text-xs mb-4">Attempt {attempts} — please check your password and try again.</p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 bg-red-500/20 border border-red-500/40 text-red-300 font-semibold rounded-xl hover:bg-red-500/30 transition text-sm"
              >
                Try Again
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-white/10 border border-white/20 text-gray-300 font-semibold rounded-xl hover:bg-white/15 transition text-sm"
              >
                Choose Different File
              </button>
            </div>
          </div>
        )}

        {/* DONE */}
        {stage === 'done' && result ? (
          <div className="space-y-4 animate-fade-in-up">
            <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔓</div>
              <h2 className="text-2xl font-bold text-white mb-2">PDF Unlocked!</h2>
              <p className="text-gray-400 mb-1">Your unlocked PDF is ready to download</p>
              <p className="text-green-400 text-sm font-medium">{result.fileName}</p>
            </div>

            <button
              onClick={() => result && downloadBlob(result.blob, result.fileName)}
              className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:opacity-90 transition text-lg shadow-lg shadow-green-500/25 flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Unlocked PDF
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleReset} className="py-3 px-4 bg-white/5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">
                Unlock Another
              </button>
              <Link href="/" className="flex items-center justify-center py-3 px-4 bg-white/5 border border-white/20 text-gray-400 hover:text-white font-semibold rounded-xl hover:bg-white/10 transition text-sm">
                Back Home
              </Link>
            </div>
          </div>

        ) : stage === 'unlocking' ? (
          /* Processing */
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
            <div className="flex justify-center mb-6">
              <Spinner size="lg" color="green" />
            </div>
            <h3 className="text-white font-semibold text-xl mb-2">Unlocking PDF…</h3>
            <p className="text-gray-400 text-sm">Removing password protection. Please wait…</p>
          </div>

        ) : !file ? (
          /* Dropzone */
          <Dropzone onFileSelect={handleFileSelect} onError={(msg) => setFileError(msg)} />
        ) : (
          /* File + password form */
          <div className="space-y-4">
            {/* File card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-2xl">🔒</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{file.name}</p>
                  <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(1)} KB • Password Protected</p>
                </div>
                <button onClick={handleReset} className="text-gray-500 hover:text-gray-300 transition" aria-label="Remove file">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Password input */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <label htmlFor="pdf-password" className="block text-sm font-medium text-gray-300 mb-3">
                PDF Password
              </label>
              <div className="relative">
                <input
                  id="pdf-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && password) handleUnlock() }}
                  placeholder="Enter the PDF password"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/30 transition pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Your password is used only to unlock the file and is never stored or transmitted.
              </p>
            </div>

            <button
              onClick={handleUnlock}
              disabled={!password}
              className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition text-lg shadow-lg shadow-green-500/25"
            >
              🔓 Unlock PDF
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
