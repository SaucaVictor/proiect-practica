import type { Attachment } from '@/types'
import type { DbAttachment } from '@/types/database'
import { supabase } from './client'

const BUCKET = 'attachments'

// ─── Mapping ─────────────────────────────────────────────────────────────────

function mapAttachment(row: DbAttachment, url: string): Attachment {
  return {
    id: row.id,
    messageId: row.message_id,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    name: row.name,
    size: row.size,
    url,
  }
}

// ─── Storage operations ──────────────────────────────────────────────────────

export async function uploadAttachment(
  file: File,
  messageId: string,
  userId: string,
  onProgress?: (percent: number) => void
): Promise<Attachment> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${userId}/${messageId}/${crypto.randomUUID()}.${ext}`

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (onProgress && supabaseUrl && supabaseAnonKey) {
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? supabaseAnonKey

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl, true)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('apikey', supabaseAnonKey)
      xhr.setRequestHeader('Content-Type', file.type)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText || xhr.statusText}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(file)
    })
  } else {
    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) throw uploadError
  }

  // Get signed URL (valid 1 hour)
  const { data: signedData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  const url = signedData?.signedUrl ?? ''

  // Insert attachment record
  const { data, error: dbError } = await supabase
    .from('attachments')
    .insert({
      message_id: messageId,
      storage_path: storagePath,
      mime_type: file.type,
      name: file.name,
      size: file.size,
    })
    .select()
    .single()

  if (dbError) throw dbError
  return mapAttachment(data as DbAttachment, url)
}

export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)
  return data?.signedUrl ?? ''
}

export async function deleteAttachment(storagePath: string, attachmentId: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath])
  await supabase.from('attachments').delete().eq('id', attachmentId)
}

export async function listAttachments(messageId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('message_id', messageId)

  if (error) throw error

  const attachments = await Promise.all(
    (data as DbAttachment[]).map(async row => {
      const url = await getAttachmentUrl(row.storage_path)
      return mapAttachment(row, url)
    })
  )

  return attachments
}
