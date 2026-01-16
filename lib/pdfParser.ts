export type ProgressCallback = (percent: number, message: string) => void;

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

// Dynamically load PDF.js to avoid SSR issues
async function loadPDFJS() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist');

      // Use local worker file for reliability
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

      return pdfjsLib;
    })();
  }
  return pdfjsLibPromise;
}

export async function extractTextFromPDF(
  file: File,
  onProgress?: ProgressCallback
): Promise<string[]> {
  const progress = onProgress || (() => {});

  progress(5, 'Loading PDF library...');
  console.log('Starting PDF extraction for file:', file.name, 'Size:', file.size);

  try {
    // First try PDF.js text extraction
    const text = await extractWithPDFJS(file, progress);

    // Check if we got meaningful text
    const words = text
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    console.log('PDF.js extracted', words.length, 'words');

    if (words.length > 50) {
      progress(100, 'Extraction complete!');
      return words;
    }

    // If not enough text, try OCR
    console.log('Text layer sparse. Trying OCR...');
    progress(30, 'Text layer sparse. Starting OCR...');

    const ocrText = await extractWithOCR(file, progress);
    progress(100, 'OCR complete!');

    return ocrText
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
  } catch (error) {
    console.error('PDF.js extraction failed:', error);
    progress(20, 'PDF.js failed. Trying OCR...');

    // Fallback to OCR
    try {
      const ocrText = await extractWithOCR(file, progress);
      progress(100, 'OCR complete!');

      return ocrText
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 0);
    } catch (ocrError) {
      console.error('OCR also failed:', ocrError);
      throw new Error(
        `Could not extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

async function extractWithPDFJS(
  file: File,
  progress: ProgressCallback
): Promise<string> {
  progress(10, 'Reading PDF...');
  console.log('Loading PDF.js library...');

  const pdfjsLib = await loadPDFJS();
  console.log('PDF.js version:', pdfjsLib.version);

  const arrayBuffer = await file.arrayBuffer();
  console.log('File loaded into memory, size:', arrayBuffer.byteLength);

  progress(15, 'Parsing PDF structure...');

  // Create loading task with error handling
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    verbosity: 0, // Reduce console noise
  });

  console.log('Created loading task, waiting for PDF...');
  const pdf = await loadingTask.promise;
  console.log('PDF loaded, pages:', pdf.numPages);

  const totalPages = pdf.numPages;
  let fullText = '';
  let extractedPages = 0;

  for (let i = 1; i <= totalPages; i++) {
    progress(
      15 + Math.floor((i / totalPages) * 15),
      `Extracting page ${i}/${totalPages}...`
    );

    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');

      fullText += pageText + ' ';
      extractedPages++;

      if (i % 50 === 0) {
        console.log(`Processed ${i}/${totalPages} pages...`);
      }
    } catch (pageError) {
      console.warn(`Warning: Could not extract text from page ${i}:`, pageError);
    }
  }

  console.log(`Extraction complete. Processed ${extractedPages}/${totalPages} pages.`);
  console.log('Total text length:', fullText.length);

  return fullText.trim();
}

async function extractWithOCR(
  file: File,
  progress: ProgressCallback
): Promise<string> {
  progress(35, 'Loading OCR engine...');
  console.log('Starting OCR extraction...');

  // Dynamically import Tesseract
  const { createWorker } = await import('tesseract.js');

  const pdfjsLib = await loadPDFJS();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer)
  }).promise;

  const totalPages = pdf.numPages;
  // Limit pages for OCR to avoid very long processing
  const maxPages = Math.min(totalPages, 20);
  let fullText = '';

  progress(40, 'Initializing OCR worker...');
  console.log('Creating Tesseract worker...');

  // Create Tesseract worker
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress?: number }) => {
      // Silent logger
    },
  });

  console.log('Tesseract worker ready. Processing', maxPages, 'pages...');

  for (let i = 1; i <= maxPages; i++) {
    const progressBase = 40 + Math.floor((i / maxPages) * 55);
    progress(progressBase, `OCR processing page ${i}/${maxPages}...`);

    try {
      const page = await pdf.getPage(i);

      // Render page to canvas
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        console.warn(`Could not get canvas context for page ${i}`);
        continue;
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // OCR the canvas
      const result = await worker.recognize(canvas);
      fullText += result.data.text + ' ';

      // Clean up
      canvas.remove();

      if (i % 5 === 0) {
        console.log(`OCR processed ${i}/${maxPages} pages...`);
      }
    } catch (pageError) {
      console.error(`Error OCR processing page ${i}:`, pageError);
    }
  }

  await worker.terminate();
  console.log('OCR complete. Text length:', fullText.length);

  if (maxPages < totalPages) {
    console.log(`Note: Only processed ${maxPages} of ${totalPages} pages`);
  }

  return fullText.trim();
}

// Calculate the ORP (Optimal Recognition Point) index for a word
export function getORPIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}
