'use client'

import { useRouter } from 'next/navigation'

const TOOLS = [
  {
    id: 'pdf-to-text',
    icon: '📝',
    title: 'PDF to Text',
    description: 'Extract all text from any PDF instantly. Perfect for research, editing, and data analysis.',
    href: '/tools/pdf-to-text',
    gradient: 'from-blue-500 to-cyan-500',
    badge: 'Most Popular',
    badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  },
  {
    id: 'pdf-to-word',
    icon: '📄',
    title: 'PDF to Word',
    description: 'Convert PDFs to fully editable Word (.docx) documents — formatting preserved.',
    href: '/tools/pdf-to-word',
    gradient: 'from-purple-500 to-pink-500',
    badge: 'Popular',
    badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  },
  {
    id: 'image-to-text',
    icon: '🖼️',
    title: 'Image to Text',
    description: 'Scan and extract characters from images (PNG, JPG, WebP) and download in 10+ formats.',
    href: '/tools/image-to-text',
    gradient: 'from-orange-500 to-amber-500',
    badge: 'New',
    badgeColor: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  },
  {
    id: 'unlock-pdf',
    icon: '🔓',
    title: 'Unlock PDF',
    description: 'Remove password protection from secured PDFs instantly and securely.',
    href: '/tools/unlock-pdf',
    gradient: 'from-green-500 to-emerald-500',
    badge: 'Free',
    badgeColor: 'bg-green-500/20 text-green-300 border border-green-500/30',
  },
]

export default function Home() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1e3a5f] to-slate-900">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">
              AI
            </div>
            <div>
              <span className="text-xl font-bold text-white">ai2026</span>
              <span className="text-xs text-gray-500 ml-2">v1.0</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {['Converter', 'Features', 'Contact'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-blue-300 font-medium">Free • No signup • Instant results</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          PDF & Image Tools for{' '}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            2026
          </span>
        </h1>

        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
          Convert PDFs and images, unlock passwords, clean OCR errors, and export documents — fast, secure, and completely free.
        </p>

        <a
          href="#tools"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:opacity-90 transition shadow-lg shadow-blue-500/25 text-lg"
        >
          Get Started Free
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </a>
      </section>

      {/* ── Tool Cards (THE FIX: real <button> with router.push) ── */}
      <section id="tools" className="max-w-7xl mx-auto px-4 pb-24" aria-label="PDF Tools">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">Choose Your Tool</h2>
          <p className="text-gray-400">Click any card below to get started immediately</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              id={`tool-${tool.id}`}
              type="button"
              onClick={() => router.push(tool.href)}
              className="group tool-card glass glass-hover rounded-2xl p-8 text-left w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2"
              aria-label={`Open ${tool.title} tool`}
            >
              {/* Icon + Badge row */}
              <div className="flex items-start justify-between mb-6">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  {tool.icon}
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${tool.badgeColor}`}>
                  {tool.badge}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                {tool.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">{tool.description}</p>

              {/* CTA row */}
              <div className={`flex items-center gap-2 text-sm font-semibold bg-gradient-to-r ${tool.gradient} bg-clip-text text-transparent`}>
                <span>Open Tool</span>
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section
        id="features"
        className="max-w-7xl mx-auto px-4 py-20 border-t border-white/10"
        aria-label="Features"
      >
        <h2 className="text-3xl font-bold text-white text-center mb-3">Why ai2026?</h2>
        <p className="text-gray-400 text-center mb-12">Professional-grade PDF tools, available to everyone</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '⚡', title: 'Lightning Fast', desc: 'Convert in seconds, not minutes' },
            { icon: '🔒', title: 'Secure & Private', desc: 'Files never stored on our servers' },
            { icon: '📱', title: 'Works Everywhere', desc: 'Desktop, tablet, and mobile' },
            { icon: '🆓', title: 'Always Free', desc: 'No subscription, no hidden fees' },
            { icon: '🎯', title: 'No Account Needed', desc: 'Start converting immediately' },
            { icon: '💾', title: 'Instant Download', desc: 'Results ready in one click' },
          ].map((f, i) => (
            <div key={i} className="glass rounded-xl p-6 flex items-start gap-4">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <h3 className="text-white font-semibold mb-1">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer id="contact" className="bg-black/50 border-t border-white/10 py-10 mt-10">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500">
          <p>© 2026 ai2026. All rights reserved.</p>
          <p className="text-sm mt-2">Built with Next.js, React & Tailwind CSS</p>
          <div className="flex justify-center gap-6 mt-4">
            <a
              href="https://github.com/manihappy84-ig/MyFirstProject"
              className="text-blue-400 hover:text-blue-300 text-sm transition"
            >
              GitHub
            </a>
            <a href="#" className="text-blue-400 hover:text-blue-300 text-sm transition">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
