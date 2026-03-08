'use client'

import { PDFConverterTool } from '@/components/PDFConverterTool'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="bg-black bg-opacity-50 border-b border-blue-500 border-opacity-20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center font-bold text-white">
              AI
            </div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              ai2026
            </h1>
            <span className="text-xs text-gray-400 ml-2">v1.0</span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm">
            <a href="#converter" className="text-gray-300 hover:text-white transition">
              Converter
            </a>
            <a href="#features" className="text-gray-300 hover:text-white transition">
              Features
            </a>
            <a href="#contact" className="text-gray-300 hover:text-white transition">
              Contact
            </a>
          </nav>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="mb-12">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-4">
            PDF Tools for 2026
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Convert PDFs to Text or Word, unlock password-protected documents, all in one powerful online tool
          </p>
        </div>

        {/* Features Grid */}
        <div id="features" className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: '📝',
              title: 'PDF to Text',
              description: 'Extract text from any PDF instantly'
            },
            {
              icon: '📄',
              title: 'PDF to Word',
              description: 'Convert PDFs to editable Word documents'
            },
            {
              icon: '🔓',
              title: 'Unlock PDF',
              description: 'Remove password protection easily'
            }
          ].map((feature, i) => (
            <div key={i} className="bg-white bg-opacity-10 backdrop-blur border border-white border-opacity-20 rounded-xl p-6 hover:bg-opacity-20 transition">
              <div className="text-4xl mb-3">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Services & Engineering Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-4xl font-bold text-white text-center mb-6">AI Services &amp; Engineering</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white bg-opacity-10 backdrop-blur border border-white border-opacity-20 rounded-xl p-6">
            <h3 className="text-2xl font-semibold text-white mb-2">AI Services</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Custom Model Development</li>
              <li>API &amp; Integration</li>
              <li>Data Strategy &amp; Preparation</li>
            </ul>
          </div>
          <div className="bg-white bg-opacity-10 backdrop-blur border border-white border-opacity-20 rounded-xl p-6">
            <h3 className="text-2xl font-semibold text-white mb-2">AI Engineering</h3>
            <p className="text-gray-300">Scalable, secure, and maintainable AI systems built for production.</p>
          </div>
          <div className="bg-white bg-opacity-10 backdrop-blur border border-white border-opacity-20 rounded-xl p-6">
            <h3 className="text-2xl font-semibold text-white mb-2">Consulting</h3>
            <p className="text-gray-300">Expert guidance on AI adoption and best practices.</p>
          </div>
        </div>
      </div>

      {/* Converter Section */}
      <div id="converter" className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-white bg-opacity-5 backdrop-blur-xl border border-white border-opacity-10 rounded-2xl p-8 md:p-12 shadow-2xl">
          <h2 className="text-3xl font-bold text-white text-center mb-2">
            Start Converting
          </h2>
          <p className="text-gray-400 text-center mb-12">
            Upload your PDF and choose your conversion method
          </p>
          
          <PDFConverterTool />
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white mb-4">Why Choose ai2026?</h3>
            {[
              '⚡ Lightning-fast conversion',
              '🔒 Secure & private processing',
              '📱 Works on all devices',
              '🎯 No registration required',
              '💾 Download instantly',
              '🆓 Always free'
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-300">
                <span className="text-xl">{feature.split(' ')[0]}</span>
                <span>{feature.split(' ').slice(1).join(' ')}</span>
              </div>
            ))}
          </div>

          <div className="bg-white bg-opacity-5 backdrop-blur border border-white border-opacity-10 rounded-xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6">How It Works</h3>
            <ol className="space-y-4 text-gray-300">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">1</span>
                <span>Upload your PDF file</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">2</span>
                <span>Choose your conversion type</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">3</span>
                <span>Click convert and wait</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">4</span>
                <span>Download your file instantly</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div id="contact" className="bg-black bg-opacity-50 border-t border-blue-500 border-opacity-20 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400">
          <p className="mb-4">© 2026 ai2026. All rights reserved.</p>
          <p className="text-sm">
            Built with Next.js, React & Tailwind CSS
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <a href="https://github.com/manihappy84-ig/MyFirstProject" className="text-blue-400 hover:text-blue-300">
              GitHub
            </a>
            <span className="text-gray-600">•</span>
            <a href="#" className="text-blue-400 hover:text-blue-300">
              Terms
            </a>
            <span className="text-gray-600">•</span>
            <a href="#" className="text-blue-400 hover:text-blue-300">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
