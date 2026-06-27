'use client'

import { useState, useRef, useCallback } from 'react'

interface DropzoneProps {
  onFileSelect: (file: File) => void
  onFilesSelect?: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
  maxSizeMB?: number
  onError?: (msg: string) => void
  accept?: string
  acceptLabel?: string
  dragLabel?: string
}

export function Dropzone({
  onFileSelect,
  onFilesSelect,
  multiple = false,
  disabled = false,
  maxSizeMB = 50,
  onError,
  accept = '.pdf,application/pdf',
  acceptLabel = 'PDF files only',
  dragLabel = 'PDF',
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndSelect = useCallback(
    (filesList: File[]) => {
      const validFiles: File[] = []
      
      const allowedTypes = accept.split(',').map((t) => t.trim().toLowerCase())
      
      for (const file of filesList) {
        const nameLower = file.name.toLowerCase()
        const mimeLower = file.type.toLowerCase()
        
        const isMatch = allowedTypes.some((allowed) => {
          if (allowed.startsWith('.')) {
            return nameLower.endsWith(allowed)
          } else if (allowed.endsWith('/*')) {
            const prefix = allowed.slice(0, -2)
            return mimeLower.startsWith(prefix)
          } else {
            return mimeLower === allowed
          }
        })
        
        if (!isMatch) {
          onError?.(`"${file.name}" is not a valid file format.`)
          continue
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
          onError?.(`"${file.name}" is too large. Maximum size is ${maxSizeMB}MB.`)
          continue
        }
        validFiles.push(file)
      }

      if (validFiles.length > 0) {
        if (multiple && onFilesSelect) {
          onFilesSelect(validFiles)
        } else {
          onFileSelect(validFiles[0])
        }
      }
    },
    [onFileSelect, onFilesSelect, multiple, maxSizeMB, onError, accept]
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
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) validateAndSelect(files)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) validateAndSelect(files)
    e.target.value = ''
  }

  const isPdf = accept.includes('pdf')

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Upload file. Click or drag and drop.`}
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
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
        multiple={multiple}
        aria-hidden
      />

      <div className="flex flex-col items-center gap-4 pointer-events-none">
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
            isDragging ? 'bg-blue-500/20 scale-110' : 'bg-white/10'
          }`}
        >
          {isPdf ? (
            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ) : (
            <span className="text-4xl">🖼️</span>
          )}
        </div>

        <div>
          <p className="text-xl font-semibold text-white mb-1">
            {isDragging ? `Drop your files here!` : `Drag & Drop your files`}
          </p>
          <p className="text-gray-400">
            or{' '}
            <span className="text-blue-400 font-semibold underline underline-offset-2">
              browse to choose files
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-3">{acceptLabel} • Maximum {maxSizeMB}MB</p>
        </div>
      </div>
    </div>
  )
}
