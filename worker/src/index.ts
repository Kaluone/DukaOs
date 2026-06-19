import express from 'express'
import { handleDispatch } from './handlers/notificationHandler'
import { handleVFDRetry, retryPendingVFD } from './handlers/vfdHandler'

const app = express()
app.use(express.json({ limit: '256kb' }))

const WORKER_SECRET = process.env.WORKER_SECRET

function authenticate(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!WORKER_SECRET) { next(); return }
  const token = req.headers['x-worker-secret']
  if (token !== WORKER_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dukaos-worker', ts: new Date().toISOString() })
})

// Notification dispatch — called by Supabase Edge Function notify-sale
app.post('/dispatch', authenticate, handleDispatch)

// VFD retry — called by Supabase Edge Function vfd-submit on failure
app.post('/vfd/retry', authenticate, handleVFDRetry)

// Periodic sweep of pending VFD receipts — called by a cron job or n8n schedule
app.post('/vfd/sweep', authenticate, async (_req, res) => {
  try {
    await retryPendingVFD()
    res.json({ status: 'ok' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`DukaOS worker listening on :${PORT}`)
})

// Run VFD sweep every 10 minutes
setInterval(() => {
  retryPendingVFD().catch(err => console.error('VFD sweep error:', err))
}, 10 * 60 * 1000)
