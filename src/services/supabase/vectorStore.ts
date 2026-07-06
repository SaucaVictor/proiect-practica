/**
 * vectorStore.ts — Supabase pgvector operations for RAG
 *
 * Funcții CRUD pentru chunk-urile semantice stocate în tabela `document_chunks`.
 * Folosit de:
 *   - uploadUserResource()     → ingestDocument() după upload
 *   - deleteUserResource()     → deleteDocumentChunks() la ștergere
 *   - useRag composable        → matchChunks() la fiecare query
 */

import { supabase } from './client'
import { generateEmbedding, chunkText } from '@/services/ai/embeddings'

export interface ChunkMatch {
  id: string
  resource_id: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

// ─── Ingestie document ────────────────────────────────────────────────────────

/**
 * Împarte textul unui document în chunk-uri, generează embeddings și le salvează
 * în tabela `document_chunks`. Apelat automat după uploadul unui fișier.
 *
 * @param resourceId  - UUID din tabela user_resources
 * @param userId      - UUID utilizator autentificat
 * @param fullText    - Textul extras din PDF / TXT
 */
export async function ingestDocument(
  resourceId: string,
  userId: string,
  fullText: string
): Promise<{ ingested: number; errors: number }> {
  const chunks = chunkText(fullText)
  let ingested = 0
  let errors = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      const embedding = await generateEmbedding(chunk, 'passage')

      const { error } = await supabase.from('document_chunks').insert({
        resource_id: resourceId,
        user_id: userId,
        content: chunk,
        embedding,
        metadata: { chunk_index: i, total_chunks: chunks.length },
      })

      if (error) {
        console.error(`[RAG] Failed to insert chunk ${i}:`, error)
        errors++
      } else {
        ingested++
      }
    } catch (err) {
      console.error(`[RAG] Embedding failed for chunk ${i}:`, err)
      errors++
    }
  }

  console.log(`[RAG] Ingested ${ingested}/${chunks.length} chunks for resource ${resourceId}`)
  return { ingested, errors }
}

// ─── Căutare semantică ────────────────────────────────────────────────────────

/**
 * Caută semantic în chunk-urile indexate și returnează cele mai relevante fragmente.
 *
 * @param queryText        - Întrebarea / mesajul utilizatorului
 * @param options.threshold  - Scor minim de similaritate (0-1, default: 0.45)
 * @param options.count      - Numărul maxim de rezultate (default: 5)
 * @param options.resourceIds - Filtrare pe documente specifice (opțional)
 */
export async function matchChunks(
  queryText: string,
  options?: {
    threshold?: number
    count?: number
    resourceIds?: string[]
    userId?: string
  }
): Promise<ChunkMatch[]> {
  try {
    const queryEmbedding = await generateEmbedding(queryText, 'query')

    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: options?.threshold ?? 0.45,
      match_count: options?.count ?? 5,
      filter_user_id: options?.userId ?? null,
      filter_resource_ids: options?.resourceIds ?? null,
    })

    if (error) {
      console.error('[RAG] matchChunks RPC error:', error)
      return []
    }

    return (data as ChunkMatch[]) ?? []
  } catch (err) {
    console.error('[RAG] matchChunks failed:', err)
    return []
  }
}

// ─── Ștergere chunk-uri pentru un document ────────────────────────────────────

/**
 * Șterge toate chunk-urile asociate unui document (apelat la deleteUserResource).
 * Supabase face CASCADE DELETE automat dacă e configurat în migrare, dar
 * menționăm funcția explicit pentru claritate și pentru cazuri edge.
 *
 * @param resourceId - UUID din tabela user_resources
 */
export async function deleteDocumentChunks(resourceId: string): Promise<void> {
  const { error } = await supabase
    .from('document_chunks')
    .delete()
    .eq('resource_id', resourceId)

  if (error) {
    console.error(`[RAG] Failed to delete chunks for resource ${resourceId}:`, error)
  } else {
    console.log(`[RAG] Cleaned up chunks for resource ${resourceId}`)
  }
}

// ─── Verificare existență chunk-uri ──────────────────────────────────────────

/**
 * Returnează true dacă un document are deja chunk-uri indexate.
 * Util pentru a evita re-ingestia dacă documentul e deja procesat.
 */
export async function hasDocumentChunks(resourceId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('resource_id', resourceId)

  if (error) return false
  return (count ?? 0) > 0
}
