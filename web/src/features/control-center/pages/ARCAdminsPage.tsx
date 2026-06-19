import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Ban, CheckCircle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { format } from 'date-fns'
import { useARCAdmin, ROLE_LABEL, type ARCRole } from '../useARCAuth'

const ROLE_OPTIONS: { value: ARCRole; label: string; desc: string; color: string }[] = [
  { value: 'founder',        label: 'Founder',        desc: 'Full access to everything', color: '#f97316' },
  { value: 'chief_admin',    label: 'Chief Admin',    desc: 'Manage tenants and operations', color: '#3b82f6' },
  { value: 'support_agent',  label: 'Support Agent',  desc: 'Handle customer support', color: '#22c55e' },
  { value: 'finance_admin',  label: 'Finance Admin',  desc: 'View payments and reports', color: '#a855f7' },
  { value: 'technical_admin',label: 'Technical Admin',desc: 'Monitor servers and backups', color: '#06b6d4' },
]

const ROLE_COLOR: Record<string, string> = {
  founder: '#f97316', chief_admin: '#3b82f6', support_agent: '#22c55e',
  finance_admin: '#a855f7', technical_admin: '#06b6d4',
}

export function ARCAdminsPage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    surface: dark ? '#0d1526' : '#ffffff', surface2: dark ? '#111827' : '#f8fafc',
    border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const { data: me } = useARCAdmin()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editAdmin, setEditAdmin] = useState<any | null>(null)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'support_agent' as ARCRole })

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['arc-admins-list'],
    queryFn: async () => {
      const { data } = await supabase.from('arc_admins').select('*').order('created_at')
      return data ?? []
    },
  })

  const createAdmin = useMutation({
    mutationFn: async () => {
      // Check if user exists
      const { data: user } = await supabase.from('arc_admins').select('id').eq('email', form.email).maybeSingle()
      if (user) throw new Error('An admin with this email already exists.')
      // Insert with placeholder user_id; the actual user_id will be linked when they first log in
      await supabase.from('arc_admins').insert({
        user_id: '00000000-0000-0000-0000-000000000000', // placeholder
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        created_by: me?.id,
        is_active: true,
      })
      setShowCreate(false)
      setForm({ email: '', full_name: '', role: 'support_agent' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arc-admins-list'] }),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from('arc_admins').update({ is_active: !is_active }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arc-admins-list'] }),
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: ARCRole }) => {
      await supabase.from('arc_admins').update({ role }).eq('id', id)
      setEditAdmin(null)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arc-admins-list'] }),
  })

  const canManage = me?.role === 'founder'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Admin Management</h1>
          <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Manage AutoRevenue Labs Control Center staff</p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: 'none',
            borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
          }}>
            <Plus size={14} /> Add Admin
          </button>
        )}
      </div>

      {/* Role Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {ROLE_OPTIONS.map(r => {
          const count = (admins as any[]).filter((a: any) => a.role === r.value).length
          const c = r.color
          return (
            <div key={r.value} style={{
              background: d.surface, border: `1px solid ${d.border}`,
              borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                <span style={{ color: c, fontSize: 12, fontWeight: 700 }}>{r.label}</span>
              </div>
              <span style={{ color: d.text, fontSize: 26, fontWeight: 800 }}>{count}</span>
              <span style={{ color: d.muted, fontSize: 11 }}>{r.desc}</span>
            </div>
          )
        })}
      </div>

      {/* Admins Table */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}` }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>All Admins ({admins.length})</h3>
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${d.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: d.surface2, borderBottom: `1px solid ${d.border}` }}>
                {['Admin', 'Role', 'Status', '2FA', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(admins as any[]).map(admin => {
                const rc = ROLE_COLOR[admin.role] ?? '#64748b'
                const isMe = admin.id === me?.id
                return (
                  <tr key={admin.id} style={{ borderBottom: `1px solid ${d.border}` }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${rc}40, ${rc}20)`,
                          border: `2px solid ${rc}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: rc, fontWeight: 800, fontSize: 14, flexShrink: 0,
                        }}>
                          {admin.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: d.text, fontWeight: 600 }}>
                            {admin.full_name} {isMe && <span style={{ color: '#3b82f6', fontSize: 11 }}>(you)</span>}
                          </div>
                          <div style={{ color: d.muted, fontSize: 11 }}>{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: `${rc}18`, color: rc, textTransform: 'capitalize',
                      }}>{ROLE_LABEL(admin.role)}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 5, width: 'fit-content',
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: admin.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: admin.is_active ? '#22c55e' : '#ef4444',
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: admin.is_active ? '#22c55e' : '#ef4444' }} />
                        {admin.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: admin.totp_enabled ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                        color: admin.totp_enabled ? '#22c55e' : '#eab308',
                      }}>{admin.totp_enabled ? '✓ Enabled' : '! Disabled'}</span>
                    </td>
                    <td style={{ padding: '14px 16px', color: d.muted, fontSize: 11 }}>
                      {admin.last_login_at ? format(new Date(admin.last_login_at), 'dd MMM HH:mm') : 'Never'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {canManage && !isMe && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setEditAdmin(admin)} title="Edit Role" style={{
                            padding: '5px 7px', background: 'none', border: `1px solid ${d.border}`,
                            borderRadius: 7, color: d.muted, cursor: 'pointer',
                          }}><Edit2 size={13} /></button>
                          {admin.role !== 'founder' && (
                            <button onClick={() => toggleActive.mutate({ id: admin.id, is_active: admin.is_active })} title={admin.is_active ? 'Suspend' : 'Activate'} style={{
                              padding: '5px 7px', background: 'none', border: `1px solid ${d.border}`,
                              borderRadius: 7, color: admin.is_active ? '#f97316' : '#22c55e', cursor: 'pointer',
                            }}>
                              {admin.is_active ? <Ban size={13} /> : <CheckCircle size={13} />}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Permissions Matrix */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}` }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Role Permissions Matrix</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: d.surface2 }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: d.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Permission</th>
                {ROLE_OPTIONS.map(r => (
                  <th key={r.value} style={{ padding: '10px 14px', textAlign: 'center', color: r.color, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { perm: 'Global Dashboard',    roles: [true, true, true, true, true] },
                { perm: 'Tenant Management',   roles: [true, true, false, false, false] },
                { perm: 'Revenue Center',      roles: [true, false, false, true, false] },
                { perm: 'Support Center',      roles: [true, true, true, false, false] },
                { perm: 'Landing Analytics',   roles: [true, false, false, true, false] },
                { perm: 'Reports Center',      roles: [true, true, false, true, false] },
                { perm: 'System Monitor',      roles: [true, false, false, false, true] },
                { perm: 'Backup & Recovery',   roles: [true, false, false, false, true] },
                { perm: 'Audit Logs',          roles: [true, true, false, false, true] },
                { perm: 'Admin Management',    roles: [true, false, false, false, false] },
                { perm: 'Impersonation',       roles: [true, false, false, false, false] },
                { perm: 'Delete Tenants',      roles: [true, true, false, false, false] },
                { perm: 'Manage Billing',      roles: [true, true, false, false, false] },
              ].map(row => (
                <tr key={row.perm} style={{ borderBottom: `1px solid ${d.border}` }}>
                  <td style={{ padding: '10px 16px', color: d.sub, fontWeight: 600 }}>{row.perm}</td>
                  {row.roles.map((allowed, i) => (
                    <td key={i} style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {allowed
                        ? <span style={{ color: '#22c55e', fontSize: 16 }}>✓</span>
                        : <span style={{ color: d.border, fontSize: 16 }}>–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Admin Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowCreate(false)}>
          <div style={{
            background: dark ? '#0d1526' : '#fff', border: `1px solid ${d.border}`,
            borderRadius: 20, maxWidth: 480, width: '100%', padding: 28,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: d.text, fontWeight: 700, margin: '0 0 20px', fontSize: 18 }}>Add New Admin</h3>

            {createAdmin.error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
                {(createAdmin.error as Error).message}
              </div>
            )}

            {[
              { field: 'full_name', label: 'Full Name', placeholder: 'John Doe' },
              { field: 'email', label: 'Email Address', placeholder: 'admin@autorevenuelabs.com' },
            ].map(({ field, label, placeholder }) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ color: d.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
                <input value={(form as any)[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={placeholder} style={{
                    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                    background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 10,
                    color: d.text, fontSize: 13, outline: 'none',
                  }} />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <label style={{ color: d.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 10 }}>Role</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ROLE_OPTIONS.filter(r => r.value !== 'founder').map(r => (
                  <label key={r.value} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: form.role === r.value ? `${r.color}10` : d.surface2,
                    border: form.role === r.value ? `2px solid ${r.color}40` : `1px solid ${d.border}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <input type="radio" name="role" value={r.value} checked={form.role === r.value}
                      onChange={e => setForm(p => ({ ...p, role: e.target.value as ARCRole }))}
                      style={{ accentColor: r.color }} />
                    <div>
                      <div style={{ color: r.color, fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                      <div style={{ color: d.muted, fontSize: 11 }}>{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '11px', background: d.surface2, border: `1px solid ${d.border}`,
                borderRadius: 10, color: d.sub, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Cancel</button>
              <button onClick={() => createAdmin.mutate()} disabled={createAdmin.isPending || !form.email || !form.full_name} style={{
                flex: 1, padding: '11px',
                background: !form.email || !form.full_name ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                border: 'none', borderRadius: 10, color: '#fff',
                cursor: !form.email || !form.full_name ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700,
              }}>{createAdmin.isPending ? 'Creating…' : 'Create Admin'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setEditAdmin(null)}>
          <div style={{
            background: dark ? '#0d1526' : '#fff', border: `1px solid ${d.border}`,
            borderRadius: 20, maxWidth: 420, width: '100%', padding: 24,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: d.text, fontWeight: 700, margin: '0 0 4px' }}>Change Role</h3>
            <p style={{ color: d.muted, fontSize: 13, margin: '0 0 20px' }}>Changing role for: <strong>{editAdmin.full_name}</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {ROLE_OPTIONS.filter(r => r.value !== 'founder').map(r => (
                <label key={r.value} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: editAdmin.role === r.value ? `${r.color}10` : d.surface2,
                  border: editAdmin.role === r.value ? `2px solid ${r.color}40` : `1px solid ${d.border}`,
                  borderRadius: 10, cursor: 'pointer',
                }}>
                  <input type="radio" name="edit-role" value={r.value} checked={editAdmin.role === r.value}
                    onChange={e => setEditAdmin((p: any) => ({ ...p, role: e.target.value }))}
                    style={{ accentColor: r.color }} />
                  <span style={{ color: r.color, fontWeight: 700, fontSize: 13 }}>{r.label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditAdmin(null)} style={{
                flex: 1, padding: '10px', background: d.surface2, border: `1px solid ${d.border}`,
                borderRadius: 10, color: d.sub, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Cancel</button>
              <button onClick={() => updateRole.mutate({ id: editAdmin.id, role: editAdmin.role })} style={{
                flex: 1, padding: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
