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

// 将 "WxH" 字符串映射到 API 支持的最近档位
// API 支持: 1024x1024 / 1536x1024 / 1024x1536 / auto
function resolveApiSize(sizeKey?: string): string {
  if (!sizeKey) return 'auto'
  const m = sizeKey.match(/(\d+)[x×](\d+)/i)
  if (!m) return 'auto'
  const w = parseInt(m[1]), h = parseInt(m[2])
  const ratio = w / h
  if (ratio > 1.2) return '1536x1024'   // 横版
  if (ratio < 0.85) return '1024x1536'  // 竖版
  return '1024x1024'                    // 接近方形
}

const REQUEST_TIMEOUT_MS = 180_000

export async function generateImage(
  prompt: string,
  sizeKey?: string,
  signal?: AbortSignal,
  referenceImageDataUrl?: string,
): Promise<GenerateImageResult> {
  // Merge caller's signal with a 180s hard timeout
  const timeoutCtrl = new AbortController()
  const timeoutId = window.setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS)
  // AbortSignal.any is available in modern browsers; fall back to timeout-only if not
  const mergedSignal: AbortSignal = signal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, timeoutCtrl.signal])
    : timeoutCtrl.signal

  try {
    const endpoint = referenceImageDataUrl
      ? '/api/images/edits'
      : '/api/images/generations'

    const size = resolveApiSize(sizeKey)
    const body: Record<string, unknown> = { model: MODEL, prompt, size }

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
      signal: mergedSignal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      if (res.status === 429) return { ok: false, error: 'API 限流，请稍后重试' }
      return { ok: false, error: `HTTP ${res.status}: ${text}` }
    }
    const json = await res.json()
    // 网关有时以 HTTP 200 + JSON error 返回限流/鉴权错误
    if (json?.error) {
      const code = json.error.code
      const msg  = json.error.message || JSON.stringify(json.error)
      if (code === 2003 || code === 429) return { ok: false, error: 'API 限流，请稍后重试' }
      return { ok: false, error: msg }
    }
    const raw = json?.data?.[0]?.url ?? json?.data?.[0]?.b64_json
    if (!raw) return { ok: false, error: '响应中未找到图片数据' }
    const url = raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`
    return { ok: true, url }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'AbortError' }
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    window.clearTimeout(timeoutId)
  }
}
