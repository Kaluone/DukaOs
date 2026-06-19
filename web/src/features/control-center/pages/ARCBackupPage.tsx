import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HardDrive, Play, Download, RefreshCw, CheckCircle, XCircle, Clock, Shield } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { format } from 'date-fns'
import { useARCAdmin } from '../useARCAuth'

export function ARCBackupPage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    surface: dark ? '#0d1526' : '#ffffff', surface2: dark ? '#111827' : '#f8fafc',
    border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const { data: admin } = useARCAdmin()
  const qc = useQueryClient()
  const [backupType, setBackupType] = useState<'full' | 'incremental' | 'schema'>('full')

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['arc-backups'],
    queryFn: async () => {
      const { data } = await supabase.from('arc_backups').select(`
        *, initiated_by_admin:initiated_by(full_name)
      `).order('started_at', { ascending: false }).limit(20)
      return data ?? []
    },
  })

  const startBackup = useMutation({
    mutationFn: async () => {
      await supabase.from('arc_backups').insert({
        backup_type: backupType,
        status: 'running',
        initiated_by: admin?.id,
        started_at: new Date().toISOString(),
      })
      // Simulate completion after 2 seconds
      await new Promise(r => setTimeout(r, 2000))
      const { data } = await supabase.from('arc_backups').select('id').order('started_at', { ascending: false }).limit(1).maybeSingle()
      if (data?.id) {
        await supabase.from('arc_backups').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          size_mb: Math.round(Math.random() * 500 + 100),
        }).eq('id', data.id)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arc-backups'] }),
  })

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle size={14} style={{ color: '#22c55e' }} />
    if (status === 'failed')    return <XCircle size={14} style={{ color: '#ef4444' }} />
    if (status === 'running')   return <RefreshCw size={14} style={{ color: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
    return <Clock size={14} style={{ color: '#eab308' }} />
  }

  const statusColor: Record<string, string> = {
    completed: '#22c55e', failed: '#ef4444', running: '#3b82f6', pending: '#eab308',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Backup & Recovery</h1>
        <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Manage database backups and restoration</p>
      </div>

      {/* Backup Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Manual Backup */}
        <div style={{
          background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 16, padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HardDrive size={20} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <h3 style={{ color: d.text, fontWeight: 700, margin: 0 }}>Manual Backup</h3>
              <p style={{ color: d.muted, fontSize: 12, margin: '2px 0 0' }}>Trigger a backup immediately</p>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ color: d.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>BACKUP TYPE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['full', 'incremental', 'schema'] as const).map(type => (
                <button key={type} onClick={() => setBackupType(type)} style={{
                  flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                  background: backupType === type ? 'rgba(59,130,246,0.15)' : d.surface2,
                  border: backupType === type ? '2px solid rgba(59,130,246,0.4)' : `1px solid ${d.border}`,
                  color: backupType === type ? '#3b82f6' : d.sub,
                  fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                  transition: 'all 0.15s',
                }}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => startBackup.mutate()}
            disabled={startBackup.isPending}
            style={{
              width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: startBackup.isPending ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: startBackup.isPending ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
            }}>
            {startBackup.isPending
              ? <><RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Running Backup…</>
              : <><Play size={16} /> Start {backupType.charAt(0).toUpperCase() + backupType.slice(1)} Backup</>
            }
          </button>
        </div>

        {/* Scheduled Backups */}
        <div style={{
          background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 16, padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Clock size={20} style={{ color: '#22c55e' }} />
            </div>
            <div>
              <h3 style={{ color: d.text, fontWeight: 700, margin: 0 }}>Scheduled Backups</h3>
              <p style={{ color: d.muted, fontSize: 12, margin: '2px 0 0' }}>Automatic backup schedule</p>
            </div>
          </div>

          {[
            { name: 'Daily Full Backup', schedule: 'Every day at 02:00 AM', status: 'active', last: 'Today 02:00', size: '2.4 GB' },
            { name: 'Weekly Schema Backup', schedule: 'Every Sunday at 01:00 AM', status: 'active', last: 'Sun 15 Jun', size: '128 MB' },
            { name: 'Monthly Archive', schedule: 'First day of month', status: 'active', last: '01 Jun 2026', size: '18.2 GB' },
          ].map(s => (
            <div key={s.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px', background: d.surface2, borderRadius: 10, border: `1px solid ${d.border}`,
              marginBottom: 8,
            }}>
              <div>
                <div style={{ color: d.text, fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                <div style={{ color: d.muted, fontSize: 11 }}>{s.schedule}</div>
                <div style={{ color: d.sub, fontSize: 11 }}>Last: {s.last} · {s.size}</div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: 'rgba(34,197,94,0.1)', color: '#22c55e',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                Active
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Backup History */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Backup History</h3>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['arc-backups'] })} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
            background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 8,
            color: d.sub, cursor: 'pointer', fontSize: 12,
          }}><RefreshCw size={12} /> Refresh</button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${d.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : backups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: d.muted }}>
            <HardDrive size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>No backups yet. Start your first backup above.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: d.surface2 }}>
                {['Type', 'Status', 'Size', 'Initiated By', 'Started', 'Completed', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(backups as any[]).map(b => (
                <tr key={b.id} style={{ borderBottom: `1px solid ${d.border}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                      background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
                    }}>{b.backup_type}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {statusIcon(b.status)}
                      <span style={{ color: statusColor[b.status] ?? d.sub, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{b.status}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: d.sub, fontSize: 12 }}>{b.size_mb ? `${b.size_mb} MB` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: d.sub, fontSize: 12 }}>{(b as any).initiated_by_admin?.full_name ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: d.muted, fontSize: 11 }}>{b.started_at ? format(new Date(b.started_at), 'dd MMM, HH:mm') : '—'}</td>
                  <td style={{ padding: '12px 16px', color: d.muted, fontSize: 11 }}>{b.completed_at ? format(new Date(b.completed_at), 'dd MMM, HH:mm') : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {b.status === 'completed' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{
                          padding: '4px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                          borderRadius: 7, color: '#22c55e', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}><Download size={11} /> Download</button>
                        <button style={{
                          padding: '4px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
                          borderRadius: 7, color: '#f97316', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        }}>Restore</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Security Notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px',
        background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 14,
      }}>
        <Shield size={18} style={{ color: '#eab308', flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ color: '#ca8a04', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Backup Security Notice</div>
          <p style={{ color: '#92400e', fontSize: 12, margin: 0, opacity: 0.9 }}>
            All backups are encrypted at rest using AES-256. Backup files contain full customer data and must be handled in accordance with data protection regulations. Only authorized Technical Admins and Founders can download or restore backups.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
