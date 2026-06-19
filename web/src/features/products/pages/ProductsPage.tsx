import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, Pencil, Trash2, X, Upload, ChevronRight, Check, FileSpreadsheet, Store, Camera, AlertCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { useT, useLanguageStore } from '@/shared/i18n/useLanguage'
import { BulkImport } from '../components/BulkImport'

// ─── Shop type definitions ────────────────────────────────────────────────────
export const SHOP_TYPE_DEFS: Record<string, { label: string; enLabel: string; emoji: string; groups: string[] | null }> = {
  grocery:     { label: 'Duka la Vyakula',       enLabel: 'Grocery Shop',        emoji: '🛒', groups: ['Nafaka & Mazao','Vinywaji','Chakula & Mbogamboga','Vifaa vya Nyumba','Mchanganyiko'] },
  pharmacy:    { label: 'Duka la Dawa',           enLabel: 'Pharmacy',            emoji: '💊', groups: ['Dawa & Afya','Vipodozi & Urembo','Mchanganyiko'] },
  electronics: { label: 'Duka la Elektroniki',    enLabel: 'Electronics Shop',    emoji: '📺', groups: ['Televisheni & Redio','Simu & Accessories','Vifaa vya Umeme','Mchanganyiko'] },
  clothing:    { label: 'Duka la Nguo',           enLabel: 'Clothing Shop',       emoji: '👗', groups: ['Nguo & Mavazi','Vipodozi & Urembo','Mchanganyiko'] },
  hardware:    { label: 'Duka la Vifaa',          enLabel: 'Hardware Shop',       emoji: '🔨', groups: ['Vifaa vya Ujenzi','Vifaa vya Nyumba','Vifaa vya Umeme','Kilimo & Mbolea','Mchanganyiko'] },
  bar:         { label: 'Bar / Baa',              enLabel: 'Bar / Pub',           emoji: '🍺', groups: ['Vinywaji','Chakula & Mbogamboga','Burudani & Michezo','Mchanganyiko'] },
  agriculture: { label: 'Duka la Kilimo',         enLabel: 'Agriculture Shop',    emoji: '🌿', groups: ['Kilimo & Mbolea','Nafaka & Mazao','Mifugo & Bidhaa Zake','Vifaa vya Nyumba','Mchanganyiko'] },
  stationery:  { label: 'Duka la Stationery',     enLabel: 'Stationery Shop',     emoji: '📚', groups: ['Stationery & Shule','Burudani & Michezo','Mchanganyiko'] },
  beauty:      { label: 'Salon / Urembo',         enLabel: 'Salon / Beauty',      emoji: '💄', groups: ['Vipodozi & Urembo','Dawa & Afya','Nguo & Mavazi','Mchanganyiko'] },
  general:     { label: 'Duka la Jumla',          enLabel: 'General Shop',        emoji: '🏪', groups: null },
}

