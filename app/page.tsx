'use client'

import { useState } from 'react'
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
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [leadSubmitted, setLeadSubmitted] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1e3a5f] to-slate-900">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          
          {/* Logo / Brand */}
          <a href="#" className="flex items-center gap-2.5 hover:opacity-90 transition">
            <span className="text-2xl font-black text-rose-500 tracking-tight">OCR</span>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white tracking-tight leading-none">InfyGalaxy</span>
              <span className="text-[8px] font-bold text-rose-400 tracking-widest mt-1 leading-none">SHAPING AI TOOLS</span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2" aria-label="Main navigation">
            {[
              { label: 'About Us', action: () => setActiveModal('about') },
              { label: 'OCR', action: () => { const el = document.getElementById('tools'); el?.scrollIntoView({ behavior: 'smooth' }) } },
              { label: 'Services', action: () => { const el = document.getElementById('tools'); el?.scrollIntoView({ behavior: 'smooth' }) } },
              { label: 'AI Solutions', action: () => setActiveModal('ai-solutions') },
              { label: 'Tools', action: () => { const el = document.getElementById('tools'); el?.scrollIntoView({ behavior: 'smooth' }) } },
              { label: 'Hire AI Experts', action: () => setActiveModal('hire') },
              { label: 'Blog', action: () => setActiveModal('blog') },
              { label: 'Contact Us', action: () => { const el = document.getElementById('contact'); el?.scrollIntoView({ behavior: 'smooth' }) } }
            ].map((menu) => (
              <button
                key={menu.label}
                onClick={menu.action}
                className="px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition font-medium"
              >
                {menu.label}
              </button>
            ))}
          </nav>

          {/* Right Area: Login Button & Mobile Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveModal('login')}
              className="hidden sm:flex items-center gap-2 border border-rose-500/30 hover:border-rose-500 text-white font-medium text-sm px-4 py-1.5 rounded-full hover:bg-rose-500/10 transition"
            >
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
              <span>Login</span>
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden text-gray-400 hover:text-white transition p-2"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 bg-slate-950/95 p-4 flex flex-col gap-2">
            {[
              { label: 'About Us', action: () => { setActiveModal('about'); setIsMobileMenuOpen(false); } },
              { label: 'OCR', action: () => { const el = document.getElementById('tools'); el?.scrollIntoView({ behavior: 'smooth' }); setIsMobileMenuOpen(false); } },
              { label: 'Services', action: () => { const el = document.getElementById('tools'); el?.scrollIntoView({ behavior: 'smooth' }); setIsMobileMenuOpen(false); } },
              { label: 'AI Solutions', action: () => { setActiveModal('ai-solutions'); setIsMobileMenuOpen(false); } },
              { label: 'Tools', action: () => { const el = document.getElementById('tools'); el?.scrollIntoView({ behavior: 'smooth' }); setIsMobileMenuOpen(false); } },
              { label: 'Hire AI Experts', action: () => { setActiveModal('hire'); setIsMobileMenuOpen(false); } },
              { label: 'Blog', action: () => { setActiveModal('blog'); setIsMobileMenuOpen(false); } },
              { label: 'Contact Us', action: () => { const el = document.getElementById('contact'); el?.scrollIntoView({ behavior: 'smooth' }); setIsMobileMenuOpen(false); } }
            ].map((menu) => (
              <button
                key={menu.label}
                onClick={menu.action}
                className="w-full text-left py-2 px-3 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition"
              >
                {menu.label}
              </button>
            ))}
            <button
              onClick={() => { setActiveModal('login'); setIsMobileMenuOpen(false); }}
              className="mt-2 w-full flex items-center justify-center gap-2 border border-rose-500/30 text-white font-medium text-sm py-2 rounded-xl hover:bg-rose-500/10 transition"
            >
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
              <span>Login</span>
            </button>
          </div>
        )}
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

      {/* ── Modals ─────────────────────────────────────────── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900/95 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden glass">
            {/* Close Button */}
            <button
              onClick={() => { setActiveModal(null); setLeadSubmitted(false); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition text-lg font-bold"
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* Modal - LOGIN */}
            {activeModal === 'login' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 text-xl mb-3">🔑</div>
                  <h3 className="text-xl font-bold text-white">Login to InfyGalaxy</h3>
                  <p className="text-gray-400 text-xs mt-1">Manage your enterprise OCR models & projects</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); setActiveModal(null); }} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
                    <input type="email" required placeholder="name@company.com" className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Password</label>
                    <input type="password" required placeholder="••••••••" className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500" />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm transition mt-4">
                    Continue to Dashboard
                  </button>
                </form>
                <div className="text-center pt-2">
                  <a href="#" className="text-xs text-gray-500 hover:text-gray-300">Forgot your password?</a>
                </div>
              </div>
            )}

            {/* Modal - ABOUT */}
            {activeModal === 'about' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 text-xl mb-3">🏢</div>
                  <h3 className="text-xl font-bold text-white">About InfyGalaxy</h3>
                </div>
                <div className="space-y-3 text-sm text-gray-300 leading-relaxed pt-2">
                  <p>
                    InfyGalaxy is at the forefront of digital transformation, engineering high-speed OCR, document parsing, and semantic correction pipelines.
                  </p>
                  <p>
                    By combining browser-local WebAssembly execution (Layer 1) with secure generative models (Layer 2), we enable organizations to digitize records with 100% data privacy and zero server overhead.
                  </p>
                </div>
              </div>
            )}

            {/* Modal - AI SOLUTIONS */}
            {activeModal === 'ai-solutions' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 text-xl mb-3">🤖</div>
                  <h3 className="text-xl font-bold text-white">AI Solutions Suite</h3>
                </div>
                <div className="space-y-3 text-sm text-gray-300 pt-2">
                  {[
                    { title: '📝 Smart Typos Correction', desc: 'Contextual correction mapping corrupt OCR letters back to proper location terms.' },
                    { title: '📊 Tabular Structure Mining', desc: 'Parses complex visual spreadsheets, receipts, and invoices into cleanly organized digital grids.' },
                    { title: '🔒 Automated Redaction', desc: 'Intelligently identifies and censors PII, signatures, and confidential numbers entirely client-side.' }
                  ].map((sol, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-3">
                      <h4 className="font-semibold text-rose-300 text-xs">{sol.title}</h4>
                      <p className="text-gray-400 text-[11px] mt-0.5">{sol.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal - HIRE EXPERTS */}
            {activeModal === 'hire' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 text-xl mb-3">💼</div>
                  <h3 className="text-xl font-bold text-white">Hire AI & OCR Experts</h3>
                  <p className="text-gray-400 text-xs mt-1">Get custom document workflows built by our core engineering team</p>
                </div>
                {leadSubmitted ? (
                  <div className="text-center py-6 space-y-2 animate-fade-in">
                    <span className="text-3xl">🎉</span>
                    <h4 className="font-bold text-white text-base">Inquiry Submitted!</h4>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto">Thank you for reaching out. An InfyGalaxy integration specialist will review your request and contact you within 24 hours.</p>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); setLeadSubmitted(true); }}
                    className="space-y-3 pt-2"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Your Name</label>
                      <input type="text" required placeholder="John Doe" className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Work Email</label>
                      <input type="email" required placeholder="john@company.com" className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Project Description</label>
                      <textarea required rows={3} placeholder="Tell us about the document pipelines you want to automate..." className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500 resize-none" />
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm transition mt-3">
                      Submit Consultation Request
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Modal - BLOG */}
            {activeModal === 'blog' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 text-xl mb-3">📰</div>
                  <h3 className="text-xl font-bold text-white">InfyGalaxy Blog</h3>
                </div>
                <div className="space-y-3 pt-2 max-h-80 overflow-y-auto pr-1">
                  {[
                    { date: 'June 2026', title: 'Why Local-First OCR is the Future of Privacy', desc: 'Analyzing the performance benefits of processing character recognition directly on client Webworkers.' },
                    { date: 'May 2026', title: 'Intelligent Table Reconstruction with Small LLMs', desc: 'How semantic models reconstruct mangled OCR names by identifying context clues in Indian geographic directories.' },
                    { date: 'April 2026', title: 'Auto-fitting Column Widths in Client-Side Spreadsheet Generation', desc: 'A deep dive into SheetJS cell length measurements for flawless Excel exports.' }
                  ].map((post, idx) => (
                    <div key={idx} className="border-b border-white/5 pb-3 last:border-0">
                      <span className="text-[9px] text-rose-400 font-bold uppercase">{post.date}</span>
                      <h4 className="font-semibold text-white text-xs mt-0.5 hover:text-rose-300 cursor-pointer transition">{post.title}</h4>
                      <p className="text-gray-400 text-[11px] mt-1 line-clamp-2">{post.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
