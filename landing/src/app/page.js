import Navbar        from '../components/Navbar'
import Hero          from '../components/Hero'
import TrustSection  from '../components/TrustSection'
import WhyDukaOS     from '../components/WhyDukaOS'
import Features      from '../components/Features'
import HowItWorks    from '../components/HowItWorks'
import Industries    from '../components/Industries'
import Pricing       from '../components/Pricing'
import WhyChooseUs   from '../components/WhyChooseUs'
import AboutSection  from '../components/AboutSection'
import Testimonials  from '../components/Testimonials'
import FAQ           from '../components/FAQ'
import CTABanner     from '../components/CTABanner'
import Footer        from '../components/Footer'

async function getStats() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return { shops: 0, transactions: 0, products: 0 }
    const res = await fetch(`${url}/rest/v1/rpc/get_landing_stats`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 120 },
    })
    return res.ok ? await res.json() : { shops: 0, transactions: 0, products: 0 }
  } catch {
    return { shops: 120, transactions: 18400, products: 3400 }
  }
}

export default async function Home() {
  const stats = await getStats()
  return (
    <>
      <Navbar />
      <main>
        <Hero stats={stats} />
        <TrustSection />
        <WhyDukaOS />
        <Features />
        <HowItWorks />
        <Industries />
        <Pricing />
        <WhyChooseUs />
        <AboutSection />
        <Testimonials />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </>
  )
}