// ─── Business category groups ─────────────────────────────────────────────────
export const BUSINESS_GROUPS = [
  {
    group: 'Nafaka & Mazao', en: 'Grains & Crops', emoji: '🌾', color: '#92400e',
    categories: ['Unga wa Ngano','Unga wa Sembe','Unga wa Mahindi','Mchele','Mahindi','Dona','Shayiri','Soya','Dengu','Maharagwe','Ufuta','Karanga','Kunde','Choroko','Njegere','Mtama','Ulezi','Viazi Vitamu','Muhogo','Ndizi Ghafi'],
    aliases: { 'Unga wa Sembe': ['sembe','unga'], 'Mchele': ['rice','wali'], 'Mahindi': ['corn','mahindi'] },
  },
  {
    group: 'Vinywaji', en: 'Beverages', emoji: '🥤', color: '#0891b2',
    categories: ['Maji ya Kunywa (Chupa)','Maji ya Kunywa (Ndoo)','Soda','Juisi ya Matunda','Maziwa','Chai','Kahawa','Bia','Divai','Pombe ya Kienyeji','Vinywaji vya Nishati','Maji ya Madini','Yogurt'],
    aliases: { 'Soda': ['soda','coke','fanta','pepsi','sprite'], 'Bia': ['beer','pombe'], 'Juisi ya Matunda': ['juice','juisi'] },
  },
  {
    group: 'Chakula & Mbogamboga', en: 'Food & Vegetables', emoji: '🥗', color: '#16a34a',
    categories: ['Nyama ya Ng\'ombe','Nyama ya Kuku','Nyama ya Nguruwe','Samaki (Safi)','Samaki (Kavu)','Mayai','Mboga (Mchanganyiko)','Spinachi','Nyanya','Vitunguu','Viazi','Pilipili Hoho','Limao','Mafuta ya Kupika','Chumvi','Sukari','Asali','Mkate','Chapati','Pilau/Biryani'],
    aliases: { 'Nyama ya Ng\'ombe': ['nyama','beef'], 'Nyama ya Kuku': ['kuku','chicken'], 'Samaki (Safi)': ['samaki','fish'] },
  },
  {
    group: 'Nguo & Mavazi', en: 'Clothing & Apparel', emoji: '👗', color: '#7c3aed',
    categories: ['Shati la Wanaume','Shati la Wanawake','Suruali ya Wanaume','Suruali ya Wanawake','Gauni','Kanga','Kitenge','Leso','T-Shirt','Sketi','Blauzi','Jaketi','Kanzu','Buibui','Viatu vya Wanaume','Viatu vya Wanawake','Viatu vya Watoto','Soksi','Kofia','Mkoba wa Mikono','Mkoba wa Mgongoni','Ngouo za Ndani'],
    aliases: { 'Shati la Wanaume': ['shati','shirt'], 'Suruali ya Wanaume': ['suruali','trouser','jeans'], 'Viatu vya Wanaume': ['viatu','shoes'] },
  },
  {
    group: 'Dawa & Afya', en: 'Medicine & Health', emoji: '💊', color: '#dc2626',
    categories: ['Paracetamol','Ibuprofen','Dawa za Malaria','Dawa za Homa','Vitamini C','Vitamini D','Zinc Tablets','Plaster','Pamba ya Matibabu','Bandage','Sabuni ya Mikono','Sanitizer','Mask ya Uso','Dawa za Tumbo','Dawa za Mtoto','ORS','Condom','Dawa za Jicho','Thermometer','Pressure Machine'],
    aliases: { 'Paracetamol': ['panadol','para','maumivu'], 'Dawa za Malaria': ['malaria','alu','coartem'], 'Sanitizer': ['sanitizer','hand gel'] },
  },
  {
    group: 'Vipodozi & Urembo', en: 'Cosmetics & Beauty', emoji: '💄', color: '#db2777',
    categories: ['Sabuni ya Kuoga','Shampoo','Conditioner','Mafuta ya Nywele','Cream ya Ngozi','Losheni','Deodorant','Perfume / Marashi','Wanja','Rangi ya Midomo (Lipstick)','Foundation','Poda ya Uso','Mascara','Dawa ya Meno','Mswaki','Razor / Wembe','Pads za Kike','Pampers / Diapers','Vipodozi vya Watoto'],
    aliases: { 'Sabuni ya Kuoga': ['sabuni','soap'], 'Shampoo': ['shampoo','nywele'], 'Perfume / Marashi': ['perfume','marashi'] },
  },
  {
    group: 'Televisheni & Redio', en: 'TV & Radio', emoji: '📺', color: '#1d4ed8',
    categories: ['Televisheni (TV) 24"','Televisheni (TV) 32"','Televisheni (TV) 43"','Televisheni (TV) 55"','Redio ya Mkono','Redio ya Nyumbani','Decoder / Set-Top Box','Antenna ya TV','DVD Player','Speaker / Subwoofer','Home Theater','Projector','Remote ya TV'],
    aliases: { 'Televisheni (TV) 32"': ['tv','tivi','television','runinga'], 'Redio ya Nyumbani': ['radio','redio'], 'Decoder / Set-Top Box': ['decoder','setop','dstv','azam'] },
  },
  {
    group: 'Simu & Accessories', en: 'Phones & Accessories', emoji: '📱', color: '#2563eb',
    categories: ['Simu ya Android','Simu ya iPhone','Simu ya Kawaida (Feature Phone)','Charger ya Simu','Earphones','Bluetooth Earbuds','Power Bank','USB Cable','Memory Card / SD Card','Screen Protector','Phone Case','SIM Card','Huawei / Techno / Infinix','Kipande cha Simu (Spare Part)'],
    aliases: { 'Simu ya Android': ['simu','phone','android','smartphone'], 'Charger ya Simu': ['charger','chaja'], 'Earphones': ['earphones','headset','masikio'] },
  },
  {
    group: 'Vifaa vya Umeme', en: 'Electrical Appliances', emoji: '⚡', color: '#ca8a04',
    categories: ['Jokofu (Fridge)','Friza (Freezer)','Kiyoyozi (AC)','Feni ya Ukutani','Feni ya Meza','Mashine ya Kufulia','Blender / Juicer','Jiko la Umeme','Kettle ya Umeme','Iron ya Nguo','Jenereta','Betri za Tochi','Tochi ya Mkono','Bulb ya LED','Extension ya Nyumbani','Adaptor / Inverter','Solar Panel','Betri ya Solar'],
    aliases: { 'Jokofu (Fridge)': ['fridge','jokofu','baridi','refrigerator'], 'Kiyoyozi (AC)': ['ac','kiyoyozi','baridi ya chumba'], 'Mashine ya Kufulia': ['washing machine','laundry','kufulia'], 'Feni ya Ukutani': ['fan','feni','upepo'] },
  },
  {
    group: 'Vifaa vya Nyumba', en: 'Household Items', emoji: '🏠', color: '#78716c',
    categories: ['Sufuria ya Kupikia','Jiko la Mkaa','Ndoo ya Maji','Beseni','Karai','Sahani','Vikombe','Kisu cha Jikoni','Godoro','Mto','Blanketi','Shuka','Pazia','Neti ya Mbu','Kiti','Meza ya Jikoni','Jipu / Flask','Chupa ya Maji'],
    aliases: { 'Sufuria ya Kupikia': ['sufuria','pot'], 'Godoro': ['godoro','mattress'], 'Neti ya Mbu': ['neti','mosquito net'] },
  },
  {
    group: 'Stationery & Shule', en: 'Stationery & School', emoji: '📚', color: '#0f766e',
    categories: ['Kalamu ya Wino','Penseli','Daftari la A4','Daftari la A5','Daftari la Exercise','Kitabu cha Hesabu','Ruler','Eraser','Selotape','Stapler & Vipande','Mfuko wa Shule','Karatasi A4','Calculator','Gundi','Rangi za Kuchora','Compass ya Hisabati'],
    aliases: { 'Kalamu ya Wino': ['kalamu','pen','biro'], 'Daftari la Exercise': ['daftari','notebook','exercise book'], 'Mfuko wa Shule': ['bag','mfuko','school bag'] },
  },
  {
    group: 'Kilimo & Mbolea', en: 'Agriculture & Fertilizer', emoji: '🌿', color: '#4d7c0f',
    categories: ['Mbolea ya Urea','Mbolea ya DAP','Mbolea ya CAN','Mbegu za Mahindi','Mbegu za Mboga','Mbegu za Nyanya','Dawa ya Wadudu','Dawa ya Ukungu','Jembe la Mkono','Panga','Visu vya Shamba','Mfuko wa Mazao','Pampu ya Dawa ya Shamba','Nyuzi za Tying'],
    aliases: { 'Mbolea ya Urea': ['urea','mbolea'], 'Dawa ya Wadudu': ['pesticide','wadudu'] },
  },
  {
    group: 'Vifaa vya Ujenzi', en: 'Construction Materials', emoji: '🔨', color: '#374151',
    categories: ['Saruji','Mchanga','Kokoto / Changarawe','Chuma cha Ujenzi (Rod)','Mbao','Rangi ya Nje','Rangi ya Ndani','Thinner','Msumari','Waya wa Umeme','Bomba la PVC','Bomba la PPR','Tile ya Sakafu','Tile ya Ukuta','Glasi','Kufuli & Ufunguo','Hinge ya Mlango','Cement Board','Gypsum Board'],
    aliases: { 'Saruji': ['cement','saruji'], 'Chuma cha Ujenzi (Rod)': ['chuma','iron rod','rod'], 'Rangi ya Nje': ['rangi','paint'] },
  },
  {
    group: 'Mifugo & Bidhaa Zake', en: 'Livestock & Products', emoji: '🐄', color: '#92400e',
    categories: ['Maziwa Safi (Lita)','Maziwa ya Unga','Jibini / Cheese','Samli / Ghee','Dawa ya Mifugo','Chanjo ya Mifugo','Chakula cha Ng\'ombe','Chakula cha Kuku (Mash)','Chakula cha Kuku (Grower)','Chakula cha Nguruwe','Mayai ya Kuku (Tray)'],
    aliases: { 'Maziwa Safi (Lita)': ['maziwa','milk'], 'Mayai ya Kuku (Tray)': ['mayai','eggs','tray'] },
  },
  {
    group: 'Burudani & Michezo', en: 'Entertainment & Sports', emoji: '🎮', color: '#6d28d9',
    categories: ['Mpira wa Miguu','Mpira wa Kikapu','Mpira wa Nyavu','Toys za Watoto','Mchezo wa Bao','Kadi za Mchezo','Puzzle ya Watoto','Muziki (USB/Bluetooth)','Vitabu vya Kusomwa','Magazeti','Mapambo ya Nyumba','Saa ya Ukutani','Saa ya Mkono'],
    aliases: { 'Mpira wa Miguu': ['mpira','football','ball'], 'Saa ya Mkono': ['saa','watch'], 'Magazeti': ['gazeti','newspaper'] },
  },
  {
    group: 'Mchanganyiko', en: 'Miscellaneous', emoji: '📦', color: '#475569',
    categories: ['Bidhaa Mchanganyiko','Zawadi / Gift','Bidhaa za Sherehe','Bidhaa Nyingine'],
    aliases: {},
  },
]

