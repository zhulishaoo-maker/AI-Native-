import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Download, Edit3, Image, Maximize2, MoreHorizontal, Scissors, Sparkles, X } from 'lucide-react'

type Phase = 'brief' | 'planning' | 'generating' | 'complete'

type SubTask = { id: string; category: string; status: 'pending' | 'running' | 'done' }

type Asset = {
  id: string
  index: number
  category: string
  visual: string
  colorA: string
  colorB: string
  approved: boolean
}

const ASSETS: Asset[] = [
  { id: 'a1', index: 0, category: '化妆品', visual: '冰蓝玻璃质感 + 水滴冰晶', colorA: '#52b8d8', colorB: '#0c4a70', approved: false },
  { id: 'a2', index: 1, category: '3C 数码', visual: '深蓝科技感 + 极光流光', colorA: '#4858c8', colorB: '#080e38', approved: false },
  { id: 'a3', index: 2, category: '服饰', visual: '薄荷清新 + 自然感', colorA: '#3cb87a', colorB: '#0c3c24', approved: false },
]

function PosterPlaceholder({ asset, generating }: { asset: Asset; generating: boolean }) {
  if (generating) {
    return (
      <div className="ps-poster-generating">
        <div className="ps-gen-spinner" />
        <span>正在生成中…</span>
        <small>{asset.category} 视觉稿</small>
      </div>
    )
  }
  return (
    <div className="ps-poster" style={{ background: `linear-gradient(155deg, ${asset.colorA} 0%, ${asset.colorB} 100%)` }}>
      <div className="ps-poster-noise" />
      <div className="ps-poster-eyebrow">清凉季 · 夏日必备</div>
      <h2 className="ps-poster-title">清凉季</h2>
      <p className="ps-poster-subtitle">— 清凉心意 · 夏日上新 —</p>
      <div className="ps-poster-product-area">
        <div className="ps-product-bottle">
          <div className="ps-bottle-cap" />
          <div className="ps-bottle-body"><span>AQUA<br/>PURE</span></div>
        </div>
        <div className="ps-product-ice" />
      </div>
      <div className="ps-poster-benefit">
        <strong>满300减50</strong>
        <span>全场通用 叠加使用</span>
      </div>
      <button className="ps-poster-cta">立即抢购</button>
      <div className="ps-poster-lock">🔒 品牌压板已锁定</div>
    </div>
  )
}

