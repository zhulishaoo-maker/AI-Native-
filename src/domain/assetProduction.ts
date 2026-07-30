export type CandidateStatus = 'queued' | 'generating' | 'validating' | 'ready' | 'failed' | 'refining' | 'reviewing' | 'approved'

// AI narration phrases shown during generating/validating states
export const generatingPhrases = [
  '正在解读场景与活动信息…',
  '正在分析品类视觉风格偏好…',
  '正在调度底图生成智能体…',
  '正在构建景深与光线参数…',
  '正在渲染高清商业级画质…',
]
export const validatingPhrases = [
  '正在校验品牌安全区…',
  '正在检查搜索框压板位置…',
  '正在比对文案长度规范…',
  '正在确认主体边距合规…',
]

export type RuleCheck = {
  id: 'brand-overlay' | 'search-overlay' | 'safe-area' | 'copy-length' | 'dimensions'
  label: string
  detail: string
  passed: boolean
  locked?: boolean
}

export type CandidateInsight = {
  strategy: string        // e.g. "冷色调 · 年轻女性"
  strategyTags: string[]  // chip labels on the card
  predictedCtr: string    // e.g. "+8.3%"
  aiRationale: string     // 1-2 sentence explanation shown in inspector
}

export type CreativeCandidate = {
  id: string
  index: number
  status: CandidateStatus
  progress: number
  version: number
  title: string
  subtitle: string
  cta: string
  rules: RuleCheck[]
  error?: string
  imageUrl?: string
  insight: CandidateInsight
}

const titles = ['冰爽开场', '清凉好物', '盛夏焕新', '热爱降温']

const candidateInsights: CandidateInsight[] = [
  {
    strategy: '冷色调 · 年轻女性',
    strategyTags: ['冲击首屏', '情绪感强', '高点击'],
    predictedCtr: '+8.3%',
    aiRationale: '冷色调冰感视觉在夏季美妆类目与 18-28 岁女性用户高度共鸣，历史相似创意平均 CTR 高出基线 8.3%，适合开场抓眼球。',
  },
  {
    strategy: '暖橙调 · 全年龄段',
    strategyTags: ['强转化', '权益清晰', '放量款'],
    predictedCtr: '+5.1%',
    aiRationale: '暖橙色系在「好物清单」品类渗透率最高，文案以商品价值为核心可加速决策漏斗，适合主力放量。',
  },
  {
    strategy: '自然绿 · 精致生活',
    strategyTags: ['品牌调性', '加购率高', '长尾流量'],
    predictedCtr: '+3.7%',
    aiRationale: '绿色清新调性强化「天然护肤」认知，对复购用户和加购行为有正向拉动，适合品牌型流量运营。',
  },
  {
    strategy: '深蓝夜感 · 男性用户',
    strategyTags: ['差异化', '男性护肤', '小众精准'],
    predictedCtr: '+6.9%',
    aiRationale: '深蓝夜感风格在男性护肤赛道差异化突出，精准触达 25-35 岁男性用户，预期点击密度高但人群相对窄。',
  },
]

export function createCandidateBatch(batchId: string): CreativeCandidate[] {
  return titles.map((title, index) => ({
    id: `${batchId}-candidate-${index + 1}`,
    index,
    status: 'queued',
    progress: 0,
    version: 1,
    title,
    subtitle: '清凉一夏，好物即刻拥有',
    cta: '立即抢购',
    rules: createRuleChecks(),
    insight: candidateInsights[index],
  }))
}

export function createRuleChecks(): RuleCheck[] {
  return [
    { id: 'brand-overlay', label: '京东大促品牌压板', detail: 'JD 618 / v3.2', passed: true, locked: true },
    { id: 'search-overlay', label: '京东搜索框压板', detail: '底部安全区内', passed: true, locked: true },
    { id: 'safe-area', label: '主体安全区', detail: '边距 ≥ 32px', passed: true },
    { id: 'copy-length', label: '营销文案', detail: '标题 ≤ 12 字', passed: true },
    { id: 'dimensions', label: '尺寸与清晰度', detail: '750 × 1000 / 2x', passed: true },
  ]
}

export function transitionCandidate(candidate: CreativeCandidate, status: CandidateStatus, progress: number): CreativeCandidate {
  return { ...candidate, status, progress: Math.max(0, Math.min(100, progress)), error: status === 'failed' ? candidate.error : undefined }
}

export function failCandidate(candidate: CreativeCandidate, error: string): CreativeCandidate {
  return { ...candidate, status: 'failed', progress: 68, error, imageUrl: undefined }
}

export function retryCandidate(candidate: CreativeCandidate): CreativeCandidate {
  return { ...candidate, status: 'generating', progress: 12, version: candidate.version + 1, error: undefined, imageUrl: undefined }
}

export function setImageUrl(candidate: CreativeCandidate, url: string): CreativeCandidate {
  return { ...candidate, imageUrl: url }
}

export function updateCandidateCopy(candidate: CreativeCandidate, copy: Pick<CreativeCandidate, 'title' | 'subtitle' | 'cta'>): CreativeCandidate {
  const copyPassed = copy.title.trim().length > 0 && copy.title.trim().length <= 12 && copy.cta.trim().length > 0 && copy.cta.trim().length <= 6
  return {
    ...candidate,
    ...copy,
    version: candidate.version + 1,
    status: 'ready',
    rules: candidate.rules.map((rule) => rule.id === 'copy-length' ? { ...rule, passed: copyPassed, detail: copyPassed ? '标题 ≤ 12 字 · CTA ≤ 6 字' : '文案超出限制' } : rule),
  }
}

export function canSubmitReview(candidate: CreativeCandidate) {
  return candidate.status === 'ready' && candidate.rules.every((rule) => rule.passed)
}

export function deriveBatchProgress(candidates: CreativeCandidate[]) {
  return Math.round(candidates.reduce((sum, candidate) => sum + candidate.progress, 0) / candidates.length)
}

