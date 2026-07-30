const API_KEY = '49722a9afd7d4b14aba717618bc8c078'
const MODEL = 'GPT-image-2-joybuilder'

// size map: ComposerState ratio → API size string
const RATIO_TO_SIZE: Record<string, string> = {
  '3:4 · 750×1000': '1024x1536',
  '16:9 · 1920×1080': '1536x1024',
  '1:1 · 1000×1000': '1024x1024',
  '会场首屏 · 750×920': '1024x1024',
}

export type GenerateImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export async function generateImage(prompt: string, ratio: string): Promise<GenerateImageResult> {
  const size = RATIO_TO_SIZE[ratio] ?? '1024x1024'
  try {
    const res = await fetch('/api/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, prompt, n: 1, size }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      return { ok: false, error: `HTTP ${res.status}: ${text}` }
    }
    const json = await res.json()
    const raw = json?.data?.[0]?.url ?? json?.data?.[0]?.b64_json
    if (!raw) return { ok: false, error: '响应中未找到图片数据' }
    // b64_json → data URL
    const url = raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`
    return { ok: true, url }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
