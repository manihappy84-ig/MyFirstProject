'use client'

import { useState } from 'react'
import { PDFUploader } from './PDFUploader'
import { PasswordInput } from './PasswordInput'

type ConversionType = 'text' | 'word' | 'unlock'

interface ConversionResult {
  type: ConversionType
  fileName: string
  success: boolean
  message?: string
  text?: string
  downloadUrl?: string
}

export function PDFConverterTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [conversionType, setConversionType] = useState<ConversionType>('text')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setError(null)
    setResult(null)
    setPassword(null)
  }

  const handleConvertToText = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/convert/to-text', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to convert PDF')
      }

      const data = await response.json()
      setResult({
        type: 'text',
        fileName: data.fileName,
        success: true,
        text: data.text,
        message: `Successfully extracted text from ${data.fileName}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConvertToWord = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/convert/to-word', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to convert PDF')
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)

      setResult({
        type: 'word',
        fileName: selectedFile.name.replace('.pdf', '_converted.docx'),
        success: true,
        downloadUrl,
        message: `Successfully converted ${selectedFile.name} to Word format`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnlockPDF = async (pwd: string) => {
    if (!selectedFile) return

    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('password', pwd)

      const response = await fetch('/api/convert/unlock', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to unlock PDF')
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)

      setResult({
        type: 'unlock',
        fileName: selectedFile.name.replace('.pdf', '_unlocked.pdf'),
        success: true,
        downloadUrl,
        message: `Successfully unlocked ${selectedFile.name}`,
      })
      setPassword(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = () => {
    if (result?.downloadUrl) {
      const a = document.createElement('a')
      a.href = result.downloadUrl
      a.download = result.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleCopyText = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text)
      alert('Text copied to clipboard!')
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setResult(null)
    setError(null)
    setPassword(null)
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Conversion Type Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-200">
        {(['text', 'word', 'unlock'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              setConversionType(type)
              setResult(null)
              setError(null)
              setPassword(null)
            }}
            className={`px-6 py-3 font-medium border-b-2 transition ${
              conversionType === type
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {type === 'text' && 'PDF to Text'}
            {type === 'word' && 'PDF to Word'}
            {type === 'unlock' && 'Unlock PDF'}
          </button>
        ))}
      </div>

      {/* File Upload Section */}
      {!selectedFile || result ? (
        <div className="mb-8">
          <PDFUploader
            onFileSelect={handleFileSelect}
            isLoading={isLoading}
          />
          {selectedFile && result && (
            <p className="text-sm text-gray-600 mt-2">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <p className="text-blue-900 font-medium">
            📄 {selectedFile.name}
          </p>
          <p className="text-blue-700 text-sm mt-1">
            {(selectedFile.size / 1024).toFixed(2)} KB
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <p className="text-red-700">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Result Section */}
      {result ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3 mb-4">
            <svg className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-green-800 font-semibold">{result.message}</p>
            </div>
          </div>

          {/* Text Result */}
          {result.text && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-900">Extracted Text</h3>
                <button
                  onClick={handleCopyText}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                >
                  Copy Text
                </button>
              </div>
              <div className="bg-white border border-gray-300 rounded p-4 max-h-96 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap">
                {result.text}
              </div>
            </div>
          )}

          {/* Download Button */}
          {result.downloadUrl && (
            <button
              onClick={handleDownload}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download {result.type === 'unlock' ? 'Unlocked PDF' : result.type === 'word' ? 'Word Document' : 'Text File'}
            </button>
          )}
        </div>
      ) : null}

      {/* Password Input for Unlock */}
      {selectedFile && conversionType === 'unlock' && !result && (
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Enter PDF Password
          </label>
          <PasswordInput
            onSubmit={handleUnlockPDF}
            isLoading={isLoading}
            placeholder="Enter the protection password"
          />
        </div>
      )}

      {/* Action Buttons */}
      {selectedFile && !result && (
        <div className="flex gap-4">
          {conversionType === 'text' && (
            <button
              onClick={handleConvertToText}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
            >
              {isLoading ? 'Converting...' : 'Convert to Text'}
            </button>
          )}
          {conversionType === 'word' && (
            <button
              onClick={handleConvertToWord}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
            >
              {isLoading ? 'Converting...' : 'Convert to Word'}
            </button>
          )}
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Reset Button After Result */}
      {result && (
        <button
          onClick={handleReset}
          className="w-full px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition"
        >
          Convert Another File
        </button>
      )}
    </div>
  )
}
