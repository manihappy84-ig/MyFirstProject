'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Dropzone } from '@/components/ui/Dropzone'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Spinner } from '@/components/ui/Spinner'
import { downloadBlob } from '@/lib/services/converterService'

type Stage = 'idle' | 'file_selected' | 'processing' | 'done' | 'error'

interface ProcessProgress {
  percent: number
  label: string
}

export default function RemoveWatermarkPage() {
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<ProcessProgress>({ percent: 0, label: '' })
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [cleanedBlob, setCleanedBlob] = useState<Blob | null>(null)

  // Options
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const [removeImages, setRemoveImages] = useState(true)
  const [smartClean, setSmartClean] = useState(true)

  const handleFileSelect = useCallback((f: File) => {
    setFile(f)
    setStage('file_selected')
    setError(null)
    setFileError(null)
    setCleanedBlob(null)
    setProgress({ percent: 0, label: '' })
  }, [])

  const handleReset = () => {
    setFile(null)
    setStage('idle')
    setError(null)
    setFileError(null)
    setCleanedBlob(null)
    setProgress({ percent: 0, label: '' })
  }

  // Inject JSZip from CDN dynamically
  const loadJSZip = async (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).JSZip) {
        resolve((window as any).JSZip)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
      script.onload = () => resolve((window as any).JSZip)
      script.onerror = () => reject(new Error('Failed to load ZIP decompression component.'))
      document.body.appendChild(script)
    })
  }

  // PowerPoint PPTX Watermark Removal
  const cleanPptx = async (fileBytes: ArrayBuffer, searchStr: string): Promise<Blob> => {
    const JSZip = await loadJSZip()
    const zip = await JSZip.loadAsync(fileBytes)
    const lowercaseSearch = searchStr.toLowerCase()

    // Find slides, layouts, and masters
    const filesToProcess: string[] = []
    zip.forEach((path: string) => {
      if (
        path.startsWith('ppt/slides/slide') ||
        path.startsWith('ppt/slideLayouts/slideLayout') ||
        path.startsWith('ppt/slideMasters/slideMaster')
      ) {
        filesToProcess.push(path)
      }
    })

    const totalFiles = filesToProcess.length
    for (let i = 0; i < totalFiles; i++) {
      const filePath = filesToProcess[i]
      const percent = Math.round(((i + 1) / totalFiles) * 80)
      setProgress({
        percent,
        label: `Scanning PowerPoint file shapes (${percent}%)…`
      })

      const xmlContent = await zip.file(filePath).async('string')
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent, 'application/xml')

      // Remove shapes containing text
      const shapes = xmlDoc.getElementsByTagName('p:sp')
      const shapesToRemove: Element[] = []

      for (let j = 0; j < shapes.length; j++) {
        const shape = shapes[j]
        const textRuns = shape.getElementsByTagName('a:t')
        let textVal = ''
        for (let k = 0; k < textRuns.length; k++) {
          textVal += textRuns[k].textContent || ''
        }

        if (textVal.toLowerCase().includes(lowercaseSearch)) {
          shapesToRemove.push(shape)
        } else {
          // Check if named watermark/confidential
          const nvSpPr = shape.getElementsByTagName('p:nvSpPr')[0]
          const nameAttr = nvSpPr?.getElementsByTagName('p:cNvPr')[0]?.getAttribute('name') || ''
          if (
            nameAttr.toLowerCase().includes('watermark') || 
            nameAttr.toLowerCase().includes('confidential')
          ) {
            shapesToRemove.push(shape)
          }
        }
      }

      // Process image shapes
      if (removeImages) {
        const pictures = xmlDoc.getElementsByTagName('p:pic')
        const picsToRemove: Element[] = []
        for (let j = 0; j < pictures.length; j++) {
          const pic = pictures[j]
          const nvPicPr = pic.getElementsByTagName('p:nvPicPr')[0]
          const nameAttr = nvPicPr?.getElementsByTagName('p:cNvPr')[0]?.getAttribute('name') || ''
          if (
            nameAttr.toLowerCase().includes('watermark') || 
            nameAttr.toLowerCase().includes('background')
          ) {
            picsToRemove.push(pic)
          }
        }
        picsToRemove.forEach((p) => p.parentNode?.removeChild(p))
      }

      shapesToRemove.forEach((s) => s.parentNode?.removeChild(s))

      const serializer = new XMLSerializer()
      const newXml = serializer.serializeToString(xmlDoc)
      zip.file(filePath, newXml)
    }

    setProgress({ percent: 90, label: 'Compiling PPTX container…' })
    const outputBlob = await zip.generateAsync({ type: 'blob' })
    return outputBlob
  }

  // PDF Watermark Removal
  const cleanPdf = async (fileBytes: ArrayBuffer, searchStr: string): Promise<Blob> => {
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(fileBytes)
    const pages = pdfDoc.getPages()
    const lowercaseSearch = searchStr.toLowerCase()
    const totalPages = pages.length

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i]
      const percent = Math.round(((i + 1) / totalPages) * 80)
      setProgress({
        percent,
        label: `Scanning PDF page content streams ${i + 1} of ${totalPages} (${percent}%)…`
      })

      // Modify page content streams
      const { getContentStreams } = page as any
      if (typeof getContentStreams === 'function') {
        const streams = getContentStreams.call(page)
        for (const stream of streams) {
          const bytes = stream.getContents()
          const rawText = new TextDecoder('utf-8').decode(bytes)

          if (rawText.toLowerCase().includes(lowercaseSearch)) {
            let cleanedText = rawText

            // Replace occurrences inside text display operators
            // Handles simple text formats (CONFIDENTIAL) Tj or similar
            const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(`\\([^)]*${escaped}[^)]*\\)`, 'gi')
            cleanedText = cleanedText.replace(regex, '()')

            if (smartClean) {
              // Strip transparent background operators that are typical watermark artifacts
              cleanedText = cleanedText
                .replace(/\/GS\d+\s+gs/g, '') // strip transparency state operators
                .replace(/\/Gs\d+\s+gs/g, '')
            }

            stream.setContents(new TextEncoder().encode(cleanedText))
          }
        }
      }

      // Remove large background image overlays
      if (removeImages) {
        const resources = (page.node as any).Resources()
        if (resources) {
          const xObjects = resources.get((page.node as any).context.obj('XObject'))
          if (xObjects) {
            const keys = xObjects.keys()
            for (const key of keys) {
              const xObject = xObjects.get(key)
              if (xObject) {
                const subtype = xObject.get((page.node as any).context.obj('Subtype'))
                if (subtype && subtype.toString() === '/Image') {
                  const width = xObject.get((page.node as any).context.obj('Width'))?.value
                  const height = xObject.get((page.node as any).context.obj('Height'))?.value
                  
                  // Identify large background watermark images
                  if (width && height && width > 400 && height > 400) {
                    xObjects.set(key, (page.node as any).context.obj({}))
                  }
                }
              }
            }
          }
        }
      }
    }

    setProgress({ percent: 90, label: 'Compiling PDF document layout…' })
    const outputBytes = await pdfDoc.save()
    return new Blob([outputBytes as any], { type: 'application/pdf' })
  }

  const handleProcess = async () => {
    if (!file) return
    setError(null)
    setStage('processing')
    setProgress({ percent: 10, label: 'Initializing file clean stream…' })

    try {
      const bytes = await file.arrayBuffer()
      let resultBlob: Blob

      if (file.name.endsWith('.pptx')) {
        resultBlob = await cleanPptx(bytes, watermarkText)
      } else {
        resultBlob = await cleanPdf(bytes, watermarkText)
      }

      setProgress({ percent: 100, label: 'Watermarks successfully removed!' })
      setCleanedBlob(resultBlob)
      setStage('done')
    } catch (err: any) {
      console.error('Watermark removal error:', err)
      setError(err.message || 'Watermark removal failed. Make sure the file format is valid.')
      setStage('error')
    }
  }

  const handleDownload = () => {
    if (!cleanedBlob || !file) return
    const prefix = file.name.replace(/\.[^/.]+$/, '')
    const ext = file.name.endsWith('.pptx') ? 'pptx' : 'pdf'
    downloadBlob(cleanedBlob, `${prefix}_cleaned.${ext}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1f2638] to-slate-900">
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
            <span className="text-white font-bold">ai2026</span>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-3xl mb-4">
            ✨
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent mb-3">
            Remove Watermark
          </h1>
          <p className="text-gray-400 text-lg">Strip text or background image watermarks from PDF and PPTX files</p>
        </div>

        {stage === 'done' && cleanedBlob ? (
          /* Finished State */
          <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center shadow-xl animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 text-3xl mb-6">
              🎉
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Watermark Stripped!</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Your document has been cleaned. The watermark layers have been filtered out client-side with full data privacy.
            </p>

            <div className="space-y-4">
              <button
                onClick={handleDownload}
                className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
              >
                <span>💾</span> Download Cleaned File
              </button>

              <button
                onClick={handleReset}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-xl transition text-sm"
              >
                Clean Another File
              </button>
            </div>
          </div>
        ) : (
          /* Upload / Settings State */
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Options Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg h-fit space-y-6">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span>⚙️</span> Cleanup Settings
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Watermark Text to Erase
                  </label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. CONFIDENTIAL"
                    className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-500 transition"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['CONFIDENTIAL', 'DRAFT', 'SAMPLE', 'COPY'].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWatermarkText(w)}
                        className={`text-[9px] font-bold px-2 py-1 rounded border transition ${
                          watermarkText === w 
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' 
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={removeImages}
                      onChange={(e) => setRemoveImages(e.target.checked)}
                      className="mt-0.5 rounded border-white/10 text-rose-600 focus:ring-0 focus:ring-offset-0 bg-transparent"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white group-hover:text-rose-300 transition">
                        Remove Background Images
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                        Identify and erase large background image overlays.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={smartClean}
                      onChange={(e) => setSmartClean(e.target.checked)}
                      className="mt-0.5 rounded border-white/10 text-rose-600 focus:ring-0 focus:ring-offset-0 bg-transparent"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white group-hover:text-rose-300 transition">
                        Smart Opacity Cleanup
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                        Strip transparent graphics operators linked to watermarks.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right Upload Panel */}
            <div className="lg:col-span-2">
              
              {/* Error box */}
              {(error || fileError) && (
                <div className="flex items-start gap-3 bg-red-900/50 border border-red-500/40 rounded-xl px-5 py-4 mb-6">
                  <div className="flex-1">
                    <p className="text-red-300 font-semibold text-sm">Error Processing Document</p>
                    <p className="text-red-400 text-xs mt-0.5">{error ?? fileError}</p>
                  </div>
                  <button onClick={() => { setError(null); setFileError(null); }} className="text-red-400 hover:text-red-200">
                    ✕
                  </button>
                </div>
              )}

              {/* Upload Stage */}
              {stage === 'idle' && (
                <Dropzone
                  onFileSelect={handleFileSelect}
                  onError={(msg) => setFileError(msg)}
                  accept=".pdf,.pptx"
                  acceptLabel="PDF files (.pdf) and PowerPoint files (.pptx) only"
                  dragLabel="Document"
                />
              )}

              {/* Processing Stage */}
              {stage === 'processing' && (
                <div className="bg-slate-950/20 border border-white/10 rounded-2xl p-10 text-center relative overflow-hidden shadow-2xl glass">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-pink-400 to-rose-500 animate-scan" />
                  
                  <div className="flex justify-center mb-6">
                    <Spinner size="lg" color="purple" />
                  </div>
                  
                  <h3 className="text-white font-bold text-xl mb-1">Removing Watermark</h3>
                  <p className="text-rose-400 text-xs font-bold tracking-wider uppercase mb-4">Processing 100% In-Browser</p>
                  <p className="text-gray-300 text-sm mb-6">{progress.label}</p>

                  <div className="max-w-md mx-auto">
                    <ProgressBar progress={progress.percent} color="purple" />
                  </div>
                </div>
              )}

              {/* Ready to process */}
              {file && stage === 'file_selected' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
                  <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                    <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-center text-3xl">
                      {file.name.endsWith('.pptx') ? '📊' : '📕'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate text-lg">{file.name}</p>
                      <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(1)} KB · Document</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-gray-500 hover:text-white transition p-2"
                      aria-label="Remove file"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 flex gap-3 text-xs text-rose-300 leading-relaxed">
                    <span>💡</span>
                    <div>
                      Click the button below to strip matching text shapes and background overlays. All data remains in your browser memory.
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleProcess}
                      className="flex-1 py-4 px-6 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-rose-500/25 text-base flex items-center justify-center gap-2"
                    >
                      ✨ Remove Watermarks
                    </button>

                    <button
                      onClick={handleReset}
                      className="py-4 px-6 bg-white/5 border border-white/10 text-gray-300 hover:text-white font-semibold rounded-xl transition text-base"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}
      </div>
    </div>
  )
}
