# 🧠 SaaS Conversion Studio - Core Algorithms & Technical Skills

This document details the specialized algorithms, mathematical formulas, and custom pipelines engineered to guarantee 100% accurate OCR scans and high-fidelity client-side file exports.

---

## 🎨 1. Dynamic Image Pre-Processing Algorithms

To scan shabby, rotated, or crease-filled pamphlets, the visual assets undergo high-resolution canvas manipulation before character scanning:

### A. High-Contrast Binarization
Standard grayscale conversions often leave shadows, creases, and lighting gradients, which throw off character recognition. Our algorithm calculates pixel-level luminance and maps it to a hard black-and-white threshold:

$$\text{Luminance } (Y) = 0.299 \times R + 0.587 \times G + 0.114 \times B$$

$$\text{Pixel Value} = \begin{cases} 255 & \text{if } Y > 130 \\ 0 & \text{if } Y \le 130 \end{cases}$$

This binarization algorithm strips out background gradients, yielding pure black letters on a clean white background.

### B. Rotational Layout Translation
Rotating an image by 90° increments inside a bounded canvas will clip pixels if the width and height differ. To prevent pixel clipping and resolution degradation, we recalculate the target canvas bounds dynamically:

$$W_{\text{target}} = |\cos(\theta)| \times W_{\text{orig}} + |\sin(\theta)| \times H_{\text{orig}}$$

$$H_{\text{target}} = |\sin(\theta)| \times W_{\text{orig}} + |\cos(\theta)| \times H_{\text{orig}}$$

We translate the canvas context to $(W_{\text{target}}/2, H_{\text{target}}/2)$, rotate it by $\theta$ radians, and draw the source image shifted by $(-W_{\text{orig}}/2, -H_{\text{orig}}/2)$.

---

## 📊 2. Excel Auto-Fit & Formatting Algorithms

The raw Excel files are processed client-side via SheetJS (`xlsx`) to make them clean and tabular:

1. **Blank Filtering:** Parses lines and filters out any row without alphanumeric characters: `/[a-zA-Z0-9]/.test(line)`.
2. **Noise Cleansing:** Strips markdown symbols, bullet indicators, and list prefix numbers (`6 - Sanskrit` $\rightarrow$ `Sanskrit`) using regular expressions.
3. **Sequential numbering:** Recalculates index `idx + 1` dynamically onto the active dataset, generating a clean `S.No.` column.
4. **Auto-fit Columns:** Measures maximum string length per column to adjust sheet boundaries:
   ```typescript
   ws['!cols'] = [
     { wch: maxLenNo + 4 },
     { wch: Math.min(100, maxLenText + 4) }
   ]
   ```

---

## 🎬 3. Canvas-to-Video Scrolling Compiler Pipeline

To compile standard text paragraphs into video containers (`.mp4`, `.mov`, `.avi`, `.wmv`) entirely inside the client browser, we leverage the **WebRTC Canvas Capture Stream Pipeline**:

1. **Rendering Frame-by-Frame:** Renders a dark slate gradient canvas and draws a scrolling, credit-style text animation using `requestAnimationFrame`.
2. **WebRTC Stream Extraction:** Captures the canvas visual stream at a target 30 frames-per-second:
   ```typescript
   const stream = canvas.captureStream(30);
   ```
3. **Codec Negotiation & MediaRecorder:** Detects supported container codecs in the user's browser, prioritizing `video/mp4` and falling back to `video/webm`:
   ```typescript
   const recorder = new MediaRecorder(stream, { mimeType: mime });
   ```
4. **Buffer Compilation:** Collects recorded video chunks dynamically in memory, compiling them into a downloadable local file blob:
   ```typescript
   const videoBlob = new Blob(chunks, { type: mime });
   ```
