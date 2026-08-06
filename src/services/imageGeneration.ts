const API_KEY = '49722a9afd7d4b14aba717618bc8c078'
const MODEL = 'GPT-image-2-joybuilder'

export type GenerateImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

/** Resize a data URL so neither dimension exceeds maxPx, maintaining aspect ratio */
function resizeDataUrl(dataUrl: string, maxPx = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      if (w <= maxPx && h <= maxPx) { resolve(dataUrl); return }
      const scale = maxPx / Math.max(w, h)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => resolve(dataUrl)  // on error keep original
    img.src = dataUrl
  })
}

export async function generateImage(
  prompt: string,
  _ratio?: string,
  signal?: AbortSignal,
  referenceImageDataUrl?: string,
): Promise<GenerateImageResult> {
  try {
    const endpoint = referenceImageDataUrl
      ? '/api/images/edits'
      : '/api/images/generations'

    const body: Record<string, unknown> = { model: MODEL, prompt }

    if (referenceImageDataUrl) {
      // Compress reference image to ≤1024px before sending
      const compressed = await resizeDataUrl(referenceImageDataUrl, 1024)
      const dataUrl = compressed.startsWith('data:')
        ? compressed
        : `data:image/jpeg;base64,${compressed}`
      body.image = [dataUrl]
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
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
