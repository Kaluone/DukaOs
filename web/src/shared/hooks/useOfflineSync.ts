import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'online' | 'offline' | 'syncing'

interface QueuedOperation {
  id: string
  table: string
  operation: 'insert' | 'update' | 'upsert'
  data: Record<string, unknown>
  timestamp: number
  retries: number
  shopId: string
}

const QUEUE_KEY  = 'dukaos_offline_queue'
const MAX_RETRIES = 5

// ─── Queue persistence ────────────────────────────────────────────────────────

function loadQueue(): QueuedOperation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedOperation[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch { /* storage full — drop oldest */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineSync() {
  const [status, setStatus]     = useState<SyncStatus>(navigator.onLine ? 'online' : 'offline')
  const [queueSize, setQueueSize] = useState(loadQueue().length)
  const syncingRef = useRef(false)

  // Update queue size display
  const refreshSize = useCallback(() => setQueueSize(loadQueue().length), [])

  // Network event listeners
  useEffect(() => {
    const goOnline  = () => { setStatus('online'); triggerSync() }
    const goOffline = () => setStatus('offline')

    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)

    // Attempt sync on mount if online
    if (navigator.onLine) triggerSync()

    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync pending queue to Supabase
  const triggerSync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return
    const queue = loadQueue()
    if (!queue.length) return

    syncingRef.current = true
    setStatus('syncing')

    const remaining: QueuedOperation[] = []

    for (const op of queue) {
      try {
        let error: unknown = null

        if (op.operation === 'insert') {
          const res = await supabase.from(op.table as any).insert(op.data)
          error = res.error
        } else if (op.operation === 'update') {
          const { id, ...rest } = op.data as any
          const res = await supabase.from(op.table as any).update(rest).eq('id', id)
          error = res.error
        } else if (op.operation === 'upsert') {
          const res = await supabase.from(op.table as any).upsert(op.data)
          error = res.error
        }

        if (error) {
          // Keep in queue if retries remain
          if (op.retries < MAX_RETRIES) {
            remaining.push({ ...op, retries: op.retries + 1 })
          }
          // else drop permanently after max retries
        }
      } catch {
        if (op.retries < MAX_RETRIES) remaining.push({ ...op, retries: op.retries + 1 })
      }
    }

    saveQueue(remaining)
    refreshSize()
    syncingRef.current = false
    setStatus(navigator.onLine ? 'online' : 'offline')
  }, [refreshSize])

  // Enqueue an operation for later sync (called when offline)
  const enqueue = useCallback((
    table: string,
    operation: QueuedOperation['operation'],
    data: Record<string, unknown>,
    shopId: string,
  ) => {
    const queue = loadQueue()
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      table, operation, data, shopId,
      timestamp: Date.now(),
      retries: 0,
    })
    saveQueue(queue)
    refreshSize()
  }, [refreshSize])

  // Smart write: try Supabase directly if online, else enqueue
  const smartWrite = useCallback(async (
    table: string,
    operation: QueuedOperation['operation'],
    data: Record<string, unknown>,
    shopId: string,
  ): Promise<{ error: Error | null }> => {
    if (!navigator.onLine) {
      enqueue(table, operation, data, shopId)
      return { error: null }
    }

    try {
      let error: unknown = null
      if (operation === 'insert') {
        const res = await supabase.from(table as any).insert(data)
        error = res.error
      } else if (operation === 'update') {
        const { id, ...rest } = data as any
        const res = await supabase.from(table as any).update(rest).eq('id', id)
        error = res.error
      } else {
        const res = await supabase.from(table as any).upsert(data)
        error = res.error
      }

      if (error) {
        // Fallback to queue on write failure
        enqueue(table, operation, data, shopId)
        return { error: error as Error }
      }
      return { error: null }
    } catch (err) {
      enqueue(table, operation, data, shopId)
      return { error: err as Error }
    }
  }, [enqueue])

  return { status, queueSize, triggerSync, enqueue, smartWrite }
}
