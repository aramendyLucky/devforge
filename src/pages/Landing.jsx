import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.jsx'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/ui/Header.jsx'

// ─── Datos de las ofertas de referencia ──────────────────
const OFFERS = [
  {
    tagKey: 'Oferta 1',
    role: 'Python / AWS Engineer',
    skills: ['Python', 'AWS Lambda', 'ECS', 'API Gateway', 'S3', 'RDS', 'CI/CD'],
  },
  {
    tagKey: 'Oferta 2',
    role: 'Full Stack Python + Next.js',
    skills: ['Django', 'Flask', 'Next.js', 'Node.js', 'REST APIs', 'SQL', 'Docker'],
  },
  {
    tagKey: 'Oferta 3',
    role: 'Agentic Python Engineer',
    skills: ['FastAPI', 'Claude Code', 'Copilot', 'AI Agents', 'Agile', 'CI/CD'],
  },
]

function SkillBar({ skill, delay }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <span
      className={`
        badge badge-muted transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {skill}
    </span>
  )
}

function OfferCard({ offer, index }) {
  return (
    <div
      className="card border-forge-border hover:border-forge-amber transition-all duration-300 animate-slide-up"
      style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="badge badge-amber">{offer.tag}</span>
      </div>
      <h3 className="font-display font-bold text-forge-text text-lg mb-4 leading-tight">
        {offer.role}
      </h3>
      <div className="flex flex-wrap gap-2">
        {offer.skills.map((skill, i) => (
          <SkillBar key={skill} skill={skill} delay={300 + index * 120 + i * 40} />
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate           = useNavigate()
  const { state }          = useStore()
  const { isAuthenticated } = useAuth() // sabemos si hay sesión activa
  const { t }              = useTranslation()
  const [titleVisible, setTitleVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTitleVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  const alreadyOnboarded = state.config.onboardingDone

  /**
   * getDestination — calcula a dónde enviar al usuario según su estado.
   *
   * Hay 3 casos posibles:
   *   1. No autenticado → /register (tiene que crear una cuenta primero)
   *   2. Autenticado pero sin onboarding → /onboarding (primer uso)
   *   3. Autenticado con onboarding completo → /dashboard (uso normal)
   *
   * Antes de agregar auth, la app solo miraba onboardingDone y mandaba
   * directamente a /onboarding, lo que causaba que PrivateRoute lo
   * redirigiera a /login porque no había sesión. Este fix corrige eso.
   */
  function getDestination() {
    if (!isAuthenticated) return '/register'
    return alreadyOnboarded ? '/dashboard' : '/onboarding'
  }

  /**
   * getMainLabel — texto del botón principal según el estado del usuario.
   *   - Sin cuenta → "Empezar ahora →"
   *   - Con cuenta pero sin onboarding → "Empezar ahora →"
   *   - Con cuenta y onboarding completo → "Continuar entrenamiento →"
   */
  function getMainLabel() {
    return isAuthenticated && alreadyOnboarded
      ? t('landing.ctaContinue')
      : t('landing.cta')
  }

  return (
    <div className="min-h-screen bg-forge-bg flex flex-col">

      {/*
        Header: el botón derecho cambia según el estado de auth.
        - No autenticado o sin onboarding → "Empezar →" (lleva a /register o /onboarding)
        - Autenticado con onboarding completo → "Dashboard →"
        Usamos getDestination() para que siempre apunte al lugar correcto.
      */}
      <Header
        rightContent={
          isAuthenticated && alreadyOnboarded ? (
            <button
              onClick={() => navigate('/dashboard')}
              style={{ padding: '7px 13px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
            >
              {t('landing.ctaDashboard')}
            </button>
          ) : (
            <button
              onClick={() => navigate(getDestination())}
              style={{ padding: '7px 13px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
            >
              {t('landing.cta')}
            </button>
          )
        }
      />

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col">
        <section className="border-b border-forge-border px-4 sm:px-6 py-14 md:py-24 max-w-5xl mx-auto w-full">

          <div
            className={`flex items-center gap-3 mb-8 transition-all duration-500
              ${titleVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            <span className="w-8 h-px bg-forge-amber" />
            <span className="font-mono text-forge-subtle text-xs uppercase tracking-widest">
              {t('landing.label')}
            </span>
          </div>

          <h1
            className={`font-display font-extrabold text-4xl sm:text-5xl md:text-7xl leading-none
              tracking-tight mb-6 transition-all duration-700 delay-100
              ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <span className="text-forge-amber block">{t('landing.title')}</span>
          </h1>

          <p
            className={`font-mono text-forge-subtle text-base md:text-lg max-w-2xl mb-10
              transition-all duration-700 delay-200
              ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            {t('landing.subtitle')}
          </p>

          <div
            className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 delay-300
              ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            {/* Botón principal del hero — usa getDestination() y getMainLabel() */}
            <button
              className="btn-primary text-base"
              onClick={() => navigate(getDestination())}
            >
              {getMainLabel()}
            </button>
            {/* "Ver ofertas" solo se muestra cuando el usuario aún no empezó */}
            {!(isAuthenticated && alreadyOnboarded) && (
              <button
                className="btn-secondary text-base"
                onClick={() => {
                  document.getElementById('ofertas').scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {t('landing.viewOffers')}
              </button>
            )}
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="border-b border-forge-border">
          <div className="max-w-5xl mx-auto w-full grid grid-cols-2 md:grid-cols-4">
            {[
              { value: '3',    key: 'stat1' },
              { value: '47',   key: 'stat2' },
              { value: '200+', key: 'stat3' },
              { value: 'AI',   key: 'stat4' },
            ].map((stat, i) => (
              <div
                key={stat.key}
                className="px-6 py-8 border-r border-forge-border last:border-r-0 animate-fade-in"
                style={{ animationDelay: `${400 + i * 80}ms`, animationFillMode: 'both' }}
              >
                <div className="font-display font-extrabold text-3xl text-forge-amber mb-1">
                  {stat.value}
                </div>
                <div className="font-mono text-forge-subtle text-xs uppercase tracking-wider">
                  {t(`landing.${stat.key}`).split(' · ').slice(1).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Ofertas ── */}
        <section id="ofertas" className="border-b border-forge-border px-6 py-16">
          <div className="max-w-5xl mx-auto w-full">
            <div className="divider mb-10">{t('landing.offersTitle')}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {OFFERS.map((offer, i) => (
                <OfferCard key={offer.tagKey} offer={{ ...offer, tag: offer.tagKey }} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Cómo funciona ── */}
        <section className="border-b border-forge-border px-6 py-16">
          <div className="max-w-5xl mx-auto w-full">
            <div className="divider mb-10">{t('landing.howTitle')}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: '01', titleKey: 'step1Title', descKey: 'step1Desc' },
                { step: '02', titleKey: 'step2Title', descKey: 'step2Desc' },
                { step: '03', titleKey: 'step3Title', descKey: 'step3Desc' },
              ].map((item, i) => (
                <div
                  key={item.step}
                  className="animate-slide-up"
                  style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
                >
                  <div className="font-mono text-forge-amber text-4xl font-bold mb-4 opacity-40">
                    {item.step}
                  </div>
                  <h3 className="font-display font-bold text-forge-text text-xl mb-2">
                    {t(`landing.${item.titleKey}`).split(' · ').slice(1).join(' · ')}
                  </h3>
                  <p className="font-mono text-forge-subtle text-sm leading-relaxed">
                    {t(`landing.${item.descKey}`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="px-6 py-20">
          <div className="max-w-5xl mx-auto w-full flex flex-col items-center text-center gap-6">
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-forge-text leading-tight">
              <span className="text-forge-amber">{t('landing.finalTitle')}</span>
            </h2>
            <p className="font-mono text-forge-subtle text-sm max-w-md">
              {t('landing.finalSubtitle')}
            </p>
            {/* CTA final — misma lógica que el hero */}
            <button
              className="btn-primary text-base mt-2"
              onClick={() => navigate(getDestination())}
            >
              {getMainLabel()}
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="forge-footer">
        <span>{t('landing.footer')}</span>
        <span>{t('landing.poweredBy')}</span>
      </footer>

    </div>
  )
}
