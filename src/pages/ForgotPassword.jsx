/**
 * src/pages/ForgotPassword.jsx
 *
 * RECUPERACIÓN DE CONTRASEÑA — paso 1: el usuario ingresa su email
 * y Supabase le envía un link para resetear la contraseña.
 *
 * Flujo completo:
 *   1. Usuario ingresa email acá → supabase.auth.resetPasswordForEmail()
 *   2. Supabase envía email con link que apunta a /reset-password
 *   3. En /reset-password el usuario ingresa su nueva contraseña
 *
 * El redirectTo usa window.location.origin para funcionar tanto en
 * desarrollo (localhost:5174) como en producción (dominio real).
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import Header from '../components/ui/Header.jsx'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [sent,    setSent]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Supabase redirige acá después de que el usuario haga clic en el email.
      // El token viene en el hash de la URL — ResetPassword.jsx lo procesa.
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (resetError) {
      // 429 = rate limit de Supabase (máx. ~2 emails por hora por IP)
      // Para otros errores mostramos un mensaje genérico — Supabase no
      // revela si el email existe o no (seguridad contra enumeración).
      const isRateLimit = resetError.status === 429 || resetError.message?.includes('rate')
      setError(
        isRateLimit
          ? t('auth.forgotErrorLimit')
          : t('auth.forgotErrorGeneric')
      )
      return
    }

    setSent(true)
  }

  return (
    <div className="min-h-screen bg-forge-bg flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md animate-slide-up">

          {/* Encabezado */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-px bg-forge-amber" />
              <span className="font-mono text-forge-subtle text-xs uppercase tracking-widest">
                {t('auth.forgotLabel')}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-3xl text-forge-text">
              {t('auth.forgotTitle')}
            </h1>
            <p className="font-mono text-forge-subtle text-sm mt-2">
              {t('auth.forgotSubtitle')}
            </p>
          </div>

          <div className="card border-forge-border">

            {/* ── Estado: email enviado ── */}
            {sent ? (
              <div className="animate-fade-in">
                <div
                  className="mb-5 px-4 py-4 border border-forge-green"
                  style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)' }}
                >
                  <p className="font-mono text-forge-green text-xs leading-relaxed">
                    {t('auth.forgotSuccess', { email })}<br />
                    {t('auth.forgotSuccessNote')}
                  </p>
                </div>
                <p className="font-mono text-forge-subtle text-xs text-center">
                  {t('auth.forgotDidntArrive')}{' '}
                  <button
                    onClick={() => setSent(false)}
                    className="text-forge-amber hover:underline transition-colors"
                  >
                    {t('auth.forgotRetry')}
                  </button>
                </p>
              </div>
            ) : (
              /* ── Formulario ── */
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-6">
                  <label
                    htmlFor="email"
                    className="block font-mono text-forge-subtle text-xs uppercase tracking-widest mb-2"
                  >
                    {t('auth.email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    required
                    autoComplete="email"
                    autoFocus
                    className="input-forge"
                  />
                </div>

                {error && (
                  <div
                    className="animate-fade-in mb-4 px-4 py-3 border border-forge-red"
                    style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)' }}
                  >
                    <p className="font-mono text-forge-red text-xs">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="btn-primary w-full"
                >
                  {loading ? t('auth.forgotLoading') : t('auth.forgotBtn')}
                </button>
              </form>
            )}
          </div>

          {/* Link volver al login */}
          <p className="font-mono text-forge-subtle text-xs text-center mt-6">
            <Link
              to="/login"
              className="text-forge-amber hover:underline transition-colors"
            >
              {t('auth.backToLogin')}
            </Link>
          </p>

        </div>
      </main>

      <footer className="forge-footer">
        <span>{t('landing.footer')}</span>
        <span>{t('landing.poweredBy')}</span>
      </footer>
    </div>
  )
}
