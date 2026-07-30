export type JourneyStatus = 'active' | 'ready' | 'watching'

export type JourneyStage = {
  id: 'exposure' | 'interest' | 'arrival' | 'conversion' | 'sharing'
  name: string
  objective: string
  assets: number
  metric: string
  value: string
  status: JourneyStatus
}

export type AgentRun = {
  id: string
  agent: string
  task: string
  status: 'done' | 'running' | 'review'
  evidence: string
}

// Three-tier decision model: green = AI auto-executes, yellow = requires approval, red = requires human + delay
export type RiskTier = 'low' | 'medium' | 'high'

export type IntentStatus = 'pending' | 'approved' | 'dismissed' | 'executing' | 'done' | 'rolled_back'

export type ActionIntent = {
  id: string
  agent: string
  title: string
  description: string
  riskTier: RiskTier
  riskLabel: string
  evidenceItems: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[]
  confidence: number
  status: IntentStatus
  autoExecuteAfterMs?: number   // low-risk: auto-execute after N ms unless dismissed
  requiresDelay?: boolean       // high-risk: show countdown before executing
  approvedAt?: number
  executingProgress?: number
}

export type DecisionLogEntry = {
  id: string
  intentId: string
  title: string
  agent: string
  action: 'approved' | 'dismissed' | 'auto_executed' | 'rolled_back'
  riskTier: RiskTier
  timestamp: string
  outcome?: string
}

export const campaignStages: JourneyStage[] = [
  { id: 'exposure', name: '曝光', objective: '建立活动认知', assets: 7, metric: '曝光', value: '128.4万', status: 'active' },
  { id: 'interest', name: '兴趣', objective: '激发点击与探索', assets: 12, metric: 'CTR', value: '6.42%', status: 'active' },
  { id: 'arrival', name: '到达', objective: '承接流量意图', assets: 3, metric: '到达率', value: '82.6%', status: 'watching' },
  { id: 'conversion', name: '转化', objective: '权益驱动下单', assets: 5, metric: '支付转化', value: '4.18%', status: 'ready' },
  { id: 'sharing', name: '再传播', objective: '促进分享回流', assets: 4, metric: '分享率', value: '1.36%', status: 'ready' },
]

export const agentRuns: AgentRun[] = [
  { id: 'design', agent: '设计智能体', task: '生成 4 组清凉季主视觉并完成品牌压板', status: 'done', evidence: '4 个资产 · 校验通过' },
  { id: 'venue', agent: '会场运营智能体', task: '优化首楼利益点与防晒商品排序', status: 'running', evidence: '预计提升加购率 3.2%' },
  { id: 'channel', agent: '渠道运营智能体', task: '匹配开屏、首页 Banner 与品类资源位', status: 'done', evidence: '7 个资源位 · 频控正常' },
  { id: 'data', agent: '数据分析智能体', task: '诊断点击正常但会场到达率下降', status: 'review', evidence: '置信度 87% · 建议实验' },
  { id: 'governance', agent: '治理智能体', task: '复核权益、价格、授权与品牌一致性', status: 'done', evidence: '0 个阻断项' },
]

