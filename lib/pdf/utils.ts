import { PDFDocument } from 'pdf-lib';

/**
 * Extract text from PDF using pdfjs-dist
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

/**
 * Convert PDF to DOCX (Word format)
 * Note: For production, consider using a service like LibreOffice or CloudConvert
 */
export async function convertPDFToWord(buffer: Buffer): Promise<Buffer> {
  try {
    // Extract text from PDF
    const text = await extractTextFromPDF(buffer);
    
    // Create basic DOCX structure (simplified)
    // For production, use a library like 'docx'
    const docx = generateBasicDocx(text);
    
    return docx;
  } catch (error) {
    throw new Error(`Failed to convert PDF to Word: ${error}`);
  }
}

/**
 * Generate basic DOCX content from text
 */
function generateBasicDocx(text: string): Buffer {
  // This is a simplified version
  // For production, use the 'docx' npm package: npm install docx
  const docContent = `<?xml version="1.0" encoding="UTF-8"?>
<document xmlns="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <body>
    <p>${escapeXml(text).split('\n').map(line => `<r><t>${line}</t></r>`).join('</p><p>')}</p>
  </body>
</document>`;
  
  return Buffer.from(docContent, 'utf-8');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Remove password from PDF
 */
export async function removePDFPassword(
  buffer: Buffer,
  password: string
): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load({ pdfBuffer: buffer, ignoreEncryption: true });
    
    // Clone the PDF without encryption
    const newPdfDoc = await PDFDocument.create();
    const copiedPages = await newPdfDoc.copyPages(
      pdfDoc,
      pdfDoc.getPageIndices()
    );
    
    copiedPages.forEach((page) => newPdfDoc.addPage(page));
    
    const pdfBytes = await newPdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    throw new Error(`Failed to remove password from PDF: ${error}`);
  }
}

/**
 * Validate PDF file
 */
export async function isPDFFile(buffer: Buffer): Promise<boolean> {
  try {
    // PDF files start with %PDF
    return buffer.toString('utf8', 0, 4) === '%PDF';
  } catch {
    return false;
  }
}

/**
 * Get PDF info (page count, etc)
 */
export async function getPDFInfo(
  buffer: Buffer
): Promise<{ pageCount: number; isEncrypted: boolean }> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    
    return {
      pageCount: pdf.numPages,
      isEncrypted: pdf.isEncrypted,
    };
  } catch (error) {
    throw new Error(`Failed to get PDF info: ${error}`);
  }
}
