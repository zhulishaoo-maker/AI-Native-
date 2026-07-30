import { useEffect, useRef, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'

type TaskStatus = 'pending' | 'running' | 'done'

type HandoffTask = {
  id: string
  agent: string
  label: string
  detail: string
  status: TaskStatus
  durationMs: number
}

const TASKS: Omit<HandoffTask, 'status'>[] = [
  { id: 't1', agent: '营销活动智能体', label: '解析活动目标与约束', detail: '目标 · 人群 · 周期 · 预算', durationMs: 900 },
  { id: 't2', agent: '营销活动智能体', label: '生成用户旅程图谱', detail: '曝光 → 兴趣 → 到达 → 转化 → 再传播', durationMs: 1100 },
  { id: 't3', agent: '设计智能体', label: '规划开屏 3 套视觉方案', detail: '底图风格 · 品牌压板 · 安全区配置', durationMs: 950 },
  { id: 't4', agent: '渠道运营智能体', label: '配置 Banner 8 个资源位尺寸', detail: '首页 · 品类页 · 搜索 · 购物车入口', durationMs: 1050 },
  { id: 't5', agent: '设计智能体', label: '生成营销海报 4 套候选', detail: '色调策略 · 文案框架 · 人群定向', durationMs: 1200 },
  { id: 't6', agent: '会场运营智能体', label: '搭建营销会场结构与组件', detail: 'Schema · 坑位 · 权益组件 · 埋点', durationMs: 1000 },
  { id: 't7', agent: '治理智能体', label: '初始化实验护栏与审核规则', detail: '品牌压板锁 · 流量上限 · 回滚阈值', durationMs: 850 },
  { id: 't8', agent: '数据分析智能体', label: '联通数据采集与归因链路', detail: 'Campaign 标识 · 统一事件 · 指标归因', durationMs: 780 },
]

type Props = {
  onComplete: () => void
}

function TaskIcon({ status }: { status: TaskStatus }) {
  if (status === 'done') return <span className="handoff-icon done"><Check size={13} /></span>
  if (status === 'running') return <span className="handoff-icon running"><span className="handoff-ring" /></span>
  return <span className="handoff-icon pending"><span className="handoff-circle" /></span>
}

export function AgentHandoff({ onComplete }: Props) {
  const [tasks, setTasks] = useState<HandoffTask[]>(() =>
    TASKS.map((t, i) => ({ ...t, status: i === 0 ? 'running' : 'pending' }))
  )
  const [totalProgress, setTotalProgress] = useState(0)
  const completeCalledRef = useRef(false)

  useEffect(() => {
    let currentIndex = 0
    const timers: number[] = []

    const advance = (index: number) => {
      if (index >= TASKS.length) {
        // All done
        setTotalProgress(100)
        timers.push(window.setTimeout(() => {
          if (!completeCalledRef.current) {
            completeCalledRef.current = true
            onComplete()
          }
        }, 600))
        return
      }

      const task = TASKS[index]
      // Mark current as running
      setTasks((prev) => prev.map((t, i) => i === index ? { ...t, status: 'running' } : t))

      timers.push(window.setTimeout(() => {
        // Mark done, update progress
        setTasks((prev) => prev.map((t, i) => i === index ? { ...t, status: 'done' } : t))
        setTotalProgress(Math.round(((index + 1) / TASKS.length) * 100))

        // Small gap before next
        timers.push(window.setTimeout(() => {
          advance(index + 1)
        }, 180))
      }, task.durationMs))
    }

    // Tiny initial delay for the screen to mount
    timers.push(window.setTimeout(() => advance(currentIndex), 300))

    return () => timers.forEach(window.clearTimeout)
  }, [onComplete])

  const runningTask = tasks.find((t) => t.status === 'running')
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const remainingMs = tasks
    .filter((t) => t.status !== 'done')
    .reduce((sum, t) => sum + t.durationMs, 0)
  const remainingSec = Math.ceil(remainingMs / 1000)

  return (
    <div className="agent-handoff-screen">
      <div className="handoff-inner">
        <div className="handoff-header">
          <div className="handoff-logo">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="handoff-eyebrow">CAMPAIGN AUTOPILOT</span>
            <h2>智能体规划中</h2>
          </div>
          <div className="handoff-live">
            <span className="handoff-pulse" />
            <small>实时执行</small>
          </div>
        </div>

        <div className="handoff-task-list">
          {tasks.map((task) => (
            <div key={task.id} className={`handoff-task-row status-${task.status}`}>
              <TaskIcon status={task.status} />
              <div className="handoff-task-body">
                <span className="handoff-task-label">{task.label}</span>
                {task.status === 'running' && (
                  <span className="handoff-task-detail">{task.detail}</span>
                )}
                {task.status === 'done' && (
                  <span className="handoff-task-agent">{task.agent}</span>
                )}
              </div>
              {task.status === 'running' && (
                <span className="handoff-task-agent-running">{task.agent}</span>
              )}
            </div>
          ))}
        </div>

        <div className="handoff-progress-section">
          <div className="handoff-progress-track">
            <div className="handoff-progress-fill" style={{ width: `${totalProgress}%` }} />
          </div>
          <div className="handoff-progress-meta">
            <span>{doneCount} / {TASKS.length} 步骤完成</span>
            {totalProgress < 100 && runningTask && (
              <span>预计还需 ~{remainingSec} 秒</span>
            )}
            {totalProgress === 100 && (
              <span className="handoff-complete-text">规划完成，即将进入工作台…</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
