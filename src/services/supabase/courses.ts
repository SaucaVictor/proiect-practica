import { supabase } from './client'

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
