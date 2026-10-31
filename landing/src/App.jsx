import Faq from './sections/Faq'
import Features from './sections/Features'
import Footer from './sections/Footer'
import Header from './sections/Header'
import Hero from './sections/Hero'
import HowItWorks from './sections/HowItWorks'
import Install from './sections/Install'
import Security from './sections/Security'

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Install />
        <Security />
        <Faq />
      </main>
      <Footer />
    </div>
  )
}
