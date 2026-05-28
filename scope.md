# 🎯 SaaS Conversion Studio - Project Scope & Boundaries

This document defines the functional boundaries, supported file capacities, technical limitations, and out-of-scope parameters for the SaaS Conversion Studio project.

---

## 📝 1. Project Objective

To build an extremely fast, high-performance, and infinitely scalable document and image utility suite. The suite relies on client-side CPU processing (WebWorkers & WASM) for core tasks (conversion, rendering, and compilation) and integrates a premium AI proofreading assistant (Mistral AI) for flawless textual accuracy.

---

## 💼 2. In-Scope Features & Tools

The platform provides four high-fidelity document utilities:

### 🖼️ A. Image to Text (Advanced OCR Suite)
* **Visual Inputs:** PNG, JPG, JPEG, WEBP, BMP.
* **Canvas Pre-processing:** Real-time 90° rotation and binarization contrast enhancement.
* **Scanning Engine:** Browser-local Tesseract OCR.
* **AI Panel:** Powered by Mistral AI, providing "Clean OCR Typos", "Summarize Document", and "Professional Formatting" with real-time original-to-AI version split preview toggles.
* **Export Options:** TXT, DOCX, PDF, Excel (filtered, cleaned, sequentialised), PowerPoint, JPEG, TIFF, SVG, SRT subtitle track, and 4 scrolling video containers (`.mp4`, `.mov`, `.avi`, `.wmv`).
* **Multimedia:** Local SpeechSynthesis Text-to-Speech (TTS) reading panel.

### 📝 B. PDF to Text (Dynamic Layout Extractor)
* **Vector PDFs:** Scrapes characters directly using native layers in WebWorkers.
* **Scanned PDFs:** Automatically detects missing text layers and triggers browser-local high-fidelity OCR scanning using `PDF.js` at rendering scale `2.0` and `Tesseract.js` multi-threading.
* **AI Assistant:** Proofreads, corrects, formats, or summarizes the text.

### 📄 C. PDF to Word (High-Fidelity Document Builder)
* **Direct Conversion:** Converts readable text into structured `.docx` templates.
* **OCR fallback:** Handles scanned PDFs locally inside the browser, building page breaks (`─── Page X Break ───`) and downloading editable Microsoft Word documents.

### 🔒 D. Unlock PDF (Decryption & Security Stripper)
* **Local Stripping:** Decrypts and removes permission restrictions from owner-locked PDFs entirely in the browser using the `pdf-lib` utility.

---

## ⛔ 3. Out-of-Scope (Non-Goals)

To preserve the zero-maintenance serverless scalability of the application, the following items are explicitly excluded:
* **User Accounts & Authentication:** No database login, user sessions, or subscriptions are managed (fully client-local).
* **Cloud Document Storage:** Documents are processed in-memory and never stored on any cloud database or server disk.
* **Server-side Batch Converting:** No backend workers or message queues are used. This avoids all hosting costs and scaling bottlenecks.
* **Multi-lingual Translation:** The initial scope is optimized for English, Sanskrit, and Hindi character sets.

---

## ⚙️ 4. System Capacity & Operational Limits

| Parameter | Recommended Limit | Technical Rationale |
| :--- | :--- | :--- |
| **Max PDF File Size** | 50 MB | To avoid browser tab crash / Vercel memory exhaustion during client parsing. |
| **Max Image Resolution** | 8000px × 8000px | To prevent GPU canvas buffer overflow in modern browsers. |
| **OCR Page Processing** | Up to 15 pages | High-performance multi-threading works best within standard CPU constraints. |
| **Mistral Context Limit** | First 10,000 characters | Safely fits inside the API response budget to guarantee rapid responses. |
| **Concurrent Users** | **Unlimited** | Fully client-side processing scales infinitely with local hardware capabilities. |
