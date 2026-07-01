import * as pdfjsLib from 'pdfjs-dist'

// Set worker from jsDelivr matching the exact pdfjs-dist version installed
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.worker.min.mjs'

/**
 * Extracts all text content from a PDF file client-side.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    
    // Extract text items and reconstruct them
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
    
    fullText += `--- Page ${i} ---\n${pageText}\n\n`
  }

  return fullText.trim()
}

/**
 * Extracts text content from a PDF URL, optionally for a specific page.
 */
export async function extractTextFromPdfUrl(url: string, pageNumber?: number): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ url })
  const pdf = await loadingTask.promise

  if (pageNumber !== undefined) {
    if (pageNumber < 1 || pageNumber > pdf.numPages) return ''
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    return textContent.items.map((item: any) => item.str).join(' ').trim()
  }

  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(' ')
    fullText += `--- Page ${i} ---\n${pageText}\n\n`
  }
  return fullText.trim()
}

