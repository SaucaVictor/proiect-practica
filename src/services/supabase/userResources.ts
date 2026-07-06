import { supabase } from './client'
import { ingestDocument, hasDocumentChunks, deleteDocumentChunks } from './vectorStore'
import { extractTextFromPdf } from '@/utils/pdf'

export interface UserResource {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  type: 'folder' | 'file'
  file_path?: string
  size?: number
  mime_type?: string
  created_at: string
  updated_at: string
}

/**
 * Lists all user resources (folders and files) for the authenticated user at a given parent directory level.
 */
export async function listUserResources(parentId: string | null = null): Promise<UserResource[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
      .from('user_resources')
      .select('*')
      .eq('user_id', user.id)

    if (parentId === null) {
      query = query.is('parent_id', null)
    } else {
      query = query.eq('parent_id', parentId)
    }

    const { data, error } = await query
      .order('type', { ascending: true }) // Folders first
      .order('name', { ascending: true })

    if (error) {
      console.error('Failed to list user resources:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Error in listUserResources:', err)
    return []
  }
}

/**
 * Creates a new folder for the current user.
 */
export async function createUserFolder(name: string, parentId: string | null = null): Promise<UserResource | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('user_resources')
      .insert({
        user_id: user.id,
        parent_id: parentId,
        name: name.trim(),
        type: 'folder'
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create folder:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Error in createUserFolder:', err)
    return null
  }
}

/**
 * Uploads a file to Supabase storage under the user's isolated folder, and records it in the database.
 */
export async function uploadUserResource(
  file: File,
  parentId: string | null = null
): Promise<UserResource | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check file extension / mime type
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')
  if (!isPdf && !isTxt) {
    throw new Error('Only PDF and TXT files are supported.')
  }

  const fileId = crypto.randomUUID()
  const fileExt = file.name.split('.').pop()
  const storagePath = `${user.id}/${fileId}.${fileExt}`

  // 1. Upload the raw file to Supabase storage bucket 'user_resources'
  const { error: uploadError } = await supabase.storage
    .from('user_resources')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    console.error('Failed to upload file to storage:', uploadError)
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  // 2. Insert record in the database
  const { data, error: dbError } = await supabase
    .from('user_resources')
    .insert({
      user_id: user.id,
      parent_id: parentId,
      name: file.name,
      type: 'file',
      file_path: storagePath,
      size: file.size,
      mime_type: file.type || (isPdf ? 'application/pdf' : 'text/plain')
    })
    .select()
    .single()

  if (dbError) {
    console.error('Failed to save file metadata to database:', dbError)
    // Cleanup/Delete the file we just uploaded to avoid leaking storage
    await supabase.storage.from('user_resources').remove([storagePath])
    throw new Error(`Database record creation failed: ${dbError.message}`)
  }

  return data
}

/**
 * Deletes a file or folder resource. If it is a folder, recursively gathers and deletes all storage files
 * under it, then triggers database deletion (which cascades database rows).
 */
export async function deleteUserResource(id: string): Promise<boolean> {
  try {
    const { data: item, error: fetchError } = await supabase
      .from('user_resources')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      console.error('Failed to fetch resource for deletion:', fetchError)
      return false
    }

    const filePathsToClean: string[] = []

    if (item.type === 'file' && item.file_path) {
      filePathsToClean.push(item.file_path)
    } else if (item.type === 'folder') {
      // Recursive function to find all nested file paths
      const collectNestedFiles = async (pId: string) => {
        const { data: children, error } = await supabase
          .from('user_resources')
          .select('*')
          .eq('parent_id', pId)

        if (error || !children) return

        for (const child of children) {
          if (child.type === 'file' && child.file_path) {
            filePathsToClean.push(child.file_path)
          } else if (child.type === 'folder') {
            await collectNestedFiles(child.id)
          }
        }
      }
      await collectNestedFiles(item.id)
    }

    // 1a. Cleanup chunk-uri RAG din document_chunks
    //    (CASCADE DELETE din SQL face asta automat, dar apelăm explicit pentru robustete)
    if (item.type === 'file') {
      await deleteDocumentChunks(item.id)
    }

    // 1b. Delete from Supabase Storage
    if (filePathsToClean.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('user_resources')
        .remove(filePathsToClean)
      if (storageError) {
        console.warn('Warning deleting storage files:', storageError)
      }
    }

    // 2. Delete the DB record (the children rows cascade delete automatically)
    const { error: dbError } = await supabase
      .from('user_resources')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.error('Failed to delete resource row from database:', dbError)
      return false
    }

    return true
  } catch (err) {
    console.error('Error in deleteUserResource:', err)
    return false
  }
}

/**
 * Generates a signed URL for viewing a user's uploaded resource file (valid for 1 hour).
 */
export async function getUserResourceSignedUrl(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('user_resources')
      .createSignedUrl(filePath, 3600) // 1 hour expiration

    if (error || !data) {
      console.error('Failed to generate signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (err) {
    console.error('Error in getUserResourceSignedUrl:', err)
    return null
  }
}

/**
 * Downloads a text resource and returns its plain-text representation.
 */
export async function getUserResourceText(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('user_resources')
      .download(filePath)

    if (error || !data) {
      console.error('Failed to download user file text:', error)
      return null
    }

    return await data.text()
  } catch (err) {
    console.error('Error in getUserResourceText:', err)
    return null
  }
}

/**
 * Gathers the list of folder nodes from a given resource up to the root.
 */
export async function getResourceAncestors(id: string): Promise<UserResource[]> {
  const ancestors: UserResource[] = []
  let currentId = id

  try {
    const { data: item, error: itemError } = await supabase
      .from('user_resources')
      .select('*')
      .eq('id', currentId)
      .single()

    if (itemError || !item) return []
    let parentId = item.parent_id

    while (parentId) {
      const { data: parent, error: pError } = await supabase
        .from('user_resources')
        .select('*')
        .eq('id', parentId)
        .single()

      if (pError || !parent) break
      ancestors.unshift(parent) // Add to beginning (root most first)
      parentId = parent.parent_id
    }
  } catch (err) {
    console.error('Error in getResourceAncestors:', err)
  }

  return ancestors
}
