/**
 * embeddings.ts — NVIDIA NIM Embedding Service
 *
 * Generează vectori semantici folosind modelul nvidia/nv-embedqa-e5-v5 (1024 dim).
 * Apelat la ingestia documentelor (input_type: 'passage') și la căutarea RAG (input_type: 'query').
 *
 * Compatibil cu Supabase pgvector HNSW index (limite 2000 dim pe free tier).
 */

// Endpoint direct NVIDIA NIM (nu trece prin proxy-ul /v1 al Vite — necesită CORS deschis)
const NVIDIA_EMBEDDINGS_URL = '/v1/embeddings'
const NVIDIA_EMBEDDING_MODEL = 'nvidia/nv-embedqa-e5-v5'

export const EMBEDDING_DIMENSIONS = 1024

// ─── Generare embedding pentru un singur text ─────────────────────────────────

export async function generateEmbedding(
  text: string,
  inputType: 'passage' | 'query'
): Promise<number[]> {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY
  if (!apiKey) throw new Error('[RAG] VITE_NVIDIA_API_KEY is not configured')

  const response = await fetch(NVIDIA_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: NVIDIA_EMBEDDING_MODEL,
      input_type: inputType,
      encoding_format: 'float',
      truncate: 'END', // Trunchiaza automat textele prea lungi (>512 tokens)
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`[RAG] NVIDIA Embeddings API error ${response.status}: ${errText}`)
  }

  const result = await response.json()
  const embedding: number[] | undefined = result?.data?.[0]?.embedding
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`[RAG] Unexpected embedding shape: got ${embedding?.length ?? 'undefined'}, expected ${EMBEDDING_DIMENSIONS}`)
  }
  return embedding
}

// ─── Chunking cu overlap ──────────────────────────────────────────────────────

/**
 * Împarte un text lung în fragmente de dimensiune fixă cu suprapunere,
 * pentru a evita pierderea contextului la granița dintre chunk-uri.
 *
 * @param text     - Textul sursă
 * @param size     - Dimensiunea unui chunk în caractere (default: 800)
 * @param overlap  - Suprapunerea dintre chunk-uri adiacente (default: 120)
 */
export function chunkText(
  text: string,
  size: number = 800,
  overlap: number = 120
): string[] {
  const chunks: string[] = []
  // Normalizăm spațiile albe excesive înainte de chunking
  const normalized = text.replace(/\s+/g, ' ').trim()

  let start = 0
  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length)
    const chunk = normalized.slice(start, end).trim()
    if (chunk.length > 20) { // Ignorăm chunk-urile triviale (spații, separatoare)
      chunks.push(chunk)
    }
    start += size - overlap
  }
  return chunks
}