// ─── i18n helpers for domain data ────────────────────────────────────────────
function groupLabel(g: { group: string; en: string }, lang: string) {
  return lang === 'en' ? g.en : g.group
}
function shopTypeLabel(def: { label: string; enLabel: string }, lang: string) {
  return lang === 'en' ? def.enLabel : def.label
}

// ─── Alias-aware search ───────────────────────────────────────────────────────
function buildAliasMap() {
  const map: Record<string, string[]> = {}
  for (const g of BUSINESS_GROUPS) {
    for (const [cat, aliases] of Object.entries(g.aliases as Record<string, string[]>)) {
      map[cat] = aliases
    }
  }
  return map
}
const ALIAS_MAP = buildAliasMap()

function matchesSearch(name: string, category: string | null, groupName: string | undefined, term: string): boolean {
  const t = term.toLowerCase().trim()
  if (!t) return true
  if (name.toLowerCase().includes(t)) return true
  if (category?.toLowerCase().includes(t)) return true
  if (groupName?.toLowerCase().includes(t)) return true
  const aliases = category ? (ALIAS_MAP[category] ?? []) : []
  return aliases.some(a => a.includes(t) || t.includes(a))
}

export function getCatInfo(catName: string | null) {
  if (!catName) return null
  for (const g of BUSINESS_GROUPS) {
    if (g.categories.includes(catName)) return { cat: catName, group: g.group, en: g.en, emoji: g.emoji, color: g.color }
  }
  return { cat: catName, group: 'Mchanganyiko', en: 'Miscellaneous', emoji: '📦', color: '#475569' }
}

