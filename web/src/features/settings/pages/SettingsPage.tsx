import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Save, Bell, Shield, Store, Languages, Wifi,
  CheckCircle, XCircle, AlertCircle, Eye, EyeOff,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { useT, useLanguageStore } from '@/shared/i18n/useLanguage'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifPrefs {
  id?: string
  shop_id?: string
  whatsapp_number?: string
  email?: string
  sms_number?: string
  push_enabled: boolean
  whatsapp_enabled: boolean
  sms_enabled: boolean
  email_enabled: boolean
  low_stock_threshold: number
  low_stock_alert: boolean
  daily_digest: boolean
  weekly_digest: boolean
  monthly_digest: boolean
  new_sale_alert: boolean
  expense_alert: boolean
  sale_alert_threshold?: number
}

interface VfdConfig {
  id?: string
  shop_id?: string
  tra_username?: string
  tra_password?: string
  device_serial?: string
  certificate?: string
  api_endpoint: string
  last_test_at?: string
  last_test_ok?: boolean
  last_test_msg?: string
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useNotifPrefs(shopId?: string) {
  return useQuery<NotifPrefs>({
    queryKey: ['notif-prefs', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('shop_id', shopId!)
        .single()
      if (error) throw error
      return data as NotifPrefs
    },
    enabled: !!shopId,
  })
}

function useVfdConfig(shopId?: string) {
  return useQuery<VfdConfig>({
    queryKey: ['vfd-config', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vfd_configs')
        .select('*')
        .eq('shop_id', shopId!)
        .maybeSingle()
      if (error) throw error
      return (data ?? { api_endpoint: 'https://virtual.tra.go.tz/efdmsREST' }) as VfdConfig
    },
    enabled: !!shopId,
  })
}

// ─── Sub-component: Toggle row ────────────────────────────────────────────────

function Toggle({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <span className="toggle-row__label">{label}</span>
        {description && <span className="toggle-row__desc">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? 'toggle--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__knob" />
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuth()
  const { data: shop, refetch: refetchShop } = useShop(user?.id)
  const t = useT()
  const { lang, setLang } = useLanguageStore()
  const qc = useQueryClient()

  // ── Shop Info ──────────────────────────────────────────────────────────────
  const [shopName, setShopName] = useState(shop?.name ?? '')
  const [shopPhone, setShopPhone] = useState(shop?.phone ?? '')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_shopAddress, _setShopAddress] = useState((shop as any)?.address ?? '')
  const [vfdEnabled, setVfdEnabled] = useState(shop?.vfd_enabled ?? false)
  const [shopSaving, setShopSaving] = useState(false)
  const [shopSaved, setShopSaved] = useState(false)

  useEffect(() => {
    if (shop) {
      setShopName(shop.name ?? '')
      setShopPhone(shop.phone ?? '')
      setVfdEnabled(shop.vfd_enabled ?? false)
    }
  }, [shop])

  const handleShopSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setShopSaving(true); setShopSaved(false)
    const { error } = await supabase.from('shops').update({
      name: shopName.trim(),
      phone: shopPhone.trim() || null,
      vfd_enabled: vfdEnabled,
    }).eq('id', shop!.id)
    if (!error) {
      qc.invalidateQueries({ queryKey: ['shop', user?.id] })
      await refetchShop()
      setShopSaved(true)
      setTimeout(() => setShopSaved(false), 3000)
    }
    setShopSaving(false)
  }

  // ── Notification Prefs ─────────────────────────────────────────────────────
  const { data: notifData, isLoading: notifLoading } = useNotifPrefs(shop?.id)
  const [notif, setNotif] = useState<NotifPrefs>({
    push_enabled: true, whatsapp_enabled: false, sms_enabled: false, email_enabled: false,
    low_stock_threshold: 5, low_stock_alert: true,
    daily_digest: true, weekly_digest: false, monthly_digest: false,
    new_sale_alert: false, expense_alert: false,
  })
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)

