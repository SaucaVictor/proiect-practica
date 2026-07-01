import { ref } from 'vue'
import { supabase } from '@/services/supabase/client'

export function useAudioCall() {
  const status = ref<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected')
  const error = ref<string | null>(null)
  const stream = ref<MediaStream | null>(null)
  let pc: RTCPeerConnection | null = null
  let sessionId: string | null = null
  let channel: any = null

  async function connect() {
    if (status.value !== 'disconnected') return
    status.value = 'connecting'
    error.value = null

    try {
      // 1. Create RTCPeerConnection with public STUN
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      })

      // 2. Setup track event
      pc.ontrack = (event) => {
        console.log('WebRTC: audio track received', event.streams)
        if (event.streams && event.streams[0]) {
          stream.value = event.streams[0]
        } else {
          stream.value = new MediaStream([event.track])
        }
        status.value = 'connected'
      }

      // 3. Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('WebRTC connection state:', pc?.connectionState)
        if (pc?.connectionState === 'connected') {
          status.value = 'connected'
        } else if (pc?.connectionState === 'failed') {
          status.value = 'failed'
          error.value = 'Conexiunea WebRTC a eșuat. Verificați rețeaua.'
          disconnect()
        } else if (pc?.connectionState === 'disconnected') {
          status.value = 'failed'
          disconnect()
        }
      }

      // 4. Add transceiver for receive-only audio
      pc.addTransceiver('audio', { direction: 'recvonly' })

      // 5. Create WebRTC offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 6. Wait for ICE gathering to complete (Vanilla ICE)
      console.log('WebRTC: gathering ICE candidates...')
      if (pc.iceGatheringState !== 'complete') {
        await new Promise<void>((resolve) => {
          const checkState = () => {
            if (pc?.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState)
              resolve()
            }
          }
          pc?.addEventListener('icegatheringstatechange', checkState)
        })
      }
      console.log('WebRTC: ICE gathering complete.')

      // 7. Insert Offer into Supabase to signal the server
      sessionId = crypto.randomUUID()
      const offerSdp = pc.localDescription?.sdp
      if (!offerSdp) throw new Error('SDP local invalid')

      const { error: dbErr } = await supabase
        .from('webrtc_signaling')
        .insert({
          session_id: sessionId,
          sender: 'client',
          type: 'offer',
          sdp: offerSdp
        })

      if (dbErr) {
        throw new Error(`Eroare salvare semnalizare în DB: ${dbErr.message}`)
      }

      console.log('WebRTC: Offer trimis în Supabase. ID Sesiune:', sessionId)

      // 8. Subscribe to the answer from the server
      channel = supabase
        .channel(`webrtc-signaling-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'webrtc_signaling',
            filter: `session_id=eq.${sessionId}`
          },
          async (payload) => {
            const row = payload.new as any
            if (row && row.sender === 'server' && row.type === 'answer') {
              console.log('WebRTC: Answer primit de la server.')
              try {
                await pc?.setRemoteDescription(new RTCSessionDescription({
                  type: 'answer',
                  sdp: row.sdp
                }))
                
                // Clean up database rows for this session to keep it clean
                await supabase
                  .from('webrtc_signaling')
                  .delete()
                  .eq('session_id', sessionId)
                
                console.log('WebRTC: Signaling finalizat și curățat.')
              } catch (e: any) {
                console.error('Failed setting remote description:', e)
                error.value = `Eroare conexiune: ${e.message}`
                status.value = 'failed'
              } finally {
                if (channel) {
                  supabase.removeChannel(channel)
                  channel = null
                }
              }
            }
          }
        )
        .subscribe()

      // Set a timeout of 15 seconds for the connection to establish
      setTimeout(() => {
        if (status.value === 'connecting') {
          status.value = 'failed'
          error.value = 'Conexiunea a expirat. Serverul audio ar putea fi offline.'
          disconnect()
        }
      }, 15000)

    } catch (e: any) {
      console.error('Error connecting WebRTC:', e)
      error.value = e.message || 'Eroare la inițierea conexiunii WebRTC.'
      status.value = 'failed'
      disconnect()
    }
  }

  function disconnect() {
    console.log('WebRTC: Deconectare...')
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }

    if (pc) {
      pc.close()
      pc = null
    }

    stream.value = null
    status.value = 'disconnected'
    if (sessionId) {
      // Clean up database signaling rows if any remain
      supabase
        .from('webrtc_signaling')
        .delete()
        .eq('session_id', sessionId)
        .then(() => {
          sessionId = null
        })
    }
  }

  return {
    status,
    error,
    stream,
    connect,
    disconnect
  }
}
