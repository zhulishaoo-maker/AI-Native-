import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertCircle, AlertTriangle, Archive, ArrowLeft, ArrowUpRight, Bot, Boxes, Check, CheckCircle2, ChevronDown, ChevronRight, CircleCheck, Clock3, Code2, Eye, Folder, Gauge, GitBranch, History, LockKeyhole, PanelLeftClose, Pencil, Play, Plus, RefreshCw, RotateCcw, Send, Settings, ShieldCheck, Sparkles, UnlockKeyhole, WandSparkles, X, Zap } from 'lucide-react'
import { VenuePreview } from './components/VenuePreview'
import { PromptComposer } from './components/PromptComposer'
import { CampaignWorkspace } from './components/CampaignWorkspace'
import { CampaignPlanner } from './components/CampaignPlanner'
import { AgentHandoff } from './components/AgentHandoff'
import { ProductionStudio } from './components/ProductionStudio'
import { componentRegistry } from './components/venue/registry'
import { sampleVenue } from './data/sampleVenue'
import { candidates, type CandidateId } from './data/candidateVenues'
import { pageSchema } from './schema/pageSchema'
import { buildGenerationBrief, defaultComposerState, taskTypes, type ComposerState, type GenerationBrief, type TaskType } from './domain/generationBrief'
import { canSubmitReview, createCandidateBatch, deriveBatchProgress, failCandidate, generatingPhrases, retryCandidate, setImageUrl, transitionCandidate, updateCandidateCopy, validatingPhrases, type CandidateInsight, type CandidateStatus, type CreativeCandidate } from './domain/assetProduction'
import { baseMetrics, detectAnomaly, tickMetrics, type DataQuality, type LiveMetrics } from './domain/campaign'
import { generateImage } from './services/imageGeneration'
import { publishToChannel } from './services/channelPublish'

type Tab = 'brief' | 'structure' | 'rules'

type AppView = 'home' | 'results' | 'campaign-plan' | 'campaign-handoff' | 'campaign' | 'venue' | 'assets' | 'insights' | 'distribute' | 'studio'

export type ArchivedAsset = {
  id: string
  briefId: string
  taskType: TaskType
  title: string
  subtitle: string
  imageUrl?: string
  insight: CandidateInsight
  archivedAt: string
  brief: GenerationBrief
}

const mockArchivedAssets: ArchivedAsset[] = [
  {
    id: 'mock-1',
    briefId: 'brief-demo-001',
    taskType: '开屏',
    title: '冰爽开场',
    subtitle: '清凉一夏，好物即刻拥有',
    insight: { strategy: '冷色调 · 年轻女性', strategyTags: ['冲击首屏', '情绪感强'], predictedCtr: '+8.3%', aiRationale: '冷色调冰感视觉在夏季美妆类目与 18-28 岁女性用户高度共鸣。' },
    archivedAt: '2026-07-18T10:30:00Z',
    brief: { id: 'brief-demo-001', taskType: '开屏', campaign: '清凉季', category: '个护美妆', benefit: '满 300 减 50', brandOverlay: '京东大促品牌压板', searchOverlay: '京东搜索框压板', style: '清透冰感', ratio: '3:4 · 750×1000', outputCount: 4, prompt: '夏日美妆清凉季，清透冰感，个护美妆，满300减50', createdAt: '2026-07-18T10:20:00Z', promptCopy: { prefix: '为', afterCampaign: '活动', afterTask: '生成', afterCategory: '类目的', afterBenefit: '权益', afterBrandOverlay: '带', afterSearchOverlay: '及', afterStyle: '风格的创意图', suffix: '' } },
  },
  {
    id: 'mock-2',
    briefId: 'brief-demo-002',
    taskType: '营销海报',
    title: '盛夏焕新',
    subtitle: '好物以实价，好物以好价',
    insight: { strategy: '自然绿 · 精致生活', strategyTags: ['品牌调性', '加购率高'], predictedCtr: '+3.7%', aiRationale: '绿色清新调性强化「天然护肤」认知，对复购用户和加购行为有正向拉动。' },
    archivedAt: '2026-07-19T14:15:00Z',
    brief: { id: 'brief-demo-002', taskType: '营销海报', campaign: '618 大促', category: '家居生活', benefit: '全场 8 折', brandOverlay: '京东大促品牌压板', searchOverlay: '不使用搜索框压板', style: '自然清新', ratio: '3:4 · 750×1000', outputCount: 4, prompt: '618大促，自然清新，家居生活，全场8折', createdAt: '2026-07-19T14:00:00Z', promptCopy: { prefix: '为', afterCampaign: '活动', afterTask: '生成', afterCategory: '类目的', afterBenefit: '权益', afterBrandOverlay: '带', afterSearchOverlay: '及', afterStyle: '风格的创意图', suffix: '' } },
  },
  {
    id: 'mock-3',
    briefId: 'brief-demo-003',
    taskType: 'Banner / 资源位',
    title: '热爱降温',
    subtitle: '为每一刻清凉而生',
    insight: { strategy: '深蓝夜感 · 男性用户', strategyTags: ['差异化', '男性护肤'], predictedCtr: '+6.9%', aiRationale: '深蓝夜感风格在男性护肤赛道差异化突出，精准触达 25-35 岁男性用户。' },
    archivedAt: '2026-07-20T09:45:00Z',
    brief: { id: 'brief-demo-003', taskType: 'Banner / 资源位', campaign: '暑期专场', category: '男士护肤', benefit: '第二件 5 折', brandOverlay: '京东大促品牌压板', searchOverlay: '京东搜索框压板', style: '深邃暗调', ratio: '16:9 · 1920×1080', outputCount: 4, prompt: '暑期专场，深邃暗调，男士护肤，第二件5折', createdAt: '2026-07-20T09:30:00Z', promptCopy: { prefix: '为', afterCampaign: '活动', afterTask: '生成', afterCategory: '类目的', afterBenefit: '权益', afterBrandOverlay: '带', afterSearchOverlay: '及', afterStyle: '风格的创意图', suffix: '' } },
  },
]

export type DistributeChannel = {
  id: string
  name: string
  type: 'social' | 'content' | 'live' | 'pr'
  icon: string
  status: 'pending' | 'scheduled' | 'sent' | 'failed'
  scheduledAt?: string
  note?: string
  format: string
  charLimit?: number
}

const distributeChannels: DistributeChannel[] = [
  { id: 'weibo',     name: '微博',         type: 'social',   icon: '微', status: 'pending', format: '正方形图 + 140字文案',    charLimit: 140 },
  { id: 'xiaohong',  name: '小红书',       type: 'social',   icon: '红', status: 'pending', format: '9:16竖版图 + 笔记正文',   charLimit: 1000 },
  { id: 'mp',        name: '公众号',       type: 'content',  icon: '号', status: 'pending', format: '16:9横版配图 + 推文正文', charLimit: 5000 },
  { id: 'shipinhao', name: '视频号',       type: 'content',  icon: '视', status: 'pending', format: '封面图 + 60s 短视频',     charLimit: 0 },
  { id: 'live',      name: '直播间',       type: 'live',     icon: '直', status: 'pending', format: '直播间横幅 + 贴片物料',   charLimit: 0 },
  { id: 'pr',        name: '公关稿 / 外宣',type: 'pr',       icon: 'PR', status: 'pending', format: '品牌新闻稿 + 配图',       charLimit: 3000 },
]

const taskDescriptions: Record<TaskType, string> = {
  开屏: '抓住第一眼注意力',
  营销海报: '快速承接传播与转化',
  'Banner / 资源位': '适配站内核心流量入口',
  营销会场: '搭建完整活动承接链路',
}

type HCPTouchpoint = { id: string; name: string; count: number; unit: string; active: boolean }

const defaultHCPTouchpoints: HCPTouchpoint[] = [
  { id: 'splash', name: '开屏',   count: 3, unit: '套',  active: true },
  { id: 'banner', name: 'Banner', count: 8, unit: '尺寸', active: true },
  { id: 'poster', name: '海报',   count: 4, unit: '套',  active: true },
  { id: 'venue',  name: '会场',   count: 3, unit: '候选', active: true },
]

function parseGoalTags(text: string) {
  const hasGmv = /GMV|销售|增长|转化/.test(text)
  const hasBrand = /品牌|新品|渗透|认知/.test(text)
  const goals = [hasGmv && 'GMV 增长', hasBrand && '新品渗透'].filter(Boolean) as string[]
  const audience = /美妆|护肤|彩妆/.test(text) ? '美妆活跃用户 · 女性 18-35'
    : /数码|3C|电子/.test(text) ? '数码爱好者 · 男性 25-40'
    : '全域活跃用户'
  return { goal: goals.length ? goals.join(' + ') : 'GMV 增长', audience, period: '7 天' }
}

