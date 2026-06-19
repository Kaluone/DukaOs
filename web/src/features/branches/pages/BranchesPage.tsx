import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GitBranch, Plus, Edit2, Archive, Users, MapPin, Phone, Star, BarChart2 } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

interface Branch {
  id: string
  shop_id: string
  name: string
  address: string | null
  phone: string | null
  manager_name: string | null
  is_main: boolean
  is_active: boolean
  created_at: string
}

function useBranches(shopId?: string) {
  return useQuery<Branch[]>({
    queryKey: ['branches', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('shop_id', shopId!)
        .order('is_main', { ascending: false })
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

interface BranchFormData {
  name: string
  address: string
  phone: string
  manager_name: string
}

const emptyForm: BranchFormData = { name: '', address: '', phone: '', manager_name: '' }

export function BranchesPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const { data: branches = [], isLoading } = useBranches(shop?.id)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form, setForm] = useState<BranchFormData>(emptyForm)
  const [error, setError] = useState('')

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }
  const openEdit = (b: Branch) => {
    setEditing(b)
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '', manager_name: b.manager_name ?? '' })
    setError('')
    setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      if (!shop?.id) throw new Error('No shop')
      if (!data.name.trim()) throw new Error('Branch name is required')
      const payload = {
        shop_id: shop.id,
        name: data.name.trim(),
        address: data.address.trim() || null,
        phone: data.phone.trim() || null,
        manager_name: data.manager_name.trim() || null,
      }
      if (editing) {
        const { error } = await supabase.from('branches').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('branches').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches', shop?.id] })
      setShowModal(false)
    },
    onError: (e: Error) => setError(e.message),
  })

  const archiveMutation = useMutation({
    mutationFn: async (b: Branch) => {
      const { error } = await supabase
        .from('branches').update({ is_active: !b.is_active }).eq('id', b.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches', shop?.id] }),
  })

  const activeBranches = branches.filter(b => b.is_active)
  const archivedBranches = branches.filter(b => !b.is_active)

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={22} style={{ color: 'var(--color-primary)' }} />
            Branch Management
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
            Manage your store locations and branches
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={16} /> Add Branch
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Branches', value: branches.length, icon: GitBranch },
          { label: 'Active', value: activeBranches.length, icon: BarChart2 },
          { label: 'Archived', value: archivedBranches.length, icon: Archive },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px' }}>
            <s.icon size={18} style={{ color: 'var(--color-primary)', marginBottom: 6 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading branches…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {activeBranches.map(branch => (
              <BranchCard
                key={branch.id}
                branch={branch}
                onEdit={() => openEdit(branch)}
                onArchive={() => archiveMutation.mutate(branch)}
              />
            ))}
          </div>

          {archivedBranches.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Archived Branches</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {archivedBranches.map(branch => (
                  <BranchCard
                    key={branch.id}
                    branch={branch}
                    onEdit={() => openEdit(branch)}
                    onArchive={() => archiveMutation.mutate(branch)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, margin: '0 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>
              {editing ? 'Edit Branch' : 'Add New Branch'}
            </h2>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
            {[
              { key: 'name', label: 'Branch Name *', placeholder: 'e.g. Downtown Branch' },
              { key: 'address', label: 'Address', placeholder: 'Physical location' },
              { key: 'phone', label: 'Phone', placeholder: '+255 7xx xxx xxx' },
              { key: 'manager_name', label: 'Manager Name', placeholder: 'Branch manager' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  value={form[f.key as keyof BranchFormData]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BranchCard({ branch, onEdit, onArchive }: { branch: Branch; onEdit: () => void; onArchive: () => void }) {
  return (
    <div style={{
      background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12,
      padding: 16, opacity: branch.is_active ? 1 : 0.6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{branch.name}</h3>
            {branch.is_main && <Star size={13} style={{ color: '#f59e0b' }} fill="#f59e0b" />}
          </div>
          {!branch.is_active && <span style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>Archived</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }} title="Edit">
            <Edit2 size={14} />
          </button>
          {!branch.is_main && (
            <button onClick={onArchive} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }} title={branch.is_active ? 'Archive' : 'Restore'}>
              <Archive size={14} />
            </button>
          )}
        </div>
      </div>
      {branch.address && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          <MapPin size={13} /> {branch.address}
        </div>
      )}
      {branch.phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          <Phone size={13} /> {branch.phone}
        </div>
      )}
      {branch.manager_name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <Users size={13} /> {branch.manager_name}
        </div>
      )}
    </div>
  )
}
