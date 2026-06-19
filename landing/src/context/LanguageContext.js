'use client'
import { createContext, useContext, useState } from 'react'

const LanguageContext = createContext({ lang: 'sw', setLang: () => {} })

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('sw')
  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
