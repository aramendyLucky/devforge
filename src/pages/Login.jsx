/**
 * src/pages/Login.jsx
 *
 * PÁGINA DE LOGIN — formulario de inicio de sesión de DevForge.
 *
 * Funcionalidades:
 *   1. Login con email + contraseña (Supabase signInWithPassword)
 *   2. Redirección inteligente después del login:
 *      - Si el usuario venía de una ruta protegida (ej: /dashboard),
 *        lo llevamos ahí. Si no, lo llevamos al dashboard o al onboarding
 *        según si ya completó el setup inicial.
 *   3. Link a /register para usuarios nuevos
 *
 * Estilo: 100% consistente con el design system de DevForge.
 * Usa las mismas clases CSS (input-forge, btn-primary, card, divider, etc.)
 * y las mismas variables CSS de tema, por lo que responde a los 3 temas.
 */

import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'
import Header from '../components/ui/Header.jsx'


/**
 * Login — componente principal de la página de inicio de sesión.
 */
export default function Login() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { signIn } = useAuth()
  const { t }      = useTranslation()

  // ─── Estado del formulario ──────────────────────────────────────────────
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [resendStatus, setResendStatus] = useState(null) // null | 'sending' | 'sent' | 'error'

  /**
   * handleSubmit — maneja el envío del formulario de login.
   *
   * ── LECCIÓN APRENDIDA: race condition entre Auth y Store (Mar 2026) ────────
   *
   * PROBLEMA ORIGINAL:
   *   El flujo de login tiene DOS operaciones asíncronas que ocurren en cascada:
   *     1. signIn() → Supabase autentica → AuthContext setea user
   *     2. El useEffect del store detecta el nuevo user → llama loadUserData()
   *        → carga todo el perfil de Supabase → dispatch(LOAD_STATE)
   *
   *   Antes, después del signIn() leíamos state.config.onboardingDone para
   *   decidir si navegar a /dashboard o /onboarding. PERO ese valor viene
   *   del store, y el store aún no había terminado loadUserData() en ese momento.
   *   El resultado: onboardingDone era siempre false → siempre iba al onboarding,
   *   aunque el usuario ya lo hubiera completado.
   *
   * POR QUÉ ERA DIFÍCIL DE DETECTAR:
   *   - En desarrollo, si la app ya estaba montada y el store cargado, el bug
   *     no se reproducía (el estado persistía en el provider).
   *   - Solo se reproducía en cada LOGIN FRESCO (token nuevo, store vacío).
   *   - El error en syncProfile estaba silenciado en un catch → nunca aparecía
   *     en consola → parecía que todo funcionaba.
   *
   * SOLUCIÓN — dos capas de fix:
   *   1. En db.js/syncProfile: separar el campo `language` en un upsert
   *      independiente para que un campo opcional nunca rompa el guardado
   *      del campo crítico (onboarding_done). Esto hizo que el perfil se guardara.
   *
   *   2. Acá en Login.jsx: después del signIn(), NO leer el store (que está vacío
   *      en el momento del login). En cambio, hacer UNA QUERY DIRECTA a Supabase
   *      para obtener onboarding_done actualizado. Así la navegación siempre
   *      usa el valor real de la DB, independientemente del estado del store.
   *
   * REGLA GENERAL: nunca uses el store para decisiones de navegación
   *   inmediatamente después del login. El store carga datos de forma asíncrona
   *   y puede estar en estado inicial cuando navegás. Si necesitás un dato de la
   *   DB para decidir la navegación, consultá Supabase directamente.
   */
  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Paso 1: autenticamos con Supabase — ahora devuelve también el user
    const { error: signInError, user } = await signIn(email, password)

    if (signInError) {
      setError(translateError(signInError.message))
      setResendStatus(null)
      // Guardamos si el error es específicamente de email no confirmado
      // para mostrar el botón de reenvío en el template
      if (signInError.message === 'Email not confirmed') {
        setResendStatus('unconfirmed')
      }
      setLoading(false)
      return
    }

    // Paso 2: si venía de una ruta protegida (guardada por PrivateRoute),
    // lo mandamos ahí directamente sin necesitar el perfil
    const from = location.state?.from?.pathname
    if (from && from !== '/login' && from !== '/register') {
      navigate(from, { replace: true })
      return
    }

    // Paso 3: consultamos el perfil real en Supabase para saber si
    // el usuario ya completó el onboarding o es su primera vez
    // No podemos usar el store porque loadUserData aún no terminó
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_done')   // solo necesitamos este campo
      .eq('user_id', user.id)
      .single()

    // Si onboarding_done es true → ya completó el setup → dashboard
    // Si es false, null, o no existe el perfil (usuario nuevo) → onboarding
    const destination = profile?.onboarding_done ? '/dashboard' : '/onboarding'
    navigate(destination, { replace: true })
  }

  // Reenvía el email de confirmación de cuenta.
  // Solo se llama cuando el error es "Email not confirmed".
  async function handleResend() {
    setResendStatus('sending')
    const { error: resendError } = await supabase.auth.resend({
      type:  'signup',
      email: email.trim(),
    })
    setResendStatus(resendError ? 'error' : 'sent')
  }

  /**
   * translateError — convierte mensajes de error de Supabase al español.
   *
   * Supabase devuelve errores en inglés. Los traducimos para mantener
   * la experiencia del usuario en español, consistente con el resto de la app.
   *
   * @param {string} message — mensaje de error original de Supabase
   * @returns {string} — mensaje en español para mostrar al usuario
   */
  function translateError(message) {
    const errorMap = {
      'Invalid login credentials':  t('auth.errorWrongCredentials'),
      'Email not confirmed':        t('auth.errorConfirmEmail'),
      'Too many requests':          t('auth.errorRateLimit'),
      'User not found':             t('auth.errorNoAccount'),
    }
    return errorMap[message] ?? `Error: ${message}`
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-forge-bg flex flex-col">

      {/* Header compartido con el resto de la app */}
      <Header />

      {/* Contenido central */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md animate-slide-up">

          {/* ── Encabezado de la sección ── */}
          <div className="mb-8">
            {/* Línea decorativa estilo DevForge */}
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-px bg-forge-amber" />
              <span className="font-mono text-forge-subtle text-xs uppercase tracking-widest">
                {t('auth.loginLabel')}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-3xl text-forge-text">
              {t('auth.loginTitle')}
            </h1>
            <p className="font-mono text-forge-subtle text-sm mt-2">
              {t('auth.loginSubtitle')}
            </p>
          </div>

          {/* ── Card principal del formulario ── */}
          <div className="card border-forge-border">

            {/* ── Formulario email + contraseña ── */}
            <form onSubmit={handleSubmit} noValidate>
              {/*
                noValidate: desactivamos la validación nativa del browser
                porque queremos controlar el UX de errores nosotros mismos
              */}

              {/* Campo email */}
              <div className="mb-4">
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
                  // input-forge: clase de globals.css con el estilo consistente
                  className="input-forge"
                />
              </div>

              {/* Campo contraseña */}
              <div className="mb-6">
                <label
                  htmlFor="password"
                  className="block font-mono text-forge-subtle text-xs uppercase tracking-widest mb-2"
                >
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  required
                  autoComplete="current-password"
                  className="input-forge"
                />
              </div>

              {/* ── Mensaje de error ── */}
              {error && (
                <div className="animate-fade-in mb-4">
                  <div
                    className="px-4 py-3 border border-forge-red"
                    style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)' }}
                  >
                    <p className="font-mono text-forge-red text-xs">{error}</p>
                  </div>

                  {/* Botón de reenvío — solo cuando el email no está confirmado */}
                  {resendStatus === 'unconfirmed' && (
                    <div className="mt-2 px-4 py-3 border border-forge-border"
                      style={{ background: 'var(--surface)' }}
                    >
                      <p className="font-mono text-forge-subtle text-xs mb-2">
                        {t('auth.resendQuestion')}
                      </p>
                      <button
                        type="button"
                        onClick={handleResend}
                        className="font-mono text-forge-amber text-xs hover:underline transition-colors"
                      >
                        {t('auth.resendBtn')}
                      </button>
                    </div>
                  )}

                  {/* Feedback del reenvío */}
                  {resendStatus === 'sending' && (
                    <p className="font-mono text-forge-subtle text-xs mt-2 text-center">
                      {t('auth.resendLoading')}
                    </p>
                  )}
                  {resendStatus === 'sent' && (
                    <div className="mt-2 px-4 py-3 border border-forge-green"
                      style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)' }}
                    >
                      <p className="font-mono text-forge-green text-xs">
                        {t('auth.resendSuccess')}
                      </p>
                    </div>
                  )}
                  {resendStatus === 'error' && (
                    <p className="font-mono text-forge-red text-xs mt-2 text-center">
                      {t('auth.resendError')}
                    </p>
                  )}
                </div>
              )}

              {/* ── Botón de submit ── */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? t('auth.loginLoading') : t('auth.loginBtn')}
              </button>

              {/* ── Link recuperar contraseña ── */}
              <p className="font-mono text-forge-subtle text-xs text-center mt-4">
                <Link
                  to="/forgot-password"
                  className="hover:text-forge-amber transition-colors"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </p>
            </form>
          </div>

          {/* ── Link a registro ── */}
          <p className="font-mono text-forge-subtle text-xs text-center mt-6">
            {t('auth.noAccount')}{' '}
            <Link
              to="/register"
              className="text-forge-amber hover:underline transition-colors"
            >
              {t('auth.register')}
            </Link>
          </p>

        </div>
      </main>

      {/* Footer consistente con el resto de la app */}
      <footer className="forge-footer">
        <span>{t('landing.footer')}</span>
        <span>{t('landing.poweredBy')}</span>
      </footer>

    </div>
  )
}
