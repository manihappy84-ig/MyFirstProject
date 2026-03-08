'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [status, setStatus] = useState<string>('Loading...')
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/health')
        if (response.ok) {
          setStatus('✅ Backend Connected')
        }
      } catch (error) {
        setStatus('❌ Backend Error')
      }
    }

    checkStatus()

    // Check Supabase connection
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      setSupabaseConnected(true)
    }
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          My First Project
        </h1>
        <p className="text-gray-600 mb-6">
          Next.js + Supabase + Vercel + Render
        </p>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700">Backend Status</p>
            <p className="text-lg mt-2">{status}</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700">Supabase</p>
            <p className="text-lg mt-2">
              {supabaseConnected ? '✅ Connected' : '❌ Not Configured'}
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700">Environment</p>
            <p className="text-lg mt-2">
              {process.env.NODE_ENV === 'production' ? '🚀 Production' : '💻 Development'}
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-4">
            Ready for deployment to Vercel & Render
          </p>
          <div className="flex gap-2 justify-center">
            <a
              href="https://github.com/manihappy84-ig/MyFirstProject"
              className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
            >
              GitHub
            </a>
            <span className="text-gray-300">•</span>
            <a
              href="https://supabase.com"
              className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
            >
              Supabase
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
