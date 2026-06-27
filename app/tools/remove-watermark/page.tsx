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
  const [files, setFiles] = useState<File[]>([])
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<ProcessProgress>({ percent: 0, label: '' })
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [cleanedFiles, setCleanedFiles] = useState<{ name: string; blob: Blob }[]>([])

  // Options
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const [removeImages, setRemoveImages] = useState(true)
  const [smartClean, setSmartClean] = useState(true)
  const [mergePdfs, setMergePdfs] = useState(false)

  const allPdfs = files.length > 0 && files.every((f) => f.name.toLowerCase().endsWith('.pdf'))
  const isMergingActive = allPdfs && mergePdfs

  const handleFilesSelect = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles])
    setStage('file_selected')
    setError(null)
    setFileError(null)
    setCleanedFiles([])
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
    setCleanedFiles([])
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

  // Inject pako from CDN dynamically
  const loadPako = async (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pako) {
        resolve((window as any).pako)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js'
      script.onload = () => resolve((window as any).pako)
      script.onerror = () => reject(new Error('Failed to load decompression component.'))
      document.body.appendChild(script)
    })
  }

  // PowerPoint PPTX Watermark Removal
  const cleanPptx = async (fileBytes: ArrayBuffer, searchStr: string, onProgress?: (p: ProcessProgress) => void): Promise<Blob> => {
    const JSZip = await loadJSZip()
    const zip = await JSZip.loadAsync(fileBytes)
    const lowercaseSearch = searchStr.toLowerCase()

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
      onProgress?.({
        percent,
        label: `Scanning PowerPoint file shapes (${percent}%)…`
      })

      const xmlContent = await zip.file(filePath).async('string')
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent, 'application/xml')

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

    onProgress?.({ percent: 90, label: 'Compiling PPTX container…' })
    const outputBlob = await zip.generateAsync({ type: 'blob' })
    return outputBlob
  }

  // PDF Watermark Removal
  const cleanPdf = async (fileBytes: ArrayBuffer, searchStr: string, onProgress?: (p: ProcessProgress) => void): Promise<Blob> => {
    const { PDFDocument, PDFDict, PDFName, PDFArray, PDFStream, PDFRawStream } = await import('pdf-lib')
    const pako = await loadPako()
    const pdfDoc = await PDFDocument.load(fileBytes)
    const pages = pdfDoc.getPages()
    const lowercaseSearch = searchStr.toLowerCase()
    const totalPages = pages.length

    const decompressStream = (stream: any) => {
      const bytes = stream.getContents()
      const filter = stream.dict.get(PDFName.of('Filter'))
      if (filter && filter.toString() === '/FlateDecode') {
        try {
          return { decompressed: pako.inflate(bytes), isCompressed: true }
        } catch (err) {
          console.error("Inflation failed:", err)
          return { decompressed: bytes, isCompressed: false }
        }
      }
      return { decompressed: bytes, isCompressed: false }
    }

    const compressBytes = (bytes: Uint8Array) => {
      return pako.deflate(bytes)
    }

    const cleanStreamText = (stream: any) => {
      const { decompressed, isCompressed } = decompressStream(stream)
      const rawText = new TextDecoder('utf-8').decode(decompressed)
      
      if (rawText.toLowerCase().includes(lowercaseSearch)) {
        let cleanedText = rawText
        const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\([^)]*${escaped}[^)]*\\)`, 'gi')
        cleanedText = cleanedText.replace(regex, '()')
        
        if (smartClean) {
          cleanedText = cleanedText
            .replace(/\/GS\d+\s+gs/g, '')
            .replace(/\/Gs\d+\s+gs/g, '')
        }
        
        let compressed = new TextEncoder().encode(cleanedText)
        if (isCompressed) {
          compressed = compressBytes(compressed)
        }
        
        stream.contents = compressed
        stream.updateDict()
        return true
      }
      return false
    }

    const processedRefs = new Set<string>()
    const cleanXObjects = (xObjectsDict: any, depth = 0) => {
      if (!(xObjectsDict instanceof PDFDict)) return
      
      const keys = xObjectsDict.keys()
      for (const key of keys) {
        const xObjectRef = xObjectsDict.get(key)
        if (!xObjectRef) continue
        
        const refStr = xObjectRef.toString()
        if (processedRefs.has(refStr)) continue
        processedRefs.add(refStr)
        
        const xObject = pdfDoc.context.lookup(xObjectRef) as any
        if (!xObject) continue
        
        let dictObj = null
        if (xObject instanceof PDFDict) {
          dictObj = xObject
        } else if (xObject.dict instanceof PDFDict) {
          dictObj = xObject.dict
        }
        
        if (dictObj) {
          const subtype = dictObj.get(PDFName.of('Subtype'))
          const subtypeStr = subtype ? subtype.toString() : ''
          
          if (subtypeStr === '/Form') {
            const hasGroup = dictObj.get(PDFName.of('Group')) !== undefined
            const streamSize = typeof xObject.getContents === 'function' ? xObject.getContents().length : 0
            
            if (hasGroup && streamSize > 1000) {
              xObject.contents = new Uint8Array([])
              xObject.updateDict()
            } else {
              if (xObject instanceof PDFStream || xObject instanceof PDFRawStream) {
                cleanStreamText(xObject)
              }
              
              const resourcesRef = dictObj.get(PDFName.of('Resources'))
              if (resourcesRef) {
                const resources = pdfDoc.context.lookup(resourcesRef)
                if (resources instanceof PDFDict) {
                  const nestedXObjectsRef = resources.get(PDFName.of('XObject'))
                  if (nestedXObjectsRef) {
                    const nestedXObjects = pdfDoc.context.lookup(nestedXObjectsRef)
                    cleanXObjects(nestedXObjects, depth + 1)
                  }
                }
              }
            }
          } else if (subtypeStr === '/Image' && removeImages) {
            const widthObj = dictObj.get(PDFName.of('Width'))
            const heightObj = dictObj.get(PDFName.of('Height'))
            
            const getNum = (o: any) => {
              if (!o) return undefined
              const resolved = pdfDoc.context.lookup(o)
              if (resolved && typeof (resolved as any).asNumber === 'function') {
                return (resolved as any).asNumber()
              }
              if (resolved && typeof (resolved as any).value === 'number') {
                return (resolved as any).value
              }
              return undefined
            }
            
            const width = getNum(widthObj)
            const height = getNum(heightObj)
            
            if (width && height && width > 400 && height > 400) {
              xObjectsDict.set(key, pdfDoc.context.obj({}))
            }
          }
        }
      }
    }

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i]
      const percent = Math.round(((i + 1) / totalPages) * 80)
      onProgress?.({
        percent,
        label: `Scanning page ${i + 1} of ${totalPages} (${percent}%)…`
      })

      const contentsRef = page.node.Contents()
      if (contentsRef) {
        const contents = pdfDoc.context.lookup(contentsRef)
        const contentStreams = []
        if (contents instanceof PDFArray) {
          for (let idx = 0; idx < contents.size(); idx++) {
            contentStreams.push(pdfDoc.context.lookup(contents.get(idx)))
          }
        } else {
          contentStreams.push(contents)
        }
        
        contentStreams.forEach((stream) => {
          if (stream instanceof PDFStream || stream instanceof PDFRawStream) {
            cleanStreamText(stream)
          }
        })
      }

      const resourcesRef = (page.node as any).Resources()
      if (resourcesRef) {
        const resources = pdfDoc.context.lookup(resourcesRef)
        if (resources instanceof PDFDict) {
          const xObjectsRef = resources.get(PDFName.of('XObject'))
          if (xObjectsRef) {
            const xObjects = pdfDoc.context.lookup(xObjectsRef)
            cleanXObjects(xObjects, 1)
          }
        }
      }
    }

    onProgress?.({ percent: 90, label: 'Compiling PDF document layout…' })
    const outputBytes = await pdfDoc.save()
    return new Blob([outputBytes as any], { type: 'application/pdf' })
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
    setProgress({ percent: 0, label: 'Initializing file clean stream…' })

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

        fileOnProgress({ percent: 5, label: 'Reading file buffer…' })
        const bytes = await activeFile.arrayBuffer()
        let resultBlob: Blob

        if (activeFile.name.endsWith('.pptx')) {
          resultBlob = await cleanPptx(bytes, watermarkText, fileOnProgress)
        } else {
          resultBlob = await cleanPdf(bytes, watermarkText, fileOnProgress)
        }

        results.push({ name: activeFile.name, blob: resultBlob })
      }

      setProgress({ percent: 100, label: 'All files successfully cleaned!' })
      setCleanedFiles(results)
      setStage('done')
    } catch (err: any) {
      console.error('Watermark removal error:', err)
      setError(err.message || 'Watermark removal failed. Make sure the file format is valid.')
      setStage('error')
    }
  }

  const handleDownload = async () => {
    if (cleanedFiles.length === 0) return

    if (cleanedFiles.length === 1) {
      const fileResult = cleanedFiles[0]
      const prefix = fileResult.name.replace(/\.[^/.]+$/, '')
      const ext = fileResult.name.endsWith('.pptx') ? 'pptx' : 'pdf'
      downloadBlob(fileResult.blob, `${prefix}_cleaned.${ext}`)
    } else if (isMergingActive) {
      try {
        setProgress({ percent: 95, label: 'Merging PDF documents…' })
        const mergedBlob = await mergePdfBlobs(cleanedFiles)
        downloadBlob(mergedBlob, 'watermarks_removed_merged.pdf')
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

        cleanedFiles.forEach((fileResult) => {
          const prefix = fileResult.name.replace(/\.[^/.]+$/, '')
          const ext = fileResult.name.endsWith('.pptx') ? 'pptx' : 'pdf'
          zip.file(`${prefix}_cleaned.${ext}`, fileResult.blob)
        })

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(zipBlob, 'watermarks_removed.zip')
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
            ✨
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent mb-3">
            Remove Watermark
          </h1>
          <p className="text-gray-400 text-lg">Strip text or background image watermarks from PDF and PPTX files</p>
        </div>

        {stage === 'done' && cleanedFiles.length > 0 ? (
          /* Finished State */
          <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center shadow-xl animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 text-3xl mb-6">
              🎉
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Watermark Stripped!</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Your documents have been cleaned. The watermark layers have been filtered out client-side with full data privacy.
            </p>

            <div className="space-y-4">
              <button
                onClick={handleDownload}
                className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
              >
                <span>💾</span> {
                  cleanedFiles.length > 1 
                    ? (isMergingActive ? 'Download Merged PDF' : 'Download Cleaned Files (ZIP)') 
                    : 'Download Cleaned File'
                }
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
                          Combine all clean PDF documents into a single merged PDF file.
                        </p>
                      </div>
                    </label>
                  )}
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
                  onFileSelect={() => {}}
                  onFilesSelect={handleFilesSelect}
                  multiple={true}
                  onError={(msg) => setFileError(msg)}
                  accept=".pdf,.pptx"
                  acceptLabel="PDF files (.pdf) and PowerPoint files (.pptx) only"
                  dragLabel="Documents"
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
                          {f.name.endsWith('.pptx') ? '📊' : '📕'}
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
                        input.accept = '.pdf,.pptx'
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
                      Click the button below to strip matching text shapes and background overlays. All files are processed sequentially in your browser memory.
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleProcess}
                      className="flex-1 py-4 px-6 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-rose-500/25 text-base flex items-center justify-center gap-2"
                    >
                      ✨ Remove Watermarks ({files.length} {files.length === 1 ? 'file' : 'files'})
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
