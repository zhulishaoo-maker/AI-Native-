const API_KEY = '49722a9afd7d4b14aba717618bc8c078'
const MODEL = 'GPT-image-2-joybuilder'

export type GenerateImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export async function generateImage(
  prompt: string,
  _ratio?: string,
  signal?: AbortSignal,
): Promise<GenerateImageResult> {
  try {
    const res = await fetch('/api/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, prompt }),
      signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      return { ok: false, error: `HTTP ${res.status}: ${text}` }
    }
    const json = await res.json()
    const raw = json?.data?.[0]?.url ?? json?.data?.[0]?.b64_json
    if (!raw) return { ok: false, error: '响应中未找到图片数据' }
    const url = raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`
    return { ok: true, url }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'AbortError' }
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