// ─── Visual 2-step category picker ───────────────────────────────────────────
function CategoryPicker({ value, onChange, shopType }: { value: string; onChange: (v: string) => void; shopType?: string | null }) {
  const t = useT()
  const { lang } = useLanguageStore()
  const [step, setStep] = useState<'group' | 'cat'>('group')
  const [selectedGroup, setSelectedGroup] = useState<typeof BUSINESS_GROUPS[0] | null>(() =>
    value ? (BUSINESS_GROUPS.find(g => g.categories.includes(value)) ?? null) : null
  )
  const [catSearch, setCatSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Filter groups based on shop type
  const shopDef = shopType ? SHOP_TYPE_DEFS[shopType] : null
  const filteredGroups = (!showAll && shopDef?.groups)
    ? BUSINESS_GROUPS.filter(g => shopDef.groups!.includes(g.group))
    : BUSINESS_GROUPS
  const hasFilter = !!(shopDef?.groups && !showAll)

  const pickGroup = (g: typeof BUSINESS_GROUPS[0]) => { setSelectedGroup(g); setStep('cat'); setCatSearch('') }
  const pickCat = (c: string) => { onChange(c) }
  const clear = () => { onChange(''); setStep('group'); setSelectedGroup(null); setCatSearch('') }

  const filteredCats = selectedGroup
    ? selectedGroup.categories.filter(c => {
        const t = catSearch.toLowerCase()
        if (!t) return true
        if (c.toLowerCase().includes(t)) return true
        const aliases = (selectedGroup.aliases as Record<string, string[]>)[c] ?? []
        return aliases.some(a => a.includes(t) || t.includes(a))
      })
    : []

  return (
    <div className="cat-picker">
      {/* Selected display */}
      {value && (
        <div className="cat-picker__selected">
          {(() => { const i = getCatInfo(value); return i ? (<><span style={{ color: i.color }}>{i.emoji} {groupLabel(i, lang)}</span><ChevronRight size={12}/><strong>{value}</strong></>) : value })()}
          <button type="button" className="cat-picker__clear" onClick={clear}><X size={14}/></button>
        </div>
      )}

      {/* Shop type filter banner */}
      {shopDef?.groups && (
        <div className="cat-type-banner">
          <span>{shopDef.emoji} {t('showingFor')} <strong>{shopTypeLabel(shopDef, lang)}</strong></span>
          <button type="button" onClick={() => setShowAll(v => !v)}>
            {showAll ? t('showShopOnly') : t('showAllCats')}
          </button>
        </div>
      )}

      {/* Step indicator */}
      <div className="cat-picker__steps">
        <button type="button" className={`cat-step ${step === 'group' ? 'cat-step--active' : ''}`} onClick={() => setStep('group')}>
          {t('chooseGroup')}
        </button>
        {selectedGroup && (
          <button type="button" className={`cat-step ${step === 'cat' ? 'cat-step--active' : ''}`} onClick={() => setStep('cat')}>
            {t('chooseSpecific')}
          </button>
        )}
      </div>

      {/* Step 1: Group grid */}
      {step === 'group' && (
        <div className="cat-picker__groups">
          {filteredGroups.map(g => (
            <button
              type="button" key={g.group}
              className={`cat-group-btn ${selectedGroup?.group === g.group ? 'cat-group-btn--sel' : ''}`}
              style={selectedGroup?.group === g.group ? { borderColor: g.color, background: g.color + '15' } : {}}
              onClick={() => pickGroup(g)}
            >
              <span className="cat-group-btn__emoji">{g.emoji}</span>
              <span className="cat-group-btn__name">{groupLabel(g, lang)}</span>
              {selectedGroup?.group === g.group && <Check size={11} style={{ color: g.color }} />}
            </button>
          ))}
          {hasFilter && (
            <button type="button" className="cat-group-btn cat-group-btn--more" onClick={() => setShowAll(true)}>
              <span className="cat-group-btn__emoji">➕</span>
              <span className="cat-group-btn__name">{t('moreGroups')}</span>
            </button>
          )}
        </div>
      )}

      {/* Step 2: Category chips */}
      {step === 'cat' && selectedGroup && (
        <div className="cat-picker__cats">
          <div className="cat-search-wrap">
            <Search size={13}/>
            <input
              type="text" className="cat-search-input"
              placeholder={`${selectedGroup.emoji} ${groupLabel(selectedGroup, lang)}...`}
              value={catSearch} onChange={e => setCatSearch(e.target.value)} autoFocus
            />
            {catSearch && <button type="button" onClick={() => setCatSearch('')}><X size={12}/></button>}
          </div>
          <div className="cat-chip-grid">
            {filteredCats.map(c => (
              <button
                type="button" key={c}
                className={`cat-item-btn ${value === c ? 'cat-item-btn--sel' : ''}`}
                style={value === c ? { borderColor: selectedGroup.color, background: selectedGroup.color + '18', color: selectedGroup.color } : {}}
                onClick={() => pickCat(c)}
              >
                {value === c && <Check size={11}/>} {c}
              </button>
            ))}
            {filteredCats.length === 0 && <p className="cat-no-match">{t('noMatchCat')} "{catSearch}"</p>}
          </div>
          <button type="button" className="cat-back-btn" onClick={() => setStep('group')}>{t('backToGroups')}</button>
        </div>
      )}
    </div>
  )
}

// ─── Types & hooks ────────────────────────────────────────────────────────────
interface Product { id: string; shop_id: string; name: string; photo_url: string | null; price: number; category: string | null; active: boolean; barcode: string | null }
interface StockLevel { product_id: string; quantity: number; reorder_threshold: number }
interface ProductFormData { name: string; price: string; category: string; quantity: string; reorder_threshold: string; barcode: string }
const emptyForm: ProductFormData = { name: '', price: '', category: '', quantity: '0', reorder_threshold: '2', barcode: '' }

function useProducts(shopId?: string) {
  return useQuery<Product[]>({
    queryKey: ['products', shopId],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('shop_id', shopId!).eq('active', true).order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId, staleTime: 5 * 60_000,
  })
}
function useStock(shopId?: string) {
  return useQuery<StockLevel[]>({
    queryKey: ['stock', shopId],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_levels').select('product_id, quantity, reorder_threshold').eq('shop_id', shopId!)
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId, staleTime: 60_000,
  })
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

// ─── Auto-SKU generator ───────────────────────────────────────────────────────
function generateSKU(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = 'SKU-'
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// ─── Inline barcode camera capture (camera only, no DB lookup) ────────────────
function BarcodeCamCapture({ onCapture, onClose }: { onCapture: (code: string) => void; onClose: () => void }) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf: number
    const start = async () => {
      if (!('BarcodeDetector' in window)) {
        setErr(t('camUseChromeHint'))
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code'] })
        const tick = async () => {
          if (videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
            try {
              // @ts-ignore
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0) {
                cancelAnimationFrame(raf)
                stream?.getTracks().forEach(t => t.stop())
                onCapture(codes[0].rawValue as string)
                return
              }
            } catch { /* skip frame */ }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setErr(t('camAccessDenied'))
      }
    }
    start()
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()) }
  }, [])

  if (err) return (
    <div className="bcc__err">
      <AlertCircle size={13}/><span>{err}</span>
      <button type="button" onClick={onClose}><X size={13}/></button>
    </div>
  )

  return (
    <div className="bcc">
      <video ref={videoRef} className="bcc__video" muted playsInline />
      <div className="bcc__frame"/>
      <p className="bcc__hint">{t('pointCameraAt')}</p>
      <button type="button" className="bcc__close" onClick={onClose}><X size={13}/> {t('closeCam')}</button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ProductsPage() {
  const { user } = useAuth()
  const { data: shop, refetch: refetchShop } = useShop(user?.id)
  const { data: products = [], isLoading } = useProducts(shop?.id)
  const { data: stock = [] } = useStock(shop?.id)
  const qc = useQueryClient()
  const t = useT()
  const { lang } = useLanguageStore()

  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showScanner, setShowScanner] = useState(false)

  const stockMap: Record<string, StockLevel> = {}
  for (const s of stock) stockMap[s.product_id] = s

  const usedGroupNames = Array.from(new Set(products.map(p => getCatInfo(p.category)?.group).filter(Boolean))) as string[]
  const filterGroups = BUSINESS_GROUPS.filter(g => usedGroupNames.includes(g.group))

  const filtered = products.filter(p => {
    const info = getCatInfo(p.category)
    if (activeGroup && info?.group !== activeGroup) return false
    return matchesSearch(p.name, p.category, info?.group, search)
  })

  const openAdd = () => { setEditTarget(null); setForm(emptyForm); setFormError(''); setShowScanner(false); setShowModal(true) }
  const openEdit = (p: Product) => {
    setEditTarget(p)
    const s = stockMap[p.id]
    setForm({ name: p.name, price: String(p.price), category: p.category ?? '', quantity: String(s?.quantity ?? 0), reorder_threshold: String(s?.reorder_threshold ?? 2), barcode: p.barcode ?? '' })
    setFormError(''); setShowScanner(false); setShowModal(true)
  }

  // Called when inline barcode camera captures a raw code
  const handleBarcodeCapture = useCallback(async (rawCode: string) => {
    setForm(f => ({ ...f, barcode: rawCode }))
    setShowScanner(false)
    // Best-effort: look up product by barcode to auto-fill other fields
    if (!shop?.id) return
    const { data } = await supabase
      .from('products')
      .select('name, category, price')
      .eq('barcode', rawCode)
      .limit(1)
    if (data?.[0]) {
      setForm(f => ({
        ...f,
        barcode: rawCode,
        name: f.name || data[0].name,
        category: f.category || (data[0].category ?? ''),
        price: f.price || String(data[0].price),
      }))
    }
  }, [shop?.id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop?.id) return
    setSaving(true); setFormError('')
    const price = parseFloat(form.price)
    if (isNaN(price) || price < 0) { setFormError(t('priceInvalid')); setSaving(false); return }

    // Barcode is optional — save null if empty (do NOT auto-generate to avoid clutter)
    const barcodeVal = form.barcode.trim() || null

    // Build payload without barcode first; add it only when column exists
    const tryWithBarcode = async (includeBarcode: boolean) => {
      const base = { name: form.name, price, category: form.category || null }
      const payload = includeBarcode ? { ...base, barcode: barcodeVal } : base

      if (editTarget) {
        return supabase.from('products').update(payload).eq('id', editTarget.id)
      } else {
        return supabase.from('products').insert({ shop_id: shop.id, ...payload }).select('id').single()
      }
    }

    let result = await tryWithBarcode(true)

    // If barcode column is missing in schema cache, retry without it
    if (result.error?.message?.includes('barcode') && result.error.message.includes('schema cache')) {
      result = await tryWithBarcode(false)
    }

    if (result.error) { setFormError(t('error') + ': ' + result.error.message); setSaving(false); return }

    const prodId = editTarget?.id ?? (result.data as { id: string } | null)?.id
    if (!prodId) { setFormError(t('error') + ': ' + t('productsTitle')); setSaving(false); return }

    if (editTarget) {
      await supabase.from('stock_levels').update({ quantity: +form.quantity, reorder_threshold: +form.reorder_threshold }).eq('product_id', prodId)
    } else {
      await supabase.from('stock_levels').insert({ product_id: prodId, shop_id: shop.id, quantity: +form.quantity, reorder_threshold: +form.reorder_threshold })
    }

    qc.invalidateQueries({ queryKey: ['products', shop.id] })
    qc.invalidateQueries({ queryKey: ['stock', shop.id] })
    setSaving(false); setShowModal(false)
  }

  const handleDelete = async (p: Product) => {
    if (!confirm(`${t('delete')} "${p.name}"?`)) return
    await supabase.from('products').update({ active: false }).eq('id', p.id)
    qc.invalidateQueries({ queryKey: ['products', shop?.id] })
  }

  const saveShopType = async (type: string) => {
    if (!shop?.id) return
    await supabase.from('shops').update({ shop_type: type }).eq('id', shop.id)
    await refetchShop()
    setShowTypeModal(false)
  }

  const lowStockCount = products.filter(p => { const s = stockMap[p.id]; return s && s.quantity <= s.reorder_threshold }).length
  const shopTypeDef = shop?.shop_type ? SHOP_TYPE_DEFS[shop.shop_type] : null

  return (
    <div className="pg">
      {/* ── Header ── */}
      <div className="pg__header">
        <div>
          <h1 className="pg__title">{t('productsTitle')}</h1>
          <p className="pg__sub">
            {products.length} {t('productsTitle')}
            {lowStockCount > 0 && <span className="pg__alert"> · ⚠️ {lowStockCount} {t('needsRestock')}</span>}
          </p>
        </div>
        <div className="pg__header-actions">
          {/* Shop type badge */}
          <button className="shop-type-btn" onClick={() => setShowTypeModal(true)}>
            {shopTypeDef ? (<>{shopTypeDef.emoji} {shopTypeLabel(shopTypeDef, lang)}</>) : (<><Store size={14}/> {t('shopType')}</>)}
          </button>

          {/* Bulk import */}
          <button className="btn-secondary" onClick={() => setShowBulk(true)}>
            <FileSpreadsheet size={16}/><span>{t('bulkImport')}</span>
          </button>

          {/* Add product */}
          <button className="btn-add" onClick={openAdd}><Plus size={18}/><span>{t('addProduct')}</span></button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="pg__search-bar">
        <Search size={16} className="pg__search-icon" />
        <input
          type="search"
          placeholder={t('searchProdHint')}
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveGroup(null) }}
          className="pg__search-input"
        />
        {search && <button className="pg__search-clear" onClick={() => setSearch('')}><X size={14}/></button>}
      </div>

      {/* ── Group filter chips ── */}
      {filterGroups.length > 0 && !search && (
        <div className="cat-filters">
          <button className={`cat-chip ${!activeGroup ? 'cat-chip--active' : ''}`} onClick={() => setActiveGroup(null)}>
            {t('all')} ({products.length})
          </button>
          {filterGroups.map(g => {
            const cnt = products.filter(p => getCatInfo(p.category)?.group === g.group).length
            const isActive = activeGroup === g.group
            return (
              <button key={g.group} className={`cat-chip ${isActive ? 'cat-chip--active' : ''}`}
                style={isActive ? { background: g.color, borderColor: g.color, color: '#fff' } : {}}
                onClick={() => setActiveGroup(prev => prev === g.group ? null : g.group)}>
                {g.emoji} {groupLabel(g, lang)} <span className="chip-count">({cnt})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Products grid ── */}
      {isLoading ? (
        <div className="product-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 195, borderRadius: 'var(--radius-l)' }} />)}
        </div>
      ) : !filtered.length ? (
        <div className="empty-state">
          <Package size={42} style={{ color: 'var(--color-text-muted)' }} />
          <p style={{ maxWidth: 300, lineHeight: 1.5, textAlign: 'center' }}>
            {search
              ? (<>{t('noProductsSearch')} <strong>"{search}"</strong><br/><span style={{fontSize:'0.8rem',color:'var(--color-text-muted)'}}>{t('trySearch')}</span></>)
              : activeGroup ? `${t('noProductsGroup').replace('kikundi hiki', `"${activeGroup}"`)}`
              : t('addProductStart')}
          </p>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map(p => {
            const s = stockMap[p.id]
            const lowStock = s && s.quantity <= s.reorder_threshold
            const info = getCatInfo(p.category)
            return (
              <div key={p.id} className={`product-card ${lowStock ? 'product-card--alert' : ''}`}>
                <div className="product-card__img" style={{ background: info ? info.color + '12' : 'var(--color-surface-2)' }}>
                  {p.photo_url ? <img src={p.photo_url} alt={p.name}/> : <span style={{fontSize:'2.6rem'}}>{info?.emoji ?? '📦'}</span>}
                  {lowStock && <span className="low-badge">⚠️ {t('lowStockBadge')}</span>}
                </div>
                <div className="product-card__body">
                  <h4 className="product-card__name">{p.name}</h4>
                  {info && <span className="product-card__group" style={{ color: info.color, background: info.color + '16' }}>{info.emoji} {groupLabel(info, lang)}</span>}
                  {p.category && <span className="product-card__cat">{p.category}</span>}
                  <div className="product-card__meta">
                    <span className="product-card__price">{fmt(p.price)}</span>
                    <span className={`product-card__stock ${lowStock ? 'stock--low' : ''}`}>{t('stockLabel')} {s?.quantity ?? '—'}</span>
                  </div>
                  <div className="product-card__actions">
                    <button className="product-card__btn" onClick={() => openEdit(p)}><Pencil size={13}/> {t('edit')}</button>
                    <button className="product-card__btn product-card__btn--del" onClick={() => handleDelete(p)}><Trash2 size={13}/></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── PRODUCT MODAL ── */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal animate-scale-in">
            <div className="modal__header">
              <h3>{editTarget ? t('editProduct') : t('addProductNew')}</h3>
              <button className="modal__close" onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="modal__form">

              {/* Name */}
              <div className="field">
                <label className="field__label">{t('productName')} *</label>
                <input className="field__input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required maxLength={100} placeholder={t('productNamePlaceholder')} autoFocus/>
              </div>

              {/* Category picker with shop type filtering */}
              <div className="field">
                <label className="field__label">{t('category')}</label>
                <CategoryPicker value={form.category} onChange={cat => setForm(f => ({...f, category: cat}))} shopType={shop?.shop_type} />
              </div>

              {/* Price + Stock */}
              <div className="field-row">
                <div className="field">
                  <label className="field__label">{t('sellingPrice')} (TZS) *</label>
                  <input className="field__input" type="number" min="0" step="1" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required placeholder="850000"/>
                </div>
                <div className="field">
                  <label className="field__label">{t('stock')}</label>
                  <input className="field__input" type="number" min="0" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))}/>
                </div>
              </div>

              {/* Barcode (optional) + Reorder threshold */}
              <div className="field-row">
                <div className="field">
                  <div className="field__label-row">
                    <label className="field__label">
                      Barcode / SKU
                      <span className="field__optional"> ({t('optional')})</span>
                    </label>
                    <button
                      type="button"
                      className="auto-sku-btn"
                      onClick={() => setForm(f => ({ ...f, barcode: generateSKU() }))}
                      title={lang === 'en' ? 'Auto-generate SKU' : 'Tengeneza SKU ya kiotomatiki'}
                    >
                      <RefreshCw size={11}/> Auto SKU
                    </button>
                  </div>
                  <div className="barcode-wrap">
                    <input
                      className="field__input barcode-input"
                      value={form.barcode}
                      onChange={e => setForm(f=>({...f,barcode:e.target.value}))}
                      placeholder={t('barcodeOrBlank')}
                      // USB barcode scanners send Enter — prevent form submit on scan
                      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                    />
                    <button
                      type="button"
                      className={`barcode-cam-btn ${showScanner ? 'barcode-cam-btn--active' : ''}`}
                      onClick={() => setShowScanner(v => !v)}
                      title={showScanner ? t('closeCam') : t('scanWithCamera')}
                    >
                      <Camera size={15}/>
                    </button>
                  </div>
                  {showScanner && (
                    <BarcodeCamCapture
                      onCapture={handleBarcodeCapture}
                      onClose={() => setShowScanner(false)}
                    />
                  )}
                  <span className="field__hint">{t('barcodeHint')}</span>
                </div>
                <div className="field">
                  <label className="field__label">{t('reorderAt')}</label>
                  <input className="field__input" type="number" min="0" value={form.reorder_threshold} onChange={e=>setForm(f=>({...f,reorder_threshold:e.target.value}))}/>
                  <span className="field__hint">{t('reorderHint')}</span>
                </div>
              </div>

              {/* Photo upload placeholder */}
              {!editTarget && (
                <div className="field">
                  <label className="field__label">{t('photoUrl')}</label>
                  <div className="upload-area"><Upload size={18}/><span>{t('uploadPhotoHint')}</span></div>
                </div>
              )}

              {formError && <p className="form-error">{formError}</p>}

              <div className="modal__footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn-save" disabled={saving || !form.name.trim() || !form.price}>
                  {saving ? <span className="btn-spinner-sm"/> : null}
                  {editTarget ? t('saveChanges') : t('addProduct')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BULK IMPORT MODAL ── */}
      {showBulk && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal modal--wide animate-scale-in">
            <div className="modal__header">
              <FileSpreadsheet size={20} style={{ color: 'var(--color-primary)' }} />
              <h3>{t('bulkImportTitle')}</h3>
              <button className="modal__close" onClick={() => setShowBulk(false)}><X size={20}/></button>
            </div>
            <div style={{ padding: 'var(--space-6)' }}>
              {shop?.id && (
                <BulkImport
                  shopId={shop.id}
                  onSuccess={() => {
                    qc.invalidateQueries({ queryKey: ['products', shop.id] })
                    qc.invalidateQueries({ queryKey: ['stock', shop.id] })
                  }}
                  onClose={() => setShowBulk(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SHOP TYPE MODAL ── */}
      {showTypeModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal animate-scale-in">
            <div className="modal__header">
              <h3>{t('shopTypeTitle')}</h3>
              <button className="modal__close" onClick={() => setShowTypeModal(false)}><X size={20}/></button>
            </div>
            <div className="modal__form">
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                {t('shopTypeDesc')}
              </p>
              <div className="shop-type-grid">
                {Object.entries(SHOP_TYPE_DEFS).map(([key, def]) => (
                  <button
                    type="button" key={key}
                    className={`shop-type-card ${shop?.shop_type === key ? 'shop-type-card--active' : ''}`}
                    onClick={() => saveShopType(key)}
                  >
                    <span className="shop-type-card__emoji">{def.emoji}</span>
                    <span className="shop-type-card__label">{shopTypeLabel(def, lang)}</span>
                    {shop?.shop_type === key && <Check size={14} className="shop-type-card__check" />}
                  </button>
                ))}
              </div>
              <div className="modal__footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                <button type="button" className="btn-cancel" onClick={() => setShowTypeModal(false)}>{t('close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ─ Page ─ */
        .pg { display:flex; flex-direction:column; gap:var(--space-5); }
        .pg__header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:var(--space-3); }
        .pg__title { font-size:1.6rem; font-weight:800; }
        .pg__sub { color:var(--color-text-muted); font-size:0.85rem; }
        .pg__alert { color:var(--color-warning); font-weight:600; }
        .pg__header-actions { display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap; }

        .shop-type-btn { display:flex; align-items:center; gap:6px; padding:var(--space-2) var(--space-4); border:1.5px solid var(--color-border); border-radius:var(--radius-l); font-size:0.8rem; font-weight:600; color:var(--color-text-secondary); background:var(--color-surface); transition:all var(--transition-fast); cursor:pointer; }
        .shop-type-btn:hover { border-color:var(--color-primary); color:var(--color-primary); }

        .btn-secondary { display:flex; align-items:center; gap:6px; padding:var(--space-3) var(--space-4); border:1.5px solid var(--color-border); border-radius:var(--radius-l); font-size:0.85rem; font-weight:600; color:var(--color-text-secondary); background:var(--color-surface); transition:all var(--transition-fast); cursor:pointer; }
        .btn-secondary:hover { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-light); }

        .btn-add { display:flex; align-items:center; gap:6px; padding:var(--space-3) var(--space-5); background:var(--color-primary); color:#fff; border-radius:var(--radius-l); font-weight:600; font-size:0.9rem; transition:all var(--transition-fast); }
        .btn-add:hover { background:var(--color-primary-hover); transform:translateY(-1px); box-shadow:var(--shadow-md); }

        /* ─ Search ─ */
        .pg__search-bar { display:flex; align-items:center; gap:var(--space-2); background:var(--color-surface); border:1.5px solid var(--color-border); border-radius:var(--radius-l); padding:0 var(--space-4); transition:border-color var(--transition-fast); }
        .pg__search-bar:focus-within { border-color:var(--color-primary); }
        .pg__search-icon { color:var(--color-text-muted); flex-shrink:0; }
        .pg__search-input { flex:1; padding:var(--space-3) 0; border:none; background:none; outline:none; font-size:0.875rem; color:var(--color-text); }
        .pg__search-clear { color:var(--color-text-muted); padding:4px; border-radius:var(--radius-s); flex-shrink:0; }

        /* ─ Filter chips ─ */
        .cat-filters { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .cat-chip { display:flex; align-items:center; gap:5px; padding:5px 14px; border-radius:var(--radius-full); border:1.5px solid var(--color-border); font-size:0.8rem; font-weight:500; color:var(--color-text-secondary); background:var(--color-surface); cursor:pointer; transition:all 150ms; white-space:nowrap; }
        .cat-chip:hover { border-color:var(--color-primary); color:var(--color-primary); }
        .cat-chip--active { background:var(--color-primary); color:#fff; border-color:var(--color-primary); }
        .chip-count { opacity:.75; }

        /* ─ Product grid ─ */
        .product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(185px,1fr)); gap:var(--space-4); }
        .product-card { background:var(--color-surface); border:1.5px solid var(--color-border); border-radius:var(--radius-l); overflow:hidden; transition:all var(--transition-fast); box-shadow:var(--shadow-xs); }
        .product-card:hover { box-shadow:var(--shadow-md); transform:translateY(-2px); }
        .product-card--alert { border-color:var(--color-warning); }
        .product-card__img { height:115px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
        .product-card__img img { width:100%; height:100%; object-fit:cover; }
        .low-badge { position:absolute; top:6px; right:6px; background:var(--color-warning); color:#fff; font-size:0.67rem; font-weight:700; padding:2px 7px; border-radius:var(--radius-full); }
        .product-card__body { padding:var(--space-3) var(--space-4); }
        .product-card__name { font-size:0.85rem; font-weight:700; line-height:1.3; margin-bottom:4px; }
        .product-card__group { display:inline-block; font-size:0.67rem; font-weight:600; padding:2px 7px; border-radius:var(--radius-full); margin-bottom:2px; }
        .product-card__cat { display:block; font-size:0.72rem; color:var(--color-text-muted); margin-bottom:var(--space-2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .product-card__meta { display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3); }
        .product-card__price { font-weight:700; color:var(--color-primary); font-size:0.875rem; }
        .product-card__stock { font-size:0.72rem; color:var(--color-text-muted); }
        .stock--low { color:var(--color-warning)!important; font-weight:600; }
        .product-card__actions { display:flex; gap:var(--space-2); }
        .product-card__btn { flex:1; display:flex; align-items:center; justify-content:center; gap:4px; padding:6px; border-radius:var(--radius-m); font-size:0.75rem; font-weight:500; border:1px solid var(--color-border); color:var(--color-text-secondary); transition:all var(--transition-fast); background:var(--color-surface); }
        .product-card__btn:hover { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-light); }
        .product-card__btn--del { flex:0 0 32px; }
        .product-card__btn--del:hover { border-color:var(--color-error); color:var(--color-error); background:var(--color-error-bg); }

        /* ─ Empty ─ */
        .empty-state { display:flex; flex-direction:column; align-items:center; gap:var(--space-4); color:var(--color-text-muted); padding-top:64px; }

        /* ─ Field extras ─ */
        .field__label-row { display:flex; align-items:center; justify-content:space-between; gap:var(--space-2); }
        .field__optional { font-size:0.75rem; font-weight:400; color:var(--color-text-muted); }
        .field__hint { font-size:0.73rem; color:var(--color-text-muted); }

        /* ─ Auto-SKU button ─ */
        .auto-sku-btn { display:flex; align-items:center; gap:4px; font-size:0.73rem; font-weight:600; color:var(--color-text-secondary); background:var(--color-bg); border:1px solid var(--color-border); padding:3px 9px; border-radius:var(--radius-full); transition:all 150ms; flex-shrink:0; }
        .auto-sku-btn:hover { border-color:var(--color-primary); color:var(--color-primary); }

        /* ─ Barcode input with inline camera button ─ */
        .barcode-wrap { display:flex; align-items:stretch; border:1.5px solid var(--color-border); border-radius:var(--radius-m); overflow:hidden; transition:border-color var(--transition-fast); background:var(--color-surface); }
        .barcode-wrap:focus-within { border-color:var(--color-primary); box-shadow:var(--shadow-focus); }
        .barcode-input { flex:1; padding:10px var(--space-4); border:none; outline:none; background:transparent; font-size:0.9rem; color:var(--color-text); min-width:0; }
        .barcode-cam-btn { display:flex; align-items:center; justify-content:center; width:42px; flex-shrink:0; border-left:1.5px solid var(--color-border); color:var(--color-text-muted); background:var(--color-bg); transition:all 150ms; }
        .barcode-cam-btn:hover { background:var(--color-primary-light); color:var(--color-primary); }
        .barcode-cam-btn--active { background:var(--color-primary); color:#fff; border-left-color:var(--color-primary); }

        /* ─ Inline barcode camera ─ */
        .bcc { position:relative; border-radius:var(--radius-m); overflow:hidden; margin-top:6px; background:#000; border:1.5px solid var(--color-primary); }
        .bcc__video { width:100%; max-height:160px; object-fit:cover; display:block; }
        .bcc__frame { position:absolute; top:50%; left:50%; transform:translate(-50%,-60%); width:55%; height:55px; border:2.5px solid var(--color-primary); border-radius:6px; box-shadow:0 0 0 2000px rgba(0,0,0,0.45); pointer-events:none; }
        .bcc__hint { position:absolute; bottom:26px; left:0; right:0; text-align:center; color:#fff; font-size:0.72rem; font-weight:500; text-shadow:0 1px 3px rgba(0,0,0,0.9); pointer-events:none; }
        .bcc__close { position:absolute; bottom:6px; right:8px; display:flex; align-items:center; gap:4px; padding:3px 9px; background:rgba(0,0,0,0.65); color:#fff; border-radius:var(--radius-m); font-size:0.73rem; }
        .bcc__close:hover { background:rgba(0,0,0,0.85); }
        .bcc__err { display:flex; align-items:center; gap:6px; font-size:0.78rem; color:var(--color-error); background:var(--color-error-bg); border:1px solid var(--color-error); padding:7px 10px; border-radius:var(--radius-m); margin-top:6px; }
        .bcc__err span { flex:1; }

        /* ─ Category picker ─ */
        .cat-picker { display:flex; flex-direction:column; gap:var(--space-3); border:1.5px solid var(--color-border); border-radius:var(--radius-l); padding:var(--space-4); background:var(--color-surface); transition:border-color var(--transition-fast); }
        .cat-picker:focus-within { border-color:var(--color-primary); }
        .cat-picker__selected { display:flex; align-items:center; gap:6px; font-size:0.85rem; flex-wrap:wrap; }
        .cat-picker__clear { margin-left:auto; color:var(--color-text-muted); padding:3px; border-radius:var(--radius-s); }
        .cat-picker__clear:hover { color:var(--color-error); }

        .cat-type-banner { display:flex; align-items:center; justify-content:space-between; gap:var(--space-2); font-size:0.78rem; padding:5px 10px; background:var(--color-bg); border-radius:var(--radius-m); border:1px solid var(--color-border); flex-wrap:wrap; }
        .cat-type-banner button { color:var(--color-primary); font-size:0.75rem; font-weight:600; text-decoration:underline; }

        .cat-picker__steps { display:flex; gap:var(--space-2); }
        .cat-step { font-size:0.78rem; font-weight:600; padding:4px 12px; border-radius:var(--radius-full); border:1.5px solid var(--color-border); color:var(--color-text-muted); background:transparent; cursor:pointer; transition:all var(--transition-fast); }
        .cat-step:hover { border-color:var(--color-primary); color:var(--color-primary); }
        .cat-step--active { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-light); }

        .cat-picker__groups { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:var(--space-2); max-height:280px; overflow-y:auto; }
        .cat-group-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:var(--space-3) var(--space-2); border:1.5px solid var(--color-border); border-radius:var(--radius-m); cursor:pointer; transition:all var(--transition-fast); background:var(--color-surface); text-align:center; }
        .cat-group-btn:hover { border-color:var(--color-primary); background:var(--color-primary-light); }
        .cat-group-btn--sel { font-weight:600; }
        .cat-group-btn--more { border-style:dashed; color:var(--color-text-muted); }
        .cat-group-btn__emoji { font-size:1.6rem; line-height:1; }
        .cat-group-btn__name { font-size:0.72rem; font-weight:500; line-height:1.3; color:var(--color-text); }
        .cat-picker__cats { display:flex; flex-direction:column; gap:var(--space-3); }
        .cat-search-wrap { display:flex; align-items:center; gap:var(--space-2); background:var(--color-bg); border:1px solid var(--color-border); border-radius:var(--radius-m); padding:6px var(--space-3); color:var(--color-text-muted); }
        .cat-search-input { flex:1; border:none; background:none; outline:none; font-size:0.85rem; color:var(--color-text); }
        .cat-chip-grid { display:flex; flex-wrap:wrap; gap:var(--space-2); max-height:200px; overflow-y:auto; }
        .cat-item-btn { padding:5px 12px; border-radius:var(--radius-full); border:1.5px solid var(--color-border); font-size:0.8rem; font-weight:500; color:var(--color-text-secondary); background:var(--color-surface); cursor:pointer; transition:all var(--transition-fast); display:flex; align-items:center; gap:4px; }
        .cat-item-btn:hover { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-light); }
        .cat-no-match { font-size:0.82rem; color:var(--color-text-muted); }
        .cat-back-btn { font-size:0.78rem; color:var(--color-text-muted); text-align:left; padding:0; background:none; border:none; cursor:pointer; }
        .cat-back-btn:hover { color:var(--color-primary); }

        /* ─ Modal ─ */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; padding:var(--space-4); z-index:200; overflow-y:auto; }
        .modal { background:var(--color-surface); border-radius:var(--radius-xl); width:100%; max-width:560px; max-height:92vh; overflow-y:auto; box-shadow:var(--shadow-lg); }
        .modal--wide { max-width:720px; }
        .modal__header { display:flex; align-items:center; gap:var(--space-3); justify-content:space-between; padding:var(--space-5) var(--space-6); border-bottom:1px solid var(--color-border); position:sticky; top:0; background:var(--color-surface); z-index:1; }
        .modal__header h3 { font-size:1.05rem; font-weight:700; flex:1; }
        .modal__close { color:var(--color-text-muted); padding:4px; border-radius:var(--radius-s); }
        .modal__close:hover { color:var(--color-text); }
        .modal__form { padding:var(--space-6); display:flex; flex-direction:column; gap:var(--space-4); }
        .modal__footer { display:flex; justify-content:flex-end; gap:var(--space-3); padding-top:var(--space-4); border-top:1px solid var(--color-border); margin-top:var(--space-2); }

        .field { display:flex; flex-direction:column; gap:5px; }
        .field-row { display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4); }
        @media (max-width:480px) { .field-row { grid-template-columns:1fr; } }
        .field__label { font-size:0.85rem; font-weight:600; color:var(--color-text); }
        .field__input { padding:10px var(--space-4); border:1.5px solid var(--color-border); border-radius:var(--radius-m); font-size:0.9rem; outline:none; background:var(--color-surface); color:var(--color-text); transition:border-color var(--transition-fast); }
        .field__input:focus { border-color:var(--color-primary); box-shadow:var(--shadow-focus); }

        .upload-area { display:flex; flex-direction:column; align-items:center; gap:var(--space-2); padding:var(--space-5); border:2px dashed var(--color-border); border-radius:var(--radius-l); color:var(--color-text-muted); font-size:0.82rem; text-align:center; cursor:pointer; }
        .upload-area:hover { border-color:var(--color-primary); color:var(--color-primary); }

        .form-error { color:var(--color-error); background:var(--color-error-bg); padding:var(--space-3) var(--space-4); border-radius:var(--radius-m); font-size:0.85rem; }
        .btn-cancel, .btn-save { padding:var(--space-3) var(--space-5); border-radius:var(--radius-m); font-weight:600; font-size:0.9rem; transition:all var(--transition-fast); display:flex; align-items:center; gap:6px; }
        .btn-cancel { border:1.5px solid var(--color-border); color:var(--color-text-secondary); background:var(--color-surface); }
        .btn-cancel:hover { border-color:var(--color-primary); color:var(--color-text); }
        .btn-save { background:var(--color-primary); color:#fff; }
        .btn-save:hover:not(:disabled) { background:var(--color-primary-hover); }
        .btn-save:disabled { opacity:.6; cursor:not-allowed; }
        .btn-spinner-sm { width:15px; height:15px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin 700ms linear infinite; display:inline-block; }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* ─ Shop type modal ─ */
        .shop-type-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:var(--space-3); }
        .shop-type-card { display:flex; flex-direction:column; align-items:center; gap:var(--space-2); padding:var(--space-4); border:1.5px solid var(--color-border); border-radius:var(--radius-l); cursor:pointer; transition:all var(--transition-fast); background:var(--color-surface); position:relative; }
        .shop-type-card:hover { border-color:var(--color-primary); background:var(--color-primary-light); transform:translateY(-2px); }
        .shop-type-card--active { border-color:var(--color-primary); background:var(--color-primary-light); }
        .shop-type-card__emoji { font-size:2rem; line-height:1; }
        .shop-type-card__label { font-size:0.8rem; font-weight:600; color:var(--color-text); text-align:center; line-height:1.3; }
        .shop-type-card__check { position:absolute; top:8px; right:8px; color:var(--color-primary); }

        .skeleton { background:var(--color-surface-2); animation:pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes animate-scale-in { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
        .animate-scale-in { animation:animate-scale-in 180ms ease-out; }
      `}</style>
    </div>
  )
}
