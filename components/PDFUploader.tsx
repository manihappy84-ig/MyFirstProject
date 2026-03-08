'use client'

import { useState, useRef } from 'react'

interface PDFUploaderProps {
  onFileSelect: (file: File) => void
  isLoading?: boolean
}

export function PDFUploader({ onFileSelect, isLoading = false }: PDFUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type === 'application/pdf') {
        onFileSelect(file)
      } else {
        alert('Please drop a PDF file')
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0])
    }
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
        dragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleChange}
        className="hidden"
        disabled={isLoading}
      />

      <div className="flex flex-col items-center justify-center py-8">
        <svg
          className="w-16 h-16 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>

        <p className="text-xl font-semibold text-gray-700 mb-2">
          Drag & drop your PDF here
        </p>
        <p className="text-sm text-gray-500">
          or click to select a file
        </p>
        <p className="text-xs text-gray-400 mt-3">
          Maximum file size: 50MB
        </p>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
          <div className="animate-spin">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
