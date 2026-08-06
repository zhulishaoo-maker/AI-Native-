import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Download, Edit3, Image, LockKeyhole, Maximize2, MoreHorizontal, Pencil, Play, Scissors, Send, ShieldCheck, Sparkles, X, Bot, Activity, AlertCircle, Zap } from 'lucide-react'
import { generateImage } from '../services/imageGeneration'
import { createRuleChecks, type RuleCheck } from '../domain/assetProduction'
import { validateJDSpecs } from '../utils/jdBrandSpec'
import { composeOverlays } from '../utils/overlayComposer'
import type { GenerationBrief } from '../domain/generationBrief'

type Phase = 'brief' | 'planning' | 'generating' | 'complete' | 'auto_reviewing' | 'distributing' | 'distributed'

type Touchpoint = {
  id: string; label: string; size: string; count: number
  status: 'pending' | 'running' | 'done'; icon: string
}

type Asset = {
  id: string; index: number; category: string; visual: string
  colorA: string; colorB: string; approved: boolean
  imageUrl?: string; progress?: number; genError?: string
  rules: RuleCheck[]
}

type DistChannel = {
  id: string; name: string; icon: string
  status: 'pending' | 'running' | 'done' | 'blocked'
  blockReason?: string; autoMs: number
}

type AgentMsg = { id: string; text: string; type: 'action' | 'done' | 'block' }

// 每个 ASSET 对应一个触点规范，带真实尺寸和专属 prompt 要求
const ASSET_SPECS = [
  {
    touchpoint: '开屏',
    sizeKey: '750×1624',   // 对应 JD_CHANNEL_SPECS 键
    ratioKey: '9:21.6',
    prompt: '京喜开屏广告，竖屏9:21比例，750x1624像素，全屏沉浸式视觉冲击，顶部留品牌压板安全区，底部留搜索框安全区，中央大面积视觉主体',
    brandOverlay: true,
    searchBar: true,
  },
  {
    touchpoint: 'Banner / 资源位',
    sizeKey: '1920×1080',
    ratioKey: '16:9',
    prompt: '京喜Banner广告横版，16:9比例，1920x1080像素，横版构图，左侧产品主体右侧权益文案，品牌压板在左上角',
    brandOverlay: true,
    searchBar: false,
  },
  {
    touchpoint: '营销海报',
    sizeKey: '750×1000',
    ratioKey: '3:4',
    prompt: '京喜营销海报，3:4竖版比例，750x1000像素，营销海报构图，主视觉产品居中，权益信息突出，品牌感强',
    brandOverlay: true,
    searchBar: true,
  },
]

const TOUCHPOINTS: Touchpoint[] = [
  { id: 'splash',  label: '开屏',           size: '750×1624',  count: 3, status: 'pending', icon: '📱' },
  { id: 'banner',  label: 'Banner / 资源位', size: '1920×1080', count: 8, status: 'pending', icon: '🖼' },
  { id: 'poster',  label: '营销海报',         size: '750×1000',  count: 4, status: 'pending', icon: '🎨' },
  { id: 'venue',   label: '营销会场首屏',      size: '750×920',   count: 3, status: 'pending', icon: '🏪' },
]

const ASSETS: Asset[] = [
  { id: 'a1', index: 0, category: '开屏',           visual: '全屏沉浸式 · 冰蓝冰晶感', colorA: '#52b8d8', colorB: '#0c4a70', approved: false, rules: createRuleChecks() },
  { id: 'a2', index: 1, category: 'Banner',         visual: '横版大气 · 深蓝科技感',   colorA: '#4858c8', colorB: '#080e38', approved: false, rules: createRuleChecks() },
  { id: 'a3', index: 2, category: '营销海报',        visual: '竖版海报 · 薄荷清新感',   colorA: '#3cb87a', colorB: '#0c3c24', approved: false, rules: createRuleChecks() },
]

const INSIGHTS = [
  { strategy: '冷色调 · 年轻女性', ctr: '+8.3%', rationale: '冷色调冰感视觉与 18-28 岁女性用户高度共鸣，历史相似创意 CTR 高出基线 8.3%。' },
  { strategy: '深蓝感 · 男性用户', ctr: '+6.9%', rationale: '深蓝夜感在男性护肤赛道差异化突出，精准触达 25-35 岁男性用户。' },
  { strategy: '自然绿 · 精致生活', ctr: '+3.7%', rationale: '绿色清新调性强化「天然护肤」认知，对复购用户加购行为有正向拉动。' },
]

