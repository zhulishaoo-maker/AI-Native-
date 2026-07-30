import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bot, ChevronRight, Sparkles, X } from 'lucide-react'

type Touchpoint = {
  id: string
  name: string
  count: number
  unit: string
  active: boolean
  color: string
}

type ParsedBrief = {
  goal: string
  audience: string
  period: string
  budget: string
}

type Props = {
  onBack: () => void
  onHandoff: (goal: string) => void
}

const defaultTouchpoints: Touchpoint[] = [
  { id: 'splash', name: '开屏',   count: 3, unit: '套',  active: true, color: '#1a3a52' },
  { id: 'banner', name: 'Banner', count: 8, unit: '尺寸', active: true, color: '#2a1a4a' },
  { id: 'poster', name: '海报',   count: 4, unit: '套',  active: true, color: '#1a3a2a' },
  { id: 'venue',  name: '会场',   count: 3, unit: '候选', active: true, color: '#3a2a12' },
]

function parseGoal(text: string): ParsedBrief {
  const hasGmv = /GMV|销售|增长|转化/.test(text)
  const hasBrand = /品牌|新品|渗透|认知/.test(text)
  const hasRetention = /复购|留存|老客/.test(text)
  const goals = [hasGmv && 'GMV 增长', hasBrand && '新品渗透', hasRetention && '老客复购'].filter(Boolean)
  const audience = /美妆|护肤|彩妆/.test(text) ? '美妆活跃用户 · 女性 18-35'
    : /数码|3C|电子/.test(text) ? '数码爱好者 · 男性 25-40'
    : /食品|零食/.test(text) ? '家庭主力购买人群'
    : '全域活跃用户'
  const period = /7天|一周/.test(text) ? '7 天'
    : /3天|三天/.test(text) ? '3 天'
    : /14天|两周/.test(text) ? '14 天'
    : '7 天'
  const budget = /大促|狂欢|618|双11/.test(text) ? '大促级预算' : '常规活动预算'
  return {
    goal: goals.length > 0 ? goals.join(' + ') : 'GMV 增长',
    audience,
    period,
    budget,
  }
}

export function CampaignPlanner({ onBack, onHandoff }: Props) {
  const [goal, setGoal] = useState('夏日美妆狂欢，满300减50，主推防晒和控油新品')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedBrief | null>({
    goal: 'GMV + 新品渗透',
    audience: '美妆活跃用户 · 女性 18-35',
    period: '7 天',
    budget: '大促级预算',
  })
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>(defaultTouchpoints)
  const parseTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => { if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current) }
  }, [])

  const handleGoalChange = (value: string) => {
    setGoal(value)
    setParsed(null)
    if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current)
    if (value.trim().length < 5) return
    parseTimerRef.current = window.setTimeout(() => {
      setParsing(true)
      window.setTimeout(() => {
        setParsing(false)
        setParsed(parseGoal(value))
      }, 700)
    }, 800)
  }

  const toggleTouchpoint = (id: string) => {
    setTouchpoints((prev) => prev.map((t) => t.id === id ? { ...t, active: !t.active } : t))
  }

  const activeCount = touchpoints.filter((t) => t.active).length
  const canGenerate = parsed !== null && activeCount > 0

  return (
    <div className="campaign-planner">
      <div className="planner-back">
        <button onClick={onBack}><ArrowLeft size={14} />首页</button>
        <ChevronRight size={12} />
        <span>全链路活动</span>
      </div>

      <div className="planner-card">
        <div className="planner-card-header">
          <span className="planner-eyebrow">CAMPAIGN AUTOPILOT</span>
          <h1>一次规划所有触点</h1>
          <p>输入活动目标，AI 生成完整用户旅程和资源组合。</p>
        </div>

        <div className="planner-goal-box">
          <textarea
            className="planner-textarea"
            value={goal}
            onChange={(e) => handleGoalChange(e.target.value)}
            placeholder="描述你的活动目标，例如：夏日美妆狂欢，满300减50，主推防晒和控油新品…"
            rows={3}
          />
          <div className="planner-goal-footer">
            {parsing && (
              <span className="planner-parsing">
                <span className="planner-spinner" />
                AI 正在解析…
              </span>
            )}
            {!parsing && parsed && (
              <div className="planner-parsed-meta">
                <span className="planner-meta-tag"><em>目标</em>{parsed.goal}</span>
                <span className="planner-meta-sep">·</span>
                <span className="planner-meta-tag"><em>人群</em>{parsed.audience}</span>
                <span className="planner-meta-sep">·</span>
                <span className="planner-meta-tag"><em>周期</em>{parsed.period}</span>
              </div>
            )}
            {!parsing && !parsed && goal.trim().length > 0 && (
              <span className="planner-parsing-hint">稍等片刻，AI 即将解析…</span>
            )}
          </div>
        </div>

        <div className="planner-touchpoints">
          {touchpoints.map((tp) => (
            <button
              key={tp.id}
              className={`planner-touchpoint-card ${tp.active ? 'active' : ''}`}
              onClick={() => toggleTouchpoint(tp.id)}
              style={{ '--tp-color': tp.color } as React.CSSProperties}
            >
              {tp.active && (
                <span className="tp-active-dot" />
              )}
              {!tp.active && (
                <span className="tp-inactive-icon"><X size={10} /></span>
              )}
              <strong>{tp.name}</strong>
              <div className="tp-count">
                <b>{tp.count}</b>
                <small>{tp.unit}</small>
              </div>
            </button>
          ))}
        </div>

        {activeCount === 0 && (
          <p className="planner-no-tp-warn">请至少选择一个触点类型</p>
        )}

        <button
          className={`planner-generate-btn ${canGenerate ? 'ready' : ''}`}
          disabled={!canGenerate}
          onClick={() => onHandoff(goal)}
        >
          <Bot size={16} />
          生成活动计划
        </button>

        <div className="planner-footer-note">
          <Sparkles size={11} />
          <span>智能体将自动规划 {activeCount} 个触点的全部资产、实验护栏与数据链路，你可随时接管或调整</span>
        </div>
      </div>
    </div>
  )
}
