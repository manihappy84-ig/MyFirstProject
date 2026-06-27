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

export default function CreateWatermarkPage() {
  const [files, setFiles] = useState<File[]>([])
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<ProcessProgress>({ percent: 0, label: '' })
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [watermarkedFiles, setWatermarkedFiles] = useState<{ name: string; blob: Blob }[]>([])

  // Create Settings Options
  const [createWatermarkText, setCreateWatermarkText] = useState('CONFIDENTIAL')
  const [createFontSize, setCreateFontSize] = useState(48)
  const [createColor, setCreateColor] = useState<'gray' | 'red' | 'blue' | 'green'>('gray')
  const [createOpacity, setCreateOpacity] = useState(0.2)
  const [createAngle, setCreateAngle] = useState(-45)
  const [mergePdfs, setMergePdfs] = useState(false)

  const allPdfs = files.length > 0 && files.every((f) => f.name.toLowerCase().endsWith('.pdf'))
  const isMergingActive = allPdfs && mergePdfs

  const handleFilesSelect = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles])
    setStage('file_selected')
    setError(null)
    setFileError(null)
    setWatermarkedFiles([])
    setProgress({ percent: 0, label: '' })
  }, [])

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 0) {
        setStage('idle')
      }
      return updated
    })
  }

  const handleReset = () => {
    setFiles([])
    setStage('idle')
    setError(null)
    setFileError(null)
    setWatermarkedFiles([])
    setProgress({ percent: 0, label: '' })
    setMergePdfs(false)
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

  // PDF Watermark Creation
  const addWatermarkToPdf = async (
    fileBytes: ArrayBuffer,
    text: string,
    options: {
      fontSize: number
      color: 'gray' | 'red' | 'blue' | 'green'
      opacity: number
      angle: number
    },
    onProgress?: (p: ProcessProgress) => void
  ): Promise<Blob> => {
    const { PDFDocument, rgb, degrees, StandardFonts } = await import('pdf-lib')
    
    onProgress?.({ percent: 10, label: 'Loading PDF document…' })
    const pdfDoc = await PDFDocument.load(fileBytes)
    const pages = pdfDoc.getPages()
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    const { fontSize, color, opacity, angle } = options
    
    const r = color === 'red' ? 0.9 : color === 'blue' ? 0.1 : color === 'green' ? 0.1 : 0.5
    const g = color === 'red' ? 0.1 : color === 'blue' ? 0.1 : color === 'green' ? 0.7 : 0.5
    const b = color === 'red' ? 0.1 : color === 'blue' ? 0.9 : color === 'green' ? 0.1 : 0.5
    
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const textHeight = font.heightAtSize(fontSize)
    const totalPages = pages.length
    
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i]
      const percent = Math.round(10 + ((i + 1) / totalPages) * 70)
      onProgress?.({
        percent,
        label: `Applying watermark to page ${i + 1} of ${totalPages} (${percent}%)…`
      })
      
      const { width, height } = page.getSize()
      
      // Center with rotation correction
      const rad = (angle * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const cx = width / 2
      const cy = height / 2
      
      const x = cx - (textWidth / 2) * cos + (textHeight / 2) * sin
      const y = cy - (textWidth / 2) * sin - (textHeight / 2) * cos
      
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(r, g, b),
        opacity,
        rotate: degrees(angle),
      })
    }
    
    onProgress?.({ percent: 90, label: 'Finalizing PDF document compile…' })
    const outputBytes = await pdfDoc.save()
    return new Blob([outputBytes as any], { type: 'application/pdf' })
  }

  // PPTX Watermark Creation
  const addWatermarkToPptx = async (
    fileBytes: ArrayBuffer,
    text: string,
    options: {
      fontSize: number
      color: 'gray' | 'red' | 'blue' | 'green'
      opacity: number
      angle: number
    },
    onProgress?: (p: ProcessProgress) => void
  ): Promise<Blob> => {
    const JSZip = await loadJSZip()
    const zip = await JSZip.loadAsync(fileBytes)
    
    const slideFiles: string[] = []
    zip.forEach((path: string) => {
      if (path.startsWith('ppt/slides/slide') && path.endsWith('.xml')) {
        slideFiles.push(path)
      }
    })
    
    const totalSlides = slideFiles.length
    
    const rot = Math.round((360 - options.angle) * 60000) % 21600000
    const sz = options.fontSize * 100
    const colorHex = options.color === 'red' ? 'E61919' : options.color === 'blue' ? '1919E6' : options.color === 'green' ? '19B419' : '808080'
    const alphaVal = Math.round(options.opacity * 100000)
    
    for (let i = 0; i < totalSlides; i++) {
      const filePath = slideFiles[i]
      const percent = Math.round(10 + ((i + 1) / totalSlides) * 80)
      onProgress?.({
        percent,
        label: `Injecting shape watermark on slide ${i + 1} of ${totalSlides} (${percent}%)…`
      })
      
      const xmlContent = await zip.file(filePath).async('string')
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent, 'application/xml')
      
      const spTree = xmlDoc.getElementsByTagName('p:spTree')[0]
      if (spTree) {
        // Standard PPTX slide dimension size (10in x 7.5in) is width=9144000 EMUs, height=6858000 EMUs
        const shapeXml = `
          <p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:nvSpPr>
              <p:cNvPr id="${100000 + i}" name="WatermarkText"/>
              <p:cNvSpPr/>
              <p:nvPr/>
            </p:nvSpPr>
            <p:spPr>
              <a:xfrm rot="${rot}">
                <a:off x="572000" y="2429000"/>
                <a:ext cx="8000000" cy="2000000"/>
              </a:xfrm>
              <a:prstGeom prst="rect">
                <a:avLst/>
              </a:prstGeom>
            </p:spPr>
            <p:txBody>
              <a:bodyPr lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="ctr"/>
              <a:lstStyle/>
              <a:p>
                <a:pPr algn="ctr"/>
                <a:r>
                  <a:rPr lang="en-US" sz="${sz}" bold="1">
                    <a:solidFill>
                      <a:srgbClr val="${colorHex}">
                        <a:alpha val="${alphaVal}"/>
                      </a:srgbClr>
                    </a:solidFill>
                  </a:rPr>
                  <a:t>${text}</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        `
        
        const shapeDoc = new DOMParser().parseFromString(shapeXml, 'application/xml')
        const shapeElement = shapeDoc.documentElement
        const importedNode = xmlDoc.importNode(shapeElement, true)
        spTree.appendChild(importedNode)
        
        const serializer = new XMLSerializer()
        const newXml = serializer.serializeToString(xmlDoc)
        zip.file(filePath, newXml)
      }
    }
    
    onProgress?.({ percent: 95, label: 'Compiling PPTX presentation container…' })
    const outputBlob = await zip.generateAsync({ type: 'blob' })
    return outputBlob
  }

  // Image Watermark Creation
  const addWatermarkToImage = async (
    file: File,
    text: string,
    options: {
      fontSize: number
      color: 'gray' | 'red' | 'blue' | 'green'
      opacity: number
      angle: number
    },
    onProgress?: (p: ProcessProgress) => void
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      onProgress?.({ percent: 20, label: 'Reading image file…' })
      const reader = new FileReader()
      reader.onload = (event) => {
        onProgress?.({ percent: 50, label: 'Drawing watermarked layer…' })
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.drawImage(img, 0, 0)

          ctx.save()
          const cx = canvas.width / 2
          const cy = canvas.height / 2
          ctx.translate(cx, cy)
          ctx.rotate((options.angle * Math.PI) / 180)

          const scaleFactor = canvas.width / 600
          const displayFontSize = Math.max(16, Math.round(options.fontSize * scaleFactor))
          ctx.font = `bold ${displayFontSize}px Helvetica, Arial, sans-serif`

          const colorMap = {
            gray: '128,128,128',
            red: '230,25,25',
            blue: '25,25,230',
            green: '25,180,25',
          }
          const rgbStr = colorMap[options.color] || '128,128,128'
          ctx.fillStyle = `rgba(${rgbStr}, ${options.opacity})`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          ctx.fillText(text, 0, 0)
          ctx.restore()

          onProgress?.({ percent: 90, label: 'Compiling image layout…' })
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Failed to convert canvas to blob'))
              }
            },
            file.type || 'image/jpeg',
            0.95
          )
        }
        img.onerror = () => reject(new Error('Failed to load image file.'))
        img.src = event.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read image file.'))
      reader.readAsDataURL(file)
    })
  }

  // Merge PDF Blobs
  const mergePdfBlobs = async (filesList: { name: string; blob: Blob }[]): Promise<Blob> => {
    const { PDFDocument } = await import('pdf-lib')
    const mergedPdf = await PDFDocument.create()
    
    for (const fileItem of filesList) {
      const arrayBuffer = await fileItem.blob.arrayBuffer()
      const srcDoc = await PDFDocument.load(arrayBuffer)
      const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices())
      copiedPages.forEach((page) => mergedPdf.addPage(page))
    }
    
    const bytes = await mergedPdf.save()
    return new Blob([bytes as any], { type: 'application/pdf' })
  }

  const handleProcess = async () => {
    if (files.length === 0) return
    setError(null)
    setStage('processing')
    setProgress({ percent: 0, label: 'Initializing file stream…' })

    const totalFiles = files.length
    const results: { name: string; blob: Blob }[] = []

    try {
      for (let i = 0; i < totalFiles; i++) {
        const activeFile = files[i]
        const basePercent = (i / totalFiles) * 100

        const fileOnProgress = (fileProgress: ProcessProgress) => {
          const globalPercent = Math.round(basePercent + (fileProgress.percent / totalFiles))
          setProgress({
            percent: globalPercent,
            label: `[File ${i + 1}/${totalFiles}] ${activeFile.name}: ${fileProgress.label}`
          })
        }

        const nameLower = activeFile.name.toLowerCase()
        let resultBlob: Blob

        if (nameLower.endsWith('.pdf')) {
          fileOnProgress({ percent: 5, label: 'Reading PDF buffer…' })
          const bytes = await activeFile.arrayBuffer()
          resultBlob = await addWatermarkToPdf(bytes, createWatermarkText, {
            fontSize: createFontSize,
            color: createColor,
            opacity: createOpacity,
            angle: createAngle
          }, fileOnProgress)
        } else if (nameLower.endsWith('.pptx')) {
          fileOnProgress({ percent: 5, label: 'Reading PPTX buffer…' })
          const bytes = await activeFile.arrayBuffer()
          resultBlob = await addWatermarkToPptx(bytes, createWatermarkText, {
            fontSize: createFontSize,
            color: createColor,
            opacity: createOpacity,
            angle: createAngle
          }, fileOnProgress)
        } else {
          // Process as Image
          resultBlob = await addWatermarkToImage(activeFile, createWatermarkText, {
            fontSize: createFontSize,
            color: createColor,
            opacity: createOpacity,
            angle: createAngle
          }, fileOnProgress)
        }

        results.push({ name: activeFile.name, blob: resultBlob })
      }

      setProgress({ percent: 100, label: 'All files successfully watermarked!' })
      setWatermarkedFiles(results)
      setStage('done')
    } catch (err: any) {
      console.error('Watermark creation error:', err)
      setError(err.message || 'Watermark operation failed. Make sure the file format is valid.')
      setStage('error')
    }
  }

  const handleDownload = async () => {
    if (watermarkedFiles.length === 0) return

    if (watermarkedFiles.length === 1) {
      const fileResult = watermarkedFiles[0]
      const prefix = fileResult.name.replace(/\.[^/.]+$/, '')
      const ext = fileResult.name.split('.').pop() || 'pdf'
      downloadBlob(fileResult.blob, `${prefix}_watermarked.${ext}`)
    } else if (isMergingActive) {
      try {
        setProgress({ percent: 95, label: 'Merging PDF documents…' })
        const mergedBlob = await mergePdfBlobs(watermarkedFiles)
        downloadBlob(mergedBlob, 'watermarked_merged.pdf')
        setProgress({ percent: 100, label: 'Merged PDF downloaded successfully!' })
      } catch (err: any) {
        console.error('PDF merge error:', err)
        setError('Failed to merge PDF documents.')
      }
    } else {
      try {
        setProgress({ percent: 95, label: 'Creating ZIP archive…' })
        const JSZip = await loadJSZip()
        const zip = new JSZip()

        watermarkedFiles.forEach((fileResult) => {
          const prefix = fileResult.name.replace(/\.[^/.]+$/, '')
          const ext = fileResult.name.split('.').pop() || 'pdf'
          zip.file(`${prefix}_watermarked.${ext}`, fileResult.blob)
        })

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(zipBlob, 'watermarked_files.zip')
      } catch (err: any) {
        console.error('ZIP generation error:', err)
        setError('Failed to generate ZIP archive.')
      }
    }
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
            ✍️
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent mb-3">
            Create Watermark
          </h1>
          <p className="text-gray-400 text-lg">
            Add customized diagonal text watermarks to your PDF, PPTX, or Image files
          </p>
        </div>

        {stage === 'done' && watermarkedFiles.length > 0 ? (
          /* Finished State */
          <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center shadow-xl animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 text-3xl mb-6">
              🎉
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Watermark Injected!</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Your documents and images have been processed successfully client-side with full data privacy.
            </p>

            <div className="space-y-4">
              <button
                onClick={handleDownload}
                className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
              >
                <span>💾</span> {
                  watermarkedFiles.length > 1 
                    ? (isMergingActive ? 'Download Merged PDF' : 'Download Files (ZIP)') 
                    : 'Download Processed File'
                }
              </button>

              <button
                onClick={handleReset}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-xl transition text-sm"
              >
                Process Another File
              </button>
            </div>
          </div>
        ) : (
          /* Settings / Upload Columns */
          <div className="grid lg:grid-cols-3 gap-8 animate-fade-in">
            
            {/* Left Column: Settings Panel */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg h-fit space-y-6">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span>⚙️</span> Watermark Design
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Watermark Stamp Text
                  </label>
                  <input
                    type="text"
                    value={createWatermarkText}
                    onChange={(e) => setCreateWatermarkText(e.target.value)}
                    placeholder="e.g. COPY, CONFIDENTIAL"
                    className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-500 transition"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['CONFIDENTIAL', 'COPY', 'DRAFT', 'DO NOT COPY', 'ORIGINAL'].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setCreateWatermarkText(w)}
                        className={`text-[9px] font-bold px-2 py-1 rounded border transition ${
                          createWatermarkText === w 
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' 
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex justify-between">
                    <span>Font Size</span>
                    <span className="text-rose-400 font-bold font-mono">{createFontSize}pt</span>
                  </label>
                  <input
                    type="range"
                    min="18"
                    max="96"
                    value={createFontSize}
                    onChange={(e) => setCreateFontSize(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Color Selection
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'gray' as const, label: 'Gray', bg: 'bg-gray-400' },
                      { id: 'red' as const, label: 'Red', bg: 'bg-red-500' },
                      { id: 'blue' as const, label: 'Blue', bg: 'bg-blue-500' },
                      { id: 'green' as const, label: 'Green', bg: 'bg-green-500' },
                    ].map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setCreateColor(col.id)}
                        className={`py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1.5 border transition ${
                          createColor === col.id
                            ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full ${col.bg} border border-white/20`} />
                        <span>{col.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex justify-between">
                    <span>Opacity / Transparency</span>
                    <span className="text-rose-400 font-bold font-mono">{Math.round(createOpacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={createOpacity}
                    onChange={(e) => setCreateOpacity(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex justify-between">
                    <span>Angle of Rotation</span>
                    <span className="text-rose-400 font-bold font-mono">{createAngle}°</span>
                  </label>
                  <input
                    type="range"
                    min="-90"
                    max="90"
                    value={createAngle}
                    onChange={(e) => setCreateAngle(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>

                {allPdfs && (
                  <label className="flex items-start gap-3 cursor-pointer group pt-2 border-t border-white/5">
                    <input
                      type="checkbox"
                      checked={mergePdfs}
                      onChange={(e) => setMergePdfs(e.target.checked)}
                      className="mt-0.5 rounded border-white/10 text-rose-600 focus:ring-0 focus:ring-offset-0 bg-transparent"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white group-hover:text-rose-300 transition">
                        Merge PDFs into One File
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                        Combine all watermarked PDFs into a single merged file.
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Right Column: Files Upload Area */}
            <div className="lg:col-span-2">
              
              {/* Error messages banner */}
              {(error || fileError) && (
                <div className="flex items-start gap-3 bg-red-900/50 border border-red-500/40 rounded-xl px-5 py-4 mb-6 animate-fade-in">
                  <div className="flex-1">
                    <p className="text-red-300 font-semibold text-sm">Failed to Process</p>
                    <p className="text-red-400 text-xs mt-0.5">{error ?? fileError}</p>
                  </div>
                  <button onClick={() => { setError(null); setFileError(null); }} className="text-red-400 hover:text-red-200">
                    ✕
                  </button>
                </div>
              )}

              {/* Upload stage Dropzone */}
              {stage === 'idle' && (
                <Dropzone
                  onFileSelect={() => {}}
                  onFilesSelect={handleFilesSelect}
                  multiple={true}
                  onError={(msg) => setFileError(msg)}
                  accept=".pdf,.pptx,.png,.jpg,.jpeg,.webp,.gif"
                  acceptLabel="PDF, PPTX, and Image files (.png, .jpg, .jpeg, .webp, .gif) only"
                  dragLabel="Documents & Images"
                />
              )}

              {/* Processing stage */}
              {stage === 'processing' && (
                <div className="bg-slate-950/20 border border-white/10 rounded-2xl p-10 text-center relative overflow-hidden shadow-2xl glass">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-pink-400 to-rose-500 animate-scan" />
                  
                  <div className="flex justify-center mb-6">
                    <Spinner size="lg" color="purple" />
                  </div>
                  
                  <h3 className="text-white font-bold text-xl mb-1">Generating Watermark</h3>
                  <p className="text-rose-400 text-xs font-bold tracking-wider uppercase mb-4">Processing 100% In-Browser</p>
                  <p className="text-gray-300 text-sm mb-6">{progress.label}</p>

                  <div className="max-w-md mx-auto">
                    <ProgressBar progress={progress.percent} color="purple" />
                  </div>
                </div>
              )}

              {/* Queued files display */}
              {files.length > 0 && stage === 'file_selected' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl animate-fade-in-up">
                  <h3 className="text-white font-semibold text-lg border-b border-white/10 pb-3 flex justify-between items-center">
                    <span>Queued Files ({files.length})</span>
                    <button
                      onClick={handleReset}
                      className="text-xs text-gray-400 hover:text-rose-400 transition"
                    >
                      Clear All
                    </button>
                  </h3>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {files.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 transition group">
                        <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-center text-xl">
                          {f.name.toLowerCase().endsWith('.pptx') 
                            ? '📊' 
                            : f.name.toLowerCase().endsWith('.pdf') 
                              ? '📕' 
                              : '🖼️'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{f.name}</p>
                          <p className="text-gray-400 text-xs">{(f.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(idx)}
                          className="text-gray-500 hover:text-rose-400 transition p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          aria-label={`Remove ${f.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.multiple = true
                        input.accept = '.pdf,.pptx,.png,.jpg,.jpeg,.webp,.gif'
                        input.onchange = (e: any) => {
                          const newFiles = Array.from(e.target.files || []) as File[]
                          if (newFiles.length > 0) handleFilesSelect(newFiles)
                        }
                        input.click()
                      }}
                      className="w-full py-2.5 border border-dashed border-white/25 rounded-xl text-xs text-gray-400 hover:text-white hover:border-blue-400/50 hover:bg-white/5 transition flex items-center justify-center gap-2"
                    >
                      ➕ Add More Files
                    </button>
                  </div>

                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 flex gap-3 text-xs text-rose-300 leading-relaxed">
                    <span>💡</span>
                    <div>
                      Click the button below to draw custom diagonal text watermarks directly onto all files client-side.
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleProcess}
                      className="flex-1 py-4 px-6 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-rose-500/25 text-base flex items-center justify-center gap-2"
                    >
                      ✨ Inject Watermarks ({files.length} {files.length === 1 ? 'file' : 'files'})
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
