/**
 * API Rate Limiter & Retry Manager
 * 用于管理GLM API的请求频率，避免429限流错误
 */

// 请求队列项
interface QueueItem {
  id: string
  execute: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  timestamp: number
}

// 配置
const CONFIG = {
  // 每秒最多请求数（进一步降低到0.5秒1个请求）
  requestsPerSecond: 0.5,
  // 最大并发请求数（降低到1，更保守）
  maxConcurrent: 1,
  // 重试配置
  maxRetries: 4,
  // 初始重试延迟 (ms) - 遇到429后等待5秒
  initialRetryDelay: 5000,
  // 重试延迟倍数
  retryDelayMultiplier: 2,
  // 缓存TTL (ms)
  cacheTTL: 30000, // 30秒
}

// 状态管理
class RateLimiter {
  private queue: QueueItem[] = []
  private processing: Set<string> = new Set()
  private lastRequestTime = 0
  private requestInterval = 1000 / CONFIG.requestsPerSecond
  private currentConcurrent = 0

  // 缓存
  private cache = new Map<string, { data: any; expiry: number }>()

  // 添加请求到队列
  async enqueue<T>(
    id: string,
    execute: () => Promise<T>,
    options?: { skipCache?: boolean; cacheKey?: string }
  ): Promise<T> {
    // 检查缓存
    const cacheKey = options?.cacheKey || id
    if (!options?.skipCache) {
      const cached = this.cache.get(cacheKey)
      if (cached && cached.expiry > Date.now()) {
        console.log(`[RateLimiter] Cache hit for: ${cacheKey}`)
        return cached.data
      }
    }

    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id,
        execute,
        resolve,
        reject,
        timestamp: Date.now(),
      }
      this.queue.push(item)
      console.log(`[RateLimiter] Enqueued: ${id} (Queue size: ${this.queue.length})`)
      this.processQueue()
    })
  }

  // 处理队列
  private async processQueue() {
    // 如果正在处理或队列为空，跳过
    if (this.currentConcurrent >= CONFIG.maxConcurrent || this.queue.length === 0) {
      return
    }

    // 检查请求间隔
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.requestInterval) {
      const waitTime = this.requestInterval - timeSinceLastRequest
      setTimeout(() => this.processQueue(), waitTime)
      return
    }

    // 取出下一个请求
    const item = this.queue.shift()
    if (!item) return

    // 检查是否已在处理中
    if (this.processing.has(item.id)) {
      // 重新放回队列
      this.queue.unshift(item)
      setTimeout(() => this.processQueue(), 100)
      return
    }

    // 标记为处理中
    this.processing.add(item.id)
    this.currentConcurrent++
    this.lastRequestTime = now

    console.log(
      `[RateLimiter] Processing: ${item.id} (Concurrent: ${this.currentConcurrent}/${CONFIG.maxConcurrent})`
    )

    try {
      // 执行请求（带重试）
      const result = await this.executeWithRetry(item.execute, item.id)
      item.resolve(result)

      // 缓存结果
      this.cache.set(item.id, {
        data: result,
        expiry: Date.now() + CONFIG.cacheTTL,
      })
    } catch (error) {
      console.error(`[RateLimiter] Error for ${item.id}:`, error)
      item.reject(error)
    } finally {
      // 清理状态
      this.processing.delete(item.id)
      this.currentConcurrent--

      // 继续处理下一个
      setTimeout(() => this.processQueue(), this.requestInterval)
    }
  }

  // 带重试的执行
  private async executeWithRetry<T>(fn: () => Promise<T>, id: string): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[RateLimiter] Retry ${attempt}/${CONFIG.maxRetries} for: ${id}`)
        }
        return await fn()
      } catch (error: any) {
        lastError = error

        // 检查是否是429错误（限流）- 增强检测
        const isRateLimit =
          error?.status === 429 ||
          error?.message?.includes("429") ||
          error?.message?.includes("1305") ||
          error?.message?.includes("Too Many Requests") ||
          error?.message?.includes("负载已饱和") ||
          error?.message?.includes("upstream_error")

        // 如果不是限流错误或已达到最大重试次数，直接抛出
        if (!isRateLimit || attempt >= CONFIG.maxRetries) {
          console.error(`[RateLimiter] Final failure for ${id} after ${attempt} attempts`)
          throw error
        }

        // 计算重试延迟（指数退避）
        const delay = CONFIG.initialRetryDelay * Math.pow(CONFIG.retryDelayMultiplier, attempt)
        console.log(`[RateLimiter] Rate limit hit (${error.status || 'unknown'}), waiting ${delay}ms before retry...`)

        // 等待后重试
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  // 清除缓存
  clearCache(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }

  // 获取队列状态
  getStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing.size,
      currentConcurrent: this.currentConcurrent,
      cacheSize: this.cache.size,
    }
  }
}

// 单例实例
export const rateLimiter = new RateLimiter()

// 快捷方法
export function fetchWithRateLimit<T>(
  id: string,
  fetchFn: () => Promise<T>,
  options?: { skipCache?: boolean; cacheKey?: string }
): Promise<T> {
  return rateLimiter.enqueue(id, fetchFn, options)
}
