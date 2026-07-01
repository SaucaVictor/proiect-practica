export type ReferenceType = 'whole-file' | 'text-selection' | 'pdf-page'

export interface FileReference {
  id: string
  subject: string
  date: string
  filename: string
  refType: ReferenceType
  /** Display label: "Subject > Date > filename" */
  label: string
  /** For text-selection: the highlighted snippet */
  selectedText?: string
  /** The full text content of the referenced page or whole file (to send to AI) */
  extractedText?: string
  /** Character offset in the file's text content */
  startOffset?: number
  endOffset?: number
  /** For pdf-page references */
  pageNumber?: number
}
