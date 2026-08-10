// 渠道发布 service — 统一接口层
// 当前全部为 Mock 实现，接入真实平台时替换对应 adapter 函数即可

export type PublishPayload = {
  channelId: string
  imageUrl: string        // data URL 或 CDN URL
  copy: string            // 文案正文
  topics: string[]        // 话题/标签，如 ["#京东夏季促销", "#美妆护肤"]
  scheduledAt?: string    // ISO 8601 定时时间，不传则立即发布
}

export type PublishResult =
  | { ok: true;  postId: string; publishedAt: string }
  | { ok: false; error: string }

type ChannelAdapter = (payload: PublishPayload) => Promise<PublishResult>

// Mock adapter — 500ms 延迟，10% 随机失败
// TODO: 接入内网发布系统时替换此函数
function mockAdapter(payload: PublishPayload): Promise<PublishResult> {
  return new Promise(resolve => {
    window.setTimeout(() => {
      // 用 payload 的字段长度做伪随机，避免使用 Math.random()（幂等性考虑）
      const seed = (payload.copy.length + payload.topics.length * 7) % 10
      if (seed === 0) {
        resolve({ ok: false, error: '平台接口超时，请稍后重试' })
      } else {
        resolve({
          ok: true,
          postId: `mock-${payload.channelId}-${Date.now()}`,
          publishedAt: new Date().toISOString(),
        })
      }
    }, 500)
  })
}

// TODO: 微博内网发布 API
// async function weiboAdapter(payload: PublishPayload): Promise<PublishResult> {
//   const res = await fetch('/api/publish/weibo', { method: 'POST', body: JSON.stringify(payload) })
//   return res.json()
// }

// TODO: 小红书内网发布 API
// async function xiaohongshuAdapter(payload: PublishPayload): Promise<PublishResult> {
//   const res = await fetch('/api/publish/xiaohongshu', { method: 'POST', body: JSON.stringify(payload) })
//   return res.json()
// }

// TODO: 公众号内网发布 API
// async function mpAdapter(payload: PublishPayload): Promise<PublishResult> { ... }

// TODO: 视频号内网发布 API
// async function shipinhaoAdapter(payload: PublishPayload): Promise<PublishResult> { ... }

// TODO: 直播间挂载内网 API
// async function liveAdapter(payload: PublishPayload): Promise<PublishResult> { ... }

// TODO: 公关稿内网发布 API
// async function prAdapter(payload: PublishPayload): Promise<PublishResult> { ... }

const adapters: Record<string, ChannelAdapter> = {
  weibo:     mockAdapter,
  xiaohong:  mockAdapter,
  mp:        mockAdapter,
  shipinhao: mockAdapter,
  live:      mockAdapter,
  pr:        mockAdapter,
}

export async function publishToChannel(payload: PublishPayload): Promise<PublishResult> {
  const adapter = adapters[payload.channelId]
  if (!adapter) return { ok: false, error: `未知渠道: ${payload.channelId}` }
  try {
    return await adapter(payload)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '发布失败，请重试' }
  }
}
