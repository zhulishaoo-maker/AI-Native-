// 京东品牌压板合成工具
// 在生成的素材上叠加品牌压板、搜索框等规范元素

export type OverlayConfig = {
  brandOverlay?: boolean    // 是否叠加品牌压板
  searchBar?: boolean       // 是否叠加搜索框
  width: number
  height: number
}

/**
 * 在 Canvas 上合成品牌压板和搜索框
 * @param baseImageUrl 基础生成的图片 URL 或 data URL
 * @param config 压板配置
 * @returns 合成后的 data URL
 */
export async function composeOverlays(
  baseImageUrl: string,
  config: OverlayConfig
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = config.width
    canvas.height = config.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('无法创建 Canvas context'))
      return
    }

    // 1. 加载并绘制基础图
    const baseImg = new window.Image()
    baseImg.crossOrigin = 'anonymous'
    baseImg.onload = async () => {
      ctx.drawImage(baseImg, 0, 0, config.width, config.height)

      // 2. 叠加品牌压板（顶部）
      if (config.brandOverlay) {
        try {
          await drawBrandOverlay(ctx, config.width, config.height)
        } catch (err) {
          console.warn('[overlay] 品牌压板加载失败，跳过', err)
        }
      }

      // 3. 叠加搜索框（底部）
      if (config.searchBar) {
        try {
          await drawSearchBar(ctx, config.width, config.height)
        } catch (err) {
          console.warn('[overlay] 搜索框加载失败，跳过', err)
        }
      }

      // 4. 输出最终合成图
      resolve(canvas.toDataURL('image/png'))
    }
    baseImg.onerror = () => reject(new Error('基础图片加载失败'))
    baseImg.src = baseImageUrl
  })
}

/**
 * 绘制京东品牌压板（顶部红色条带 + Logo）
 */
async function drawBrandOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<void> {
  // 品牌压板高度约占图片高度的 8-10%
  const overlayHeight = Math.floor(height * 0.09)

  // 绘制红色背景条
  ctx.fillStyle = '#e52b21'  // 京东红
  ctx.fillRect(0, 0, width, overlayHeight)

  // 尝试加载 Logo 并绘制（如果有的话）
  try {
    const logo = await loadImage('/logo.png')
    const logoHeight = overlayHeight * 0.6
    const logoWidth = logo.width * (logoHeight / logo.height)
    const logoX = 20
    const logoY = (overlayHeight - logoHeight) / 2
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight)
  } catch {
    // Logo 加载失败，用文字替代
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${overlayHeight * 0.5}px "Noto Sans SC", sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText('京东 618', 20, overlayHeight / 2)
  }

  // 右侧活动标签
  ctx.fillStyle = '#ffffff'
  ctx.font = `${overlayHeight * 0.35}px "Noto Sans SC", sans-serif`
  ctx.textAlign = 'right'
  ctx.fillText('清凉季', width - 20, overlayHeight / 2)
}

/**
 * 绘制搜索框压板（底部白色搜索条）
 */
async function drawSearchBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Promise<void> {
  const barHeight = Math.floor(height * 0.07)
  const barY = height - barHeight - 20  // 距离底部 20px

  // 半透明白色背景
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2

  // 绘制圆角矩形搜索框
  const padding = 15
  const radius = barHeight / 2
  roundRect(ctx, padding, barY, width - padding * 2, barHeight, radius)
  ctx.fill()

  // 重置阴影
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // 搜索图标（简化版放大镜）
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 2
  const iconX = padding + 20
  const iconY = barY + barHeight / 2
  const iconRadius = barHeight * 0.25
  ctx.beginPath()
  ctx.arc(iconX, iconY, iconRadius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(iconX + iconRadius * 0.7, iconY + iconRadius * 0.7)
  ctx.lineTo(iconX + iconRadius * 1.4, iconY + iconRadius * 1.4)
  ctx.stroke()

  // 搜索提示文字
  ctx.fillStyle = '#999'
  ctx.font = `${barHeight * 0.35}px "Noto Sans SC", sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('搜索商品', iconX + 30, barY + barHeight / 2)
}

/**
 * 绘制圆角矩形
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
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

/**
 * 辅助函数：加载图片
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
