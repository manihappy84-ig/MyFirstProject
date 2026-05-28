# 🔄 SaaS Conversion Studio - Operational Workflow

This document documents the step-by-step conversion lifecycle, data progression, and operational pipeline from raw file upload to multi-format exports.

---

## 🗺️ Operational Flow Diagram

```mermaid
graph TD
    %% Step 1: Upload
    subgraph 📤 1. Upload Phase
        A[User Uploads File] --> B{Check File Type}
        B -->|Image: PNG/JPG/WEBP| C[Load Image Preview]
        B -->|PDF Document| D[Load PDF Metadata]
    end

    %% Step 2: Pre-process
    subgraph ⚙️ 2. Pre-Processing Phase
        C --> E[User Uses Rotate Toolbar]
        E --> F[Toggle Grayscale Contrast]
        F --> G[Offscreen Canvas Binarization]
    end

    %% Step 3: Scan
    subgraph 🔍 3. Scanning Phase
        G --> H[Initialize Tesseract WebWorker]
        H --> I[Scan Characters in Background]
        D --> J{Text Layer Found?}
        J -->|Yes| K[Extract Direct Text Layer]
        J -->|No: Scanned PDF| L[PDF.js Page Canvas Renderer]
        L --> H
    end

    %% Step 4: AI Enrichment
    subgraph ✨ 4. Semantic Refinement
        I & K --> M[Original Text Displayed]
        M --> N{Trigger AI Assistant?}
        N -->|Yes: Clean/Summarize/Format| O[Secure Mistral API Request]
        O --> P[Mistral AI Model Output]
        P --> Q[AI Version Tab Loaded]
        N -->|No| R[Export Original Directly]
    end

    %% Step 5: Export
    subgraph 💾 5. Export Phase
        Q & R --> S[Select Export Layout Tab]
        S --> T[SaaS Multi-Format Exports]
        T --> U[Dynamic In-Memory Blob Assembly]
        U --> V([Download Triggered])
    end

    style A fill:#38bdf8,stroke:#0369a1,stroke-width:2px,color:#0f172a
    style V fill:#34d399,stroke:#047857,stroke-width:2px,color:#0f172a
```

---

## 🚶 Step-by-Step Walkthrough

### 1. Upload Phase
* **Trigger:** User uploads a file using the dropzone.
* **Metadata Check:** Component checks file type constraints (`accept` parameter).
* **State Transition:** UI shifts from `idle` to `file_selected` state.

### 2. Pre-processing Phase (Images Only)
* **Visual Tweak:** User checks the layout. If the photo was taken sideways, they click **Rotate 90°** to align it.
* **Contrast Tweak:** If the document has shadows or creased borders, the user clicks **Enhance Contrast** to run a pixel contrast binarization filter.
* **Canvas Compile:** The pre-processed image is drawn onto an offscreen canvas at high resolution, preserving text sharpness.

### 3. Scanning & Character Extraction (OCR)
* **Direct Vector Scan (PDFs):** readable PDFs bypass Tesseract, directly copying vector text characters in milliseconds.
* **Scanned Scan (PDFs/Images):** Scanned pages are loaded dynamically via PDF.js, drawn onto high-resolution canvases at a `2.0` multiplier, and processed page-by-page by `Tesseract.js` WebWorkers.

### 4. Semantic Refinement (Mistral AI Assistant)
* **Typos Correction:** The user clicks **Clean OCR Typos**. The raw text is passed to Mistral AI via our backend route `/api/ai/process`. The AI corrects typos, bad spacing, and spelling errors, then returns a cleaned layout.
* **Executive Bullets:** The user clicks **Summarize Document** to generate executive bulleted summaries.
* **Professional Layout:** The user clicks **Professional Formatting** to organize the text with clean business headers.

### 5. Selection, Review & Exports
* **Switcher Verification:** The user toggles between `Original` and `AI Version` to compare text quality.
* **Export Action:** The user picks their target format (Word, PDF, TXT, Excel, PPTX, graphics, subtitle track, or scrolling video representation).
* **Local Assembly:** The file is compiled dynamically in-browser from the active text and downloaded instantly.
