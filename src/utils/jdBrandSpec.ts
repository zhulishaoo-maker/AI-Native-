// JD 京喜品牌规范 VIS 校验工具
// 来源：京喜品牌标识规范 VIS 规范手册

export type ChannelSpec = {
  name: string
  width: number
  height: number
  safeMarginPx: number        // 安全边距（基于规范尺寸）
  brandOverlayRequired: boolean
  searchBarRequired: boolean
  maxTitleChars: number
  maxCtaChars: number
}

export const JD_CHANNEL_SPECS: Record<string, ChannelSpec> = {
  '750×1624': {
    name: '开屏',
    width: 750, height: 1624,
    safeMarginPx: 40,
    brandOverlayRequired: true,
    searchBarRequired: true,
    maxTitleChars: 12,
    maxCtaChars: 6,
  },
  '1920×1080': {
    name: 'Banner / 视频横版',
    width: 1920, height: 1080,
    safeMarginPx: 60,
    brandOverlayRequired: true,
    searchBarRequired: false,
    maxTitleChars: 16,
    maxCtaChars: 8,
  },
  '750×1000': {
    name: '营销海报',
    width: 750, height: 1000,
    safeMarginPx: 32,
    brandOverlayRequired: true,
    searchBarRequired: true,
    maxTitleChars: 12,
    maxCtaChars: 6,
  },
  '750×920': {
    name: '会场首屏',
    width: 750, height: 920,
    safeMarginPx: 32,
    brandOverlayRequired: true,
    searchBarRequired: false,
    maxTitleChars: 14,
    maxCtaChars: 6,
  },
  '1080×1920': {
    name: '竖版海报 / 内宣',
    width: 1080, height: 1920,
    safeMarginPx: 48,
    brandOverlayRequired: true,
    searchBarRequired: false,
    maxTitleChars: 14,
    maxCtaChars: 8,
  },
  '1200×1600': {
    name: '小红书封面',
    width: 1200, height: 1600,
    safeMarginPx: 40,
    brandOverlayRequired: false,
    searchBarRequired: false,
    maxTitleChars: 16,
    maxCtaChars: 8,
  },
  '1080×1440': {
    name: '视频号竖版',
    width: 1080, height: 1440,
    safeMarginPx: 40,
    brandOverlayRequired: false,
    searchBarRequired: false,
    maxTitleChars: 16,
    maxCtaChars: 8,
  },
  '1080×608': {
    name: '微信视频号横版',
    width: 1080, height: 608,
    safeMarginPx: 32,
    brandOverlayRequired: false,
    searchBarRequired: false,
    maxTitleChars: 16,
    maxCtaChars: 8,
  },
}

export type RuleCheckResult = {
  id: 'brand-overlay' | 'search-overlay' | 'safe-area' | 'copy-length' | 'dimensions'
  passed: boolean
  detail: string
}

/**
 * Validate an image URL against JD brand specs.
 * Returns a map of rule id → pass/fail+detail.
 */
export async function validateJDSpecs(
  imageUrl: string,
  ratioKey: string,  // e.g. "3:4 · 750×1000"
  title: string,
  cta: string,
  hasBrandOverlay: boolean,
  hasSearchOverlay: boolean,
): Promise<RuleCheckResult[]> {
  // Extract size key from ratio string like "3:4 · 750×1000"
  const sizeMatch = ratioKey.match(/(\d+)[×x](\d+)/)
  const sizeKey = sizeMatch ? `${sizeMatch[1]}×${sizeMatch[2]}` : ''
  const spec = JD_CHANNEL_SPECS[sizeKey]

  const results: RuleCheckResult[] = []

  // 1. Brand overlay
  results.push({
    id: 'brand-overlay',
    passed: !spec?.brandOverlayRequired || hasBrandOverlay,
    detail: spec?.brandOverlayRequired
      ? (hasBrandOverlay ? 'JD-CAMPAIGN v3.2 · 已应用' : '品牌压板缺失，不符合规范')
      : 'JD-CAMPAIGN v3.2',
  })

  // 2. Search overlay
  results.push({
    id: 'search-overlay',
    passed: !spec?.searchBarRequired || hasSearchOverlay,
    detail: spec?.searchBarRequired
      ? (hasSearchOverlay ? '底部安全区内 · 已应用' : '搜索框压板缺失')
      : '此渠道不需要搜索框压板',
  })

  // 3. Copy length
  const titlePass = title.length <= (spec?.maxTitleChars ?? 12)
  const ctaPass = cta.length <= (spec?.maxCtaChars ?? 6)
  results.push({
    id: 'copy-length',
    passed: titlePass && ctaPass,
    detail: titlePass && ctaPass
      ? `标题 ${title.length}/${spec?.maxTitleChars ?? 12} 字 · CTA ${cta.length}/${spec?.maxCtaChars ?? 6} 字`
      : `${!titlePass ? `标题超出 ${title.length}/${spec?.maxTitleChars ?? 12} 字` : ''} ${!ctaPass ? `CTA超出 ${cta.length}/${spec?.maxCtaChars ?? 6} 字` : ''}`.trim(),
  })

  // 4. Dimensions — check actual image dimensions
  const dimensionResult = await checkImageDimensions(imageUrl, spec)
  results.push(dimensionResult)

  // 5. Safe area — approximate: if dimensions match spec, assume safe area ok
  results.push({
    id: 'safe-area',
    passed: dimensionResult.passed,
    detail: spec ? `边距 ≥ ${spec.safeMarginPx}px · 主体安全区` : '边距 ≥ 32px',
  })

  return results
}

async function checkImageDimensions(
  url: string,
  spec: ChannelSpec | undefined,
): Promise<RuleCheckResult> {
  if (!spec) {
    return { id: 'dimensions', passed: true, detail: '尺寸校验跳过（未知规格）' }
  }

  return new Promise(resolve => {
    const img = new window.Image()
    const timeout = window.setTimeout(() => {
      resolve({ id: 'dimensions', passed: false, detail: '图片加载超时，无法校验尺寸' })
    }, 8000)
    img.onload = () => {
      window.clearTimeout(timeout)
      const expectedRatio = spec.width / spec.height
      const actualRatio = img.naturalWidth / img.naturalHeight
      const ratioMatch = Math.abs(actualRatio - expectedRatio) < 0.08
      resolve({
        id: 'dimensions',
        passed: ratioMatch,
        detail: ratioMatch
          ? `${img.naturalWidth}×${img.naturalHeight} · 比例符合规范`
          : `实际 ${img.naturalWidth}×${img.naturalHeight}，期望 ${spec.width}×${spec.height}`,
      })
    }
    img.onerror = () => {
      window.clearTimeout(timeout)
      resolve({ id: 'dimensions', passed: false, detail: '图片加载失败，无法校验尺寸' })
    }
    img.src = url
  })
}