function HomeCampaignPanel({
  goal, onGoalChange, onHandoff,
}: { goal: string; onGoalChange: (v: string) => void; onHandoff: () => void }) {
  const [touchpoints, setTouchpoints] = useState<HCPTouchpoint[]>(defaultHCPTouchpoints)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(() => parseGoalTags(goal))
  const timerRef = useRef<number | undefined>(undefined)

  const handleChange = (v: string) => {
    onGoalChange(v)
    setParsed({ goal: '', audience: '', period: '' })
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (v.trim().length < 4) return
    timerRef.current = window.setTimeout(() => {
      setParsing(true)
      window.setTimeout(() => { setParsing(false); setParsed(parseGoalTags(v)) }, 600)
    }, 700)
  }

  const toggle = (id: string) => setTouchpoints((prev) => prev.map((t) => t.id === id ? { ...t, active: !t.active } : t))
  const activeCount = touchpoints.filter((t) => t.active).length
  const canGo = parsed.goal.length > 0 && activeCount > 0

  return (
    <div className="hcp-panel">
      <div className="hcp-goal-wrap">
        <textarea
          className="hcp-textarea"
          value={goal}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="输入运营目标，营销活动智能体将调度设计、会场、渠道与数据能力，完成从生产到增长的闭环"
          rows={3}
        />
        <div className="hcp-goal-foot">
          {parsing && <span className="hcp-parsing"><span className="hcp-spinner" />AI 解析中…</span>}
          {!parsing && parsed.goal && (
            <div className="hcp-parsed-tags">
              <span><em>目标</em>{parsed.goal}</span>
              <i />
              <span><em>人群</em>{parsed.audience}</span>
              <i />
              <span><em>周期</em>{parsed.period}</span>
            </div>
          )}
        </div>
        <div className="hcp-composer-actions">
          <div className="hcp-action-btns">
            <button><span>📎</span></button>
            <button><span>🗂</span></button>
            <button className="hcp-auto-btn"><Check size={11} />自动 <ChevronDown size={11} /></button>
          </div>
          <div className="hcp-action-right">
            <button className="hcp-custom-btn"><Sparkles size={11} />自定义</button>
            <button className="hcp-mic-btn">🎤</button>
            <button className="hcp-send-btn" disabled={!canGo} onClick={onHandoff}>
              <ArrowUpRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="hcp-touchpoints">
        {touchpoints.map((tp) => (
          <button key={tp.id} className={`hcp-tp-card ${tp.active ? 'active' : ''}`} onClick={() => toggle(tp.id)}>
            <span className="hcp-tp-name">{tp.name}</span>
            <span className="hcp-tp-count"><b>{tp.count}</b>{tp.unit}</span>
          </button>
        ))}
        <button className="hcp-tp-more">更多</button>
      </div>
    </div>
  )
}

