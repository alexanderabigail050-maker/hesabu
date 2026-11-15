const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CONTENT_CHARS = 30_000;
const MAX_PAGES = 60;

function normalizeText(text) {
  return text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
}

/** Extract text locally. Only notes explicitly selected by the learner later travel to the AI endpoint. */
export async function readNoteFile(file) {
  if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size)) throw new Error('Choose a PDF, TXT, or Markdown file.');
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is too large. Choose a file smaller than 10 MB.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['pdf', 'txt', 'md', 'markdown'].includes(extension)) throw new Error('Use a text PDF, .txt, or .md file. Other file types are not supported.');
  const warnings = [];
  let content = '';
  if (extension === 'pdf') {
    // Keep this a native dynamic import: the PDF parser is a separately shipped, self-hosted asset.
    const modulePath = '/vendor/pdf.mjs';
    const pdfjs = await import(/* @vite-ignore */ modulePath);
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.mjs';
    const bytes = new Uint8Array(await file.arrayBuffer());
    let document;
    try {
      document = await pdfjs.getDocument({
        data: bytes, isEvalSupported: false, useWorkerFetch: true,
        cMapUrl: '/vendor/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/standard_fonts/',
      }).promise;
      const pages = Math.min(document.numPages, MAX_PAGES);
      if (document.numPages > MAX_PAGES) warnings.push(`Only the first ${MAX_PAGES} of ${document.numPages} pages were read.`);
      for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const data = await page.getTextContent();
        const parts = data.items.filter(item => typeof item.str === 'string').map(item => `${item.str}${item.hasEOL ? '\n' : ' '}`);
        const text = normalizeText(parts.join(''));
        if (text) content += `${content ? '\n\n' : ''}[Page ${pageNumber}]\n${text}`;
        page.cleanup();
        if (content.length > MAX_CONTENT_CHARS) break;
      }
    } catch (error) {
      if (error?.name === 'PasswordException') throw new Error('This PDF is password protected. Export an unlocked copy first.');
      throw new Error('This PDF could not be read. Try exporting a text PDF, or paste the notes as text.');
    } finally { if (document) await document.destroy(); }
    if (content.replace(/\[Page \d+\]/g, '').trim().length < 20) throw new Error('No usable text was found. Scanned PDFs need OCR first. You can paste their text into a note.');
  } else {
    content = normalizeText(await file.text());
  }
  if (!content.trim()) throw new Error('This file is empty. Choose a file with study notes.');
  if (content.length > MAX_CONTENT_CHARS) {
    warnings.push('Only the first 30,000 characters were kept. Split longer material into shorter notes.');
    content = content.slice(0, MAX_CONTENT_CHARS);
  }
  return { id: crypto.randomUUID(), title: file.name.slice(0, 180), content, createdAt: Date.now(), warnings };
}

export const NOTE_LIMITS = { maxFileBytes: MAX_FILE_BYTES, maxContentChars: MAX_CONTENT_CHARS, maxPdfPages: MAX_PAGES };
