import { ref, watch, onUnmounted } from 'vue'
import { supabase } from '@/services/supabase/client'

export interface TranscriptSegment {
  id: string
  subject_name: string
  session_date: string
  segment_start: string
  segment_end: string | null
  text: string
  is_final: boolean
  created_at: string
}

/**
 * useLiveTranscript
 *
 * Subscribes to the `live_transcripts` Supabase table via Realtime and exposes
 * today's segments as a reactive list. Designed to be used in AudioCallPage
 * while the user is connected to the live audio stream.
 *
 * @param isActive - When true the subscription is open; when false it is closed.
 */
export function useLiveTranscript(isActive: ReturnType<typeof ref<boolean>>) {
  const segments = ref<TranscriptSegment[]>([])
  const isListening = ref(false)
  const loadError = ref<string | null>(null)

  let channel: ReturnType<typeof supabase.channel> | null = null

  // ── Helpers ───────────────────────────────────────────────────────────────

  function todayUtc(): string {
    return new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  }

  function upsertSegment(row: TranscriptSegment) {
    const idx = segments.value.findIndex((s) => s.id === row.id)
    if (idx >= 0) {
      segments.value[idx] = row
    } else {
      segments.value.push(row)
    }
    // Keep sorted by segment_start ascending
    segments.value.sort(
      (a, b) => new Date(a.segment_start).getTime() - new Date(b.segment_start).getTime()
    )
  }

  // ── Load historical segments for today ───────────────────────────────────

  async function loadToday() {
    loadError.value = null
    const { data, error } = await supabase
      .from('live_transcripts')
      .select('*')
      .eq('session_date', todayUtc())
      .order('segment_start', { ascending: true })

    if (error) {
      loadError.value = `Nu s-au putut încărca transcriptele: ${error.message}`
      return
    }

    segments.value = (data as TranscriptSegment[]) ?? []
  }

  // ── Realtime subscription ─────────────────────────────────────────────────

  function openChannel() {
    if (channel) return // already open

    isListening.value = true
    channel = supabase
      .channel('live-transcripts-today')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_transcripts',
          filter: `session_date=eq.${todayUtc()}`
        },
        (payload) => {
          const row = payload.new as TranscriptSegment
          upsertSegment(row)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_transcripts',
          filter: `session_date=eq.${todayUtc()}`
        },
        (payload) => {
          const row = payload.new as TranscriptSegment
          upsertSegment(row)
        }
      )
      .subscribe()
  }

  function closeChannel() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    isListening.value = false
  }

  // ── Reactive: open/close subscription based on isActive ──────────────────

  watch(
    isActive,
    (active) => {
      if (active) {
        loadToday()
        openChannel()
      } else {
        closeChannel()
        // Keep segments visible so the user can still read them after disconnect
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    closeChannel()
  })

  return {
    segments,
    isListening,
    loadError
  }
}