export const defaultActionIntents: ActionIntent[] = [
  {
    id: 'intent-001',
    agent: '数据分析智能体',
    title: '启动「会场首屏 B」10% 小流量实验',
    description: '开屏与 Banner 点击率保持稳定，但会场到达率较基线下降 6.3%。归因判断：首屏 LCP 超 2.1s 且利益点可见区偏移。建议以 10% 流量测试会场 B 版本，持续 2 小时，最小样本 30,000，到达率低于 78% 自动回滚。',
    riskTier: 'medium',
    riskLabel: '需要批准',
    confidence: 87,
    evidenceItems: [
      { label: '创意点击率', value: '6.42% · 正常', trend: 'up' },
      { label: '会场到达率', value: '82.6% · -6.3%', trend: 'down' },
      { label: '判断置信度', value: '87%', trend: 'neutral' },
      { label: '数据窗口', value: '近 30 min · 48,200 次', trend: 'neutral' },
    ],
    status: 'pending',
  },
  {
    id: 'intent-002',
    agent: '会场运营智能体',
    title: '将首楼防晒坑位从 4 个调整为 6 个',
    description: '防晒类目点击密度在当前时段高出大盘 22%，首楼坑位扩充可直接承接需求，预计加购率提升 3.2%。属于低风险页面结构调整，不影响品牌压板与核心利益点。',
    riskTier: 'low',
    riskLabel: 'AI 自动执行',
    confidence: 91,
    evidenceItems: [
      { label: '防晒类目点击密度', value: '+22% vs 大盘', trend: 'up' },
      { label: '预计加购率提升', value: '+3.2%', trend: 'up' },
      { label: '影响范围', value: '首楼坑位布局', trend: 'neutral' },
    ],
    status: 'pending',
    autoExecuteAfterMs: 8000,
  },
  {
    id: 'intent-003',
    agent: '渠道运营智能体',
    title: '将开屏 A/B 实验流量从 10% 扩量至 30%',
    description: '开屏 B 方案（冰感冷蓝调）在 A/B 实验中 CTR 高出对照组 18.3%，统计显著性已达 p<0.05。建议扩量至 30% 继续验证，预计 3 小时后可决策全量切换。',
    riskTier: 'medium',
    riskLabel: '需要批准',
    confidence: 79,
    evidenceItems: [
      { label: '实验 CTR 提升', value: '+18.3% vs 对照', trend: 'up' },
      { label: '统计显著性', value: 'p < 0.05', trend: 'neutral' },
      { label: '当前实验流量', value: '10%', trend: 'neutral' },
    ],
    status: 'pending',
  },
  {
    id: 'intent-004',
    agent: '数据分析智能体',
    title: '触发满减权益降级：满 300 减 50 → 满 200 减 30',
    description: '当前时段支付转化率低于历史同期 1.8pp，加购未付款率上升。权益降级将影响 GMV 核算基础，属于高风险决策，建议人工评估后再执行，且执行后有 10 分钟撤回窗口。',
    riskTier: 'high',
    riskLabel: '高风险 · 需人工评估',
    confidence: 62,
    evidenceItems: [
      { label: '转化率低于历史同期', value: '-1.8pp', trend: 'down' },
      { label: '加购未付款率', value: '↑ 上升中', trend: 'down' },
      { label: '判断置信度', value: '62% · 偏低', trend: 'neutral' },
      { label: '潜在 GMV 影响', value: '≈ -¥24万', trend: 'down' },
    ],
    status: 'pending',
    requiresDelay: true,
  },
]

export function totalCampaignAssets(stages = campaignStages) {
  return stages.reduce((sum, stage) => sum + stage.assets, 0)
}

// ── Live Metrics ──────────────────────────────────────────────────────────────

export type LiveMetrics = {
  impressions: number   // e.g. 12840000
  ctr: number           // e.g. 5.61 (percent)
  arrivalRate: number   // e.g. 82.6 (percent)
  gmv: number           // e.g. 2860000 (yuan)
  conversionRate: number // e.g. 4.18 (percent)
  tick: number          // monotonic counter, triggers re-render
}

export type DataQualityStatus = 'ok' | 'lag' | 'anomaly'

export type DataQuality = {
  status: DataQualityStatus
  label: string
  detail: string
}

const BASE: LiveMetrics = {
  impressions: 12840000,
  ctr: 5.61,
  arrivalRate: 82.6,
  gmv: 2860000,
  conversionRate: 4.18,
  tick: 0,
}

// Small random walk — values drift slightly each tick
export function tickMetrics(prev: LiveMetrics, boosted = false): LiveMetrics {
  const sign = () => (Math.random() > 0.5 ? 1 : -1)
  const jitter = (v: number, range: number) => Math.max(0, v + sign() * Math.random() * range)
  const boost = boosted ? 1.8 : 1
  return {
    impressions: Math.round(jitter(prev.impressions, 28000 * boost)),
    ctr: +jitter(prev.ctr, 0.04 * boost).toFixed(2),
    arrivalRate: +jitter(prev.arrivalRate, 0.18 * boost).toFixed(1),
    gmv: Math.round(jitter(prev.gmv, 6000 * boost)),
    conversionRate: +jitter(prev.conversionRate, 0.03 * boost).toFixed(2),
    tick: prev.tick + 1,
  }
}

export function baseMetrics(): LiveMetrics {
  return { ...BASE }
}

// Anomaly fires when arrivalRate drops below threshold
export function detectAnomaly(m: LiveMetrics): DataQuality {
  if (m.arrivalRate < 80) {
    return { status: 'anomaly', label: '到达率异常', detail: `会场到达率 ${m.arrivalRate.toFixed(1)}% 低于护栏阈值 80%` }
  }
  if (m.tick % 7 === 0 && m.tick > 0) {
    return { status: 'lag', label: '数据轻微延迟', detail: '采集链路正常，延迟约 8s' }
  }
  return { status: 'ok', label: '数据正常', detail: '全链路采集正常' }
}
