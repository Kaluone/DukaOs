import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Server, Database, Wifi, HardDrive, Cpu, MemoryStick,
  Activity, Clock, TrendingUp,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/shared/lib/supabaseClient'
import { format } from 'date-fns'

function useSimulatedMetrics() {
  const [metrics, setMetrics] = useState({
    cpu: 34, memory: 58, disk: 42, network: 12,
    history: Array.from({ length: 20 }, (_, i) => ({
      time: format(new Date(Date.now() - (19 - i) * 3000), 'HH:mm:ss'),
      cpu: 20 + Math.random() * 30, memory: 50 + Math.random() * 20,
    })),
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => {
        const newCpu = Math.max(5, Math.min(95, prev.cpu + (Math.random() - 0.5) * 10))
        const newMem = Math.max(30, Math.min(90, prev.memory + (Math.random() - 0.5) * 5))
        return {
          cpu: Math.round(newCpu),
          memory: Math.round(newMem),
          disk: prev.disk,
          network: Math.round(Math.random() * 30),
          history: [...prev.history.slice(1), {
            time: format(new Date(), 'HH:mm:ss'),
            cpu: newCpu, memory: newMem,
          }],
        }
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return metrics
}

export function ARCSystemPage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    surface: dark ? '#0d1526' : '#ffffff', surface2: dark ? '#111827' : '#f8fafc',
    border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const metrics = useSimulatedMetrics()

  const { data: dbStats } = useQuery({
    queryKey: ['arc-db-stats'],
    queryFn: async () => {
      const [
        { count: shops }, { count: transactions }, { count: products }, { count: staff },
      ] = await Promise.all([
        supabase.from('shops').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('*', { count: 'exact', head: true }),
      ])
      return { shops: shops ?? 0, transactions: transactions ?? 0, products: products ?? 0, staff: staff ?? 0 }
    },
    refetchInterval: 60_000,
  })

  const services = [
    { name: 'API Server', status: 'operational', latency: '8ms',   icon: Server,   color: '#22c55e' },
    { name: 'Database',   status: 'operational', latency: '12ms',  icon: Database, color: '#22c55e' },
    { name: 'Auth Service',status: 'operational', latency: '5ms',  icon: Wifi,     color: '#22c55e' },
    { name: 'Storage',    status: 'operational', latency: '18ms',  icon: HardDrive,color: '#22c55e' },
    { name: 'Realtime',   status: 'operational', latency: '3ms',   icon: Activity, color: '#22c55e' },
    { name: 'Edge Functions',status:'operational',latency: '22ms', icon: Cpu,      color: '#22c55e' },
  ]

  const errorLogs = [
    { time: '09:12:04', level: 'warn',  msg: 'High memory usage detected on replica-2', service: 'Database' },
    { time: '08:45:33', level: 'info',  msg: 'Backup completed successfully (2.4 GB)', service: 'Storage' },
    { time: '08:30:21', level: 'info',  msg: 'SSL certificate renewed for api.dukaos.com', service: 'Security' },
    { time: '07:15:09', level: 'error', msg: 'Webhook delivery failed for shop_id=abc123 (timeout)', service: 'API' },
    { time: '06:02:44', level: 'info',  msg: 'Scheduled maintenance completed', service: 'System' },
  ]

  const logColor: Record<string, string> = { error: '#ef4444', warn: '#eab308', info: '#3b82f6' }

  function GaugeBar({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
    const status = value > 85 ? 'Critical' : value > 70 ? 'Warning' : 'Normal'
    const statusC = value > 85 ? '#ef4444' : value > 70 ? '#eab308' : '#22c55e'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px', background: d.surface2, borderRadius: 12, border: `1px solid ${d.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={16} style={{ color }} />
            <span style={{ color: d.sub, fontSize: 13, fontWeight: 600 }}>{label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: d.text, fontWeight: 800, fontSize: 20, fontFamily: 'monospace' }}>{value}%</span>
            <span style={{ color: statusC, fontSize: 11, fontWeight: 700, background: `${statusC}18`, padding: '2px 6px', borderRadius: 6 }}>{status}</span>
          </div>
        </div>
        <div style={{ height: 8, background: `${color}20`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${value}%`, borderRadius: 4,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>System Monitor</h1>
          <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Real-time server health and performance metrics</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>All Systems Operational</span>
        </div>
      </div>

      {/* Resource Gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        <GaugeBar label="CPU Usage"     value={metrics.cpu}     color="#3b82f6" icon={Cpu} />
        <GaugeBar label="Memory"        value={metrics.memory}  color="#a855f7" icon={MemoryStick} />
        <GaugeBar label="Disk Storage"  value={metrics.disk}    color="#f97316" icon={HardDrive} />
        <GaugeBar label="Network I/O"   value={metrics.network} color="#06b6d4" icon={Activity} />
      </div>

      {/* Live Charts */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Live Performance (Last 60 seconds)</h3>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 11, fontWeight: 600,
            background: 'rgba(34,197,94,0.1)', padding: '3px 8px', borderRadius: 6,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s infinite' }} />
            LIVE
          </div>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <AreaChart data={metrics.history}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={d.border} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: d.muted }} axisLine={false} tickLine={false} interval={4} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: d.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10, fontSize: 11, color: d.text }}
                formatter={(v: any) => [`${Math.round(v)}%`]} />
              <Area type="monotone" dataKey="cpu" name="CPU" stroke="#3b82f6" strokeWidth={2} fill="url(#cpuGrad)" />
              <Area type="monotone" dataKey="memory" name="Memory" stroke="#a855f7" strokeWidth={2} fill="url(#memGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {[{ color: '#3b82f6', label: 'CPU' }, { color: '#a855f7', label: 'Memory' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 3, background: l.color, borderRadius: 2 }} />
              <span style={{ color: d.muted, fontSize: 12 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Services Status */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}` }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Services Status</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1, background: d.border }}>
          {services.map(s => (
            <div key={s.name} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
              background: d.surface,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: `${s.color}18`, border: `1px solid ${s.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: d.text, fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                <div style={{ color: d.muted, fontSize: 11 }}>Latency: {s.latency}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>OK</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Database Stats */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, padding: 20,
      }}>
        <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Database Statistics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {[
            { label: 'Shops', value: dbStats?.shops, icon: Server, color: '#3b82f6' },
            { label: 'Transactions', value: dbStats?.transactions, icon: TrendingUp, color: '#22c55e' },
            { label: 'Products', value: dbStats?.products, icon: Activity, color: '#a855f7' },
            { label: 'Staff', value: dbStats?.staff, icon: Clock, color: '#f97316' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '14px', background: d.surface2, borderRadius: 12, border: `1px solid ${d.border}`,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <s.icon size={16} style={{ color: s.color }} />
              <span style={{ color: d.text, fontSize: 20, fontWeight: 800 }}>{s.value?.toLocaleString() ?? '—'}</span>
              <span style={{ color: d.muted, fontSize: 11 }}>Total {s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error Logs */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}` }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>System Logs</h3>
        </div>
        <div style={{ fontFamily: 'monospace' }}>
          {errorLogs.map((log, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14, padding: '10px 20px',
              borderBottom: i < errorLogs.length - 1 ? `1px solid ${d.border}` : 'none',
              background: log.level === 'error' ? 'rgba(239,68,68,0.04)' : 'transparent',
            }}>
              <span style={{ color: d.muted, fontSize: 11, minWidth: 70, flexShrink: 0 }}>{log.time}</span>
              <span style={{
                padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0,
                background: `${logColor[log.level]}20`, color: logColor[log.level],
              }}>{log.level}</span>
              <span style={{ color: d.sub, fontSize: 12, flex: 1 }}>{log.msg}</span>
              <span style={{ color: d.muted, fontSize: 11, flexShrink: 0 }}>{log.service}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}