export function ProductionStudio({ onComplete, onBack }: { goal: string; onComplete: () => void; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('brief')
  const [showAiText, setShowAiText] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const [tasks, setTasks] = useState<SubTask[]>(
    ASSETS.map(a => ({ id: a.id, category: a.category, status: 'pending' as const }))
  )
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [assets, setAssets] = useState(ASSETS)

  useEffect(() => {
    const timers: number[] = []
    timers.push(window.setTimeout(() => { setShowAiText(true); setPhase('planning') }, 1000))
    timers.push(window.setTimeout(() => setShowTable(true), 2200))
    timers.push(window.setTimeout(() => {
      setPhase('generating')
      setTasks(p => p.map((t, i) => i === 0 ? { ...t, status: 'running' } : t))
    }, 3200))
    timers.push(window.setTimeout(() => setTasks(p => p.map((t, i) => i === 0 ? { ...t, status: 'done' } : i === 1 ? { ...t, status: 'running' } : t)), 4600))
    timers.push(window.setTimeout(() => setTasks(p => p.map((t, i) => i === 1 ? { ...t, status: 'done' } : i === 2 ? { ...t, status: 'running' } : t)), 6000))
    timers.push(window.setTimeout(() => {
      setTasks(p => p.map(t => ({ ...t, status: 'done' })))
      setShowFinal(true)
      setPhase('complete')
    }, 7400))
    return () => timers.forEach(window.clearTimeout)
  }, [])

  const approve = (id: string) => setAssets(p => p.map(a => a.id === id ? { ...a, approved: true } : a))
  const allApproved = assets.every(a => a.approved)
  const current = assets[selectedIdx]
  const currentTaskDone = tasks[selectedIdx]?.status === 'done'

  return (
    <div className="production-studio">
      {/* ── LEFT: Chat panel ────────────────────────────────── */}
      <div className="ps-chat">
        <div className="ps-chat-header">
          <button className="ps-back-btn" onClick={onBack}><ArrowLeft size={15} /></button>
          <div className="ps-project-badge">
            <span className="ps-project-emoji">🐾</span>
            <span>清凉季</span>
          </div>
          <button className="ps-page-btn">Page 1 <ChevronDown size={11} /></button>
          <div className="ps-header-icons">
            <button>▷</button>
            <button>⏱</button>
            <button>⊞</button>
          </div>
        </div>

        <div className="ps-messages-area">
          {/* Task title */}
          <div className="ps-task-title">清凉季营销活动单品推广海报设计</div>

          {/* User brief bubble */}
          <div className="ps-bubble ps-bubble-user">
            <p>请为「清凉季」营销活动设计一组单品推广海报，包含化妆品、3C数码、服饰三个品类。设计要求：核心权益「满300减50」需突出展示，应用品牌搜索框压板效果和商品打标设计。整体视觉风格以清凉感为主，建议运用清爽的蓝绿色调、冰晶质感、流动的水波纹理或冰块肌理，营造夏日清凉的购物氛围，同时保持画面简洁、品牌信息清晰可读。</p>
          </div>

          {/* AI response */}
          {showAiText && (
            <div className="ps-ai-block">
              <div className="ps-ai-date">Jul 22, 2026</div>
              <p className="ps-ai-text">这是一组跨品类的活动海报需求，三个品类各有独立的视觉主体，我来分别生成。我将三个品类同步发出——每张海报都针对各自品类做了差异化的视觉处理，统一在清凉蓝绿色调和「满300减50」权益呈现上。</p>

              {showTable && (
                <table className="ps-plan-table">
                  <thead><tr><th>卡片</th><th>品类</th><th>视觉核心</th></tr></thead>
                  <tbody>
                    {ASSETS.map(a => (
                      <tr key={a.id}>
                        <td><span className="ps-table-dot">⊕</span></td>
                        <td>{a.category}</td>
                        <td>{a.visual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Subtask completions */}
          {tasks.filter(t => t.status === 'done').map(t => (
            <div key={t.id} className="ps-subtask-row">
              <Check size={12} className="ps-subtask-check" />
              <span>Image Buddy 已完成任务</span>
            </div>
          ))}

          {/* Final AI message */}
          {showFinal && (
            <div className="ps-ai-block">
              <p className="ps-ai-text">三张海报统一使用 3:4 竖版比例，核心权益「满300减50」已固定在安全区，品牌压板已锁定。请逐一确认后进入投放流程。每张卡片对应一个品类：</p>
              <div className="ps-tasklist">
                <div className="ps-tasklist-header">
                  <span>≡ 任务清单</span>
                  <span className="ps-tasklist-count">{assets.filter(a => a.approved).length}/{assets.length}</span>
                  <ChevronRight size={12} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="ps-input-bar">
          <div className="ps-input-tools">
            <button className="ps-tool-btn">📎</button>
            <button className="ps-tool-btn">📐</button>
            <button className="ps-ask-btn">Ask <ChevronDown size={10} /></button>
          </div>
          <div className="ps-input-right">
            <button className="ps-custom-btn"><Sparkles size={11} />自定义</button>
            <button className="ps-tool-btn">✨</button>
            <button className="ps-tool-btn">🎤</button>
            <button className="ps-send-circle" disabled />
          </div>
        </div>
      </div>

      {/* ── RIGHT: Canvas ────────────────────────────────────── */}
      <div className="ps-canvas">
        {/* Toolbar */}
        <div className="ps-canvas-toolbar">
          <button><Scissors size={13} /><span>背景移除</span></button>
          <button><Edit3 size={13} /><span>文字替换</span></button>
          <button><span className="ps-hex-icon">⬡</span><span>框选编辑</span></button>
          <button><Maximize2 size={13} /><span>生成全景图</span></button>
          <div className="ps-toolbar-sep" />
          <button><Image size={13} /></button>
          <button><span>◇</span></button>
          <button><Download size={13} /><ChevronDown size={10} /></button>
          <button><MoreHorizontal size={13} /></button>
        </div>

        {/* Asset tabs */}
        <div className="ps-asset-tabs">
          {assets.map((a, i) => (
            <button
              key={a.id}
              className={`ps-asset-tab ${selectedIdx === i ? 'active' : ''} ${a.approved ? 'approved' : ''}`}
              onClick={() => setSelectedIdx(i)}
            >
              {a.approved && <Check size={9} />}
              {a.category}
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div className="ps-canvas-area">
          {currentTaskDone ? (
            <div className="ps-poster-stage">
              <div className="ps-poster-label">A premium cosmetics · 1536×2048</div>
              <div className="ps-poster-frame">
                <PosterPlaceholder asset={current} generating={false} />
              </div>
            </div>
          ) : (
            <PosterPlaceholder asset={current} generating={true} />
          )}
        </div>

        {/* Review bar */}
        {phase === 'complete' && (
          <div className="ps-review-bar">
            <div className="ps-review-left">
              {current.approved
                ? <span className="ps-review-approved"><Check size={14} />已确认通过</span>
                : <span className="ps-review-pending">请确认「{current.category}」方案</span>}
            </div>
            <div className="ps-review-actions">
              {!current.approved && (
                <>
                  <button className="ps-btn-reject" onClick={() => {}}>
                    <X size={13} />需修改
                  </button>
                  <button className="ps-btn-approve" onClick={() => approve(current.id)}>
                    <Check size={13} />确认通过
                  </button>
                </>
              )}
              {allApproved && (
                <button className="ps-btn-proceed" onClick={onComplete}>
                  进入投放阶段 →
                </button>
              )}
            </div>
            <div className="ps-canvas-zoom">14% ▾</div>
          </div>
        )}
      </div>
    </div>
  )
}
