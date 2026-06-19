// TTL-based in-memory cache — prevents redundant Supabase reads within a session

export class TTLCache<T> {
  private data: T | null = null
  private timestamp: number | null = null

  constructor(private readonly ttlMs: number) {}

  get(forceRefresh = false): T | null {
    if (forceRefresh || !this.data || !this.timestamp) return null
    if (Date.now() - this.timestamp > this.ttlMs) return null
    return this.data
  }

  set(value: T): void {
    this.data = value
    this.timestamp = Date.now()
  }

  invalidate(): void {
    this.data = null
    this.timestamp = null
  }

  isStale(): boolean {
    if (!this.timestamp) return true
    return Date.now() - this.timestamp > this.ttlMs
  }
}

export const caches = {
  shop:     new TTLCache<unknown>(5  * 60 * 1000),  // 5 min
  products: new TTLCache<unknown>(10 * 60 * 1000),  // 10 min
  staff:    new TTLCache<unknown>(10 * 60 * 1000),  // 10 min
  dashboard:new TTLCache<unknown>(30 * 1000),        // 30s — live data
}

export function clearAllCaches(): void {
  Object.values(caches).forEach((c) => c.invalidate())
}
