import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useOfflineSync } from '@/shared/hooks/useOfflineSync'

export function OfflineIndicator() {
  const { status, queueSize, triggerSync } = useOfflineSync()

  if (status === 'online' && queueSize === 0) return null

  return (
    <div className={`offline-ind offline-ind--${status}`} role="status" aria-live="polite">
      {status === 'offline' && (
        <>
          <WifiOff size={13} />
          <span>Offline</span>
          {queueSize > 0 && <span className="offline-ind__queue">{queueSize} pending</span>}
        </>
      )}
      {status === 'syncing' && (
        <>
          <RefreshCw size={13} className="spin" />
          <span>Syncing…</span>
        </>
      )}
      {status === 'online' && queueSize > 0 && (
        <>
          <Wifi size={13} />
          <span>{queueSize} to sync</span>
          <button className="offline-ind__sync-btn" onClick={triggerSync}>Sync now</button>
        </>
      )}

      <style>{`
        .offline-ind {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: var(--radius-full);
          font-size: 0.72rem; font-weight: 600;
        }
        .offline-ind--offline { background: var(--color-error-bg, #fee2e2); color: var(--color-error); }
        .offline-ind--syncing { background: var(--color-primary-light); color: var(--color-primary); }
        .offline-ind--online  { background: var(--color-warning-bg, #fef9c3); color: var(--color-warning); }
        .offline-ind__queue { background: var(--color-error); color: #fff; border-radius: var(--radius-full); padding: 1px 6px; }
        .offline-ind__sync-btn { background: none; border: none; color: inherit; font-weight: 700; cursor: pointer; text-decoration: underline; font-size: inherit; }
        .spin { animation: spin 800ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
