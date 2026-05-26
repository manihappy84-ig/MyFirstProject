import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ai2026 - PDF Converter & Unlock Tool',
  description: 'Convert PDFs to Text or Word documents, and unlock password-protected PDFs. Free, fast, and secure PDF tools online.',
  keywords: 'PDF converter, PDF to text, PDF to word, unlock PDF, password removal',
  openGraph: {
    title: 'ai2026 - PDF Converter & Unlock Tool',
    description: 'Convert PDFs to Text or Word documents, and unlock password-protected PDFs.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
