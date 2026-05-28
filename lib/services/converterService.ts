/**
 * Converter Service — client-side API wrapper
 * All PDF conversion calls go through here.
 */

export interface ConversionResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface TextResult {
  text: string
  fileName: string
  charCount: number
  wordCount: number
}

export interface WordResult {
  blob: Blob
  fileName: string
  text: string
  charCount: number
  wordCount: number
}

export interface UnlockResult {
  blob: Blob
  fileName: string
}

export async function convertPdfToText(file: File): Promise<ConversionResult<TextResult>> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/convert/to-text', { method: 'POST', body: formData })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Server error' }))
      return { success: false, error: err.error || `Server error ${response.status}` }
    }

    const json = await response.json()
    const text: string = json.text || ''
    const words = text.trim().split(/\s+/).filter(Boolean)

    return {
      success: true,
      data: {
        text,
        fileName: json.fileName || file.name,
        charCount: text.length,
        wordCount: words.length,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error. Please try again.' }
  }
}

export async function convertPdfToWord(file: File): Promise<ConversionResult<WordResult>> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/convert/to-word', { method: 'POST', body: formData })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Server error' }))
      return { success: false, error: err.error || `Server error ${response.status}` }
    }

    const json = await response.json()
    const binaryString = window.atob(json.docxBase64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const text: string = json.text || ''
    const words = text.trim().split(/\s+/).filter(Boolean)

    return {
      success: true,
      data: {
        blob,
        fileName: json.fileName || `${file.name.replace(/\.pdf$/i, '')}.docx`,
        text,
        charCount: text.length,
        wordCount: words.length,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error. Please try again.' }
  }
}

export async function unlockPdf(
  file: File,
  password: string
): Promise<ConversionResult<UnlockResult>> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('password', password)

    const response = await fetch('/api/convert/unlock', { method: 'POST', body: formData })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Incorrect password or corrupted PDF' }))
      return { success: false, error: err.error || `Server error ${response.status}` }
    }

    const blob = await response.blob()
    const baseName = file.name.replace(/\.pdf$/i, '')

    return { success: true, data: { blob, fileName: `${baseName}_unlocked.pdf` } }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error. Please try again.' }
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
