import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import t, { type Lang, type TranslationKey } from './translations'

interface LanguageStore {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      lang: 'sw',
      setLang: (lang) => set({ lang }),
      toggleLang: () => set({ lang: get().lang === 'sw' ? 'en' : 'sw' }),
    }),
    { name: 'dukaos-lang' }
  )
)

export function useT() {
  const lang = useLanguageStore((s) => s.lang)
  return (key: TranslationKey) => t[key][lang]
}
