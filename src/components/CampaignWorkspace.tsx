import { useEffect, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDown, ArrowUpRight,
  Bot, Check, ChevronRight, CircleAlert, Clock3,
  Pause, Play, RefreshCw, ShieldCheck, Sparkles, TrendingUp,
  X, Zap, AlertCircle, CheckCircle2, RotateCcw, History, TrendingDown,
} from 'lucide-react'
import {
  agentRuns, campaignStages, defaultActionIntents,totalCampaignAssets,
  type ActionIntent, type DecisionLogEntry, type IntentStatus, type RiskTier,
} from '../domain/campaign'

type Props = { onBack: () => void; onVenue: () => void }

const RISK_CONFIG: Record<RiskTier, { label: string; color: string; icon: React.ReactNode }> = {
  low: { label: 'AI 自动执行', color: 'risk-low', icon: <Zap size={11} /> },
  medium: { label: '需要批准', color: 'risk-medium', icon: <AlertCircle size={11} /> },
  high: { label: '高风险 · 人工评估', color: 'risk-high', icon: <AlertTriangle size={11} /> },
}

function RiskBadge({ tier }: { tier: RiskTier }) {
  const cfg = RISK_CONFIG[tier]
  return (
    <span className={`risk-badge ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function CountdownBar({ ms, onExpire }: { ms: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(ms)
  const expiredRef = useRef(false)

  useEffect(() => {
    expiredRef.current = false
    setRemaining(ms)
    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 100
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true
          window.clearInterval(interval)
          onExpire()
          return 0
        }
        return Math.max(0, next)
      })
    }, 100)
    return () => window.clearInterval(interval)
  }, [ms, onExpire])

  const pct = Math.round((remaining / ms) * 100)
  return (
    <div className="countdown-bar">
      <span>自动执行倒计时</span>
      <div className="countdown-track"><div className="countdown-fill" style={{ width: `${pct}%` }} /></div>
      <strong>{(remaining / 1000).toFixed(1)}s</strong>
    </div>
  )
}

function IntentCard({
  intent,
  onApprove,
  onDismiss,
  onRollback,
}: {
  intent: ActionIntent
  onApprove: (id: string) => void
  onDismiss: (id: string) => void
  onRollback: (id: string) => void
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const isDone = intent.status === 'done'
  const isRolledBack = intent.status === 'rolled_back'

  return (
    <div className={`intent-card intent-${intent.riskTier} intent-status-${intent.status}`}>
      <div className="intent-card-header">
        <RiskBadge tier={intent.riskTier} />
        <span className="intent-agent">{intent.agent}</span>
        {isDone && <span className="intent-done-badge"><CheckCircle2 size={11} />已执行</span>}
        {isRolledBack && <span className="intent-rolled-badge"><RotateCcw size={11} />已回滚</span>}
      </div>

      <div className="intent-card-body">
        <div className="intent-main">
          <div className="intent-icon-wrap">
            <Bot size={15} />
          </div>
          <div className="intent-content">
            <h4>{intent.title}</h4>
            <p>{intent.description}</p>
          </div>
          <div className="intent-confidence">
            <span>置信度</span>
            <strong>{intent.confidence}%</strong>
          </div>
        </div>

        {intent.status === 'executing' && intent.executingProgress !== undefined && (
          <div className="intent-executing">
            <div className="intent-exec-bar">
              <div className="intent-exec-fill" style={{ width: `${intent.executingProgress}%` }} />
            </div>
            <small>执行中 · {intent.executingProgress}%</small>
          </div>
        )}

        {intent.autoExecuteAfterMs && intent.status === 'pending' && (
          <CountdownBar
            ms={intent.autoExecuteAfterMs}
            onExpire={() => onApprove(intent.id)}
          />
        )}

        <div className="intent-evidence-row">
          {intent.evidenceItems.map((item) => (
            <div key={item.label} className={`evidence-chip trend-${item.trend ?? 'neutral'}`}>
              {item.trend === 'up' && <ArrowUpRight size={10} />}
              {item.trend === 'down' && <ArrowDown size={10} />}
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      {!isDone && !isRolledBack && (
        <div className="intent-card-actions">
          <button className="intent-evidence-toggle" onClick={() => setEvidenceOpen((o) => !o)}>
            {evidenceOpen ? '收起' : '查看数据窗口'}
          </button>

          {evidenceOpen && (
            <div className="intent-detail-panel">
              <div><small>数据窗口</small><span>近 30 分钟 · 样本 48,200 次</span></div>
              <div><small>对照基线</small><span>过去 7 日同时段均值</span></div>
              <div><small>归因模型</small><span>多变量 Δ 归因 · 滞后校正</span></div>
            </div>
          )}

          <div className="intent-buttons">
            {intent.status === 'pending' && (
              <>
                <button className="intent-btn-dismiss" onClick={() => onDismiss(intent.id)}>
                  <X size={13} />忽略
                </button>
                {intent.riskTier !== 'low' && (
                  <button
                    className={`intent-btn-approve intent-approve-${intent.riskTier}`}
                    onClick={() => onApprove(intent.id)}
                  >
                    <Check size={13} />
                    {intent.riskTier === 'high' ? '确认执行（不可逆）' : '批准执行'}
                  </button>
                )}
              </>
            )}
            {intent.status === 'done' && intent.riskTier !== 'high' && (
              <button className="intent-btn-rollback" onClick={() => onRollback(intent.id)}>
                <RotateCcw size={13} />回滚此操作
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DecisionLog({ entries }: { entries: DecisionLogEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div className="decision-log">
      <div className="decision-log-header">
        <History size={13} />
        <span>决策日志</span>
        <em>{entries.length} 条</em>
      </div>
      <div className="decision-log-list">
        {entries.map((entry) => (
          <div key={entry.id} className={`decision-log-row log-action-${entry.action}`}>
            <span className={`log-dot risk-dot-${entry.riskTier}`} />
            <div className="log-content">
              <strong>{entry.title}</strong>
              <p>{entry.agent} · {entry.timestamp}</p>
              {entry.outcome && <em>{entry.outcome}</em>}
            </div>
            <span className={`log-badge log-${entry.action}`}>
              {entry.action === 'approved' && '已批准'}
              {entry.action === 'dismissed' && '已忽略'}
              {entry.action === 'auto_executed' && 'AI 执行'}
              {entry.action === 'rolled_back' && '已回滚'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampaignWorkspace({ onBack, onVenue }: Props) {
  const [intents, setIntents] = useState<ActionIntent[]>(defaultActionIntents)
  const [log, setLog] = useState<DecisionLogEntry[]>([])
  const [selectedStage, setSelectedStage] = useState('arrival')
  const [submitted, setSubmitted] = useState(false)
  const [activeTouchpoint, setActiveTouchpoint] = useState<string | null>(null)
  const [metricToast, setMetricToast] = useState<{ title: string; delta: string; positive: boolean } | null>(null)
  const currentStage = campaignStages.find((s) => s.id === selectedStage)!

  const addLog = (intent: ActionIntent, action: DecisionLogEntry['action'], outcome?: string) => {
    setLog((prev) => [
      {
        id: `log-${Date.now()}`,
        intentId: intent.id,
        title: intent.title,
        agent: intent.agent,
        action,
        riskTier: intent.riskTier,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        outcome,
      },
      ...prev,
    ])
  }

  const approveIntent = (id: string) => {
    const intent = intents.find((i) => i.id === id)
    if (!intent) return

    // Metric outcome map: intentId → what the data shows after execution
    const intentOutcomes: Record<string, { title: string; delta: string; positive: boolean }> = {
      'intent-001': { title: '会场到达率回升', delta: '+4.2pp · 82.6% → 86.8%', positive: true },
      'intent-002': { title: '首楼加购率提升', delta: '+3.2% · AI 自动执行', positive: true },
      'intent-003': { title: '开屏 CTR 持续领先', delta: '+18.3% vs 对照组', positive: true },
      'intent-004': { title: '权益降级已执行', delta: '转化率仍在观察中', positive: false },
    }

    setIntents((prev) => prev.map((i) => i.id === id ? { ...i, status: 'executing' as IntentStatus, executingProgress: 0 } : i))

    const startProgress = () => {
      let progress = 0
      const interval = window.setInterval(() => {
        progress += Math.random() * 18 + 8
        if (progress >= 100) {
          window.clearInterval(interval)
          setIntents((prev) => prev.map((i) => i.id === id ? { ...i, status: 'done' as IntentStatus, executingProgress: 100 } : i))
          addLog(intent, intent.riskTier === 'low' ? 'auto_executed' : 'approved', '执行成功，数据回收中')
          const outcome = intentOutcomes[id]
          if (outcome) {
            setMetricToast(outcome)
            window.setTimeout(() => setMetricToast(null), 5000)
          }
        } else {
          setIntents((prev) => prev.map((i) => i.id === id ? { ...i, executingProgress: Math.round(progress) } : i))
        }
      }, 280)
    }

    window.setTimeout(startProgress, 200)
  }

  const dismissIntent = (id: string) => {
    const intent = intents.find((i) => i.id === id)
    if (!intent) return
    setIntents((prev) => prev.map((i) => i.id === id ? { ...i, status: 'dismissed' as IntentStatus } : i))
    addLog(intent, 'dismissed')
  }

  const rollbackIntent = (id: string) => {
    const intent = intents.find((i) => i.id === id)
    if (!intent) return
    setIntents((prev) => prev.map((i) => i.id === id ? { ...i, status: 'rolled_back' as IntentStatus } : i))
    addLog(intent, 'rolled_back', '已恢复至执行前状态')
  }

  const handleTouchpoint = (item: string) => {
    if (item === '营销会场 B') { onVenue(); return }
    setActiveTouchpoint(item)
    window.setTimeout(() => setActiveTouchpoint(null), 1500)
  }

  const activeIntents = intents.filter((i) => i.status === 'pending' || i.status === 'executing')
  const resolvedIntents = intents.filter((i) => i.status === 'done' || i.status === 'dismissed' || i.status === 'rolled_back')

  return (
    <div className="campaign-workspace">
      {/* Metric improvement toast */}
      {metricToast && (
        <div className={`metric-toast ${metricToast.positive ? 'toast-positive' : 'toast-neutral'}`}>
          {metricToast.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <div>
            <strong>{metricToast.title}</strong>
            <span>{metricToast.delta}</span>
          </div>
          <button onClick={() => setMetricToast(null)}><X size={12} /></button>
        </div>
      )}
      <div className="campaign-titlebar">
        <div>
          <button onClick={onBack}>创意工作台</button>
          <ChevronRight size={13} />
          <span>清凉季全域增长 Campaign</span>
        </div>
        <div className="campaign-actions">
          <span><i />运行中 · L1</span>
          <button onClick={() => {}}><Pause size={14} />暂停自动任务</button>
          <button
            className={`dark ${submitted ? 'submitted' : ''}`}
            onClick={() => setSubmitted(true)}
            disabled={submitted}
          >
            {submitted ? <><Check size={14} />已提交审批</> : <><Play size={14} />提交投放审批</>}
          </button>
        </div>
      </div>

      <section className="campaign-hero">
        <div>
          <span className="campaign-code">CAMPAIGN / JD-SUMMER-2607</span>
          <h1>清凉季全域增长</h1>
          <p>营销活动智能体围绕 GMV 增长目标，持续协调创意、资源位、会场与实验。</p>
        </div>
        <div className="campaign-metrics">
          <div><small>GMV</small><strong>¥ 286.4万</strong><em><TrendingUp />+12.8%</em></div>
          <div><small>支付转化率</small><strong>4.18%</strong><em><TrendingUp />+0.46pp</em></div>
          <div><small>资产 / 资源</small><strong>{totalCampaignAssets()}</strong><em className="neutral">5 阶段</em></div>
          <div><small>护栏状态</small><strong>正常</strong><em className="safe"><ShieldCheck />0 阻断</em></div>
        </div>
      </section>

      <section className="journey-section">
        <div className="section-title">
          <div><span>01</span><h2>用户旅程</h2></div>
          <p>创意、资源位和会场共享统一 Campaign 标识</p>
        </div>
        <div className="journey-flow">
          {campaignStages.map((stage, index) => (
            <button
              key={stage.id}
              className={`${stage.status} ${selectedStage === stage.id ? 'selected' : ''}`}
              onClick={() => setSelectedStage(stage.id)}
            >
              <div className="stage-top">
                <span>0{index + 1}</span>
                <i />
                <em>{stage.assets} 个资产</em>
              </div>
              <h3>{stage.name}</h3>
              <p>{stage.objective}</p>
              <div><small>{stage.metric}</small><strong>{stage.value}</strong></div>
              {index < campaignStages.length - 1 && <ChevronRight className="flow-arrow" />}
            </button>
          ))}
        </div>
        <div className="stage-objective-bar">
          <Sparkles size={12} />
          <span><strong>{currentStage.name}</strong> — {currentStage.objective}</span>
        </div>
      </section>

      <div className="campaign-grid">
        {/* Left: orchestrator with multi-intent queue */}
        <section className="orchestrator-panel">
          <div className="section-title">
            <div><span>02</span><h2>营销活动智能体</h2></div>
            <em><i />正在编排</em>
          </div>

          {/* Intent queue header */}
          <div className="intent-queue-header">
            <div className="intent-queue-counts">
              <span className="iq-count iq-pending">{activeIntents.length} 待处理</span>
              {resolvedIntents.length > 0 && <span className="iq-count iq-done">{resolvedIntents.length} 已处理</span>}
            </div>
            <p>智能体发现以下可优化动作，按风险等级需要不同授权</p>
          </div>

          {/* Active intents */}
          <div className="intent-queue">
            {activeIntents.length === 0 && (
              <div className="intent-queue-empty">
                <CheckCircle2 size={20} />
                <span>暂无待处理建议，智能体持续监控中</span>
              </div>
            )}
            {activeIntents.map((intent) => (
              <IntentCard
                key={intent.id}
                intent={intent}
                onApprove={approveIntent}
                onDismiss={dismissIntent}
                onRollback={rollbackIntent}
              />
            ))}
          </div>

          {/* Resolved intents (collapsed) */}
          {resolvedIntents.length > 0 && (
            <div className="intent-resolved-section">
              <div className="intent-resolved-header">已处理建议</div>
              {resolvedIntents.map((intent) => (
                <IntentCard
                  key={intent.id}
                  intent={intent}
                  onApprove={approveIntent}
                  onDismiss={dismissIntent}
                  onRollback={rollbackIntent}
                />
              ))}
            </div>
          )}

          {/* Decision log */}
          <DecisionLog entries={log} />
        </section>

        {/* Right: agent status panel */}
        <section className="agent-panel">
          <div className="section-title">
            <div><span>03</span><h2>专业智能体任务</h2></div>
            <small>5 / 5 在线</small>
          </div>
          <div className="agent-list">
            {agentRuns.map((run) => (
              <button key={run.id}>
                <span className={`agent-icon ${run.status}`}>
                  {run.status === 'done' ? <Check /> : run.status === 'running' ? <Activity /> : <Clock3 />}
                </span>
                <span>
                  <strong>{run.agent}</strong>
                  <p>{run.task}</p>
                  <small>{run.evidence}</small>
                </span>
                <ChevronRight />
              </button>
            ))}
          </div>

          {/* Risk tier legend */}
          <div className="risk-legend">
            <div className="risk-legend-title">决策分级说明</div>
            {(['low', 'medium', 'high'] as RiskTier[]).map((tier) => (
              <div key={tier} className={`risk-legend-row risk-legend-${tier}`}>
                <span className={`risk-dot risk-dot-${tier}`} />
                <div>
                  <strong>{RISK_CONFIG[tier].label}</strong>
                  <p>
                    {tier === 'low' && '影响小、可回滚，AI 自动完成并通知'}
                    {tier === 'medium' && '中度影响，需运营批准后执行'}
                    {tier === 'high' && '高风险，需人工评估 + 延迟执行窗口'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="touchpoint-strip">
        <div><span>04</span><h2>触点资产</h2></div>
        {(['开屏 A/B', '首页 Banner', '品类资源位', '营销会场 B', '分享海报'] as const).map((item, index) => (
          <button
            key={item}
            className={activeTouchpoint === item ? 'touchpoint-active' : ''}
            onClick={() => handleTouchpoint(item)}
          >
            <i className={`touch-${index}`} />
            <span>
              <strong>{item}</strong>
              <small>{index === 3 ? '实验版本 · 待审批' : '已审核 · 投放中'}</small>
            </span>
            <ChevronRight />
          </button>
        ))}
      </section>
    </div>
  )
}
