# 📐 SaaS Conversion Studio - Development Rules & Guidelines

These development rules, bundle strategies, and UI styling guidelines must be strictly followed to preserve the stability, speed, and infinite scaling properties of the platform.

---

## ⚡ 1. Architecture & Execution Rules

### 🚫 Rule A: Zero Heavy Server-Side Operations
* **Requirement:** Never compile downloadable documents, slides, images, or subtitle files inside Next.js serverless routes (`/api`).
* **Rationale:** Vercel serverless functions have strict memory (1024MB on Hobby) and execution timeout (10-second) constraints. High-CPU processing will trigger serverless crash codes.
* **Solution:** All file formats (TXT, Word, PDF, Excel, PowerPoint, JPEG, SVG, SRT, MP4, WebM) **must** be compiled client-side in the browser using the active text states.

### 📦 Rule B: CDN Injection for Heavy Engines (Bypassing Webpack)
* **Requirement:** Large external document libraries (such as `pptxgenjs` and `pdfjs-dist` workers) must be loaded dynamically inside React components using a script promise injection from a trusted CDN (e.g., JSDelivr, Cloudflare) rather than bundled inside Next.js.
* **Rationale:** Webpack 5 client bundler throws errors (e.g., `UnhandledSchemeError` for `node:fs` ESM dependencies) when packaging complex document modules, and heavy engines inflate the initial load size.
* **Implementation Pattern:**
  ```typescript
  const PptxGenJS = await new Promise<any>((resolve, reject) => {
    if ((window as any).PptxGenJS) return resolve((window as any).PptxGenJS)
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
    script.onload = () => resolve((window as any).PptxGenJS)
    script.onerror = () => reject(new Error('CDN failed.'))
    document.body.appendChild(script)
  })
  ```

---

## 🎨 2. UI Style Tokens & Premium Design System

### 🌌 Color Palettes & Atmosphere
Maintain a cohesive, dark, deep slate and navy space-age glassmorphism look:
* **Background:** `bg-gradient-to-br from-slate-900 via-[#1f283e] to-slate-900` (incorporating customized blue, slate, and purple tints per tool).
* **Card Overlays:** Translucent surfaces with thin, semi-transparent borders: `bg-white/5 border border-white/10 backdrop-blur-xl`.
* **Glow accents:** Active state borders must utilize soft amber/orange/blue highlights paired with drop-shadows: `shadow-lg shadow-orange-500/10 border-orange-500/20`.

### 🔄 React State Synchronization Rules
* **Target Syncing:** Every time a user switches between the `Original` and `AI Version` preview panel, the variables `displayedText`, `displayedWords`, and `displayedChars` must be recalculated instantly.
* **Action Target:** All copy buttons, downloads, and speech synthesis targets **must** immediately match the active selected view version.
* **Native-Resolution Canvas:** Always perform image preprocessing rotation and binarization operations on a native offscreen canvas using `img.naturalWidth` and `img.naturalHeight` to avoid degrading image quality before character extraction.

---

## 🛑 3. Next.js Code & Compile Rules

* **TypeScript Strictness:** Strict property definitions. Never use random sizes on UI helper components (e.g., `Spinner` is defined strictly with `size="sm" | "md" | "lg"`).
* **State Resiliency:** Mistral API calls must gracefully handle environment variable discrepancies (e.g. `process.env.MISTRAL_API_KEY || process.env.Mistral`) without throwing server errors.
* **Component Reuse:** Ensure all dropzones pass custom upload parameters (`accept`, `acceptLabel`, `dragLabel`) to guarantee backwards compatibility.
