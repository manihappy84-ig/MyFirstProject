'use client'

import { useState, useRef, useCallback } from 'react'

interface DropzoneProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
  maxSizeMB?: number
  onError?: (msg: string) => void
}

export function Dropzone({ onFileSelect, disabled = false, maxSizeMB = 50, onError }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        onError?.('Please select a valid PDF file.')
        return
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        onError?.(`File is too large. Maximum size is ${maxSizeMB}MB.`)
        return
      }
      onFileSelect(file)
    },
    [onFileSelect, maxSizeMB, onError]
  )

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    setIsDragging(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) validateAndSelect(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSelect(file)
    e.target.value = ''
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload PDF file. Click or drag and drop."
      aria-disabled={disabled}
      className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
        isDragging
          ? 'dropzone-active border-blue-400 bg-blue-500/10'
          : 'border-white/20 hover:border-blue-400/50 hover:bg-white/5'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click()
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
        aria-hidden
      />

      <div className="flex flex-col items-center gap-4 pointer-events-none">
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
            isDragging ? 'bg-blue-500/20 scale-110' : 'bg-white/10'
          }`}
        >
          <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        <div>
          <p className="text-xl font-semibold text-white mb-1">
            {isDragging ? 'Drop your PDF here!' : 'Drag & Drop your PDF'}
          </p>
          <p className="text-gray-400">
            or{' '}
            <span className="text-blue-400 font-semibold underline underline-offset-2">
              browse to choose a file
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-3">PDF files only • Maximum {maxSizeMB}MB</p>
        </div>
      </div>
    </div>
  )
}