export function App() {
  const [view, setView] = useState<AppView>('home')
  const [homeMode, setHomeMode] = useState<'quick' | 'campaign'>('quick')
  const [composer, setComposer] = useState<ComposerState>(defaultComposerState)
  const [brief, setBrief] = useState<GenerationBrief | null>(null)
  const [archivedAssets, setArchivedAssets] = useState<ArchivedAsset[]>(mockArchivedAssets)
  const [campaignGoal, setCampaignGoal] = useState('夏日美妆狂欢，满300减50，主推防晒和控油新品')

  const generate = () => {
    setBrief(buildGenerationBrief(composer))
    setCampaignGoal(composer.campaign + ' - ' + composer.taskType)
    setView('studio')
  }

  const archiveAsset = (asset: ArchivedAsset) => {
    setArchivedAssets((prev) => [asset, ...prev])
  }

  if (view === 'venue') return <VenueEditor onBack={() => setView('campaign')} />
  if (view === 'studio') return (
    <main className="marketing-shell">
      <AppHeader view={view} setView={setView} />
      <ProductionStudio goal={campaignGoal} brief={brief} onComplete={() => setView('assets')} onBack={() => setView('home')} />
    </main>
  )
  if (view === 'campaign-plan') return (
    <main className="marketing-shell">
      <AppHeader view={view} setView={setView} />
      <CampaignPlanner onBack={() => setView('home')} onHandoff={() => setView('campaign-handoff')} />
    </main>
  )
  if (view === 'campaign-handoff') return (
    <AgentHandoff onComplete={() => setView('campaign')} />
  )
  if (view === 'assets') return (
    <main className="marketing-shell">
      <AppHeader view={view} setView={setView} />
      <AssetCenterView assets={archivedAssets} onBack={() => setView('home')} onDistribute={() => setView('distribute')} />
    </main>
  )
  if (view === 'insights') return (
    <main className="marketing-shell">
      <AppHeader view={view} setView={setView} />
      <DataInsightsView assets={archivedAssets} onBack={() => setView('home')} />
    </main>
  )

  if (view === 'distribute') return (
    <main className="marketing-shell">
      <AppHeader view={view} setView={setView} />
      <DistributeView assets={archivedAssets} onBack={() => setView('assets')} />
    </main>
  )

  return (
    <main className="marketing-shell">
      <AppHeader view={view} setView={setView} />

      {view === 'home' ? (
        <div className="creation-home">
          {/* Hero row: title left, mascot right */}
          <div className="home-hero-row">
            <div className="home-hero-text">
              <div className="home-brand-row">
                <span className="home-brand-joy">Joy</span><span className="home-brand-builder">Builder</span>
              </div>
              <h1 className="home-hero-title">今天想创造什么？</h1>
            </div>
            <div className="home-mascot">
              <img src="/joy.png" alt="JoyBuilder" className="home-mascot-img" />
            </div>
          </div>

          <section className="creation-studio">
            <div className="mode-switch">
              <button className={homeMode === 'quick' ? 'active' : ''} onClick={() => setHomeMode('quick')}>
                <WandSparkles size={17} /><span><strong>快速生成</strong><small>单项资源，分钟级出稿</small></span>
              </button>
              <button className={homeMode === 'campaign' ? 'active' : ''} onClick={() => setHomeMode('campaign')}>
                <Boxes size={17} /><span><strong>全链路活动</strong><small>跨触点编排与持续优化</small></span>
              </button>
            </div>

            {homeMode === 'quick' ? (
              <>
                <PromptComposer value={composer} onChange={setComposer} onSubmit={generate} />
                <div className="task-tabs">
                  {taskTypes.map((task) => <button key={task} className={composer.taskType === task ? 'active' : ''} onClick={() => setComposer({ ...composer, taskType: task })}>
                    <span>{task === '开屏' ? '01' : task === '营销海报' ? '02' : task === 'Banner / 资源位' ? '03' : '04'}</span><div><strong>{task}</strong><small>{taskDescriptions[task]}</small></div>
                  </button>)}
                  <button className="task-tab-more">更多</button>
                </div>
              </>
            ) : (
              <HomeCampaignPanel
                goal={campaignGoal}
                onGoalChange={setCampaignGoal}
                onHandoff={() => setView('studio')}
              />
            )}
          </section>

          {/* Template prompts */}
          <div className="home-templates">
            <p className="home-templates-hint">不知道从何开始？试试这些模板。</p>
            <div className="home-template-list">
              {[
                '5分钟，我要10张启动屏',
                '为清凉季设计10张单品海报，商品分别@sku@sku@sku@sku@sku@sku@sku@sku@sku@sku',
                '为京喜618延展10个分会场，分别是美妆，3c，服饰，生鲜，居家，建材…',
              ].map((tpl) => (
                <button key={tpl} className="home-template-card" onClick={() => {
                  // Fill the prompt sentence campaign field with the template text
                  setComposer({ ...composer, campaign: tpl.slice(0, 12) })
                }}>
                  {tpl}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : view === 'campaign' ? (
        <CampaignWorkspace onBack={() => setView('home')} onVenue={() => setView('venue')} />
      ) : (
        <ResultsView brief={brief!} onBack={() => setView('home')} onVenue={() => setView('venue')} onArchive={archiveAsset} onGoAssets={() => setView('assets')} />
      )}
    </main>
  )
}

function AppHeader({ view, setView }: { view: AppView; setView: (v: AppView) => void }) {
  const navItems = [
    { id: 'home' as AppView, label: '创意工作台', icon: <WandSparkles size={16} />, match: (v: AppView) => v === 'home' || v === 'results' },
    { id: 'campaign-plan' as AppView, label: '活动旅程', icon: <Boxes size={16} />, match: (v: AppView) => v === 'campaign' || v === 'campaign-plan' || v === 'campaign-handoff' },
    { id: 'assets' as AppView, label: '资产中心', icon: <Archive size={16} />, match: (v: AppView) => v === 'assets' },
    { id: 'insights' as AppView, label: '数据洞察', icon: <Gauge size={16} />, match: (v: AppView) => v === 'insights' },
    { id: 'distribute' as AppView, label: '渠道投放', icon: <Send size={16} />, match: (v: AppView) => v === 'distribute' },
  ]

  const projects = [
    { name: '未命名项目', active: false },
    { name: '清凉季', active: true },
  ]

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <button className="sidebar-brand" onClick={() => setView('home')}>
        <img src="/logo.png" alt="JoyBuilder" className="sidebar-logo-img" />
      </button>

      {/* Main nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${item.match(view) ? 'active' : ''}`}
            onClick={() => setView(item.id)}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Projects */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>项目</span>
          <button className="sidebar-section-add" aria-label="新建项目"><Plus size={13} /></button>
        </div>
        <div className="sidebar-project-list">
          {projects.map((p) => (
            <button key={p.name} className={`sidebar-project-item ${p.active ? 'active' : ''}`}>
              <Folder size={13} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: user */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">L</div>
          <div className="sidebar-user-info">
            <strong>Lisa Zhu</strong>
            <small>zhulishaoo@gmail.com</small>
          </div>
          <Settings size={14} className="sidebar-settings-icon" />
        </div>
      </div>
    </aside>
  )
}

function useNarration(phrases: string[], intervalMs = 2200) {
  const [index, setIndex] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    ref.current = 0
    setIndex(0)
    const id = window.setInterval(() => {
      ref.current = (ref.current + 1) % phrases.length
      setIndex(ref.current)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [phrases, intervalMs])
  return phrases[index]
}

function NarrationText({ status }: { status: CandidateStatus }) {
  const genPhrase = useNarration(generatingPhrases, 2000)
  const valPhrase = useNarration(validatingPhrases, 1800)
  if (status === 'generating') return <small className="narration-phrase">{genPhrase}</small>
  if (status === 'validating') return <small className="narration-phrase">{valPhrase}</small>
  return null
}

function ResultsView({ brief, onBack, onVenue, onArchive, onGoAssets }: { brief: GenerationBrief; onBack: () => void; onVenue: () => void; onArchive: (asset: ArchivedAsset) => void; onGoAssets: () => void }) {
  const [selected, setSelected] = useState(0)
  const [candidates, setCandidates] = useState(() => createCandidateBatch(brief.id))
  const [refining, setRefining] = useState(false)
  const [archiveNotice, setArchiveNotice] = useState(false)
  const selectedCandidate = candidates[selected]
  const batchProgress = deriveBatchProgress(candidates)

  useEffect(() => {
    const timers: number[] = []
    const controllers: AbortController[] = []

    candidates.forEach((_, index) => {
      // start "generating" progress animation
      timers.push(window.setTimeout(() => setCandidates((cur) => cur.map((c, i) => i === index ? transitionCandidate(c, 'generating', 18) : c)), 180 + index * 120))
      timers.push(window.setTimeout(() => setCandidates((cur) => cur.map((c, i) => i === index ? transitionCandidate(c, 'generating', 55) : c)), 500 + index * 120))

      // call real image generation API
      const controller = new AbortController()
      controllers.push(controller)
      ;(async () => {
        // stagger requests slightly
        await new Promise<void>((resolve) => { timers.push(window.setTimeout(resolve, 300 + index * 200)) })
        if (controller.signal.aborted) return

        // show validating while waiting for response
        setCandidates((cur) => cur.map((c, i) => i === index ? transitionCandidate(c, 'validating', 72) : c))

        const candidateTitle = ['冰爽开场', '清凉好物', '盛夏焕新', '热爱降温'][index]
        const imagePrompt = `${brief.prompt}，方案主题：${candidateTitle}，高清营销广告图，纯净背景，商业级画质`
        const result = await generateImage(imagePrompt, brief.ratio, controller.signal)
        if (controller.signal.aborted) return

        if (result.ok) {
          setCandidates((cur) => cur.map((c, i) => {
            if (i !== index) return c
            return setImageUrl(transitionCandidate(c, 'ready', 100), result.url)
          }))
        } else {
          const isThirdSlot = index === 2
          if (isThirdSlot) {
            setCandidates((cur) => cur.map((c, i) => i === index ? failCandidate(c, result.error.slice(0, 40) || '主体超出安全区，请重新生成底图') : c))
          } else {
            // still show ready state with placeholder on error (except slot 2 which demos failure)
            setCandidates((cur) => cur.map((c, i) => i === index ? transitionCandidate(c, 'ready', 100) : c))
          }
        }
      })()
    })

    return () => {
      timers.forEach(window.clearTimeout)
      controllers.forEach((c) => c.abort())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retry = (index: number) => {
    setCandidates((cur) => cur.map((c, i) => i === index ? retryCandidate(c) : c))
    window.setTimeout(() => setCandidates((cur) => cur.map((c, i) => i === index ? transitionCandidate(c, 'validating', 55) : c)), 400)
    const candidateTitle = ['冰爽开场', '清凉好物', '盛夏焕新', '热爱降温'][index]
    const imagePrompt = `${brief.prompt}，方案主题：${candidateTitle}，高清营销广告图，纯净背景，商业级画质`
    generateImage(imagePrompt, brief.ratio).then((result) => {
      if (result.ok) {
        setCandidates((cur) => cur.map((c, i) => i === index ? setImageUrl(transitionCandidate(c, 'ready', 100), result.url) : c))
      } else {
        setCandidates((cur) => cur.map((c, i) => i === index ? transitionCandidate(c, 'ready', 100) : c))
      }
    })
  }

  const submitReview = () => {
    if (!canSubmitReview(selectedCandidate)) return
    setCandidates((current) => current.map((candidate, index) => index === selected ? transitionCandidate(candidate, 'reviewing', 100) : candidate))
    window.setTimeout(() => {
      setCandidates((current) => current.map((candidate, index) => index === selected ? transitionCandidate(candidate, 'approved', 100) : candidate))
      setArchiveNotice(true)
      onArchive({
        id: `${brief.id}-candidate-${selected + 1}`,
        briefId: brief.id,
        taskType: brief.taskType,
        title: selectedCandidate.title,
        subtitle: selectedCandidate.subtitle,
        imageUrl: selectedCandidate.imageUrl,
        insight: selectedCandidate.insight,
        archivedAt: new Date().toISOString(),
        brief,
      })
    }, 900)
  }

  const saveCopy = (copy: Pick<CreativeCandidate, 'title' | 'subtitle' | 'cta'>) => {
    setCandidates((current) => current.map((candidate, index) => index === selected ? updateCandidateCopy(candidate, copy) : candidate))
    setRefining(false)
  }

  return <div className="results-page production-page">
    <div className="results-heading">
      <button onClick={onBack}><ArrowLeft size={17} />返回创作</button>
      <div><span>PRODUCTION / {brief.id.toUpperCase()}</span><h1>{batchProgress === 100 ? '创意资产生产完成' : '正在生产 4 个创意方案'}</h1><p>{brief.prompt}</p></div>
      <div className="batch-meter"><div><span>批次进度</span><strong>{batchProgress}%</strong></div><i><b style={{ width: `${batchProgress}%` }} /></i><small>{candidates.filter((item) => item.status === 'ready' || item.status === 'approved').length} 就绪 · {candidates.filter((item) => item.status === 'failed').length} 需处理</small></div>
    </div>
    <div className="production-layout">
      <div className="candidate-gallery">
      {candidates.map((candidate, item) => <button key={candidate.id} className={`creative-card variant-${item + 1} status-${candidate.status} ${selected === item ? 'selected' : ''}`} onClick={() => setSelected(item)}>
        {candidate.status === 'queued' || candidate.status === 'generating' || candidate.status === 'validating' ? <span className="generating"><Sparkles /><strong>{candidate.status === 'queued' ? '等待生产' : candidate.status === 'validating' ? '规则检查中' : '生成底图中'}</strong><i><b style={{ width: `${candidate.progress}%` }} /></i><small>{candidate.progress}%</small><NarrationText status={candidate.status} /></span> : candidate.status === 'failed' ? <span className="candidate-failed"><AlertTriangle /><strong>方案需要处理</strong><small>{candidate.error}</small><em onClick={(event) => { event.stopPropagation(); retry(item) }}><RefreshCw size={13} />单图重试</em></span> : <>
          <div className="asset-brand"><b>京东 618</b><small>又好又便宜</small></div>
          <div className="asset-copy"><span>SUMMER {String(item + 1).padStart(2, '0')}</span><h2>{candidate.title}</h2><p>{brief.benefit}</p></div>
          {candidate.imageUrl
            ? <img className="asset-image" src={candidate.imageUrl} alt={candidate.title} />
            : <div className="asset-object"><i /><b /></div>}
          {brief.searchOverlay !== '不使用搜索框压板' && <div className="asset-search">京东搜索「{brief.category}」<strong>搜索</strong></div>}
          <span className="candidate-index">0{item + 1}</span>
          <span className={`asset-state ${candidate.status}`}>{candidate.status === 'approved' ? <><Archive size={11} />已归档</> : candidate.status === 'reviewing' ? '审核中' : `v${candidate.version} · 已就绪`}</span>
          {selected === item && <span className="selected-badge"><Check size={13} />已选择</span>}
          <div className="strategy-tags">{candidate.insight.strategyTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </>}
      </button>)}
      </div>
      <AssetInspector candidate={selectedCandidate} brief={brief} onRetry={() => retry(selected)} />
    </div>
    <div className="result-actions"><div><strong>方案 {selected + 1} · v{selectedCandidate.version}</strong><span>{selectedCandidate.status === 'approved' ? '审核通过，资产已进入 Campaign 资产库' : selectedCandidate.status === 'failed' ? '请先重试失败方案' : '品牌压板已锁定，可继续精修文案'}</span></div>{selectedCandidate.status === 'failed' ? <button className="secondary" onClick={() => retry(selected)}><RefreshCw size={14} />单图重试</button> : <><button className="secondary" disabled={!['ready', 'approved'].includes(selectedCandidate.status)} onClick={() => setRefining(true)}><Pencil size={14} />精修文案</button><button className="primary" disabled={selectedCandidate.status !== 'approved' && !canSubmitReview(selectedCandidate)} onClick={brief.taskType === '营销会场' && selectedCandidate.status === 'approved' ? onVenue : submitReview}>{selectedCandidate.status === 'reviewing' ? '审核中…' : selectedCandidate.status === 'approved' ? (brief.taskType === '营销会场' ? '进入会场编辑器' : '已归档资产') : '提交审核'}</button></>}</div>
    {refining && <CopyRefinement candidate={selectedCandidate} onClose={() => setRefining(false)} onSave={saveCopy} />}
    {archiveNotice && <div className="archive-toast"><CheckCircle2 size={18} /><span><strong>审核通过，资产已归档</strong><small>{brief.id} / candidate-0{selected + 1} / v{selectedCandidate.version}</small></span><button className="archive-toast-link" onClick={onGoAssets}>查看资产库</button><button onClick={() => setArchiveNotice(false)}><X size={14} /></button></div>}
  </div>
}

function AssetInspector({ candidate, brief, onRetry }: { candidate: CreativeCandidate; brief: GenerationBrief; onRetry: () => void }) {
  const checksPassed = candidate.rules.filter((rule) => rule.passed).length
  const { insight } = candidate
  return <aside className="asset-inspector">
    <div className="inspector-title"><span>方案 0{candidate.index + 1}</span><strong>确定性规则检查</strong><small>底图与品牌固定层分离生产</small></div>
    <div className={`inspector-score ${candidate.status === 'failed' ? 'warning' : ''}`}><span>{candidate.status === 'failed' ? <AlertTriangle /> : <ShieldCheck />}</span><div><strong>{candidate.status === 'failed' ? '需要重新生成底图' : `${checksPassed} / ${candidate.rules.length} 项规则通过`}</strong><small>{candidate.status === 'failed' ? candidate.error : '可提交审核'}</small></div></div>
    <div className="rule-list">{candidate.rules.map((rule) => <div key={rule.id}><span className={rule.passed ? 'passed' : 'failed'}>{rule.passed ? <Check size={12} /> : <X size={12} />}</span><p><strong>{rule.label}</strong><small>{rule.detail}</small></p>{rule.locked && <em><LockKeyhole size={10} />锁定</em>}</div>)}</div>
    {candidate.status !== 'failed' && candidate.status !== 'queued' && (
      <div className="ai-insight">
        <div className="ai-insight-header"><Sparkles size={12} /><span>AI 选题分析</span><strong className="ctr-badge">{insight.predictedCtr}</strong></div>
        <p className="ai-insight-strategy">{insight.strategy}</p>
        <p className="ai-insight-rationale">{insight.aiRationale}</p>
      </div>
    )}
    <dl className="asset-metadata"><div><dt>任务类型</dt><dd>{brief.taskType}</dd></div><div><dt>压板版本</dt><dd>JD-CAMPAIGN v3.2</dd></div><div><dt>资产版本</dt><dd>v{candidate.version}</dd></div></dl>
    {candidate.status === 'failed' && <button className="inspector-retry" onClick={onRetry}><RefreshCw size={14} />重新生成此方案</button>}
  </aside>
}

function CopyRefinement({ candidate, onClose, onSave }: { candidate: CreativeCandidate; onClose: () => void; onSave: (copy: Pick<CreativeCandidate, 'title' | 'subtitle' | 'cta'>) => void }) {
  const [title, setTitle] = useState(candidate.title)
  const [subtitle, setSubtitle] = useState(candidate.subtitle)
  const [cta, setCta] = useState(candidate.cta)
  const valid = title.trim().length > 0 && title.trim().length <= 12 && cta.trim().length > 0 && cta.trim().length <= 6
  return <div className="refine-backdrop" onMouseDown={onClose}><section className="refine-panel" onMouseDown={(event) => event.stopPropagation()}>
    <header><span><Pencil size={16} /><strong>精修方案 0{candidate.index + 1}</strong></span><button onClick={onClose}><X size={18} /></button></header>
    <div className="locked-layer"><LockKeyhole size={15} /><span><strong>京东大促品牌压板已锁定</strong><small>Logo、搜索框和安全区不参与生成与编辑</small></span></div>
    <label><span>主标题 <em>{title.length}/12</em></span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <label><span>副标题 <em>{subtitle.length}/24</em></span><input value={subtitle} maxLength={24} onChange={(event) => setSubtitle(event.target.value)} /></label>
    <label><span>行动按钮 <em>{cta.length}/6</em></span><input value={cta} onChange={(event) => setCta(event.target.value)} /></label>
    {!valid && <p className="copy-error"><AlertTriangle size={13} />主标题不超过 12 字，行动按钮不超过 6 字</p>}
    <footer><button onClick={onClose}>取消</button><button disabled={!valid} onClick={() => onSave({ title: title.trim(), subtitle: subtitle.trim(), cta: cta.trim() })}>保存为 v{candidate.version + 1}</button></footer>
  </section></div>
}

function AssetCenterView({ assets, onBack, onDistribute }: { assets: ArchivedAsset[]; onBack: () => void; onDistribute: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(assets[0]?.id ?? null)
  const [filter, setFilter] = useState<'all' | 'approved' | 'reuse'>('all')
  const selected = assets.find((a) => a.id === selectedId) ?? assets[0]
  const variantClass = ['variant-1', 'variant-2', 'variant-3', 'variant-4']

  return (
    <div className="asset-center-page results-page production-page">
      <div className="results-heading">
        <button onClick={onBack}><ArrowLeft size={17} />返回</button>
        <div>
          <span>ASSET CENTER</span>
          <h1>创意资产中心</h1>
          <p>所有经过审核归档的创意资产，可直接用于会场编辑器和投放工作台。</p>
        </div>
        <div className="batch-meter">
          <div><span>已归档资产</span><strong>{assets.length}</strong></div>
          <i><b style={{ width: '100%' }} /></i>
          <small>{assets.filter((a) => a.taskType === '开屏').length} 开屏 · {assets.filter((a) => a.taskType === '营销海报').length} 海报 · {assets.filter((a) => a.taskType === 'Banner / 资源位').length} Banner</small>
          <button className="distribute-entry-btn" onClick={onDistribute}><Send size={12} />发布到渠道</button>
        </div>
      </div>
      <div className="asset-center-tabs">
        {(['all', 'approved', 'reuse'] as const).map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? '全部资产' : f === 'approved' ? '已审核' : '待复用'}
          </button>
        ))}
      </div>
      <div className="production-layout">
        <div className="candidate-gallery">
          {assets.filter(asset => {
            if (filter === 'all') return true
            if (filter === 'approved') return true  // all archived are approved
            if (filter === 'reuse') return asset.insight.predictedCtr.startsWith('+')
            return true
          }).map((asset, i) => (
            <button key={asset.id} className={`creative-card ${variantClass[i % 4]} status-approved ${selectedId === asset.id ? 'selected' : ''}`} onClick={() => setSelectedId(asset.id)}>
              {asset.imageUrl
                ? <img className="asset-image" src={asset.imageUrl} alt={asset.title} />
                : <div className="asset-object"><i /><b /></div>}
              <div className="asset-brand"><b>京东</b><small>{asset.taskType}</small></div>
              <div className="asset-copy"><span>ASSET</span><h2>{asset.title}</h2><p>{asset.subtitle}</p></div>
              <span className="asset-state approved"><Archive size={11} />已归档</span>
              <div className="strategy-tags">{asset.insight.strategyTags.map((t) => <span key={t}>{t}</span>)}</div>
              {selectedId === asset.id && <span className="selected-badge"><Check size={13} />已选择</span>}
            </button>
          ))}
        </div>
        {selected && (
          <aside className="asset-inspector">
            <div className="inspector-title"><span>资产详情</span><strong>{selected.title}</strong><small>{selected.taskType} · {selected.archivedAt.slice(0, 10)}</small></div>
            <div className="inspector-score"><span><CheckCircle2 /></span><div><strong>审核通过</strong><small>{selected.brief.campaign} · {selected.brief.benefit}</small></div></div>
            <div className="ai-insight">
              <div className="ai-insight-header"><Sparkles size={12} /><span>AI 选题分析</span><strong className="ctr-badge">{selected.insight.predictedCtr}</strong></div>
              <p className="ai-insight-strategy">{selected.insight.strategy}</p>
              <p className="ai-insight-rationale">{selected.insight.aiRationale}</p>
            </div>
            <dl className="asset-metadata">
              <div><dt>任务类型</dt><dd>{selected.taskType}</dd></div>
              <div><dt>活动</dt><dd>{selected.brief.campaign}</dd></div>
              <div><dt>权益</dt><dd>{selected.brief.benefit}</dd></div>
              <div><dt>风格</dt><dd>{selected.brief.style}</dd></div>
              <div><dt>归档时间</dt><dd>{selected.archivedAt.slice(0, 10)}</dd></div>
            </dl>
          </aside>
        )}
      </div>
    </div>
  )
}

function useLiveMetrics(intervalMs = 2500) {
  const [metrics, setMetrics] = useState<LiveMetrics>(baseMetrics)
  const [quality, setQuality] = useState<DataQuality>({ status: 'ok', label: '数据正常', detail: '全链路采集正常' })
  const boostedRef = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      // Compute next outside updater to avoid side effects inside setState
      setMetrics((prev) => {
        const next = tickMetrics(prev, boostedRef.current)
        return next
      })
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  // Sync quality from metrics changes via a separate effect
  useEffect(() => {
    setQuality(detectAnomaly(metrics))
  }, [metrics])

  const boost = () => { boostedRef.current = true; window.setTimeout(() => { boostedRef.current = false }, 12000) }

  return { metrics, quality, boost }
}

function LiveMetricTile({ label, value, sub, flash }: { label: string; value: string; sub: React.ReactNode; flash: boolean }) {
  return (
    <div className={`live-metric-tile ${flash ? 'metric-flash' : ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{sub}</em>
    </div>
  )
}

function DataQualityBar({ quality }: { quality: DataQuality }) {
  const colorMap: Record<string, string> = { ok: '#3a7d44', lag: '#9a7a20', anomaly: '#c0392b' }
  const dotMap: Record<string, string> = { ok: 'dq-dot-ok', lag: 'dq-dot-lag', anomaly: 'dq-dot-anomaly' }
  return (
    <div className={`dq-bar dq-${quality.status}`}>
      <span className={`dq-dot ${dotMap[quality.status]}`} />
      <strong style={{ color: colorMap[quality.status] }}>{quality.label}</strong>
      <span>{quality.detail}</span>
      <span className="dq-timestamp">{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
  )
}

function DataInsightsView({ assets, onBack }: { assets: ArchivedAsset[]; onBack: () => void }) {
  const [logFilter, setLogFilter] = useState<'all' | 'approved' | 'auto' | 'dismissed'>('all')
  const [anomalyDismissed, setAnomalyDismissed] = useState(false)
  const { metrics, quality, boost } = useLiveMetrics(2500)
  const prevMetrics = useRef(metrics)
  const [flashFields, setFlashFields] = useState<Set<keyof LiveMetrics>>(new Set())

  // detect which fields changed and flash them
  useEffect(() => {
    const changed = new Set<keyof LiveMetrics>()
    ;(['impressions', 'ctr', 'arrivalRate', 'gmv', 'conversionRate'] as (keyof LiveMetrics)[]).forEach((k) => {
      if (prevMetrics.current[k] !== metrics[k]) changed.add(k)
    })
    prevMetrics.current = metrics
    if (changed.size > 0) {
      setFlashFields(changed)
      const t = window.setTimeout(() => setFlashFields(new Set()), 600)
      return () => window.clearTimeout(t)
    }
  }, [metrics])

  const agentLog = [
    { agent: '设计智能体', task: '生成 4 个夏季美妆创意候选', time: '10:30', status: 'done' as const },
    { agent: '品牌合规智能体', task: '完成 5 项确定性规则校验', time: '10:32', status: 'done' as const },
    { agent: '会场运营智能体', task: '调整首楼防晒坑位 4→6 个（AI 自动执行）', time: '10:44', status: 'done' as const },
    { agent: '会场运营智能体', task: '配置首屏 B 版本 10% 流量实验（运营批准）', time: '10:45', status: 'running' as const },
    { agent: '数据分析智能体', task: '检测到会场到达率下滑 6.3%', time: '11:08', status: 'review' as const },
    { agent: '治理智能体', task: '确认实验符合护栏规范，批准执行', time: '11:10', status: 'done' as const },
  ]

  const performers = [
    { title: '冰爽开场', strategy: '冷色调·年轻女性', predicted: '+8.3%', actual: '7.9%', bar: 79 },
    { title: '热爱降温', strategy: '深蓝·男性用户', predicted: '+6.9%', actual: '6.4%', bar: 64 },
    { title: '清凉好物', strategy: '暖橙·全年龄段', predicted: '+5.1%', actual: '4.8%', bar: 48 },
    { title: '盛夏焕新', strategy: '自然绿·精致生活', predicted: '+3.7%', actual: '3.2%', bar: 32 },
  ]

  const decisionHistory = [
    { id: 'd1', title: '首楼防晒坑位 4→6 扩充', agent: '会场运营智能体', action: 'auto_executed' as const, risk: 'low' as const, time: '10:44', outcome: '加购率 +2.8%' },
    { id: 'd2', title: '启动首屏 B 10% 小流量实验', agent: '数据分析智能体', action: 'approved' as const, risk: 'medium' as const, time: '10:45', outcome: '进行中' },
    { id: 'd3', title: '开屏 A/B 扩量至 30%', agent: '渠道运营智能体', action: 'approved' as const, risk: 'medium' as const, time: '11:12', outcome: '执行中' },
    { id: 'd4', title: '满减权益降级提案', agent: '数据分析智能体', action: 'dismissed' as const, risk: 'high' as const, time: '11:15', outcome: '运营驳回' },
  ]

  const filteredHistory = decisionHistory.filter((d) => {
    if (logFilter === 'all') return true
    if (logFilter === 'approved') return d.action === 'approved'
    if (logFilter === 'auto') return d.action === 'auto_executed'
    if (logFilter === 'dismissed') return d.action === 'dismissed'
    return true
  })

  const actionLabels: Record<string, string> = { auto_executed: 'AI 执行', approved: '已批准', dismissed: '已驳回', rolled_back: '已回滚' }
  const riskColors: Record<string, string> = { low: '#4f7a2c', medium: '#8b5e16', high: '#8b2020' }
  const riskLabels: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' }

  const fmtImpr = (n: number) => `${(n / 10000).toFixed(0)}万`
  const fmtGmv  = (n: number) => `¥ ${(n / 10000).toFixed(0)}万`

  const showAnomalyBanner = quality.status === 'anomaly' && !anomalyDismissed

  return (
    <div className="insights-page results-page">
      <div className="results-heading">
        <button onClick={onBack}><ArrowLeft size={17} />返回</button>
        <div><span>DATA INSIGHTS</span><h1>数据洞察</h1><p>本轮创意投放的实时表现、智能体运行日志与决策追溯。</p></div>
        <DataQualityBar quality={quality} />
      </div>

      {/* Anomaly banner */}
      {showAnomalyBanner && (
        <div className="anomaly-banner">
          <AlertTriangle size={15} />
          <div>
            <strong>数据分析智能体检测到异常</strong>
            <span>会场到达率 {metrics.arrivalRate.toFixed(1)}% 低于护栏阈值，建议触发小流量实验进行验证。</span>
          </div>
          <button className="anomaly-action" onClick={() => { boost(); setAnomalyDismissed(true) }}>
            <Zap size={12} />触发实验建议
          </button>
          <button className="anomaly-dismiss" onClick={() => setAnomalyDismissed(true)}><X size={14} /></button>
        </div>
      )}

      {/* Live metrics strip */}
      <div className="live-metrics-strip">
        <div className="live-metrics-header">
          <span className="live-pulse" />
          <small>实时数据 · 每 2.5 秒更新</small>
        </div>
        <div className="live-metrics-row">
          <LiveMetricTile label="曝光量" value={fmtImpr(metrics.impressions)} sub={<><Sparkles size={10} />+18.3%</>} flash={flashFields.has('impressions')} />
          <LiveMetricTile label="平均点击率" value={`${metrics.ctr.toFixed(2)}%`} sub={<><Sparkles size={10} />+2.1pp</>} flash={flashFields.has('ctr')} />
          <LiveMetricTile label="会场到达率" value={`${metrics.arrivalRate.toFixed(1)}%`} sub={metrics.arrivalRate < 80 ? <span style={{ color: '#c0392b' }}>低于护栏</span> : '正常'} flash={flashFields.has('arrivalRate')} />
          <LiveMetricTile label="GMV" value={fmtGmv(metrics.gmv)} sub={<><Sparkles size={10} />+12.8%</>} flash={flashFields.has('gmv')} />
          <LiveMetricTile label="支付转化率" value={`${metrics.conversionRate.toFixed(2)}%`} sub={<><Sparkles size={10} />+0.46pp</>} flash={flashFields.has('conversionRate')} />
          <LiveMetricTile label="归档资产数" value={String(assets.length)} sub="本轮累计" flash={false} />
        </div>
      </div>

      <div className="campaign-grid" style={{ gap: 16 }}>
        <section className="orchestrator-panel" style={{ borderRadius: 13 }}>
          <div className="section-title" style={{ marginBottom: 14 }}>
            <div><span style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', background: '#1c1e19', color: '#d8ff52', font: '600 8px DM Mono' }}>01</span><h2>创意表现排行</h2></div>
          </div>
          <div className="agent-list">
            {performers.map((p, i) => (
              <div key={p.title} style={{ display: 'grid', gap: 6, padding: '10px 0', borderBottom: '1px solid #ecebe5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: '700 10px DM Mono', color: i === 0 ? '#2a7a47' : '#888', minWidth: 16 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 11 }}>{p.title}</strong>
                    <p style={{ fontSize: 8, color: '#777', margin: '2px 0 0' }}>{p.strategy}</p>
                  </div>
                  <span style={{ font: '700 11px Unbounded', color: '#2a7a47' }}>{p.actual}</span>
                  <span style={{ fontSize: 8, color: '#aaa' }}>预测 {p.predicted}</span>
                </div>
                <div className="insights-bar"><b style={{ width: `${p.bar}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="agent-panel" style={{ borderRadius: 13 }}>
          <div className="section-title"><div><span style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', background: '#1c1e19', color: '#d8ff52', font: '600 8px DM Mono' }}>02</span><h2>智能体运行日志</h2></div></div>
          <div className="agent-list">
            {agentLog.map((log) => (
              <button key={log.task} style={{ cursor: 'default' }}>
                <span className={`agent-icon ${log.status}`}>{log.status === 'done' ? <Check size={13} /> : log.status === 'running' ? <Activity size={13} /> : <Clock3 size={13} />}</span>
                <span><strong>{log.agent}</strong><p>{log.task}</p><small>{log.time}</small></span>
                <ChevronRight size={12} />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Decision audit trail */}
      <section className="insights-decision-section">
        <div className="insights-decision-header">
          <div className="insights-decision-title">
            <History size={15} />
            <h2>决策追溯</h2>
            <span>全链路可审计</span>
          </div>
          <div className="insights-log-filters">
            {(['all', 'approved', 'auto', 'dismissed'] as const).map((f) => (
              <button key={f} className={logFilter === f ? 'active' : ''} onClick={() => setLogFilter(f)}>
                {f === 'all' ? '全部' : f === 'approved' ? '批准' : f === 'auto' ? 'AI 执行' : '驳回'}
              </button>
            ))}
          </div>
        </div>
        <div className="insights-decision-list">
          {filteredHistory.map((entry) => (
            <div key={entry.id} className="insights-decision-row">
              <div className="idr-risk">
                <span className="idr-risk-dot" style={{ background: riskColors[entry.risk] }} title={riskLabels[entry.risk]} />
                <small style={{ color: riskColors[entry.risk] }}>{riskLabels[entry.risk]}</small>
              </div>
              <div className="idr-body">
                <strong>{entry.title}</strong>
                <p>{entry.agent} · {entry.time}</p>
              </div>
              <span className={`idr-action-badge action-${entry.action}`}>{actionLabels[entry.action]}</span>
              {entry.outcome && <span className="idr-outcome">{entry.outcome}</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="orchestrator-message" style={{ marginTop: 16, borderRadius: 10 }}>
        <Bot /><div><span>AI 优化建议</span><h3>冷色调冰感方案表现最佳，建议下一轮优先复用</h3><p>「冰爽开场」实际 CTR 7.9% 超过预测，在 18-28 岁女性用户中点击深度最高。建议下一轮活动以该方案为基础变体，调整文案权益后快速复用，减少生产成本。</p></div>
      </div>
    </div>
  )
}

type ChannelState = {
  status: 'pending' | 'scheduled' | 'sending' | 'sent' | 'failed'
  copyDraft: string
  topics: string         // 逗号分隔的话题标签，如 "#京东夏季促销, #美妆护肤"
  scheduledAt: string    // ISO 8601 或空字符串（空 = 立即发布）
  scheduleLabel: string
  postId?: string
  errorMsg?: string
}

function DistributeView({ assets, onBack }: { assets: ArchivedAsset[]; onBack: () => void }) {
  const [selectedAssetId, setSelectedAssetId] = useState<string>(assets[0]?.id ?? '')
  const [channels, setChannels] = useState<Record<string, ChannelState>>(() =>
    Object.fromEntries(distributeChannels.map((c) => [c.id, { status: 'pending', copyDraft: '', topics: '', scheduledAt: '', scheduleLabel: '' }]))
  )
  const [sending, setSending] = useState<string | null>(null)
  const [activeChannel, setActiveChannel] = useState<string>(distributeChannels[0].id)

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? assets[0]
  const ch = distributeChannels.find((c) => c.id === activeChannel)!
  const chState = channels[activeChannel]

  const aiCopy: Record<string, string> = {
    weibo:     `🧊 ${selectedAsset?.title ?? '夏日好物'} | 清凉一夏就靠这波了！满300减50，品类精选，手速要快～ #京东夏季促销 #美妆护肤`,
    xiaohong:  `✨ 今夏最值得入手的${selectedAsset?.brief?.category ?? '个护'} 清单来了\n\n夏天护肤要趁早！这次帮大家选了几款高性价比单品，颜值在线，成分实绩，${selectedAsset?.brief?.benefit ?? '好价好货'}直接冲～\n\n#夏日护肤 #个护精选 #京东好物`,
    mp:        `夏季美妆护肤大赏丨这届年轻人选产品有多认真？\n\n随着气温攀升，一场声势浩大的「清凉换季」正在发生。京东「${selectedAsset?.brief?.campaign ?? '清凉季'}」活动精选百余款夏日护肤好物，${selectedAsset?.brief?.benefit ?? '满300减50'}，助力每一位爱美的你顺利完成夏日护肤升级。`,
    shipinhao: `（上传 9:16 竖版视频 + 封面图）\n封面文案：${selectedAsset?.title ?? '夏日好物'}\n视频内容：产品展示 + 权益信息 + 倒计时`,
    live:      `直播间横幅文案：${selectedAsset?.brief?.benefit ?? '满300减50'} · ${selectedAsset?.brief?.campaign ?? '清凉季限时专场'}\n贴片物料：${selectedAsset?.title ?? '夏日好物'} — 今日直播价`,
    pr:        `【新闻稿】京东「${selectedAsset?.brief?.campaign ?? '清凉季'}」全域美妆营销活动正式启动\n\n2026年7月，京东美妆携手品牌方共同打造全域营销闭环。活动以"清凉夏日"为视觉主轴，通过 AI 生成的差异化创意素材覆盖开屏、海报、Banner 及营销会场，最终实现 GMV 增长 +12.8%，创意 CTR 超出基线 8.3%。`,
  }

  const fillAiCopy = () => {
    setChannels((prev) => ({ ...prev, [activeChannel]: { ...prev[activeChannel], copyDraft: aiCopy[activeChannel] ?? '' } }))
  }

  const scheduleOrSend = async (channelId: string) => {
    const snapshot = channels[channelId]
    setSending(channelId)
    setChannels((prev) => ({ ...prev, [channelId]: { ...prev[channelId], status: 'sending', errorMsg: undefined } }))

    const result = await publishToChannel({
      channelId,
      imageUrl: selectedAsset?.imageUrl ?? '',
      copy: snapshot.copyDraft,
      topics: snapshot.topics.split(',').map((t) => t.trim()).filter(Boolean),
      scheduledAt: snapshot.scheduledAt || undefined,
    })

    setSending(null)
    if (result.ok) {
      const label = snapshot.scheduledAt
        ? `已排期 · ${new Date(snapshot.scheduledAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
        : '刚刚'
      setChannels((prev) => ({ ...prev, [channelId]: { ...prev[channelId], status: 'sent', postId: result.postId, scheduleLabel: label } }))
    } else {
      setChannels((prev) => ({ ...prev, [channelId]: { ...prev[channelId], status: 'failed', errorMsg: result.error } }))
    }
  }

  const statusLabel = (s: ChannelState['status']) => {
    if (s === 'sent') return '已发布'
    if (s === 'scheduled') return '已排期'
    if (s === 'sending') return '发布中…'
    if (s === 'failed') return '发布失败'
    return '待发布'
  }

  const sentCount = Object.values(channels).filter((s) => s.status === 'sent').length

  return (
    <div className="distribute-page results-page production-page">
      <div className="results-heading">
        <button onClick={onBack}><ArrowLeft size={17} />返回资产</button>
        <div>
          <span>DISTRIBUTE</span>
          <h1>渠道投放工作台</h1>
          <p>选择素材，为每个渠道自动适配格式与文案，一键发布或排期。</p>
        </div>
        <div className="batch-meter">
          <div><span>渠道覆盖</span><strong>{sentCount} / {distributeChannels.length}</strong></div>
          <i><b style={{ width: `${Math.round(sentCount / distributeChannels.length * 100)}%` }} /></i>
          <small>{sentCount > 0 ? `${sentCount} 个渠道已发布` : '尚未发布到任何渠道'}</small>
        </div>
      </div>

      <div className="distribute-layout">
        {/* Left: asset picker */}
        <div className="distribute-asset-col">
          <p className="distribute-col-label">选择素材</p>
          <div className="distribute-asset-list">
            {assets.map((a, i) => (
              <button
                key={a.id}
                className={`distribute-asset-item ${selectedAssetId === a.id ? 'selected' : ''} variant-${(i % 4) + 1}`}
                onClick={() => setSelectedAssetId(a.id)}
              >
                {a.imageUrl
                  ? <img src={a.imageUrl} alt={a.title} />
                  : <div className="distribute-asset-thumb"><i /></div>}
                <div className="distribute-asset-meta">
                  <strong>{a.title}</strong>
                  <small>{a.taskType} · {a.insight.predictedCtr}</small>
                </div>
                {selectedAssetId === a.id && <Check size={13} className="distribute-check" />}
              </button>
            ))}
          </div>
        </div>

        {/* Middle: channel list */}
        <div className="distribute-channel-col">
          <p className="distribute-col-label">目标渠道</p>
          <div className="distribute-channel-list">
            {distributeChannels.map((c) => {
              const st = channels[c.id]
              return (
                <button
                  key={c.id}
                  className={`distribute-channel-item ${activeChannel === c.id ? 'active' : ''} dist-status-${st.status}`}
                  onClick={() => setActiveChannel(c.id)}
                >
                  <span className="dist-icon">{c.icon}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <small>{c.format}</small>
                  </div>
                  <span className={`dist-badge ${st.status}`}>{statusLabel(st.status)}</span>
                  <ChevronRight size={12} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: compose + send panel */}
        <div className="distribute-compose-col">
          <div className="distribute-compose-header">
            <span className="dist-icon lg">{ch.icon}</span>
            <div>
              <strong>{ch.name}</strong>
              <small>{ch.format}{ch.charLimit ? ` · 上限 ${ch.charLimit} 字` : ''}</small>
            </div>
            <span className={`dist-badge ${chState.status}`}>{statusLabel(chState.status)}</span>
          </div>

          <div className="distribute-asset-preview">
            {selectedAsset?.imageUrl
              ? <img src={selectedAsset.imageUrl} alt={selectedAsset.title} />
              : <div className={`distribute-preview-thumb variant-${(assets.findIndex((a) => a.id === selectedAssetId) % 4) + 1}`} />}
            <div className="distribute-preview-meta">
              <strong>{selectedAsset?.title}</strong>
              <span>{selectedAsset?.taskType} · {selectedAsset?.insight.strategy}</span>
              <span className="dist-ctr">{selectedAsset?.insight.predictedCtr} predicted CTR</span>
            </div>
          </div>

          <div className="distribute-copy-area">
            <div className="distribute-copy-toolbar">
              <span>投放文案</span>
              <button className="ai-draft-btn" onClick={fillAiCopy}><Sparkles size={11} />AI 一键起稿</button>
            </div>
            <textarea
              className="distribute-textarea"
              placeholder={`为 ${ch.name} 撰写投放文案…`}
              value={chState.copyDraft}
              maxLength={ch.charLimit || undefined}
              onChange={(e) => setChannels((prev) => ({ ...prev, [activeChannel]: { ...prev[activeChannel], copyDraft: e.target.value } }))}
            />
            {ch.charLimit ? (
              <small className="copy-char-count">{chState.copyDraft.length} / {ch.charLimit}</small>
            ) : null}
          </div>

          {/* Topics / hashtags */}
          <div className="dist-topics-row">
            <label className="dist-field-label">话题 / 标签</label>
            <input
              className="dist-topics-input"
              placeholder="#京东夏季促销, #美妆护肤"
              value={chState.topics}
              onChange={(e) => setChannels((prev) => ({ ...prev, [activeChannel]: { ...prev[activeChannel], topics: e.target.value } }))}
            />
            <small className="dist-field-hint">多个话题用逗号分隔</small>
          </div>

          {/* Schedule time */}
          <div className="dist-schedule-time-row">
            <label className="dist-field-label">发布时间</label>
            <div className="dist-schedule-time-inputs">
              <input
                type="datetime-local"
                className="dist-datetime-input"
                value={chState.scheduledAt}
                onChange={(e) => setChannels((prev) => ({ ...prev, [activeChannel]: { ...prev[activeChannel], scheduledAt: e.target.value } }))}
              />
              {chState.scheduledAt && (
                <button className="dist-clear-time" onClick={() => setChannels((prev) => ({ ...prev, [activeChannel]: { ...prev[activeChannel], scheduledAt: '' } }))}>
                  <X size={11} />立即
                </button>
              )}
            </div>
          </div>

          <div className="distribute-actions">
            {chState.status === 'sent' ? (
              <div className="dist-sent-state"><Check size={15} /><span>已发布到 {ch.name}</span><small>{chState.scheduleLabel}</small></div>
            ) : chState.status === 'failed' ? (
              <div className="dist-error-state">
                <AlertCircle size={13} />
                <span>{chState.errorMsg}</span>
                <button className="dist-retry-btn" onClick={() => scheduleOrSend(activeChannel)}>重试</button>
              </div>
            ) : (
              <>
                <button
                  className="dist-schedule-btn"
                  onClick={() => {
                    const t = chState.scheduledAt || (() => { const d = new Date(); d.setHours(20, 0, 0, 0); return d.toISOString().slice(0, 16) })()
                    setChannels((prev) => ({ ...prev, [activeChannel]: { ...prev[activeChannel], status: 'scheduled', scheduledAt: t, scheduleLabel: '今日 20:00' } }))
                  }}
                  disabled={chState.status === 'scheduled' || sending === activeChannel}
                >
                  <Clock3 size={13} />{chState.status === 'scheduled' ? `已排期 · ${chState.scheduleLabel}` : '排期发布'}
                </button>
                <button
                  className="dist-send-btn"
                  onClick={() => scheduleOrSend(activeChannel)}
                  disabled={sending === activeChannel || chState.status === 'sending'}
                >
                  {chState.status === 'sending' || sending === activeChannel
                    ? <><Activity size={13} />发布中…</>
                    : <><Send size={13} />{chState.scheduledAt ? '确认排期' : '立即发布'}</>}
                </button>
              </>
            )}
          </div>

          <div className="distribute-ai-tip">
            <Zap size={11} />
            <span>AI 已根据 {ch.name} 平台调性自动匹配文案风格，支持直接编辑后发布。</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function VenueEditor({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('structure')
  const [selectedId, setSelectedId] = useState('grid-01')
  const [previewMode, setPreviewMode] = useState<'mobile' | 'wide'>('mobile')
  const [candidateId, setCandidateId] = useState<CandidateId>('balanced')
  const [venue, setVenue] = useState(() => structuredClone(sampleVenue))
  const [candidateOpen, setCandidateOpen] = useState(false)
  const [reviewState, setReviewState] = useState<'draft' | 'checking' | 'submitted'>('draft')
  const candidate = candidates.find((item) => item.id === candidateId)!
  const validation = useMemo(() => pageSchema.safeParse(venue), [venue])
  const selected = venue.components.find((item) => item.id === selectedId)!

  const chooseCandidate = (id: CandidateId) => {
    const next = candidates.find((item) => item.id === id)!
    setCandidateId(id)
    setVenue(structuredClone(next.venue))
    setCandidateOpen(false)
    setReviewState('draft')
  }

  const toggleLock = () => {
    setVenue((current) => ({
      ...current,
      components: current.components.map((item) => item.id === selectedId ? { ...item, locked: !item.locked } : item),
    }))
    setReviewState('draft')
  }

  const submitReview = () => {
    if (!validation.success || reviewState !== 'draft') return
    setReviewState('checking')
    window.setTimeout(() => setReviewState('submitted'), 700)
  }

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="mark">VP<span>AI</span></div>
        <nav>
          <button className="active" aria-label="会场"><PanelLeftClose /></button>
          <button aria-label="AI 智能体"><Bot /></button>
          <button aria-label="实验"><GitBranch /></button>
          <button aria-label="指标"><Gauge /></button>
        </nav>
        <div className="rail-status"><span />L0</div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><button className="editor-back" onClick={onBack}><ArrowLeft size={14} />工作台</button><b>/</b><strong>{sampleVenue.metadata.title}</strong><em>v003</em></div>
          <div className="top-actions">
            <span className="save-state"><CircleCheck size={14} />已保存</span>
            <button className="ghost"><Eye size={16} />预览</button>
            <button className={`review-button ${reviewState}`} onClick={submitReview} disabled={!validation.success || reviewState !== 'draft'}>
              {reviewState === 'submitted' ? <Check size={15} /> : <Play size={15} fill="currentColor" />}
              {reviewState === 'draft' ? '提交审核' : reviewState === 'checking' ? '规则复检中' : '已提交审核'}
            </button>
          </div>
        </header>

        <section className="control-panel">
          <div className="panel-head">
            <div><span className="kicker">CAMPAIGN BLUEPRINT</span><h1>夏日美妆狂欢</h1></div>
            <div className="candidate-picker">
              <button className="ai-pill" onClick={() => setCandidateOpen((open) => !open)}><Sparkles size={15} />AI {candidate.name} <ChevronDown size={14} /></button>
              {candidateOpen && <div className="candidate-menu">
                {candidates.map((item) => <button key={item.id} className={candidateId === item.id ? 'active' : ''} onClick={() => chooseCandidate(item.id)}>
                  <span>{item.label}</span><div><strong>{item.name}</strong><small>预期 {item.expectedLift} · 信心 {item.confidence}%</small></div>{candidateId === item.id && <Check size={14} />}
                </button>)}
              </div>}
            </div>
          </div>

          <div className="tabs">
            {([['brief', '活动 Brief'], ['structure', '页面结构'], ['rules', '规则与护栏']] as const).map(([key, label]) => (
              <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === 'structure' && <>
            <div className="schema-summary">
              <div><Code2 /><span><small>PAGE SCHEMA</small><strong>v{sampleVenue.schemaVersion}</strong></span></div>
              <div><ShieldCheck /><span><small>校验状态</small><strong>{validation.success ? '全部通过' : '存在错误'}</strong></span></div>
              <div><Activity /><span><small>埋点覆盖</small><strong>3 / 3</strong></span></div>
            </div>
            <div className="component-list">
              {venue.components.map((component, index) => {
                const meta = componentRegistry[component.type]
                return <button key={component.id} className={selectedId === component.id ? 'selected' : ''} onClick={() => setSelectedId(component.id)}>
                  <span className="drag">{String(index + 1).padStart(2, '0')}</span>
                  <span className="component-icon">{component.type === 'benefit-hero' ? '日' : component.type === 'coupon-strip' ? '券' : '品'}</span>
                  <span className="component-meta"><strong>{meta.label}</strong><small>{component.trackingId}</small></span>
                  <em className={meta.risk}>{meta.risk === 'high' ? '核心' : '可调权'}</em>
                  {component.locked && <LockKeyhole size={14} />}
                </button>
              })}
            </div>
            <div className="inspector">
              <span className="kicker">SELECTED COMPONENT</span><h3>{componentRegistry[selected.type].label}</h3>
              <div className="inspector-row"><span>组件 ID</span><code>{selected.id}</code></div>
              <div className="inspector-row"><span>AI 权限</span><strong>{selected.locked ? '不可改动' : '护栏内可调整'}</strong></div>
              <button className="lock-action" onClick={toggleLock}>{selected.locked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}{selected.locked ? '解锁组件' : '锁定组件'}</button>
            </div>
          </>}

          {tab === 'brief' && <div className="brief-card"><span className="kicker">AI INTERPRETED INTENT</span><blockquote>“夏日美妆狂欢，满 300 减 50，主推防晒和控油。”</blockquote><dl><div><dt>人群</dt><dd>{sampleVenue.metadata.audience}</dd></div><div><dt>策略</dt><dd>GMV 40% · 转化 30% · 加购 15% · 点击 15%</dd></div></dl></div>}
          {tab === 'rules' && <div className="rules-card"><div><ShieldCheck /><span><strong>权益真实性</strong><small>已通过· 2 项权益</small></span></div><div><ShieldCheck /><span><strong>价格与库存</strong><small>已通过· 286 个商品</small></span></div><div><ShieldCheck /><span><strong>素材授权</strong><small>已通过· 42 份素材</small></span></div></div>}
        </section>

        <section className="preview-stage">
          <div className="stage-toolbar"><span><i />实时预览</span><div><button className={previewMode === 'mobile' ? 'active' : ''} onClick={() => setPreviewMode('mobile')}>移动端</button><button className={previewMode === 'wide' ? 'active' : ''} onClick={() => setPreviewMode('wide')}>宽屏</button></div><code>{venue.pageVersionId}</code></div>
          <div className="candidate-score"><span>{candidate.label}</span><div><small>AI CANDIDATE</small><strong>{candidate.name}</strong></div><b>{candidate.expectedLift}</b><em>{candidate.confidence}% 信心</em></div>
          <div className={`device-frame ${previewMode}`}><div className="device-top"><span /><b /><span /></div><div className="device-screen"><VenuePreview venue={venue} /></div></div>
          <div className="stage-note"><Sparkles size={16} /><span><strong>AI 编排说明</strong>{candidate.rationale}</span><button onClick={() => chooseCandidate('balanced')} aria-label="恢复均衡版"><RotateCcw size={14} /></button></div>
        </section>
      </div>
    </div>
  )
}
