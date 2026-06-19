import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Code, Plus, Key, Webhook, Trash2, Copy, CheckCircle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

type Tab = 'keys' | 'webhooks' | 'docs'

interface APIKey {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  is_active: boolean
  created_at: string
}

const WEBHOOK_EVENTS = [
  'sale.created', 'sale.updated', 'sale.refunded',
  'purchase.created', 'customer.created', 'stock.changed',
  'subscription.updated',
]

export function DeveloperPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('keys')
  const [newKeyName, setNewKeyName] = useState('')

  const [generatedKey, setGeneratedKey] = useState('')
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', events: [] as string[] })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: apiKeys = [] } = useQuery<APIKey[]>({
    queryKey: ['api-keys', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('api_keys').select('id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at').eq('shop_id', shop!.id).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as APIKey[]
    },
  })

  const { data: webhooks = [] } = useQuery<Webhook[]>({
    queryKey: ['webhooks', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('webhooks').select('id, name, url, events, is_active, created_at').eq('shop_id', shop!.id).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Webhook[]
    },
  })

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      if (!shop?.id) throw new Error('No shop')
      if (!name.trim()) throw new Error('Key name required')
      // Generate a random API key
      const raw = `duka_${Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')}`
      const prefix = raw.slice(0, 12)
      // Store hash of full key (SHA-256)
      const enc = new TextEncoder().encode(raw)
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc)
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
      const { error } = await supabase.from('api_keys').insert({
        shop_id: shop.id, name: name.trim(), key_prefix: prefix, key_hash: hashHex, permissions: ['read'],
      })
      if (error) throw error
      return raw
    },
    onSuccess: (key) => {
      setGeneratedKey(key)
      qc.invalidateQueries({ queryKey: ['api-keys', shop?.id] })
      setNewKeyName('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('api_keys').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys', shop?.id] }),
  })

  const saveWebhook = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      if (!webhookForm.name.trim() || !webhookForm.url.trim()) throw new Error('Name and URL required')
      if (!webhookForm.url.startsWith('https://')) throw new Error('URL must use HTTPS')
      if (webhookForm.events.length === 0) throw new Error('Select at least one event')
      const { error } = await supabase.from('webhooks').insert({
        shop_id: shop.id, name: webhookForm.name.trim(), url: webhookForm.url.trim(), events: webhookForm.events,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', shop?.id] })
      setShowWebhookModal(false)
      setWebhookForm({ name: '', url: '', events: [] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhooks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks', shop?.id] }),
  })

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000) })
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Code size={22} style={{ color: 'var(--color-primary)' }} /> Developer API
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>Manage API keys and webhooks for integrations</p>

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--color-bg)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {(['keys', 'webhooks', 'docs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--color-card)' : 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, fontSize: 14, textTransform: 'capitalize' }}>
            {t === 'keys' ? <><Key size={13} style={{ marginRight: 6 }} />API Keys</> : t === 'webhooks' ? <><Webhook size={13} style={{ marginRight: 6 }} />Webhooks</> : 'Documentation'}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <>
          {generatedKey && (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 700, color: '#166534', marginBottom: 6 }}>API Key Created — Save it now!</p>
              <p style={{ fontSize: 12, color: '#166534', marginBottom: 8 }}>This key will only be shown once. Store it securely.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontFamily: 'monospace', background: '#fff', padding: '8px 12px', borderRadius: 6, fontSize: 13, wordBreak: 'break-all' }}>{generatedKey}</code>
                <button onClick={() => copyToClipboard(generatedKey, 'gen')} style={{ padding: '8px', background: '#166534', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  {copiedId === 'gen' ? <CheckCircle size={15} /> : <Copy size={15} />}
                </button>
              </div>
              <button onClick={() => setGeneratedKey('')} style={{ marginTop: 8, fontSize: 12, color: '#166534', background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKey.mutate(newKeyName)}
              placeholder="Key name (e.g. Production Key)"
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}
            />
            <button onClick={() => createKey.mutate(newKeyName)} disabled={createKey.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={15} /> Generate Key
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}><Key size={36} style={{ opacity: 0.3, marginBottom: 8 }} /><p>No API keys yet</p></div>
          ) : (
            apiKeys.map(k => (
              <div key={k.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 8, opacity: k.is_active ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {k.name}
                      <span style={{ fontSize: 11, fontWeight: 600, color: k.is_active ? '#16a34a' : '#dc2626' }}>{k.is_active ? 'Active' : 'Revoked'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      <code style={{ fontFamily: 'monospace' }}>{k.key_prefix}…</code>
                      {k.last_used_at && ` · Last used: ${format(new Date(k.last_used_at), 'dd MMM yyyy')}`}
                      {` · Created: ${format(new Date(k.created_at), 'dd MMM yyyy')}`}
                    </div>
                  </div>
                  {k.is_active && (
                    <button onClick={() => revokeKey.mutate(k.id)} style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Trash2 size={13} /> Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'webhooks' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => { setShowWebhookModal(true); setError('') }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={15} /> Add Webhook
            </button>
          </div>

          {webhooks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}><Webhook size={36} style={{ opacity: 0.3, marginBottom: 8 }} /><p>No webhooks configured</p></div>
          ) : (
            webhooks.map(w => (
              <div key={w.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', marginBottom: 2 }}>{w.name}</div>
                    <code style={{ fontSize: 12, color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{w.url}</code>
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {w.events.map(e => <span key={e} style={{ fontSize: 11, background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{e}</span>)}
                    </div>
                  </div>
                  <button onClick={() => deleteWebhook.mutate(w.id)} style={{ padding: '6px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}

          {showWebhookModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, margin: '0 16px' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>Add Webhook</h2>
                {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
                {[
                  { key: 'name', label: 'Webhook Name', placeholder: 'e.g. Inventory Sync' },
                  { key: 'url', label: 'Endpoint URL (HTTPS)', placeholder: 'https://your-server.com/webhook' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input value={webhookForm[f.key as keyof typeof webhookForm] as string} onChange={e => setWebhookForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                ))}
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>Events to Listen</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {WEBHOOK_EVENTS.map(ev => (
                    <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={webhookForm.events.includes(ev)} onChange={e => setWebhookForm(p => ({ ...p, events: e.target.checked ? [...p.events, ev] : p.events.filter(x => x !== ev) }))} />
                      <code style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>{ev}</code>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowWebhookModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => saveWebhook.mutate()} disabled={saveWebhook.isPending} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                    {saveWebhook.isPending ? 'Saving…' : 'Create Webhook'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'docs' && (
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>REST API Documentation</h3>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Authenticate all requests with your API key in the <code style={{ fontFamily: 'monospace', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>Authorization</code> header:
          </p>
          <code style={{ display: 'block', background: 'var(--color-bg)', padding: '12px 16px', borderRadius: 8, fontFamily: 'monospace', fontSize: 13, marginBottom: 16, wordBreak: 'break-all' }}>
            Authorization: Bearer duka_xxxxxxxxxxxxxxxx
          </code>
          {[
            { method: 'GET', path: '/api/v1/products', desc: 'List all products' },
            { method: 'GET', path: '/api/v1/customers', desc: 'List all customers' },
            { method: 'GET', path: '/api/v1/sales', desc: 'List sales transactions' },
            { method: 'GET', path: '/api/v1/stock', desc: 'Current stock levels' },
            { method: 'GET', path: '/api/v1/reports/pnl', desc: 'Profit & Loss summary' },
            { method: 'POST', path: '/api/v1/sales', desc: 'Create a new sale' },
          ].map(ep => (
            <div key={ep.path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: ep.method === 'GET' ? '#16a34a' : '#3b82f6', background: ep.method === 'GET' ? '#dcfce7' : '#dbeafe', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', width: 40, textAlign: 'center' }}>{ep.method}</span>
              <code style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-text)', flex: 1 }}>{ep.path}</code>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{ep.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
