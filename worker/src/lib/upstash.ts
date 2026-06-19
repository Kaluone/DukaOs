import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const IDEMPOTENCY_TTL = 86400 // 24 hours

export async function isAlreadyProcessed(key: string): Promise<boolean> {
  const val = await redis.get(`idem:${key}`)
  return val !== null
}

export async function markProcessed(key: string): Promise<void> {
  await redis.set(`idem:${key}`, '1', { ex: IDEMPOTENCY_TTL })
}

export async function rateLimitCheck(shopId: string, channel: string, windowSecs = 60, max = 3): Promise<boolean> {
  const rateKey = `rl:${shopId}:${channel}:${Math.floor(Date.now() / (windowSecs * 1000))}`
  const count = await redis.incr(rateKey)
  if (count === 1) await redis.expire(rateKey, windowSecs)
  return count <= max
}

export default redis