  useEffect(() => {
    if (notifData) setNotif(prev => ({ ...prev, ...notifData }))
  }, [notifData])

  const setN = <K extends keyof NotifPrefs>(k: K, v: NotifPrefs[K]) =>
    setNotif(prev => ({ ...prev, [k]: v }))

  const handleNotifSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop?.id) return
    setNotifSaving(true); setNotifSaved(false)
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        shop_id: shop.id,
        whatsapp_number:    notif.whatsapp_number?.trim() || null,
        email:              notif.email?.trim() || null,
        sms_number:         notif.sms_number?.trim() || null,
        push_enabled:       notif.push_enabled,
        whatsapp_enabled:   notif.whatsapp_enabled,
        sms_enabled:        notif.sms_enabled,
        email_enabled:      notif.email_enabled,
        low_stock_threshold: Number(notif.low_stock_threshold) || 5,
        low_stock_alert:    notif.low_stock_alert,
        daily_digest:       notif.daily_digest,
        weekly_digest:      notif.weekly_digest,
        monthly_digest:     notif.monthly_digest,
        new_sale_alert:     notif.new_sale_alert,
        expense_alert:      notif.expense_alert,
      }, { onConflict: 'shop_id' })
    if (!error) {
      qc.invalidateQueries({ queryKey: ['notif-prefs', shop.id] })
      setNotifSaved(true)
      setTimeout(() => setNotifSaved(false), 3000)
    }
    setNotifSaving(false)
  }

  // ── VFD Config ─────────────────────────────────────────────────────────────
  const { data: vfdData } = useVfdConfig(shop?.id)
  const [vfd, setVfd] = useState<VfdConfig>({ api_endpoint: 'https://virtual.tra.go.tz/efdmsREST' })
  const [vfdSaving, setVfdSaving] = useState(false)
  const [vfdSaved, setVfdSaved] = useState(false)
  const [vfdTesting, setVfdTesting] = useState(false)
  const [vfdTestResult, setVfdTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showVfdPass, setShowVfdPass] = useState(false)

  useEffect(() => {
    if (vfdData) setVfd(prev => ({ ...prev, ...vfdData }))
  }, [vfdData])

  const setV = <K extends keyof VfdConfig>(k: K, v: VfdConfig[K]) =>
    setVfd(prev => ({ ...prev, [k]: v }))

  const handleVfdSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop?.id) return
    setVfdSaving(true); setVfdSaved(false)
    const { error } = await supabase
      .from('vfd_configs')
      .upsert({
        shop_id: shop.id,
        tra_username:  vfd.tra_username?.trim() || null,
        tra_password:  vfd.tra_password?.trim() || null,
        device_serial: vfd.device_serial?.trim() || null,
        certificate:   vfd.certificate?.trim() || null,
        api_endpoint:  vfd.api_endpoint?.trim() || 'https://virtual.tra.go.tz/efdmsREST',
      }, { onConflict: 'shop_id' })
    if (!error) {
      qc.invalidateQueries({ queryKey: ['vfd-config', shop.id] })
      setVfdSaved(true)
      setTimeout(() => setVfdSaved(false), 3000)
    }
    setVfdSaving(false)
  }

  const handleVfdTest = async () => {
    if (!shop?.id) return
    setVfdTesting(true); setVfdTestResult(null)
    try {
      // Real connection test: POST to VFD endpoint with credentials
      const endpoint = (vfd.api_endpoint ?? '').replace(/\/$/, '')
      const res = await fetch(`${endpoint}/vfdRegReq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          USERNAME: vfd.tra_username,
          TOKEN: vfd.tra_password,
          SERIAL: vfd.device_serial,
        }),
        signal: AbortSignal.timeout(8000),
      })
      const ok = res.status < 500
      const msg = ok ? 'Connection successful' : `HTTP ${res.status}`
      setVfdTestResult({ ok, msg })

      // Persist test result
      await supabase.from('vfd_configs').upsert({
        shop_id: shop.id, last_test_at: new Date().toISOString(),
        last_test_ok: ok, last_test_msg: msg,
      }, { onConflict: 'shop_id' })
      qc.invalidateQueries({ queryKey: ['vfd-config', shop.id] })
    } catch (err: any) {
      const msg = err?.message === 'The operation was aborted.' ? 'Connection timed out' : (err?.message ?? 'Connection failed')
      setVfdTestResult({ ok: false, msg })
      await supabase.from('vfd_configs').upsert({
        shop_id: shop.id, last_test_at: new Date().toISOString(),
        last_test_ok: false, last_test_msg: msg,
      }, { onConflict: 'shop_id' })
    }
    setVfdTesting(false)
  }

  if (!shop) return null

  return (
    <div className="stg">
      <div className="stg__header">
        <h1 className="stg__title">{t('settingsTitle')}</h1>
        <p className="stg__sub">{t('settingsSub')}</p>
      </div>

      {/* ── SHOP INFO ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleShopSave} className="stg-section">
        <div className="stg-section__head">
          <Store size={18} />
          <span>{t('shopInfo')}</span>
        </div>
        <div className="stg-section__body">
          <div className="field-row">
            <div className="field">
              <label className="field__label">{t('shopName')} *</label>
              <input className="field__input" value={shopName} onChange={e => setShopName(e.target.value)} required maxLength={100} />
            </div>
            <div className="field">
              <label className="field__label">{t('phone')}</label>
              <input className="field__input" type="tel" value={shopPhone} onChange={e => setShopPhone(e.target.value)} placeholder="+255 7XX XXX XXX" />
            </div>
          </div>
          <div className="stg-footer">
            {shopSaved && <span className="save-ok"><CheckCircle size={14} /> {t('savedSuccess')}</span>}
            <button type="submit" className="btn-save" disabled={shopSaving}>
              {shopSaving ? <span className="spinner-sm" /> : <Save size={14} />}
              {shopSaving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </form>

      {/* ── LANGUAGE ─────────────────────────────────────────────────────── */}
      <div className="stg-section">
        <div className="stg-section__head">
          <Languages size={18} />
          <span>{t('language')}</span>
        </div>
        <div className="stg-section__body">
          <div className="lang-row">
            <button type="button" className={`lang-btn ${lang === 'sw' ? 'lang-btn--active' : ''}`} onClick={() => setLang('sw')}>
              🇹🇿 {t('langSwahili')}
            </button>
            <button type="button" className={`lang-btn ${lang === 'en' ? 'lang-btn--active' : ''}`} onClick={() => setLang('en')}>
              🇬🇧 {t('langEnglish')}
            </button>
          </div>
        </div>
      </div>

      {/* ── NOTIFICATIONS ────────────────────────────────────────────────── */}
      <form onSubmit={handleNotifSave} className="stg-section">
        <div className="stg-section__head">
          <Bell size={18} />
          <span>{t('notifSection')}</span>
        </div>
        {notifLoading ? (
          <div className="stg-section__body"><div className="spinner-sm" /></div>
        ) : (
          <div className="stg-section__body">

            {/* Channels */}
            <div className="sub-section">
              <h4 className="sub-section__title">Channels</h4>

              <Toggle checked={notif.push_enabled} onChange={v => setN('push_enabled', v)}
                label="Push Notifications" description="Browser/app push notifications" />

              <Toggle checked={notif.whatsapp_enabled} onChange={v => setN('whatsapp_enabled', v)}
                label={t('enableWhatsapp')} description="Send alerts via WhatsApp" />
              {notif.whatsapp_enabled && (
                <div className="field indent-field">
                  <label className="field__label">{t('whatsappNumber')}</label>
                  <input className="field__input" type="tel" value={notif.whatsapp_number ?? ''}
                    onChange={e => setN('whatsapp_number', e.target.value)}
                    placeholder="+255 7XX XXX XXX" />
                </div>
              )}

              <Toggle checked={notif.email_enabled} onChange={v => setN('email_enabled', v)}
                label={t('enableEmail')} description="Send alerts via Email" />
              {notif.email_enabled && (
                <div className="field indent-field">
                  <label className="field__label">{t('emailAddress')}</label>
                  <input className="field__input" type="email" value={notif.email ?? ''}
                    onChange={e => setN('email', e.target.value)}
                    placeholder="you@example.com" />
                </div>
              )}

              <Toggle checked={notif.sms_enabled} onChange={v => setN('sms_enabled', v)}
                label={t('enableSms')} description="Send alerts via SMS" />
              {notif.sms_enabled && (
                <div className="field indent-field">
                  <label className="field__label">{t('smsNumber')}</label>
                  <input className="field__input" type="tel" value={notif.sms_number ?? ''}
                    onChange={e => setN('sms_number', e.target.value)}
                    placeholder="+255 7XX XXX XXX" />
                </div>
              )}
            </div>

            {/* Alert Types */}
            <div className="sub-section">
              <h4 className="sub-section__title">{t('alertsSection')}</h4>

              <Toggle checked={notif.low_stock_alert} onChange={v => setN('low_stock_alert', v)}
                label={t('lowStockAlert')} description="Alert when product reaches reorder level" />
              {notif.low_stock_alert && (
                <div className="field indent-field">
                  <label className="field__label">{t('lowStockThreshold')}</label>
                  <input className="field__input" type="number" min={0} max={9999}
                    value={notif.low_stock_threshold}
                    onChange={e => setN('low_stock_threshold', Number(e.target.value))} />
                  <span className="field__hint">{t('lowStockThresholdHint')}</span>
                </div>
              )}

              <Toggle checked={notif.new_sale_alert} onChange={v => setN('new_sale_alert', v)}
                label={t('newSaleAlert')} description="Notify on every completed sale" />

              <Toggle checked={notif.expense_alert} onChange={v => setN('expense_alert', v)}
                label={t('expenseAlert')} description="Notify when an expense is recorded" />
            </div>

            {/* Digests */}
            <div className="sub-section">
              <h4 className="sub-section__title">{t('digestsSection')}</h4>
              <Toggle checked={notif.daily_digest}   onChange={v => setN('daily_digest', v)}   label={t('dailyDigest')}   description="Daily sales & expense summary" />
              <Toggle checked={notif.weekly_digest}  onChange={v => setN('weekly_digest', v)}  label={t('weeklyDigest')}  description="Weekly business performance summary" />
              <Toggle checked={notif.monthly_digest} onChange={v => setN('monthly_digest', v)} label={t('monthlyDigest')} description="Monthly P&L and stock report" />
            </div>

            <div className="stg-footer">
              {notifSaved && <span className="save-ok"><CheckCircle size={14} /> {t('notifSaved')}</span>}
              <button type="submit" className="btn-save" disabled={notifSaving}>
                {notifSaving ? <span className="spinner-sm" /> : <Save size={14} />}
                {notifSaving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ── VFD / EFD ────────────────────────────────────────────────────── */}
      <form onSubmit={handleVfdSave} className="stg-section">
        <div className="stg-section__head">
          <Shield size={18} />
          <span>{t('vfdSection')}</span>
        </div>
        <div className="stg-section__body">
          {/* Enable toggle */}
          <Toggle checked={vfdEnabled} onChange={setVfdEnabled}
            label={t('vfdEnabled')} description={t('vfdHint')} />

          {vfdEnabled && (
            <>
              <div className="vfd-status-banner">
                {vfdData?.last_test_at ? (
                  vfdData.last_test_ok
                    ? <span className="vfd-ok"><CheckCircle size={14} /> {t('vfdConnected')} — {t('lastTested')}: {format(new Date(vfdData.last_test_at), 'dd/MM/yyyy HH:mm')}</span>
                    : <span className="vfd-fail"><XCircle size={14} /> {vfdData.last_test_msg ?? t('connectionFail')}</span>
                ) : (
                  <span className="vfd-unknown"><AlertCircle size={14} /> {t('vfdNotTested')}</span>
                )}
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field__label">{t('traUsername')}</label>
                  <input className="field__input" value={vfd.tra_username ?? ''}
                    onChange={e => setV('tra_username', e.target.value)}
                    autoComplete="off" placeholder="TRA username" />
                </div>
                <div className="field">
                  <label className="field__label">{t('traPassword')}</label>
                  <div className="pass-wrap">
                    <input className="field__input pass-input"
                      type={showVfdPass ? 'text' : 'password'}
                      value={vfd.tra_password ?? ''}
                      onChange={e => setV('tra_password', e.target.value)}
                      autoComplete="new-password" placeholder="TRA password" />
                    <button type="button" className="pass-eye" onClick={() => setShowVfdPass(v => !v)} aria-label="Toggle password visibility">
                      {showVfdPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field__label">{t('deviceSerial')}</label>
                  <input className="field__input" value={vfd.device_serial ?? ''}
                    onChange={e => setV('device_serial', e.target.value)}
                    placeholder="e.g. ZNZTRXX000001" />
                </div>
                <div className="field">
                  <label className="field__label">{t('apiEndpoint')}</label>
                  <input className="field__input" value={vfd.api_endpoint ?? ''}
                    onChange={e => setV('api_endpoint', e.target.value)}
                    placeholder="https://virtual.tra.go.tz/efdmsREST" />
                </div>
              </div>
              <div className="field">
                <label className="field__label">{t('certificate')} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(Base64)</span></label>
                <textarea className="field__input field__textarea"
                  value={vfd.certificate ?? ''}
                  onChange={e => setV('certificate', e.target.value)}
                  placeholder="Paste Base64-encoded certificate here…"
                  rows={4} />
              </div>

              {vfdTestResult && (
                <div className={`test-result ${vfdTestResult.ok ? 'test-result--ok' : 'test-result--fail'}`}>
                  {vfdTestResult.ok
                    ? <><CheckCircle size={15} /> {t('connectionOk')}</>
                    : <><XCircle size={15} /> {vfdTestResult.msg}</>}
                </div>
              )}
            </>
          )}

          <div className="stg-footer">
            {vfdEnabled && (
              <button type="button" className="btn-test" onClick={handleVfdTest} disabled={vfdTesting}>
                {vfdTesting ? <><span className="spinner-sm" /> {t('testing')}</> : <><Wifi size={14} /> {t('testConnection')}</>}
              </button>
            )}
            {vfdSaved && <span className="save-ok"><CheckCircle size={14} /> {t('savedSuccess')}</span>}
            <button type="submit" className="btn-save" disabled={vfdSaving}>
              {vfdSaving ? <span className="spinner-sm" /> : <Save size={14} />}
              {vfdSaving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </form>

      <style>{`
        .stg { display: flex; flex-direction: column; gap: var(--space-4); max-width: 720px; }
        .stg__header { }
        .stg__title { font-size: 1.6rem; font-weight: 800; }
        .stg__sub { color: var(--color-text-muted); font-size: 0.85rem; margin-top: 2px; }

        .stg-section { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); overflow: hidden; box-shadow: var(--shadow-xs); }
        .stg-section__head { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-5); background: var(--color-surface-2); border-bottom: 1px solid var(--color-border); font-weight: 700; font-size: 0.9rem; }
        .stg-section__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }

        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        @media (max-width: 580px) { .field-row { grid-template-columns: 1fr; } }

        .field { display: flex; flex-direction: column; gap: 4px; }
        .field__label { font-size: 0.82rem; font-weight: 600; }
        .field__input {
          padding: 9px var(--space-4); border: 1.5px solid var(--color-border);
          border-radius: var(--radius-m); font-size: 0.9rem; outline: none;
          background: var(--color-surface); color: var(--color-text);
          transition: border-color var(--transition-fast); width: 100%;
        }
        .field__input:focus { border-color: var(--color-primary); box-shadow: var(--shadow-focus); }
        .field__hint { font-size: 0.72rem; color: var(--color-text-muted); }
        .field__textarea { resize: vertical; font-family: var(--font-mono, monospace); font-size: 0.8rem; min-height: 80px; }

        .indent-field { margin-left: var(--space-5); margin-top: -8px; }

        .sub-section { border: 1px solid var(--color-border); border-radius: var(--radius-m); overflow: hidden; }
        .sub-section__title { font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; padding: var(--space-3) var(--space-4); background: var(--color-surface-2); border-bottom: 1px solid var(--color-border); margin: 0; }

        .toggle-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); }
        .toggle-row:last-child { border-bottom: none; }
        .toggle-row__text { flex: 1; min-width: 0; }
        .toggle-row__label { font-weight: 600; font-size: 0.88rem; display: block; }
        .toggle-row__desc { font-size: 0.75rem; color: var(--color-text-muted); display: block; }

        .toggle { width: 46px; height: 25px; background: var(--color-border-strong); border-radius: var(--radius-full); position: relative; transition: background var(--transition-normal); flex-shrink: 0; cursor: pointer; border: none; }
        .toggle--on { background: var(--color-primary); }
        .toggle__knob { position: absolute; top: 3px; left: 3px; width: 19px; height: 19px; border-radius: 50%; background: #fff; transition: transform var(--transition-normal); box-shadow: 0 1px 3px rgba(0,0,0,0.25); }
        .toggle--on .toggle__knob { transform: translateX(21px); }

        .lang-row { display: flex; gap: var(--space-3); }
        .lang-btn { padding: var(--space-3) var(--space-5); border: 2px solid var(--color-border); border-radius: var(--radius-l); font-size: 0.9rem; font-weight: 600; color: var(--color-text-secondary); background: var(--color-surface); cursor: pointer; transition: all var(--transition-fast); }
        .lang-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .lang-btn--active { border-color: var(--color-primary); background: var(--color-primary); color: #fff; }

        .vfd-status-banner { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-m); font-size: 0.82rem; font-weight: 500; }
        .vfd-ok      { color: var(--color-success); background: var(--color-success-bg, #dcfce7); display: flex; align-items: center; gap: var(--space-2); padding: 8px 12px; border-radius: var(--radius-m); }
        .vfd-fail    { color: var(--color-error);   background: var(--color-error-bg, #fee2e2); display: flex; align-items: center; gap: var(--space-2); padding: 8px 12px; border-radius: var(--radius-m); }
        .vfd-unknown { color: var(--color-warning); background: var(--color-warning-bg, #fef9c3); display: flex; align-items: center; gap: var(--space-2); padding: 8px 12px; border-radius: var(--radius-m); }

        .pass-wrap { position: relative; }
        .pass-input { padding-right: 40px; }
        .pass-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); padding: 2px; cursor: pointer; background: none; border: none; }
        .pass-eye:hover { color: var(--color-primary); }

        .test-result { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-m); font-size: 0.875rem; font-weight: 500; }
        .test-result--ok   { background: var(--color-success-bg, #dcfce7); color: var(--color-success); }
        .test-result--fail { background: var(--color-error-bg, #fee2e2); color: var(--color-error); }

        .stg-footer { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); padding-top: var(--space-2); flex-wrap: wrap; }
        .save-ok { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; color: var(--color-success); font-weight: 500; }

        .btn-save { display: flex; align-items: center; gap: 6px; padding: var(--space-2) var(--space-5); background: var(--color-primary); color: #fff; border-radius: var(--radius-l); font-weight: 600; font-size: 0.88rem; transition: all var(--transition-fast); }
        .btn-save:hover:not(:disabled) { background: var(--color-primary-hover); transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-test { display: flex; align-items: center; gap: 6px; padding: var(--space-2) var(--space-4); border: 1.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); border-radius: var(--radius-l); font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all var(--transition-fast); }
        .btn-test:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
        .btn-test:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; flex-shrink: 0; }
        .btn-test .spinner-sm { border-color: var(--color-border); border-top-color: var(--color-primary); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
