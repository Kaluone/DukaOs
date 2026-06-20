import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Eye, EyeOff, Users, LogIn } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useStaffSession, hashPin, getOrCreateDeviceId } from '../store/staffSessionStore'
import { useNavigate } from 'react-router-dom'

interface Props {
  shopId: string
  onClose: () => void
}

interface StaffMember {
  id: string
  full_name: string
}

export function StaffHandoffModal({ shopId, onClose }: Props) {
  const { enterStaffMode } = useStaffSession()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ['staff-handoff', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('shop_id', shopId)
        .eq('active', true)
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
  })

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !pin) { setError('Chagua jina na weka PIN'); return }
    setLoading(true); setError('')

    try {
      const pinHash = await hashPin(pin)
      const deviceId = getOrCreateDeviceId()

      const { data, error: rpcErr } = await supabase.rpc('rpc_staff_login', {
        p_shop_id:      shopId,
        p_staff_id:     selectedId,
        p_pin_hash:     pinHash,
        p_device_id:    deviceId,
        p_device_label: navigator.userAgent.substring(0, 150),
      })

      if (rpcErr) throw rpcErr

      enterStaffMode(
        data.staff.id,
        data.staff.full_name,
        data.session_token,
        data.expires_at,
      )
      onClose()
      navigate('/pos')
    } catch (err: any) {
      const msg = err?.message ?? ''
      setError(msg.includes('PIN si sahihi') ? 'PIN si sahihi. Jaribu tena.' : 'Imeshindwa kuingia. Jaribu tena.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: 'var(--color-card)', borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--color-primary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Users size={20} style={{ color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                Mkabidhi Mfanyakazi
              </h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                Mfanyakazi ataona POS tu
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleEnter}>
          {/* Staff list */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>
              Chagua Mfanyakazi
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {staffList.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', padding: 16 }}>
                  Hakuna wafanyakazi walioorodheshwa. Ongeza wafanyakazi kwanza.
                </p>
              ) : (
                staffList.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedId(s.id); setError('') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                      border: `2px solid ${selectedId === s.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: selectedId === s.id ? 'var(--color-primary-light)' : 'var(--color-bg)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: selectedId === s.id ? 'var(--color-primary)' : 'var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      color: selectedId === s.id ? '#fff' : 'var(--color-text-secondary)',
                      flexShrink: 0,
                    }}>
                      {initials(s.full_name)}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                      {s.full_name}
                    </span>
                    {selectedId === s.id && (
                      <span style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--color-primary)' }}>✓</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* PIN input */}
          {selectedId && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                PIN ya Mfanyakazi
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
                  placeholder="Weka PIN"
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px',
                    border: '1.5px solid var(--color-border)', borderRadius: 10,
                    background: 'var(--color-bg)', color: 'var(--color-text)',
                    fontSize: 20, fontWeight: 700, letterSpacing: 6,
                    boxSizing: 'border-box', outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: '#fee2e2', color: '#dc2626',
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              marginBottom: 14, fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '11px 0',
                border: '1.5px solid var(--color-border)', borderRadius: 10,
                background: 'transparent', color: 'var(--color-text)',
                fontWeight: 600, cursor: 'pointer', fontSize: 14,
              }}
            >
              Ghairi
            </button>
            <button
              type="submit"
              disabled={!selectedId || !pin || loading}
              style={{
                flex: 2, padding: '11px 0',
                background: selectedId && pin ? 'var(--color-primary)' : 'var(--color-border)',
                color: selectedId && pin ? '#fff' : 'var(--color-text-secondary)',
                border: 'none', borderRadius: 10, fontWeight: 700,
                cursor: selectedId && pin ? 'pointer' : 'not-allowed',
                fontSize: 14, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
              }}
            >
              <LogIn size={16} />
              {loading ? 'Inathibitisha…' : 'Ingia kama Mfanyakazi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
