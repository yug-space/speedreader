// PDF Processor with multiple fallback methods
// 1. PDF.js for text layer extraction
// 2. Tesseract.js for OCR on scanned PDFs

class PDFProcessor {
  constructor(onProgress) {
    this.onProgress = onProgress || (() => {});
    this.pdfjsLib = null;
    this.Tesseract = null;
  }

  async loadPDFJS() {
    if (this.pdfjsLib) return this.pdfjsLib;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
      script.type = 'module';

      // For PDF.js we need to use the legacy build for better compatibility
      const legacyScript = document.createElement('script');
      legacyScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

      legacyScript.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          this.pdfjsLib = window.pdfjsLib;
          resolve(this.pdfjsLib);
        } else {
          reject(new Error('PDF.js failed to load'));
        }
      };

      legacyScript.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(legacyScript);
    });
  }

  async loadTesseract() {
    if (this.Tesseract) return this.Tesseract;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

      script.onload = () => {
        if (window.Tesseract) {
          this.Tesseract = window.Tesseract;
          resolve(this.Tesseract);
        } else {
          reject(new Error('Tesseract.js failed to load'));
        }
      };

      script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
      document.head.appendChild(script);
    });
  }

  async extractText(file) {
    this.onProgress(5, 'Loading PDF library...');

    try {
      // First try PDF.js text extraction
      const text = await this.extractWithPDFJS(file);

      // Check if we got meaningful text
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

      if (wordCount > 50) {
        this.onProgress(100, 'Extraction complete!');
        return text;
      }

      // If not enough text, try OCR
      console.log('PDF.js extracted only', wordCount, 'words. Trying OCR...');
      this.onProgress(30, 'Text layer sparse. Starting OCR...');

      const ocrText = await this.extractWithOCR(file);
      this.onProgress(100, 'OCR complete!');
      return ocrText;

    } catch (error) {
      console.error('PDF.js failed:', error);
      this.onProgress(20, 'PDF.js failed. Trying OCR...');

      // Fallback to OCR
      try {
        const ocrText = await this.extractWithOCR(file);
        this.onProgress(100, 'OCR complete!');
        return ocrText;
      } catch (ocrError) {
        console.error('OCR also failed:', ocrError);
        throw new Error('Could not extract text from PDF. The file may be corrupted or protected.');
      }
    }
  }

  async extractWithPDFJS(file) {
    await this.loadPDFJS();

    this.onProgress(10, 'Reading PDF...');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const totalPages = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= totalPages; i++) {
      this.onProgress(
        10 + Math.floor((i / totalPages) * 20),
        `Extracting page ${i}/${totalPages}...`
      );

      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ');

      fullText += pageText + ' ';
    }

    return fullText.trim();
  }

  async extractWithOCR(file) {
    await this.loadPDFJS();
    await this.loadTesseract();

    this.onProgress(35, 'Preparing OCR...');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const totalPages = pdf.numPages;
    // Limit pages for OCR to avoid very long processing
    const maxPages = Math.min(totalPages, 50);
    let fullText = '';

    // Create Tesseract worker
    const worker = await this.Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // Update progress during recognition
        }
      }
    });

    for (let i = 1; i <= maxPages; i++) {
      const progressBase = 35 + Math.floor((i / maxPages) * 60);
      this.onProgress(progressBase, `OCR page ${i}/${maxPages}...`);

      try {
        const page = await pdf.getPage(i);

        // Render page to canvas
        const scale = 2; // Higher scale = better OCR quality
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        // OCR the canvas
        const { data: { text } } = await worker.recognize(canvas);
        fullText += text + ' ';

        // Clean up
        canvas.remove();
      } catch (pageError) {
        console.error(`Error processing page ${i}:`, pageError);
      }
    }

    await worker.terminate();

    if (maxPages < totalPages) {
      console.log(`Note: Only processed ${maxPages} of ${totalPages} pages due to OCR limitations`);
    }

    return fullText.trim();
  }
}

// Export for use in popup.js
window.PDFProcessor = PDFProcessor;
