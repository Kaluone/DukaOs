import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, Check, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

interface Permission {
  id: string
  code: string
  name: string
  description: string | null
  category: string
}

interface Role {
  id: string
  shop_id: string
  name: string
  is_system: boolean
  created_at: string
  permissions?: string[]
}

function useRolesData(shopId?: string) {
  return useQuery<{ roles: Role[]; permissions: Permission[] }>({
    queryKey: ['roles-data', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const [rolesRes, permsRes] = await Promise.all([
        supabase.from('roles').select('id, shop_id, name, is_system, created_at').eq('shop_id', shopId!).order('name'),
        supabase.from('permissions').select('id, code, name, description, category').order('category').order('name'),
      ])
      if (rolesRes.error) throw rolesRes.error
      if (permsRes.error) throw permsRes.error

      // Fetch role_permissions
      const roleIds = (rolesRes.data ?? []).map(r => r.id)
      const { data: rpData } = await supabase
        .from('role_permissions')
        .select('role_id, permission_id')
        .in('role_id', roleIds)

      const rolePermMap: Record<string, string[]> = {}
      for (const rp of rpData ?? []) {
        if (!rolePermMap[rp.role_id]) rolePermMap[rp.role_id] = []
        rolePermMap[rp.role_id].push(rp.permission_id)
      }

      const roles = (rolesRes.data ?? []).map(r => ({ ...r, permissions: rolePermMap[r.id] ?? [] }))
      return { roles, permissions: permsRes.data ?? [] }
    },
  })
}

const PERM_CATEGORIES = ['reports', 'sales', 'expenses', 'products', 'customers', 'purchases', 'suppliers', 'staff', 'branches', 'inventory', 'approvals', 'ai', 'security', 'cash', 'promotions', 'settings', 'admin', 'general']

export function RolesPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const { data, isLoading } = useRolesData(shop?.id)

  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [showNewRole, setShowNewRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['reports', 'sales']))
  const [saving, setSaving] = useState(false)
  const [localPerms, setLocalPerms] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const roles = data?.roles ?? []
  const permissions = data?.permissions ?? []
  const permsByCategory = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  const selectRole = (r: Role) => {
    setSelectedRole(r)
    setLocalPerms(new Set(r.permissions ?? []))
    setError('')
  }

  const togglePerm = (permId: string) => {
    setLocalPerms(prev => {
      const next = new Set(prev)
      if (next.has(permId)) next.delete(permId)
      else next.add(permId)
      return next
    })
  }

  const savePermissions = async () => {
    if (!selectedRole) return
    setSaving(true)
    setError('')
    try {
      await supabase.from('role_permissions').delete().eq('role_id', selectedRole.id)
      if (localPerms.size > 0) {
        const rows = Array.from(localPerms).map(pid => ({ role_id: selectedRole.id, permission_id: pid }))
        const { error } = await supabase.from('role_permissions').insert(rows)
        if (error) throw error
      }
      await qc.invalidateQueries({ queryKey: ['roles-data', shop?.id] })
      setSaving(false)
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  const createRoleMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!shop?.id) throw new Error('No shop')
      const { error } = await supabase.from('roles').insert({ shop_id: shop.id, name: name.trim(), is_system: false })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles-data', shop?.id] })
      setShowNewRole(false)
      setNewRoleName('')
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={22} style={{ color: 'var(--color-primary)' }} /> Roles & Permissions
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
            Configure what each role can access
          </p>
        </div>
        <button
          onClick={() => setShowNewRole(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={16} /> New Role
        </button>
      </div>

      {showNewRole && (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            autoFocus
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            placeholder="Role name (e.g. Senior Cashier)"
            onKeyDown={e => { if (e.key === 'Enter') createRoleMutation.mutate(newRoleName) }}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}
          />
          <button onClick={() => createRoleMutation.mutate(newRoleName)} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create</button>
          <button onClick={() => setShowNewRole(false)} style={{ padding: '8px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--color-text)' }}>Cancel</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
        {/* Role list */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>ROLES ({roles.length})</div>
          {isLoading ? (
            <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading…</div>
          ) : (
            roles.map(r => (
              <button
                key={r.id}
                onClick={() => selectRole(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px',
                  background: selectedRole?.id === r.id ? 'var(--color-primary)' : 'transparent',
                  color: selectedRole?.id === r.id ? '#fff' : 'var(--color-text)',
                  border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--color-border)',
                }}
              >
                <Users size={14} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{r.name}</span>
                {r.is_system && <span style={{ fontSize: 10, opacity: 0.7 }}>SYS</span>}
              </button>
            ))
          )}
        </div>

        {/* Permissions editor */}
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
          {!selectedRole ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-secondary)' }}>
              <Shield size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p>Select a role to configure permissions</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{selectedRole.name} Permissions</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {error && <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>}
                  <button
                    onClick={savePermissions}
                    disabled={saving}
                    style={{ padding: '6px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {PERM_CATEGORIES.filter(cat => permsByCategory[cat]).map(cat => {
                const catPerms = permsByCategory[cat] ?? []
                const isExpanded = expandedCategories.has(cat)
                const checkedCount = catPerms.filter(p => localPerms.has(p.id)).length
                return (
                  <div key={cat} style={{ marginBottom: 8, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedCategories(prev => {
                        const next = new Set(prev)
                        if (next.has(cat)) next.delete(cat)
                        else next.add(cat)
                        return next
                      })}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', background: 'var(--color-bg)', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{cat}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{checkedCount}/{catPerms.length}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {catPerms.map(perm => (
                          <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
                            <div
                              onClick={() => togglePerm(perm.id)}
                              style={{
                                width: 18, height: 18, borderRadius: 4, border: '2px solid',
                                borderColor: localPerms.has(perm.id) ? 'var(--color-primary)' : 'var(--color-border)',
                                background: localPerms.has(perm.id) ? 'var(--color-primary)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}
                            >
                              {localPerms.has(perm.id) && <Check size={12} color="#fff" />}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{perm.name}</div>
                              {perm.description && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{perm.description}</div>}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
