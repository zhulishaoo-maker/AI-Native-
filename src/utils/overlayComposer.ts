// 京东品牌压板合成工具
// 在生成的素材上叠加品牌压板、搜索框等规范元素

export type OverlayConfig = {
  brandOverlay?: boolean   // 是否叠加品牌压板
  searchBar?: boolean      // 是否叠加搜索框
  brandOverlayUrl?: string // 自定义品牌压板图片 URL
  searchBarUrl?: string    // 自定义搜索框图片 URL
}

/**
 * 在生成图片上叠加品牌压板和搜索框
 * 保持图片原始分辨率，不做拉伸
 */
export async function composeOverlays(
  baseImageUrl: string,
  config: OverlayConfig
): Promise<string> {
  return new Promise((resolve, reject) => {
    const baseImg = new window.Image()
    baseImg.crossOrigin = 'anonymous'
    baseImg.onload = async () => {
      const W = baseImg.naturalWidth
      const H = baseImg.naturalHeight

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas unavailable')); return }

      // 1. 画原图（不拉伸）
      ctx.drawImage(baseImg, 0, 0, W, H)

      // 2. 品牌压板（顶部）
      if (config.brandOverlay) {
        try {
          if (config.brandOverlayUrl) {
            // 用真实压板图片
            const overlay = await loadImage(config.brandOverlayUrl)
            // 按宽度撑满，高度等比
            const overlayH = Math.round(overlay.naturalHeight * (W / overlay.naturalWidth))
            ctx.drawImage(overlay, 0, 0, W, overlayH)
          } else {
            // fallback：纯色条 + 文字
            drawFallbackBrandOverlay(ctx, W, H)
          }
        } catch {
          drawFallbackBrandOverlay(ctx, W, H)
        }
      }

      // 3. 搜索框（底部）
      if (config.searchBar) {
        try {
          if (config.searchBarUrl) {
            const overlay = await loadImage(config.searchBarUrl)
            const overlayH = Math.round(overlay.naturalHeight * (W / overlay.naturalWidth))
            ctx.drawImage(overlay, 0, H - overlayH, W, overlayH)
          } else {
            // fallback：白色搜索条
            drawFallbackSearchBar(ctx, W, H)
          }
        } catch {
          drawFallbackSearchBar(ctx, W, H)
        }
      }

      resolve(canvas.toDataURL('image/png'))
    }
    baseImg.onerror = () => reject(new Error('图片加载失败'))
    baseImg.src = baseImageUrl
  })
}

function drawFallbackBrandOverlay(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const barH = Math.round(H * 0.08)
  // 京喜品牌红渐变（从左到右 #ed0038 → #ff1a53）
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, '#ed0038')
  grad.addColorStop(1, '#ff1a53')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, barH)

  // 白色「京喜」文字
  ctx.fillStyle = '#ffffff'
  const fontSize = Math.round(barH * 0.52)
  ctx.font = `700 ${fontSize}px "Noto Sans SC", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText('京喜', Math.round(W * 0.04), barH / 2)

  // 右侧活动名
  ctx.textAlign = 'right'
  ctx.font = `500 ${Math.round(fontSize * 0.8)}px "Noto Sans SC", sans-serif`
  ctx.fillText('又好又便宜', W - Math.round(W * 0.04), barH / 2)
}

function drawFallbackSearchBar(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const barH = Math.round(H * 0.065)
  const barY = H - barH - Math.round(H * 0.02)
  const mx = Math.round(W * 0.04)   // horizontal margin
  const r = barH / 2

  // 白色圆角矩形
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  roundRect(ctx, mx, barY, W - mx * 2, barH, r)
  ctx.fill()
  ctx.restore()

  // 红色搜索按钮
  const btnW = Math.round(W * 0.18)
  const btnX = W - mx - btnW
  ctx.fillStyle = '#E1251B'
  roundRect(ctx, btnX, barY, btnW, barH, r)
  ctx.fill()

  ctx.fillStyle = '#fff'
  const fs = Math.round(barH * 0.4)
  ctx.font = `600 ${fs}px "Noto Sans SC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('搜索', btnX + btnW / 2, barY + barH / 2)

  // 搜索框文字
  ctx.fillStyle = '#aaa'
  ctx.font = `400 ${fs}px "Noto Sans SC", sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('京东搜一搜', mx + r + 8, barY + barH / 2)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
