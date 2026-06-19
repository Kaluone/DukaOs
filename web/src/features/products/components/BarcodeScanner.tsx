import { useState, useEffect, useRef, useCallback } from 'react'
import { Scan, Keyboard, Camera, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'

export interface ScanResult {
  name: string
  category: string | null
  price: number | null
  barcode: string
  found: boolean
}

interface Props {
  shopId: string
  onResult: (r: ScanResult) => void
}

// ── Camera sub-component ──────────────────────────────────────────────────────
function CameraScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camErr, setCamErr] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf: number

    const start = async () => {
      if (!('BarcodeDetector' in window)) {
        setCamErr('Kivinjari chako hakisaidii BarcodeDetector API. Tumia Chrome 88+ au tumia USB Scanner.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        // @ts-ignore — BarcodeDetector is not yet in TS lib
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
        })

        const tick = async () => {
          if (videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
            try {
              // @ts-ignore
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0) {
                cancelAnimationFrame(raf)
                stream?.getTracks().forEach(t => t.stop())
                onDetect(codes[0].rawValue as string)
                onClose()
                return
              }
            } catch { /* frame skip */ }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setCamErr('Kamera haiwezi kufunguliwa. Rhusu ufikiaji wa kamera kwenye kivinjari chako.')
      }
    }

    start()
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()) }
  }, [])

  return (
    <div className="cam">
      {camErr ? (
        <div className="cam__err">
          <AlertCircle size={20} />
          <p>{camErr}</p>
          <button type="button" onClick={onClose}>Funga</button>
        </div>
      ) : (
        <div className="cam__wrap">
          <video ref={videoRef} className="cam__video" muted playsInline />
          <div className="cam__overlay">
            <div className="cam__frame" />
            <p className="cam__hint">Elekeza kamera kwenye barcode...</p>
          </div>
          <button type="button" className="cam__close" onClick={onClose}>
            <X size={14} /> Funga Kamera
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main BarcodeScanner ───────────────────────────────────────────────────────
export function BarcodeScanner({ shopId, onResult }: Props) {
  const [mode, setMode] = useState<'idle' | 'usb' | 'camera'>('idle')
  const [inputVal, setInputVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === 'usb') {
      // Small delay so the element is rendered before focus
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [mode])

  const lookup = useCallback(async (raw: string) => {
    const barcode = raw.trim()
    if (!barcode) return
    setLoading(true)
    setStatus(null)

    // 1. Search this shop's own products by barcode
    const { data: own } = await supabase
      .from('products')
      .select('name, category, price, barcode')
      .eq('shop_id', shopId)
      .eq('barcode', barcode)
      .limit(1)

    if (own?.[0]) {
      setStatus({ type: 'ok', msg: `✓ "${own[0].name}" imepatikana kwenye duka lako!` })
      onResult({ name: own[0].name, category: own[0].category, price: own[0].price, barcode, found: true })
      setLoading(false)
      setInputVal('')
      setMode('idle')
      return
    }

    // 2. Search the global product catalog (all shops) — cross-shop name lookup
    const { data: global } = await supabase
      .from('products')
      .select('name, category')
      .eq('barcode', barcode)
      .limit(1)

    if (global?.[0]) {
      setStatus({ type: 'ok', msg: `✓ Imepatikana kwenye katalogi: "${global[0].name}"` })
      onResult({ name: global[0].name, category: global[0].category, price: null, barcode, found: true })
      setLoading(false)
      setInputVal('')
      setMode('idle')
      return
    }

    // 3. Not found — pass barcode through so user fills manually
    setStatus({ type: 'err', msg: `Barcode "${barcode}" haikupatikana. Jaza jina la bidhaa kwa mkono.` })
    onResult({ name: '', category: null, price: null, barcode, found: false })
    setLoading(false)
    setInputVal('')
  }, [shopId, onResult])

  const reset = () => { setMode('idle'); setInputVal(''); setStatus(null) }

  return (
    <div className="bs">
      {/* ── Button group (idle) ── */}
      {mode === 'idle' && (
        <div className="bs__btns">
          <button type="button" className="bs__btn" onClick={() => setMode('usb')}>
            <Keyboard size={13} />
            <span>USB Scanner / Ingiza Barcode</span>
          </button>
          <button type="button" className="bs__btn" onClick={() => setMode('camera')}>
            <Camera size={13} />
            <span>Scan kwa Kamera</span>
          </button>
        </div>
      )}

      {/* ── USB / manual input ── */}
      {mode === 'usb' && (
        <div className="bs__row">
          <Scan size={15} className="bs__icon" />
          <input
            ref={inputRef}
            className="bs__input"
            type="text"
            placeholder="Scan barcode au andika nambari, kisha Enter..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup(inputVal)}
            disabled={loading}
            autoComplete="off"
          />
          <button
            type="button"
            className="bs__go"
            onClick={() => lookup(inputVal)}
            disabled={loading || !inputVal.trim()}
          >
            {loading ? <Loader2 size={13} className="bs__spin" /> : 'Tafuta'}
          </button>
          <button type="button" className="bs__x" onClick={reset} title="Funga">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Camera mode ── */}
      {mode === 'camera' && (
        <CameraScanner onDetect={lookup} onClose={reset} />
      )}

      {/* ── Status message ── */}
      {status && (
        <p className={`bs__status bs__status--${status.type}`}>
          {status.type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
          {status.msg}
        </p>
      )}

      <style>{`
        .bs { display:flex; flex-direction:column; gap:8px; }

        .bs__btns { display:flex; gap:8px; flex-wrap:wrap; }
        .bs__btn {
          display:flex; align-items:center; gap:6px;
          padding:6px 13px;
          border-radius:var(--radius-m);
          border:1.5px dashed var(--color-border);
          font-size:0.78rem; font-weight:500;
          color:var(--color-text-secondary);
          background:var(--color-bg);
          cursor:pointer;
          transition:all 150ms;
        }
        .bs__btn:hover { border-color:var(--color-primary); color:var(--color-primary); border-style:solid; background:var(--color-primary-light); }

        .bs__row {
          display:flex; align-items:center; gap:8px;
          background:var(--color-bg);
          border:1.5px solid var(--color-primary);
          border-radius:var(--radius-m);
          padding:7px 12px;
          box-shadow:0 0 0 3px var(--color-primary-light);
        }
        .bs__icon { color:var(--color-primary); flex-shrink:0; }
        .bs__input {
          flex:1; border:none; background:none; outline:none;
          font-size:0.875rem; color:var(--color-text); min-width:0;
        }
        .bs__go {
          padding:4px 12px;
          background:var(--color-primary); color:#fff;
          border-radius:var(--radius-s);
          font-size:0.78rem; font-weight:600;
          display:flex; align-items:center; gap:4px;
          transition:background 150ms;
          flex-shrink:0;
        }
        .bs__go:disabled { opacity:.5; cursor:not-allowed; }
        .bs__x { color:var(--color-text-muted); padding:3px; border-radius:var(--radius-s); transition:color 150ms; flex-shrink:0; }
        .bs__x:hover { color:var(--color-error); }

        @keyframes bs-spin { to { transform:rotate(360deg); } }
        .bs__spin { animation:bs-spin 700ms linear infinite; }

        .bs__status {
          display:flex; align-items:center; gap:6px;
          font-size:0.8rem; padding:7px 11px;
          border-radius:var(--radius-m);
        }
        .bs__status--ok { background:#d1fae5; color:#065f46; }
        .bs__status--err { background:#fef2f2; color:#991b1b; }

        /* Camera */
        .cam { border-radius:var(--radius-l); overflow:hidden; border:1.5px solid var(--color-border); }
        .cam__wrap { position:relative; background:#000; }
        .cam__video { width:100%; max-height:220px; object-fit:cover; display:block; }
        .cam__overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; }
        .cam__frame { width:200px; height:90px; border:3px solid var(--color-primary); border-radius:8px; box-shadow:0 0 0 2000px rgba(0,0,0,0.45); }
        .cam__hint { color:#fff; font-size:0.78rem; font-weight:500; text-shadow:0 1px 4px rgba(0,0,0,0.9); }
        .cam__close {
          position:absolute; bottom:10px; right:10px;
          display:flex; align-items:center; gap:5px;
          padding:5px 12px; background:rgba(0,0,0,0.65); color:#fff;
          border-radius:var(--radius-m); font-size:0.78rem; font-weight:500;
          transition:background 150ms;
        }
        .cam__close:hover { background:rgba(0,0,0,0.85); }
        .cam__err {
          display:flex; flex-direction:column; align-items:center; gap:12px;
          padding:28px 20px; text-align:center;
          background:var(--color-error-bg); color:var(--color-error);
        }
        .cam__err p { font-size:0.83rem; line-height:1.5; max-width:280px; }
        .cam__err button { padding:6px 18px; background:var(--color-error); color:#fff; border-radius:var(--radius-m); font-size:0.82rem; font-weight:600; }
      `}</style>
    </div>
  )
}
