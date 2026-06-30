/**
 * Transcribes an audio file.
 * Supports:
 * 1. Custom local ASR endpoint (e.g. local Python server running in whispered project)
 *    defined by VITE_ASR_ENDPOINT in `.env`.
 * 2. Hugging Face Serverless Inference API (using openai/whisper-large-v3),
 *    optionally authenticated with VITE_HF_TOKEN or VITE_HF_API_KEY.
 */
export async function transcribeAudio(file: File): Promise<string> {
  const customAsrEndpoint = import.meta.env.VITE_ASR_ENDPOINT
  const hfToken = import.meta.env.VITE_HF_TOKEN || import.meta.env.VITE_HF_API_KEY

  // ─── 1. Custom ASR Server Endpoint (Local Python Flask/FastAPI etc.) ─────────
  if (customAsrEndpoint) {
    console.log(`Sending audio to custom ASR endpoint: ${customAsrEndpoint}`)
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(customAsrEndpoint, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Custom ASR failed: ${response.status} - ${errText}`)
    }

    const data = await response.json()
    return data.text || data.transcription || data.transcript || ''
  }

  // ─── 2. Hugging Face Serverless Inference API ────────────────────────────────
  console.log('Sending audio to Hugging Face Serverless Whisper API...')
  const url = 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3'
  
  const headers: Record<string, string> = {}
  if (hfToken) {
    headers['Authorization'] = `Bearer ${hfToken}`
  }

  // Note: Hugging Face Inference API expects the raw audio binary data directly in the body
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: file
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Hugging Face requires a free Access Token. Please add VITE_HF_TOKEN=hf_... to your .env file, or configure VITE_ASR_ENDPOINT to use your local whispered project server.')
    }
    const errText = await response.text()
    let cleanErr = errText
    try {
      const parsed = JSON.parse(errText)
      if (parsed.error) cleanErr = parsed.error
    } catch {
      // Not JSON
    }
    throw new Error(`Hugging Face ASR failed: ${response.status} - ${cleanErr}`)
  }

  const data = await response.json()
  return data.text || ''
}
