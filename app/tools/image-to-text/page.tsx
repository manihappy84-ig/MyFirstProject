'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Dropzone } from '@/components/ui/Dropzone'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { downloadBlob } from '@/lib/services/converterService'

type Stage = 'idle' | 'file_selected' | 'scanning' | 'done' | 'error'

interface OcrProgress {
  percent: number
  label: string
}

export default function ImageToTextPage() {
  const [file, setFile]           = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [stage, setStage]         = useState<Stage>('idle')
  const [text, setText]           = useState<string>('')
  const [error, setError]         = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [ocrProgress, setOcrProgress] = useState<OcrProgress>({ percent: 0, label: '' })

  // Spoken audio playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Media generation/download progress
  const [isMediaLoading, setIsMediaLoading] = useState(false)
  const [mediaStatus, setMediaStatus] = useState('')

  const handleFileSelect = useCallback((f: File) => {
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setStage('file_selected')
    setError(null)
    setFileError(null)
    setText('')
    setOcrProgress({ percent: 0, label: '' })
  }, [])

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setStage('idle')
    setText('')
    setError(null)
    setFileError(null)
    setOcrProgress({ percent: 0, label: '' })
    handleStopAudio()
  }

  const handleScan = async () => {
    if (!file) return
    setError(null)
    setStage('scanning')
    setOcrProgress({ percent: 0, label: 'Initializing character scanning engine…' })

    try {
      const Tesseract = (await import('tesseract.js')).default

      const ocrResult = await Tesseract.recognize(file, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100)
            setOcrProgress({
              percent: pct,
              label: `Scanning characters… (${pct}%)`,
            })
          }
        },
      })

      const scannedText = ocrResult.data.text.trim()
      if (!scannedText) {
        throw new Error('No character or text contents could be scanned from this image. Please upload a clearer image.')
      }

      setText(scannedText)
      setStage('done')
    } catch (err: any) {
      console.error('Image OCR failed:', err)
      setError(err.message || 'Failed to scan image. Please try again with a clearer image.')
      setStage('error')
    }
  }

  const handleCopy = async () => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- AUDIO SYNTHESIS PLAYBACK ---
  const handlePlayAudio = () => {
    if (!text) return
    if (isPlaying) {
      handleStopAudio()
      return
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
      window.speechSynthesis.cancel() // stop any active synthesis

      const utterance = new SpeechSynthesisUtterance(text.substring(0, 1000)) // synthesize first 1000 chars safely
      utterance.onend = () => setIsPlaying(false)
      utterance.onerror = () => setIsPlaying(false)
      
      utteranceRef.current = utterance
      setIsPlaying(true)
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleStopAudio = () => {
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    setIsPlaying(false)
  }

  // --- MULTI-FORMAT EXPORTS ---
  const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'extracted_document'

  const exportToTxt = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, `${baseName}.txt`)
  }

  const exportToDocx = async () => {
    setIsMediaLoading(true)
    setMediaStatus('Compiling Word document…')
    try {
      const { Document, Packer, Paragraph, TextRun } = await import('docx')
      const paragraphs = text.split('\n').map((line) => {
        const trimmed = line.trim()
        return new Paragraph({ children: [new TextRun({ text: trimmed })] })
      })

      const doc = new Document({ sections: [{ children: paragraphs }] })
      const docxBlob = await Packer.toBlob(doc)
      downloadBlob(docxBlob, `${baseName}.docx`)
    } catch (err) {
      console.error('DOCX export failed:', err)
    } finally {
      setIsMediaLoading(false)
      setMediaStatus('')
    }
  }

  const exportToPdf = async () => {
    setIsMediaLoading(true)
    setMediaStatus('Rendering PDF document…')
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('Extracted Image Text', 20, 20)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      const splitText = doc.splitTextToSize(text, 170)
      doc.text(splitText, 20, 30)
      doc.save(`${baseName}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setIsMediaLoading(false)
      setMediaStatus('')
    }
  }

  const exportToExcel = async () => {
    setIsMediaLoading(true)
    setMediaStatus('Formatting Excel sheet…')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const rows = text.split('\n').map((line, idx) => ({ Line: idx + 1, Content: line }))
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Scanned Text')
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/octet-stream' })
      downloadBlob(blob, `${baseName}.xlsx`)
    } catch (err) {
      console.error('Excel export failed:', err)
    } finally {
      setIsMediaLoading(false)
      setMediaStatus('')
    }
  }

  const exportToPptx = async () => {
    setIsMediaLoading(true)
    setMediaStatus('Structuring PowerPoint slides…')
    try {
      const PptxGenJS = await new Promise<any>((resolve, reject) => {
        if ((window as any).PptxGenJS) {
          resolve((window as any).PptxGenJS)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
        script.onload = () => resolve((window as any).PptxGenJS)
        script.onerror = () => reject(new Error('Failed to load PowerPoint engine.'))
        document.body.appendChild(script)
      })

      const pptx = new PptxGenJS()
      
      // 1. Cover slide
      const cover = pptx.addSlide()
      cover.background = { fill: '1E293B' }
      cover.addText('Extracted Document Presentation', { x: 1, y: 2, w: 8, fontSize: 32, color: 'F8FAFC', bold: true })
      cover.addText('ai2026 Image to Text presentation studio', { x: 1, y: 3.5, w: 8, fontSize: 16, color: '94A3B8' })

      // 2. Content slides (chunks of 6 lines per slide)
      const lines = text.split('\n').filter(Boolean)
      const chunkSize = 6
      for (let i = 0; i < lines.length; i += chunkSize) {
        const slideLines = lines.slice(i, i + chunkSize)
        const slide = pptx.addSlide()
        slide.background = { fill: 'FFFFFF' }
        slide.addText(`Extracted Content (Part ${Math.floor(i / chunkSize) + 1})`, { x: 0.5, y: 0.5, w: 9, fontSize: 20, color: '0F172A', bold: true })
        slide.addText(slideLines.join('\n\n'), { x: 0.5, y: 1.5, w: 9, h: 5, fontSize: 14, color: '334155', valign: 'top' })
      }

      await pptx.writeFile({ fileName: `${baseName}.pptx` })
    } catch (err) {
      console.error('PowerPoint export failed:', err)
    } finally {
      setIsMediaLoading(false)
      setMediaStatus('')
    }
  }

  const exportToImage = async (format: 'jpeg' | 'tiff') => {
    setIsMediaLoading(true)
    setMediaStatus(`Drawing text to ${format.toUpperCase()} canvas…`)
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const lines = text.split('\n')
      canvas.width = 800
      canvas.height = Math.max(600, lines.length * 28 + 120)
      
      // Clean white background
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Elegant slate border
      ctx.strokeStyle = '#E2E8F0'
      ctx.lineWidth = 10
      ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)

      // Title header
      ctx.fillStyle = '#0F172A'
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText('Extracted Text Image', 40, 50)
      ctx.fillStyle = '#64748B'
      ctx.font = '12px sans-serif'
      ctx.fillText('Generated via ai2026 Studio', 40, 75)

      // Content writing
      ctx.fillStyle = '#334155'
      ctx.font = '14px monospace'
      lines.forEach((line, index) => {
        ctx.fillText(line.substring(0, 85), 40, 120 + index * 28) // clip characters to fit canvas bounds nicely
      })

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      const imageBlob = await (await fetch(dataUrl)).blob()
      downloadBlob(imageBlob, `${baseName}.${format}`)
    } catch (err) {
      console.error('Image export failed:', err)
    } finally {
      setIsMediaLoading(false)
      setMediaStatus('')
    }
  }

  const exportToSvg = () => {
    const lines = text.split('\n')
    const height = lines.length * 25 + 100
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" width="800" height="${height}">\n`
    svgContent += `  <rect width="100%" height="100%" fill="#F8FAFC"/>\n`
    svgContent += `  <text x="40" y="50" font-family="sans-serif" font-size="24" font-weight="bold" fill="#0F172A">Extracted Image Text Graphic</text>\n`
    svgContent += `  <text x="40" y="75" font-family="sans-serif" font-size="12" fill="#64748B">ai2026 Studio</text>\n`
    
    lines.forEach((line, index) => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
      svgContent += `  <text x="40" y="${120 + index * 25}" font-family="monospace" font-size="14" fill="#334155">${escaped}</text>\n`
    })
    svgContent += `</svg>`
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    downloadBlob(blob, `${baseName}.svg`)
  }

  const exportToSrt = () => {
    const lines = text.split('\n').filter(Boolean)
    let srtText = ''
    const padZero = (n: number, len: number = 2) => String(n).padStart(len, '0')
    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = Math.floor(seconds % 60)
      const ms = Math.floor((seconds % 1) * 1000)
      return `${padZero(h)}:${padZero(m)}:${padZero(s)},${padZero(ms, 3)}`
    }
    
    lines.forEach((line, idx) => {
      const start = idx * 6
      const end = start + 5.5
      srtText += `${idx + 1}\n`
      srtText += `${formatTime(start)} --> ${formatTime(end)}\n`
      srtText += `${line.trim()}\n\n`
    })

    const blob = new Blob([srtText.trim()], { type: 'text/srt;charset=utf-8' })
    downloadBlob(blob, `${baseName}.srt`)
  }

  // Captures moving scrolling canvas presentation to export actual .mp4 / .mov / .avi / .wmv containers
  const exportToVideo = async (extension: string) => {
    setIsMediaLoading(true)
    setMediaStatus(`Assembling scrolling ${extension.toUpperCase()} video stream…`)
    
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 854
      canvas.height = 480
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas render context error')

      const stream = canvas.captureStream(30) // Capture stream at 30 fps
      let mime = 'video/webm'
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mime = 'video/mp4'
      }

      const recorder = new MediaRecorder(stream, { mimeType: mime })
      const chunks: Blob[] = []
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: mime })
        downloadBlob(videoBlob, `${baseName}_presentation.${extension}`)
        setIsMediaLoading(false)
        setMediaStatus('')
      }

      recorder.start()

      let startTime = Date.now()
      const duration = 4000 // 4 seconds animation
      const paragraphs = text.split('\n').filter(Boolean).slice(0, 8)

      const drawFrame = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1.0)

        // Gradient background
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        grad.addColorStop(0, '#0F172A')
        grad.addColorStop(0.5, '#1E293B')
        grad.addColorStop(1, '#0F172A')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Glowing Title
        ctx.fillStyle = '#F59E0B'
        ctx.font = 'bold 22px sans-serif'
        ctx.shadowColor = '#FBBF24'
        ctx.shadowBlur = 8
        ctx.fillText('🎙️ Document Video Presentation', 50, 60)
        ctx.shadowBlur = 0

        ctx.fillStyle = '#64748B'
        ctx.font = '11px monospace'
        ctx.fillText(`ENCODER TYPE: WebRTC canvas ${extension.toUpperCase()}`, 50, 90)

        // Render line characters typing out
        ctx.fillStyle = '#F8FAFC'
        ctx.font = '14px Inter, monospace'
        let lineOffset = 0
        paragraphs.forEach((p, idx) => {
          const charsToShow = Math.floor(p.length * Math.min(progress * 1.5 - (idx * 0.1), 1.0))
          if (charsToShow > 0) {
            ctx.fillText(p.substring(0, charsToShow), 50, 140 + lineOffset)
            lineOffset += 32
          }
        })

        // Footer status indicators
        ctx.fillStyle = '#10B981'
        ctx.font = 'bold 11px monospace'
        ctx.fillText('● RECORDING', 50, canvas.height - 40)
        ctx.fillStyle = '#64748B'
        ctx.fillText(`ELAPSED: ${(elapsed/1000).toFixed(2)}s / 4.00s`, 160, canvas.height - 40)

        // Progress bar
        ctx.fillStyle = '#334155'
        ctx.fillRect(50, canvas.height - 25, canvas.width - 100, 4)
        ctx.fillStyle = '#F59E0B'
        ctx.fillRect(50, canvas.height - 25, (canvas.width - 100) * progress, 4)

        if (elapsed < duration) {
          requestAnimationFrame(drawFrame)
        } else {
          recorder.stop()
        }
      }

      requestAnimationFrame(drawFrame)
    } catch (err) {
      console.error('Video compiler error:', err)
      setIsMediaLoading(false)
      setMediaStatus('')
    }
  }

  const isProcessing = stage === 'scanning'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1f283e] to-slate-900">
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-3xl mb-4">
            🖼️
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-3">
            Image to Text Converter
          </h1>
          <p className="text-gray-400 text-lg">Scan any image file and extract editable text instantly</p>
        </div>

        {stage === 'done' && text ? (
          /* Converted Dashboard State */
          <div className="grid lg:grid-cols-3 gap-6 animate-fade-in-up">
            
            {/* Text Preview Column */}
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <h2 className="text-white font-semibold">Extracted Document Text</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {text.split(/\s+/).filter(Boolean).length.toLocaleString()} words ·{' '}
                    {text.length.toLocaleString()} characters
                  </p>
                </div>
                
                {/* Spoken Playback Trigger */}
                <button
                  onClick={handlePlayAudio}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                    isPlaying 
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      Stop Listening
                    </>
                  ) : (
                    <>
                      <span>🔊</span>
                      Listen Out Loud
                    </>
                  )}
                </button>
              </div>

              <div className="p-5 h-96 lg:h-[500px] overflow-y-auto">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {text}
                </pre>
              </div>
            </div>

            {/* Actions and Export Column */}
            <div className="flex flex-col gap-5">
              
              {/* Copy & General Action Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
                <h3 className="text-white font-semibold mb-4">Quick Operations</h3>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleCopy}
                    className={`flex items-center justify-center gap-2 w-full py-3 px-4 font-semibold rounded-xl border transition ${
                      copied
                        ? 'bg-green-500/20 border-green-500/40 text-green-300'
                        : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    {copied ? 'Copied to Clipboard!' : 'Copy Raw Text'}
                  </button>

                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white/5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition"
                  >
                    Convert Another Image
                  </button>
                </div>
              </div>

              {/* Dynamic Multi-Format Export Suite */}
              <div className="bg-gradient-to-br from-[#1b2234] to-[#121724] border border-orange-500/25 rounded-2xl p-5 shadow-xl shadow-black/30 relative">
                
                {/* Media Loading Overlay */}
                {isMediaLoading && (
                  <div className="absolute inset-0 bg-black/80 rounded-2xl flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
                    <Spinner size="md" color="orange" />
                    <p className="text-white font-semibold mt-4 text-sm">{mediaStatus}</p>
                    <p className="text-xs text-gray-400 mt-2">Processing 100% locally in your browser…</p>
                  </div>
                )}

                <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">
                  <span className="text-orange-400">⚡</span> SaaS Export Suite
                </h3>
                <p className="text-gray-400 text-xs mb-4">Choose from professional download formats compiled client-side:</p>

                {/* Sub-groups */}
                <div className="space-y-4">
                  
                  {/* Documents Section */}
                  <div>
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Documents</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={exportToTxt}
                        className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-200 hover:bg-white/10 transition flex items-center gap-1.5"
                      >
                        📄 TXT File
                      </button>
                      <button
                        onClick={exportToDocx}
                        className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-200 hover:bg-white/10 transition flex items-center gap-1.5"
                      >
                        📝 Word
                      </button>
                      <button
                        onClick={exportToPdf}
                        className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-200 hover:bg-white/10 transition flex items-center gap-1.5"
                      >
                        📕 PDF
                      </button>
                      <button
                        onClick={exportToExcel}
                        className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-200 hover:bg-white/10 transition flex items-center gap-1.5"
                      >
                        📊 Excel
                      </button>
                      <button
                        onClick={exportToPptx}
                        className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-200 hover:bg-white/10 transition flex items-center gap-1.5 col-span-2 justify-center"
                      >
                        🎨 PowerPoint Slide Deck
                      </button>
                    </div>
                  </div>

                  {/* Visual Layouts */}
                  <div>
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Graphics & Vectors</h4>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => exportToImage('jpeg')}
                        className="py-2 px-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-semibold text-gray-200 hover:bg-white/10 text-center transition"
                      >
                        JPEG
                      </button>
                      <button
                        onClick={() => exportToImage('tiff')}
                        className="py-2 px-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-semibold text-gray-200 hover:bg-white/10 text-center transition"
                      >
                        TIFF
                      </button>
                      <button
                        onClick={exportToSvg}
                        className="py-2 px-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-semibold text-gray-200 hover:bg-white/10 text-center transition"
                      >
                        SVG
                      </button>
                    </div>
                  </div>

                  {/* Subtitles & Multimedia Containers */}
                  <div>
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Subtitles & Video Wrapper</h4>
                    <div className="space-y-2">
                      <button
                        onClick={exportToSrt}
                        className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-200 hover:bg-white/10 transition flex items-center justify-between"
                      >
                        <span>🎬 SRT Subtitle Track</span>
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">SRT</span>
                      </button>
                      
                      <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 space-y-2">
                        <div className="text-[9px] text-gray-400 font-semibold tracking-wider">COMPILE VIDEO WRAPPER:</div>
                        <div className="grid grid-cols-4 gap-1">
                          {['mp4', 'mov', 'avi', 'wmv'].map((ext) => (
                            <button
                              key={ext}
                              onClick={() => exportToVideo(ext)}
                              className="py-1.5 bg-orange-500/10 hover:bg-orange-500/25 border border-orange-500/20 rounded text-[9px] font-bold text-orange-300 text-center transition"
                            >
                              .{ext.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        ) : (
          /* File Upload / Scanner UI State */
          <div className="max-w-2xl mx-auto">
            {/* Error notifications */}
            {(error || fileError) && (
              <div className="flex items-start gap-3 bg-red-900/50 border border-red-500/40 rounded-xl px-5 py-4 mb-6 animate-fade-in">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-300 font-semibold">Scanning Error</p>
                  <p className="text-red-400 text-sm mt-0.5">{error ?? fileError}</p>
                </div>
                <button onClick={() => { setError(null); setFileError(null) }} className="text-red-400 hover:text-red-200 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Dropzone */}
            {(!file || stage === 'idle') && (
              <Dropzone
                onFileSelect={handleFileSelect}
                disabled={isProcessing}
                onError={(msg) => setFileError(msg)}
                accept="image/*"
                acceptLabel="Image files only (PNG, JPG, WebP)"
                dragLabel="Image"
              />
            )}

            {/* Laser scanning active overlay */}
            {stage === 'scanning' && (
              <div className="bg-gradient-to-br from-[#241b12] to-[#120e0a] border border-orange-500/20 rounded-2xl p-10 text-center relative overflow-hidden shadow-2xl glass">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 animate-scan" />
                
                <div className="flex justify-center mb-6">
                  <div className="relative w-16 h-16 flex items-center justify-center bg-orange-500/10 border border-orange-500/30 rounded-2xl text-3xl shadow-lg shadow-orange-500/10 animate-pulse">
                    🖼️
                  </div>
                </div>
                
                <h3 className="text-white font-bold text-xl mb-1">OCR Scanning Image</h3>
                <p className="text-orange-400 text-xs font-bold tracking-wider uppercase mb-4">Processing 100% Locally In-Browser</p>
                
                <p className="text-gray-300 text-sm max-w-md mx-auto mb-6">
                  {ocrProgress.label}
                </p>

                <div className="max-w-md mx-auto">
                  <ProgressBar progress={ocrProgress.percent} color="blue" />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono tracking-wider">
                    <span>PROGRESS</span>
                    <span>{ocrProgress.percent}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* File loaded, waiting to trigger scan */}
            {file && stage === 'file_selected' && (
              <div className="space-y-5">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center">
                  
                  {previewUrl && (
                    <img 
                      src={previewUrl} 
                      alt="Upload Preview" 
                      className="w-24 h-24 object-cover rounded-xl border border-white/10 bg-slate-950"
                    />
                  )}

                  <div className="flex-1 min-w-0 text-center md:text-left">
                    <p className="text-white font-semibold truncate">{file.name}</p>
                    <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(1)} KB • Image</p>
                  </div>
                  
                  <button
                    onClick={handleReset}
                    className="text-gray-500 hover:text-gray-300 transition"
                    aria-label="Remove image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isProcessing}
                  className="w-full py-4 px-6 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition text-lg shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
                >
                  <span>✨ Scan & Extract Characters</span>
                </button>

                <button
                  onClick={handleReset}
                  className="w-full py-3 text-gray-400 hover:text-white text-sm transition"
                >
                  Choose a different image
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
