import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Shield, AlertCircle, Lock, Mail } from 'lucide-react'
import { useARCSignIn } from './useARCAuth'
import { ARCLogo } from './ARCLogo'

export function ARCLoginPage() {
  const navigate = useNavigate()
  const signIn = useARCSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signIn.mutateAsync({ email, password })
      navigate('/arc/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.message ?? 'Login failed. Please check your credentials.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a35 50%, #0a1628 100%)',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 420, padding: '24px 20px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            filter: 'drop-shadow(0 0 32px rgba(59,130,246,0.35))',
          }}>
            <ARCLogo size={64} showText={false} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                AutoRevenue Labs
              </div>
              <div style={{ color: '#3b82f6', fontSize: 11, marginTop: 4, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                Control Center
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(51,65,85,0.8)',
          borderRadius: 20, padding: '36px 32px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.1)',
        }}>
          <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            Staff Access Portal
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 28 }}>
            Restricted to authorized AutoRevenue Labs personnel only.
          </p>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 20,
            }}>
              <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email Address
              </span>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@autorevenuelabs.com"
                  style={{
                    width: '100%', padding: '11px 14px 11px 40px', boxSizing: 'border-box',
                    background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.8)',
                    borderRadius: 10, color: '#f1f5f9', fontSize: 14, outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = 'rgba(51,65,85,0.8)'}
                />
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password
              </span>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type={show ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••••••"
                  style={{
                    width: '100%', padding: '11px 44px 11px 40px', boxSizing: 'border-box',
                    background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.8)',
                    borderRadius: 10, color: '#f1f5f9', fontSize: 14, outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = 'rgba(51,65,85,0.8)'}
                />
                <button type="button" onClick={() => setShow(p => !p)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4,
                }}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <button type="submit" disabled={signIn.isPending} style={{
              marginTop: 8, padding: '13px',
              background: signIn.isPending
                ? 'rgba(59,130,246,0.5)'
                : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 14,
              fontWeight: 700, cursor: signIn.isPending ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
              transition: 'all 0.2s', letterSpacing: '0.02em',
            }}>
              {signIn.isPending ? 'Authenticating…' : 'Access Control Center'}
            </button>
          </form>

          <div style={{
            marginTop: 24, padding: '12px 14px',
            background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
            borderRadius: 10,
          }}>
            <p style={{ color: '#ca8a04', fontSize: 12, margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Shield size={13} /> All access is monitored and logged. Unauthorized access is prohibited.
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 24 }}>
          © {new Date().getFullYear()} AutoRevenue Labs. DukaOS Platform v2.0
        </p>
      </div>
    </div>
  )
}
