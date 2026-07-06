/**
 * useRag.ts — Composable Vue pentru RAG (Retrieval-Augmented Generation)
 *
 * Expune ragSearch() care:
 *   1. Generează embedding-ul pentru query-ul utilizatorului
 *   2. Caută semantic în document_chunks din Supabase
 *   3. Formatează rezultatele ca bloc de context XML (Anthropic best practice)
 *      gata de injectat în system prompt
 */

import { ref } from 'vue'
import { matchChunks } from '@/services/supabase/vectorStore'
import { supabase } from '@/services/supabase/client'

export interface RagSearchResult {
  /** Blocul XML gata de injectat în system prompt */
  contextBlock: string
  /** Numărul de chunk-uri găsite */
  chunkCount: number
  /** true dacă s-au găsit rezultate relevante */
  hasContext: boolean
}

/**
 * Composable pentru integrarea RAG în fluxul de chat.
 * Folosit în useChat.ts pentru a îmbogăți automat fiecare mesaj cu context relevant.
 */
export function useRag() {
  const isSearching = ref(false)

  /**
   * Caută semantic în toate documentele utilizatorului și returnează
   * un bloc de context XML gata de injectat în systemPrompt.
   *
   * Formatarea XML urmează Anthropic best practices:
   * - Tag-uri clare cu atribute (index, resource_id, similarity)
   * - Conținut textual separat de instrucțiuni sistem
   * - Ordinea: cel mai relevant primul
   *
   * @param query         - Mesajul / întrebarea utilizatorului
   * @param resourceIds   - (Opțional) Limitează căutarea la documente specifice
   */
  async function ragSearch(
    query: string,
    resourceIds?: string[]
  ): Promise<RagSearchResult> {
    const EMPTY: RagSearchResult = { contextBlock: '', chunkCount: 0, hasContext: false }

    // Evităm apeluri inutile pentru mesaje prea scurte
    if (!query || query.trim().length < 5) return EMPTY

    isSearching.value = true
    try {
      // Obținem user_id pentru filtrare corectă RLS
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return EMPTY

      const matches = await matchChunks(query, {
        threshold: 0.45,
        count: 5,
        userId: user.id,
        resourceIds,
      })

      if (!matches || matches.length === 0) return EMPTY

      // ── Formatare XML (Anthropic best practice) ─────────────────────────────
      // Structura XML ajută LLM-ul să distingă clar contextul extras de
      // instrucțiunile sistemului și de mesajul utilizatorului.
      const documentsXml = matches
        .map(
          (chunk, i) =>
            `  <document index="${i + 1}" resource_id="${chunk.resource_id}" similarity="${chunk.similarity.toFixed(3)}">\n    <content>${escapeXml(chunk.content)}</content>\n  </document>`
        )
        .join('\n')

      const contextBlock = `<retrieved_context>\n  <!-- Context extras semantic din documentele utilizatorului. Prioritizeaza aceste informatii in raspunsul tau. -->\n${documentsXml}\n</retrieved_context>`

      return {
        contextBlock,
        chunkCount: matches.length,
        hasContext: true,
      }
    } catch (err) {
      // RAG e un layer optional — nu blocam chat-ul daca esueaza
      console.warn('[RAG] ragSearch failed, proceeding without context:', err)
      return EMPTY
    } finally {
      isSearching.value = false
    }
  }

  return {
    isSearching,
    ragSearch,
  }
}

// ─── Utilitar: escapare caractere XML ────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
