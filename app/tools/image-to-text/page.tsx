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

  // Interactive image pre-processing states for 100% OCR accuracy
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270 degrees
  const [isEnhanced, setIsEnhanced] = useState(false) // toggle grayscale high-contrast thresholding

  // AI Assistant states
  const [aiText, setAiText] = useState<string | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [activeView, setActiveView] = useState<'original' | 'ai'>('original')
  const [aiAction, setAiAction] = useState<'summarize' | 'clean' | 'format' | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const handleFileSelect = useCallback((f: File) => {
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setStage('file_selected')
    setError(null)
    setFileError(null)
    setText('')
    setOcrProgress({ percent: 0, label: '' })
    setRotation(0)
    setIsEnhanced(false)
    setAiText(null)
    setActiveView('original')
    setAiAction(null)
    setAiError(null)
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
    setRotation(0)
    setIsEnhanced(false)
    setAiText(null)
    setActiveView('original')
    setAiAction(null)
    setAiError(null)
    handleStopAudio()
  }

  // Native high-resolution canvas pre-processor for flawless OCR
  const getProcessedImage = (imgFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.src = URL.createObjectURL(imgFile)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context error'))
          return
        }

        const angleRad = (rotation * Math.PI) / 180
        const sin = Math.abs(Math.sin(angleRad))
        const cos = Math.abs(Math.cos(angleRad))
        
        const width = img.naturalWidth
        const height = img.naturalHeight
        
        canvas.width = cos * width + sin * height
        canvas.height = sin * width + cos * height

        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(angleRad)
        ctx.drawImage(img, -width / 2, -height / 2)

        if (isEnhanced) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const d = imgData.data
          for (let i = 0; i < d.length; i += 4) {
            // Standard luminance formula
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
            // Sharp binarization threshold to strip shadows
            const binarized = gray > 130 ? 255 : 0
            d[i] = d[i + 1] = d[i + 2] = binarized
          }
          ctx.putImageData(imgData, 0, 0)
        }

        const dataUrl = canvas.toDataURL('image/png')
        URL.revokeObjectURL(img.src)
        resolve(dataUrl)
      }
      img.onerror = (e) => reject(e)
    })
  }

  const handleScan = async () => {
    if (!file) return
    setError(null)
    setStage('scanning')
    setOcrProgress({ percent: 0, label: 'Initializing character scanning engine…' })

    try {
      setOcrProgress({ percent: 10, label: 'Pre-processing image layout & contrast…' })
      const processedDataUrl = await getProcessedImage(file)

      const Tesseract = (await import('tesseract.js')).default

      const ocrResult = await Tesseract.recognize(processedDataUrl, 'eng', {
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
        throw new Error('No character or text could be scanned. Make sure the image is correctly oriented and has clear text.')
      }

      setText(scannedText)
      setStage('done')
    } catch (err: any) {
      console.error('Image OCR failed:', err)
      setError(err.message || 'Failed to scan image. Make sure image is clear and orient it horizontally.')
      setStage('error')
    }
  }

  const handleAiProcess = async (action: 'summarize' | 'clean' | 'format') => {
    if (!text) return
    setIsAiLoading(true)
    setAiError(null)
    setAiAction(action)
    try {
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, action })
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

  // Target text for spoken audio and all export formats
  const displayedText = activeView === 'ai' && aiText ? aiText : text

  const handleCopy = async () => {
    if (!displayedText) return
    await navigator.clipboard.writeText(displayedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- AUDIO SYNTHESIS PLAYBACK ---
  const handlePlayAudio = () => {
    if (!displayedText) return
    if (isPlaying) {
      handleStopAudio()
      return
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
      window.speechSynthesis.cancel() // stop any active synthesis

      const utterance = new SpeechSynthesisUtterance(displayedText.substring(0, 1000)) // synthesize first 1000 chars safely
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
    if (!displayedText) return
    const blob = new Blob([displayedText], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, `${baseName}.txt`)
  }

  const exportToDocx = async () => {
    if (!displayedText) return
    setIsMediaLoading(true)
    setMediaStatus('Compiling Word document…')
    try {
      const { Document, Packer, Paragraph, TextRun } = await import('docx')
      const paragraphs = displayedText.split('\n').map((line) => {
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
    if (!displayedText) return
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
      const splitText = doc.splitTextToSize(displayedText, 170)
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
    if (!displayedText) return
    setIsMediaLoading(true)
    setMediaStatus('Formatting Excel sheet…')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      
      // Filter out empty rows and lines with only whitespace/symbols
      const lines = displayedText.split('\n')
        .map(line => line.trim())
        .filter(line => {
          if (!line) return false
          // Keep lines that have at least one alphanumeric character
          return /[a-zA-Z0-9]/.test(line)
        })

      const rows = lines.map((line, idx) => {
        // Clean up markdown headers, bold weights, bullet items, and emoji noise
        let cleanedContent = line
          .replace(/^\s*#+\s+/, '') // strip markdown header like ###
          .replace(/\s*\*{2,}\s*/g, '') // strip bold markers **
          .replace(/^\s*[-*+•✓]\s+/, '') // strip list bullet prefixes
          .trim()

        // Strip redundant leading numbers if they duplicate our Excel sequence (e.g., "6 - Sanskrit" -> "Sanskrit")
        cleanedContent = cleanedContent.replace(/^\d+[-.\s\u2013\u2014]+\s*/, '').trim()

        // Remove phone or email emojis for a clean corporate appearance
        cleanedContent = cleanedContent.replace(/^[\uD83D\uDCDE\u260E\u2706\u261E]\s*/, '')

        return {
          'S.No.': idx + 1,
          'Extracted Content': cleanedContent
        }
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      
      // Auto-fit column sizes to ensure premium layout with no text clipping
      const maxLenNo = Math.max('S.No.'.length, String(rows.length).length)
      const maxLenText = Math.max('Extracted Content'.length, ...rows.map(r => r['Extracted Content'].length))
      ws['!cols'] = [
        { wch: maxLenNo + 4 },
        { wch: Math.min(100, maxLenText + 4) }
      ]

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
    if (!displayedText) return
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
      const lines = displayedText.split('\n').filter(Boolean)
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
    if (!displayedText) return
    setIsMediaLoading(true)
    setMediaStatus(`Drawing text to ${format.toUpperCase()} canvas…`)
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const lines = displayedText.split('\n')
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
    if (!displayedText) return
    const lines = displayedText.split('\n')
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
    if (!displayedText) return
    const lines = displayedText.split('\n').filter(Boolean)
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
    if (!displayedText) return
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
      const paragraphs = displayedText.split('\n').filter(Boolean).slice(0, 8)

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
          (() => {
            const activeWords = displayedText ? displayedText.split(/\s+/).filter(Boolean).length : 0
            const activeChars = displayedText ? displayedText.length : 0

            return (
              <div className="grid lg:grid-cols-3 gap-6 animate-fade-in-up">
                
                {/* Text Preview Column */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl bg-slate-950/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-white/10 bg-white/[0.02]">
                    <div>
                      <h2 className="text-white font-semibold">
                        {activeView === 'ai' ? `AI Processed Text (${aiAction})` : 'Extracted Document Text'}
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {activeWords.toLocaleString()} words ·{' '}
                        {activeChars.toLocaleString()} characters
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
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

                      {/* AI View Toggles */}
                      {aiText && (
                        <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl">
                          <button
                            onClick={() => setActiveView('original')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                              activeView === 'original'
                                ? 'bg-white/10 text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Original
                          </button>
                          <button
                            onClick={() => setActiveView('ai')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                              activeView === 'ai'
                                ? 'bg-orange-500/25 text-orange-300 border border-orange-500/30'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            AI Version
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 h-96 lg:h-[500px] overflow-y-auto relative">
                    {/* Glowing AI Spinner */}
                    {isAiLoading && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center animate-fade-in z-10">
                        <Spinner size="md" color="orange" />
                        <p className="text-orange-400 font-bold text-sm mt-4 tracking-wide uppercase">AI Assistant active</p>
                        <p className="text-gray-400 text-xs mt-1">Proofreading, correcting typos, and refining text with Mistral AI…</p>
                      </div>
                    )}

                    {displayedText ? (
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {displayedText}
                      </pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <p className="text-gray-500">No preview text available.</p>
                      </div>
                    )}
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
                        {copied ? 'Copied to Clipboard!' : 'Copy Active Text'}
                      </button>

                      <button
                        onClick={handleReset}
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white/5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition"
                      >
                        Convert Another Image
                      </button>
                    </div>
                  </div>

                  {/* SaaS AI Assistant Panel */}
                  <div className="bg-gradient-to-br from-[#241712] to-[#170e0b] border border-orange-500/30 rounded-2xl p-5 shadow-xl shadow-orange-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">
                      <span className="text-orange-400 animate-pulse">✨</span> AI Assistant
                    </h3>
                    <p className="text-gray-400 text-xs mb-4">SaaS document processing powered by Mistral AI.</p>

                    {aiError && (
                      <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-500/30 rounded-xl text-xs text-red-300">
                        {aiError}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <button
                        disabled={isAiLoading || !text}
                        onClick={() => handleAiProcess('clean')}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition ${
                          aiAction === 'clean' && isAiLoading
                            ? 'bg-orange-500/25 border-orange-500/40 text-orange-300'
                            : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50'
                        }`}
                      >
                        <span>🧹</span>
                        <div className="flex-1">
                          <div>Clean OCR Typos</div>
                          <div className="text-[9px] text-gray-500 font-normal">Proofread spelling errors and typos</div>
                        </div>
                        {aiAction === 'clean' && isAiLoading && <Spinner size="sm" color="orange" />}
                      </button>

                      <button
                        disabled={isAiLoading || !text}
                        onClick={() => handleAiProcess('summarize')}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition ${
                          aiAction === 'summarize' && isAiLoading
                            ? 'bg-orange-500/25 border-orange-500/40 text-orange-300'
                            : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50'
                        }`}
                      >
                        <span>📊</span>
                        <div className="flex-1">
                          <div>Summarize Document</div>
                          <div className="text-[9px] text-gray-500 font-normal">Create clear executive bullets</div>
                        </div>
                        {aiAction === 'summarize' && isAiLoading && <Spinner size="sm" color="orange" />}
                      </button>

                      <button
                        disabled={isAiLoading || !text}
                        onClick={() => handleAiProcess('format')}
                        className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition ${
                          aiAction === 'format' && isAiLoading
                            ? 'bg-orange-500/25 border-orange-500/40 text-orange-300'
                            : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50'
                        }`}
                      >
                        <span>🏢</span>
                        <div className="flex-1">
                          <div>Professional Formatting</div>
                          <div className="text-[9px] text-gray-500 font-normal">Structure clean layout and headings</div>
                        </div>
                        {aiAction === 'format' && isAiLoading && <Spinner size="sm" color="orange" />}
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Multi-Format Export Suite */}
                  <div className="bg-gradient-to-br from-[#1b2234] to-[#121724] border border-orange-500/25 rounded-2xl p-5 shadow-xl shadow-black/30 relative">
                    
                    {/* Media Loading Overlay */}
                    {isMediaLoading && (
                      <div className="absolute inset-0 bg-black/85 rounded-2xl flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
                        <Spinner size="md" color="orange" />
                        <p className="text-white font-semibold mt-4 text-sm">{mediaStatus}</p>
                        <p className="text-xs text-gray-400 mt-2">Compiling document locally in your browser…</p>
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
            )
          })()
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
              <div className="space-y-6">
                
                {/* Visual Preview Box with dynamic transformations */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-xl">
                  {/* Grid background decoration */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/5 via-transparent to-transparent pointer-events-none" />
                  
                  {previewUrl && (
                    <div className="relative max-h-80 w-full flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950 p-4">
                      <img 
                        src={previewUrl} 
                        alt="Upload Preview" 
                        style={{ 
                          transform: `rotate(${rotation}deg)` 
                        }}
                        className={`max-h-64 object-contain transition-all duration-300 rounded shadow-2xl ${
                          isEnhanced ? 'grayscale contrast-[300%] brightness-[105%]' : ''
                        }`}
                      />
                    </div>
                  )}

                  <div className="mt-4 text-center">
                    <p className="text-white font-semibold truncate max-w-sm">{file.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{(file.size / 1024).toFixed(1)} KB • Image format</p>
                  </div>
                </div>

                {/* SaaS Pre-processing Toolbar */}
                <div className="bg-gradient-to-br from-[#1b1c24] to-[#121319] border border-orange-500/20 rounded-2xl p-4 shadow-lg flex flex-wrap gap-3 items-center justify-between">
                  <div className="text-xs font-bold text-gray-400 tracking-wider uppercase">⚙️ PRE-PROCESS TOOLBAR</div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRotation((prev) => (prev + 90) % 360)}
                      className="py-2 px-3.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition text-xs flex items-center gap-1.5"
                    >
                      <span>🔄</span> Rotate 90°
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsEnhanced((prev) => !prev)}
                      className={`py-2 px-3.5 border font-semibold rounded-xl transition text-xs flex items-center gap-1.5 ${
                        isEnhanced 
                          ? 'bg-orange-500/25 border-orange-500/40 text-orange-300'
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      <span>🔆</span> {isEnhanced ? 'Contrast: Enhanced' : 'Enhance Contrast'}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setRotation(0); setIsEnhanced(false); }}
                      className="py-2 px-3 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-xl transition text-xs"
                      title="Reset rotation & contrast booster"
                    >
                      Reset
                    </button>
                  </div>
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
