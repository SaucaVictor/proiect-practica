import { supabase } from './client'
import { generateEmbedding, chunkText } from '@/services/ai/embeddings'

export interface CourseSubject {
  name: string
}

export interface CourseDate {
  subject: string
  date: string
}

export interface CourseFile {
  name: string
  subject: string
  date: string
  type: 'audio' | 'transcript' | 'pdf' | 'other'
  size?: number
}

/**
 * Lists all subject-level folders in the courses bucket (top-level folders).
 */
export async function listCourseSubjects(): Promise<CourseSubject[]> {
  const { data, error } = await supabase.storage.from('courses').list('', {
    limit: 100,
    offset: 0,
  })

  if (error) {
    console.error('Failed to list course subjects:', error)
    return []
  }

  // Folders have no size (or size === 0) and no specific file extension
  return (data ?? [])
    .filter((item) => !item.metadata || item.metadata.size === undefined)
    .map((item) => ({ name: item.name }))
}

/**
 * Lists date sub-folders for a given subject.
 */
export async function listCourseDates(subject: string): Promise<CourseDate[]> {
  const { data, error } = await supabase.storage
    .from('courses')
    .list(subject, { limit: 100, offset: 0 })

  if (error) {
    console.error(`Failed to list dates for subject "${subject}":`, error)
    return []
  }

  return (data ?? [])
    .filter((item) => !item.metadata || item.metadata.size === undefined)
    .map((item) => ({ subject, date: item.name }))
}

/**
 * Lists all files within a subject/date folder.
 */
export async function listCourseFiles(
  subject: string,
  date: string
): Promise<CourseFile[]> {
  const path = `${subject}/${date}`
  const { data, error } = await supabase.storage
    .from('courses')
    .list(path, { limit: 100, offset: 0 })

  if (error) {
    console.error(`Failed to list files for "${path}":`, error)
    return []
  }

  return (data ?? [])
    .filter((item) => item.metadata && item.metadata.size !== undefined)
    .map((item) => {
      const name = item.name
      let type: CourseFile['type'] = 'other'
      if (name.endsWith('.txt')) type = 'transcript'
      else if (name.endsWith('.pdf')) type = 'pdf'
      else if (
        name.endsWith('.wav') ||
        name.endsWith('.mp3') ||
        name.endsWith('.ogg')
      )
        type = 'audio'
      return {
        name,
        subject,
        date,
        type,
        size: item.metadata?.size,
      }
    })
}

/**
 * Fetches the text content of a transcript file.
 */
export async function getCourseTranscript(
  subject: string,
  date: string,
  filename = 'transcript.txt'
): Promise<string | null> {
  const path = `${subject}/${date}/${filename}`
  const { data, error } = await supabase.storage
    .from('courses')
    .download(path)

  if (error || !data) {
    console.error(`Failed to download transcript "${path}":`, error)
    return null
  }

  return await data.text()
}

/**
 * Returns a public URL for a course file.
 */
export function getCourseFileUrl(
  subject: string,
  date: string,
  filename: string
): string {
  const { data } = supabase.storage
    .from('courses')
    .getPublicUrl(`${subject}/${date}/${filename}`)
  return data.publicUrl
}

/**
 * Uploads a course file (PDF or TXT) to Supabase storage courses bucket
 * under the path: `${subject}/${date}/${file.name}`.
 */
export async function uploadCourseFile(
  subject: string,
  date: string,
  file: File
): Promise<CourseFile> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')
  if (!isPdf && !isTxt) {
    throw new Error('Only PDF and TXT files are supported.')
  }

  const storagePath = `${subject}/${date}/${file.name}`

  // Upload file to storage courses bucket
  const { error: uploadError } = await supabase.storage
    .from('courses')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true
    })

  if (uploadError) {
    console.error('Failed to upload file to courses bucket:', uploadError)
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  let type: CourseFile['type'] = 'other'
  if (isTxt) type = 'transcript'
  else if (isPdf) type = 'pdf'

  return {
    name: file.name,
    subject,
    date,
    type,
    size: file.size
  }
}

/**
 * Deletes a course file from Supabase storage and its indexed document chunks.
 */
export async function deleteCourseFile(
  subject: string,
  date: string,
  filename: string
): Promise<void> {
  const storagePath = `${subject}/${date}/${filename}`

  // 1. Delete from storage courses bucket
  const { error: storageError } = await supabase.storage
    .from('courses')
    .remove([storagePath])

  if (storageError) {
    console.error('Failed to delete course file from storage:', storageError)
    throw new Error(`Failed to delete course file: ${storageError.message}`)
  }

  // 2. Delete document chunks (RAG index) for this specific file path
  // Since resource_id is NULL for course materials, we query by metadata->>file_path
  const { error: dbError } = await supabase
    .from('document_chunks')
    .delete()
    .eq('metadata->>file_path', storagePath)

  if (dbError) {
    console.error('Failed to delete document chunks:', dbError)
  }
}

/**
 * Ingests a course file content into the RAG second brain vector table.
 */
export async function ingestCourseFile(
  subject: string,
  date: string,
  filename: string,
  fullText: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const chunks = chunkText(fullText)
  if (chunks.length === 0) return

  const file_path = `${subject}/${date}/${filename}`

  // Clear previous chunks for safety
  await supabase
    .from('document_chunks')
    .delete()
    .eq('metadata->>file_path', file_path)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = await generateEmbedding(chunk, 'passage')

    const { error } = await supabase.from('document_chunks').insert({
      resource_id: null,
      user_id: userId,
      content: chunk,
      embedding,
      metadata: {
        chunk_index: i,
        total_chunks: chunks.length,
        subject_name: subject,
        session_date: date,
        file_name: filename,
        file_path: file_path
      }
    })

    if (error) {
      console.error(`[RAG] Failed to insert course chunk ${i}:`, error)
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / chunks.length) * 100))
    }
  }
}

/**
 * Checks if a course file already has chunks indexed in the document_chunks table.
 */
export async function hasCourseFileChunks(
  subject: string,
  date: string,
  filename: string
): Promise<boolean> {
  const file_path = `${subject}/${date}/${filename}`
  const { count, error } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('metadata->>file_path', file_path)

  if (error) return false
  return (count ?? 0) > 0
}

