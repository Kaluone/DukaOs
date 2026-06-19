import './globals.css'
import { LanguageProvider } from '../context/LanguageContext'

export const metadata = {
  title: 'DukaOS — Dhibiti Biashara Yako Kwa Urahisi | Run Your Business Smarter',
  description:
    'DukaOS ni mfumo wa kisasa wa usimamizi wa biashara — POS, stok, wafanyakazi, ripoti na zaidi. Powered by AutoRevenue Labs.',
  keywords:
    'DukaOS, POS Tanzania, mfumo wa biashara, stock management, AutoRevenue Labs, business software Tanzania',
  openGraph: {
    title: 'DukaOS — Dhibiti Biashara Yako Kwa Urahisi',
    description:
      'Mfumo wa kisasa wa usimamizi wa biashara unaokuwezesha kusimamia mauzo, stok, wafanyakazi, matumizi, ripoti na faida zako zote kupitia mfumo mmoja salama.',
    type: 'website',
    locale: 'sw_TZ',
    siteName: 'DukaOS',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="sw">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