const DIST_CHANNELS: DistChannel[] = [
  { id: 'jd_home',   name: '京东首页开屏',      icon: '📱', status: 'pending', autoMs: 1200 },
  { id: 'jd_banner', name: '站内 Banner 资源位', icon: '🖼', status: 'pending', autoMs: 1400 },
  { id: 'weibo',     name: '微博外宣',           icon: '微', status: 'pending', autoMs: 1200 },
  { id: 'xhs',       name: '小红书',             icon: '红', status: 'pending', autoMs: 0,    blockReason: '小红书投放需确认内容合规，请人工审批后继续' },
  { id: 'wx_video',  name: '微信视频号',          icon: '视', status: 'pending', autoMs: 1600 },
  { id: 'live',      name: '直播间挂载',          icon: '直', status: 'pending', autoMs: 0,    blockReason: '直播间上线影响实时流量，需运营负责人确认' },
]

function PosterPlaceholder({ asset, generating }: { asset: Asset; generating: boolean }) {
  if (generating) {
    const p = asset.progress ?? 0
    const label = p < 30 ? '正在解析创意目标…' : p < 60 ? '正在生成底图…' : p < 90 ? '正在校验规则…' : '即将完成…'
    return (
      <div className="ps-poster-generating">
        <div className="ps-gen-progress-ring">
          <svg viewBox="0 0 44 44" className="ps-ring-svg">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#2a3a4a" strokeWidth="3" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="#5a9ed8" strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={`${2 * Math.PI * 18 * (1 - p / 100)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset .4s ease', transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }} />
          </svg>
          <span className="ps-ring-pct">{p}%</span>
        </div>
        <span>{label}</span>
        <small>{asset.category} · {asset.visual}</small>
      </div>
    )
  }
  if (asset.imageUrl) {
    return (
      <div className="ps-poster-img-wrap">
        <img src={asset.imageUrl} alt={asset.category} className="ps-poster-real-img" />
        <div className="ps-poster-lock">🔒 品牌压板已锁定</div>
      </div>
    )
  }
  if (!generating && asset.genError) {
    return (
      <div className="ps-poster-generating ps-poster-error">
        <span className="ps-error-icon">⚠️</span>
        <span>生图失败</span>
        <small style={{ wordBreak: 'break-all', textAlign: 'center' }}>{asset.genError.slice(0, 80)}</small>
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
        <div className="ps-product-bottle"><div className="ps-bottle-cap" /><div className="ps-bottle-body"><span>AQUA<br/>PURE</span></div></div>
        <div className="ps-product-ice" />
      </div>
      <div className="ps-poster-benefit"><strong>满300减50</strong><span>全场通用 叠加使用</span></div>
      <button className="ps-poster-cta">立即抢购</button>
      <div className="ps-poster-lock">🔒 品牌压板已锁定</div>
    </div>
  )
}

export function ProductionStudio({ brief, onComplete, onBack }: { goal: string; brief: GenerationBrief | null; onComplete: () => void; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('brief')
  const [showPlan, setShowPlan] = useState(false)
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>(TOUCHPOINTS)
  const [showFinal, setShowFinal] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [assets, setAssets] = useState(ASSETS)
  const [tasks, setTasks] = useState(ASSETS.map(a => ({ id: a.id, status: 'pending' as 'pending' | 'running' | 'done' })))
  const [distChannels, setDistChannels] = useState<DistChannel[]>(DIST_CHANNELS)
  const [agentMsgs, setAgentMsgs] = useState<AgentMsg[]>([])
  const [highlightBtn, setHighlightBtn] = useState<string | null>(null)  // which button agent is "clicking"
  const [autoMode, setAutoMode] = useState(true)
  const messagesRef = useRef<HTMLDivElement>(null)
  const allTimers = useRef<number[]>([])

  const addMsg = (text: string, type: AgentMsg['type'] = 'action') => {
    setAgentMsgs(p => [...p, { id: `m${Date.now()}${Math.random()}`, text, type }])
  }

  // Auto-scroll messages area whenever new content added
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [agentMsgs, showFinal, phase])

  const t = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    allTimers.current.push(id)
    return id
  }

  // ── Production phase ─────────────────────────────────────
  useEffect(() => {
    t(1000, () => setPhase('planning'))
    t(2000, () => setShowPlan(true))
    t(3200, () => {
      setPhase('generating')
      let cancelled = false
      const ticks: number[] = []
      const abortController = new AbortController()

      ;(async () => {
        for (let i = 0; i < ASSETS.length; i++) {
          if (cancelled) return
          const asset = ASSETS[i]
          setTasks(p => p.map((x, j) => j === i ? { ...x, status: 'running' } : x))
          setTouchpoints(p => p.map((x, j) => j === i ? { ...x, status: 'running' } : x))
          setSelectedIdx(i)

          let prog = 0
          const tick = window.setInterval(() => {
            if (cancelled) { window.clearInterval(tick); return }
            prog = Math.min(prog < 85 ? prog + Math.random() * 6 + 2 : prog + 0.3, 92)
            setAssets(p => p.map((a, j) => j === i ? { ...a, progress: Math.round(prog) } : a))
          }, 400)
          ticks.push(tick)

          const spec = ASSET_SPECS[i]
          const refImageUrl = brief?.referenceImages?.[0]?.dataUrl
          // Build prompt: spec-specific + brief context + reference hint
          const basePrompt = brief
            ? `${spec.prompt}，活动主题「${brief.campaign}」，主推${brief.category}，核心权益「${brief.benefit}」，视觉风格${brief.style}${refImageUrl ? '，严格参照参考图的色彩构图风格' : ''}`
            : `${spec.prompt}，清凉季活动，满300减50权益，清透冰感风格`
          const result = await generateImage(basePrompt, undefined, abortController.signal, refImageUrl)
          window.clearInterval(tick)
          if (cancelled) return
          if (!result.ok) console.error(`[image gen] asset ${i} failed:`, result.error)

          // 正确传入标题（取 visual 前半作为标题占位，实际使用 asset 品类名）
          const titleForValidation = asset.category  // 3个字以内，必定通过字数校验
          const ratioKey = '3:4 · 750×1000'

          setAssets(p => p.map((a, j) => j === i
            ? { ...a, imageUrl: result.ok ? result.url : undefined, genError: result.ok ? undefined : result.error, progress: undefined }
            : a
          ))

          // Compose brand overlay + search bar 按该触点规范决定是否叠加
          if (result.ok && result.url && !cancelled) {
            try {
              const composedUrl = await composeOverlays(result.url, {
                brandOverlay: spec.brandOverlay,
                searchBar: spec.searchBar,
                brandOverlayUrl: '/brand-overlay.png',
                searchBarUrl: '/search-bar.png',
              })
              setAssets(p => p.map((a, j) => j === i ? { ...a, imageUrl: composedUrl } : a))
            } catch (err) {
              console.warn('[overlay] 压板合成失败，使用原图', err)
            }
          }

          // Run JD brand spec validation 按该触点的规范尺寸校验
          if (result.ok && result.url && !cancelled) {
            const validationResults = await validateJDSpecs(
              result.url,
              spec.sizeKey,
              asset.category,
              '立即抢购',
              spec.brandOverlay,
              spec.searchBar,
            )
            if (!cancelled) {
              setAssets(p => p.map((a, j) => j === i ? {
                ...a,
                rules: a.rules.map(r => {
                  const vr = validationResults.find(v => v.id === r.id)
                  return vr ? { ...r, passed: vr.passed, detail: vr.detail } : r
                }),
              } : a))
            }
          }

          if (!cancelled) {
            setTasks(p => p.map((x, j) => j === i ? { ...x, status: 'done' } : x))
            setTouchpoints(p => p.map((x, j) => j === i ? { ...x, status: 'done' } : x))
          }

          if (i < ASSETS.length - 1 && !cancelled) {
            await new Promise<void>(r => {
              const id = window.setTimeout(r, 1000)
              allTimers.current.push(id)
            })
          }
        }
        if (!cancelled) { setShowFinal(true); setPhase('complete') }
      })()

      // store cancel fn so cleanup can stop the loop
      ;(allTimers.current as unknown as { _cancel?: () => void })._cancel = () => {
        cancelled = true
        abortController.abort()
        ticks.forEach(window.clearInterval)
      }
    })
    return () => {
      allTimers.current.forEach(window.clearTimeout)
      const c = (allTimers.current as unknown as { _cancel?: () => void })._cancel
      if (c) c()
    }
  }, [])

  // ── Auto-review: starts when phase becomes 'complete' and autoMode is on ──
  useEffect(() => {
    if (phase !== 'complete' || !autoMode) return
    let delay = 800
    const timers: number[] = []

    ASSETS.forEach((_, i) => {
      // select this asset tab
      timers.push(window.setTimeout(() => {
        setSelectedIdx(i)
        addMsg(`正在审核方案 ${i + 1}「${ASSETS[i].category}」，核查规则与品牌合规…`)
        setHighlightBtn(null)
      }, delay))
      delay += 1400

      // highlight 提交审核 button
      timers.push(window.setTimeout(() => {
        setHighlightBtn(`submit-${i}`)
        addMsg(`规则全部通过，提交方案 ${i + 1} 审核`)
      }, delay))
      delay += 700

      // "click" it
      timers.push(window.setTimeout(() => {
        setAssets(p => p.map((a, j) => j === i ? { ...a, approved: true } : a))
        setHighlightBtn(null)
        addMsg(`方案 ${i + 1} 已审核通过 ✓`, 'done')
      }, delay))
      delay += 600
    })

    // after all approved, highlight distribute button then click
    timers.push(window.setTimeout(() => {
      addMsg('所有方案审核通过，准备开始全渠道分发…')
      setHighlightBtn('distribute')
    }, delay))
    delay += 800

    timers.push(window.setTimeout(() => {
      setHighlightBtn(null)
      setPhase('auto_reviewing')
      startDistribution()
    }, delay))

    timers.forEach(id => allTimers.current.push(id))
    return () => timers.forEach(window.clearTimeout)
  }, [phase, autoMode])

  // ── Distribution ──────────────────────────────────────────
  const setChStatus = (id: string, status: DistChannel['status']) =>
    (p: DistChannel[]): DistChannel[] => p.map(c => c.id === id ? { ...c, status } : c)

  const setChIdxStatus = (idx: number, status: DistChannel['status']) =>
    (p: DistChannel[]): DistChannel[] => p.map((c, j) => j === idx ? { ...c, status } : c)

  const startDistribution = () => {
    setPhase('distributing')
    let delay = 600
    DIST_CHANNELS.forEach((ch, i) => {
      const t1 = window.setTimeout(() => {
        setDistChannels(setChIdxStatus(i, 'running'))
        addMsg(`正在推送至「${ch.name}」…`)
      }, delay)
      allTimers.current.push(t1)

      if (ch.autoMs > 0) {
        const t2 = window.setTimeout(() => {
          // Compute next state first, then do side effects outside updater
          setDistChannels(p => setChIdxStatus(i, 'done')(p))
          addMsg(`「${ch.name}」发布成功 ✓`, 'done')
          // Check if all done after state update settles
          setDistChannels(p => {
            if (p.every(c => c.status === 'done')) setPhase('distributed')
            return p
          })
        }, delay + ch.autoMs)
        allTimers.current.push(t2)
        delay += ch.autoMs + 500
      } else {
        const t2 = window.setTimeout(() => {
          setDistChannels(setChIdxStatus(i, 'blocked'))
          addMsg(`「${ch.name}」需要人工确认，智能体已暂停等待…`, 'block')
        }, delay + 800)
        allTimers.current.push(t2)
        delay += 1400
      }
    })
  }

  const approveChannel = (id: string) => {
    const ch = distChannels.find(c => c.id === id)
    if (ch) addMsg(`「${ch.name}」已获人工授权，继续发布…`)
    setDistChannels(setChStatus(id, 'running'))
    const tid = window.setTimeout(() => {
      setDistChannels(p => setChStatus(id, 'done')(p))
      if (ch) addMsg(`「${ch.name}」发布成功 ✓`, 'done')
      setDistChannels(p => {
        if (p.every(c => c.status === 'done')) setPhase('distributed')
        return p
      })
    }, 1200)
    allTimers.current.push(tid)
  }

  const skipChannel = (id: string) => {
    const ch = distChannels.find(c => c.id === id)
    setDistChannels(p => setChStatus(id, 'done')(p))
    if (ch) addMsg(`「${ch.name}」已跳过`)
    setDistChannels(p => {
      if (p.every(c => c.status === 'done')) setPhase('distributed')
      return p
    })
  }

  // manual controls
  const manualApprove = (id: string) => setAssets(p => p.map(a => a.id === id ? { ...a, approved: true } : a))
  const manualDistribute = () => { setPhase('auto_reviewing'); startDistribution() }

  const current = assets[selectedIdx]
  const currentTaskDone = tasks[selectedIdx]?.status === 'done'
  const doneCount = touchpoints.filter(t => t.status === 'done').length
  const batchPct = Math.round((doneCount / TOUCHPOINTS.length) * 100)
  const insight = INSIGHTS[selectedIdx] ?? INSIGHTS[0]
  const totalAssets = TOUCHPOINTS.reduce((s, tp) => s + tp.count, 0)
  const distDone = distChannels.filter(c => c.status === 'done').length
  const blockedChannel = distChannels.find(c => c.status === 'blocked')
  const allApproved = assets.every(a => a.approved)
  const isAutoRunning = phase === 'complete' && autoMode

  return (
    <div className="production-studio">
      {/* ── LEFT: Agent chat ─────────────────────────────── */}
      <div className="ps-chat">
        <div className="ps-chat-header">
          <button className="ps-back-btn" onClick={onBack}><ArrowLeft size={15} /></button>
          <div className="ps-project-badge"><span className="ps-project-emoji">🐾</span><span>清凉季</span></div>
          <button className="ps-page-btn">Page 1 <ChevronDown size={11} /></button>
          <div className="ps-header-icons">
            <button>▷</button><button>⏱</button><button>⊞</button>
          </div>
        </div>

        <div className="ps-messages-area" ref={messagesRef}>
          <div className="ps-task-title">清凉季全域营销活动 · 多触点素材生产</div>

          <div className="ps-bubble ps-bubble-user">
            <p>为「清凉季」活动生产全触点营销素材，覆盖开屏、Banner、营销海报和会场首屏。核心权益「满300减50」，品类主推个护美妆，视觉风格以清凉冰感为主，应用京东品牌压板和搜索框规范。</p>
          </div>

          {phase !== 'brief' && (
            <div className="ps-ai-block">
              <div className="ps-agent-header">
                <span className="ps-agent-icon"><Bot size={13} /></span>
                <span className="ps-agent-name">设计智能体</span>
                <span className="ps-agent-status">
                  {phase === 'distributed' ? '已完成' :
                   phase === 'distributing' || phase === 'auto_reviewing' ? <><Activity size={10} />分发中</> :
                   doneCount === TOUCHPOINTS.length ? '生产完成' : <><Activity size={10} />生产中</>}
                </span>
              </div>
              <p className="ps-ai-text">收到 Campaign 目标。我将按触点优先级拆解素材任务，同步生产各规格资源，确定性品牌压板由规则引擎固定，不参与 AI 生成。</p>

              {showPlan && (
                <div className="ps-touchpoint-plan">
                  <div className="ps-plan-header"><span>触点规划</span><em>共 {totalAssets} 个资产</em></div>
                  {touchpoints.map((tp) => (
                    <div key={tp.id} className={`ps-tp-row ps-tp-${tp.status}`}>
                      <span className="ps-tp-icon">
                        {tp.status === 'done' ? <Check size={11} /> : tp.status === 'running' ? <span className="ps-tp-spinner" /> : <span className="ps-tp-dot" />}
                      </span>
                      <span className="ps-tp-label">{tp.icon} {tp.label}</span>
                      <span className="ps-tp-meta">{tp.size} · {tp.count} 套</span>
                      <span className={`ps-tp-badge ps-tp-badge-${tp.status}`}>
                        {tp.status === 'done' ? '已完成' : tp.status === 'running' ? '生成中' : '待生产'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showFinal && (
            <div className="ps-ai-block">
              <p className="ps-ai-text">全部触点素材已生产完毕，共 {totalAssets} 个资产。品牌压板已锁定，规则检查通过。</p>
              {autoMode && isAutoRunning && (
                <div className="ps-agent-autopilot">
                  <Zap size={11} /><span>智能体自动审核模式已开启，正在逐一检查方案…</span>
                </div>
              )}
            </div>
          )}

          {/* Agent operation log */}
          {agentMsgs.map(msg => (
            <div key={msg.id} className={`ps-agent-log-row ps-log-${msg.type}`}>
              {msg.type === 'done' ? <Check size={10} /> : msg.type === 'block' ? <AlertCircle size={10} /> : <Bot size={10} />}
              <span>{msg.text}</span>
            </div>
          ))}

          {/* Blocked approval */}
          {blockedChannel && (
            <div className="ps-block-card">
              <div className="ps-block-header"><AlertCircle size={13} /><strong>需要人工确认</strong></div>
              <p>{blockedChannel.blockReason}</p>
              <div className="ps-block-actions">
                <button className="ps-block-dismiss" onClick={() => skipChannel(blockedChannel.id)}>跳过此渠道</button>
                <button className="ps-block-approve" onClick={() => approveChannel(blockedChannel.id)}><Check size={12} />确认发布</button>
              </div>
            </div>
          )}

          {phase === 'distributed' && (
            <div className="ps-dist-complete">
              <Check size={14} />
              <span>全渠道分发完成，活动已上线</span>
              <button onClick={onComplete}>查看数据洞察 →</button>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="ps-input-bar">
          <div className="ps-input-tools">
            <button className="ps-tool-btn">📎</button>
            <button className="ps-tool-btn">🗂</button>
            <button className="ps-ask-btn">Ask <ChevronDown size={10} /></button>
          </div>
          <textarea className="ps-input-field" placeholder="继续描述，或告诉智能体调整方向…" rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) e.preventDefault() }} />
          <div className="ps-input-right">
            <button className="ps-custom-btn"><Sparkles size={11} />自定义</button>
            <button className="ps-tool-btn">✦</button>
            <button className="ps-tool-btn">🎤</button>
            <button className="ps-send-circle" disabled />
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Canvas ───────────────────────────────── */}
      <div className="ps-canvas">
        <div className="ps-canvas-toolbar">
          <button><Scissors size={13} /><span>背景移除</span></button>
          <button><Edit3 size={13} /><span>文字替换</span></button>
          <button><span className="ps-hex-icon">⬡</span><span>框选编辑</span></button>
          <button><Maximize2 size={13} /><span>生成全景图</span></button>
          <div className="ps-toolbar-sep" />
          <button><Image size={13} /></button><button><span>◇</span></button>
          <button><Download size={13} /><ChevronDown size={10} /></button>
          <button><MoreHorizontal size={13} /></button>
        </div>

        <div className="ps-asset-tabs">
          {assets.map((a, i) => (
            <button key={a.id}
              className={`ps-asset-tab ${selectedIdx === i ? 'active' : ''} ${a.approved ? 'approved' : ''} ${isAutoRunning && selectedIdx === i ? 'agent-focus' : ''}`}
              onClick={() => setSelectedIdx(i)}>
              {a.approved && <Check size={9} />}{a.category}
            </button>
          ))}
        </div>

        <div className="ps-canvas-area">
          {currentTaskDone
            ? <div className="ps-poster-stage">
                <div className="ps-poster-label">A premium cosmetics · 1536×2048</div>
                <div className="ps-poster-frame"><PosterPlaceholder asset={current} generating={false} /></div>
              </div>
            : <PosterPlaceholder asset={current} generating={true} />}
        </div>

        <div className="ps-canvas-zoom-bar">
          <span>14% ▾</span>
          <div className="ps-zoom-tools"><button>⊞</button><button>⊟</button><button>⊡</button></div>
        </div>
      </div>

      {/* ── RIGHT: Inspector ─────────────────────────────── */}
      <div className="ps-inspector-panel">
        <div className="ps-insp-progress-section">
          <div className="ps-insp-progress-row">
            <span>批次进度</span>
            <strong>{phase === 'distributing' || phase === 'distributed' || phase === 'auto_reviewing' ? 100 : batchPct}%</strong>
          </div>
          <div className="ps-insp-progress-track">
            <div className="ps-insp-progress-fill" style={{ width: `${phase === 'distributing' || phase === 'distributed' || phase === 'auto_reviewing' ? 100 : batchPct}%` }} />
          </div>
          <small>{doneCount} 就绪 · {TOUCHPOINTS.length - doneCount} 需处理</small>
        </div>

        <div className="ps-insp-section">
          <div className="ps-insp-section-header"><span>确定性规则检查</span><small>底图与品牌固定层分离生产</small></div>
          {current?.rules ? (() => {
            const passCount = current.rules.filter(r => r.passed).length
            const allPass = passCount === current.rules.length
            return (
              <>
                <div className={`ps-insp-score ${allPass ? '' : 'warning'}`}>
                  {allPass ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
                  <div>
                    <strong>{passCount} / {current.rules.length} 规则通过</strong>
                    <small>{allPass ? '可提交审核' : '存在不合规项，请修复后提交'}</small>
                  </div>
                </div>
                <div className="ps-rule-list">
                  {current.rules.map(r => (
                    <div key={r.id} className="ps-rule-row">
                      <span className={`ps-rule-dot ${r.passed ? 'passed' : 'failed'}`}>
                        {r.passed ? <Check size={10} /> : <X size={10} />}
                      </span>
                      <div className="ps-rule-body"><strong>{r.label}</strong><small>{r.detail}</small></div>
                      {r.locked && <span className="ps-rule-lock"><LockKeyhole size={9} />锁定</span>}
                    </div>
                  ))}
                </div>
              </>
            )
          })() : (
            <div className="ps-insp-score">
              <ShieldCheck size={14} />
              <div><strong>等待生成…</strong><small>生成完成后自动校验</small></div>
            </div>
          )}
        </div>

        {phase !== 'brief' && phase !== 'planning' && phase !== 'generating' && (
          <div className="ps-insp-section">
            <div className="ps-insp-section-header"><Sparkles size={11} /><span>AI 选题分析</span><strong className="ps-insp-ctr">{insight.ctr}</strong></div>
            <p className="ps-insp-strategy">{insight.strategy}</p>
            <p className="ps-insp-rationale">{insight.rationale}</p>
          </div>
        )}

        <dl className="ps-insp-meta">
          <div><dt>任务类型</dt><dd>营销海报</dd></div>
          <div><dt>压板版本</dt><dd>JD-CAMPAIGN v3.2</dd></div>
          <div><dt>资产版本</dt><dd>v{selectedIdx + 1}</dd></div>
        </dl>

        {/* Action buttons — always shown, agent "clicks" them automatically */}
        {(phase === 'complete' || phase === 'auto_reviewing') && (() => {
          const rulesAllPass = current.rules ? current.rules.every(r => r.passed) : true
          return (
          <div className="ps-insp-actions">
            {current.approved
              ? <div className="ps-insp-approved"><Check size={13} />方案 {selectedIdx + 1} 已通过</div>
              : <>
                  <button className="ps-btn-reject"><X size={13} />需修改</button>
                  <button className="ps-btn-approve"><Pencil size={13} />精修文案</button>
                  <button
                    className={`ps-btn-proceed-sm ${highlightBtn === `submit-${selectedIdx}` ? 'agent-clicking' : ''}`}
                    disabled={!rulesAllPass}
                    title={rulesAllPass ? '' : '存在规范问题，请先修复'}
                    onClick={() => manualApprove(current.id)}>
                    <Play size={13} fill="currentColor" />{rulesAllPass ? '提交审核' : '规范校验中…'}
                  </button>
                </>
            }
            {allApproved && phase === 'complete' && (
              <button
                className={`ps-btn-all-done ${highlightBtn === 'distribute' ? 'agent-clicking' : ''}`}
                onClick={manualDistribute}>
                <Send size={13} />审核通过 · 开始分发
              </button>
            )}
          </div>
          )
        })()}

        {(phase === 'distributing' || phase === 'distributed') && (
          <div className="ps-insp-actions">
            <div className="ps-insp-dist-status">
              <Send size={13} />
              <span>{phase === 'distributed' ? '全渠道已分发' : `分发中 ${distDone}/${distChannels.length}`}</span>
            </div>
          </div>
        )}

        {/* Auto mode toggle */}
        <div className="ps-auto-toggle">
          <button
            className={`ps-auto-btn ${autoMode ? 'on' : ''}`}
            onClick={() => setAutoMode(v => !v)}>
            <Zap size={11} />{autoMode ? '自动驾驶模式' : '手动模式'}
          </button>
          <small>{autoMode ? '智能体自动推进，卡点暂停' : '点击按钮手动操作'}</small>
        </div>
      </div>
    </div>
  )
}
