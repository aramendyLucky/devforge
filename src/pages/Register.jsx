/**
 * src/pages/Register.jsx
 *
 * PÁGINA DE REGISTRO — formulario de creación de cuenta en DevForge.
 *
 * Funcionalidades:
 *   1. Registro con email + contraseña (Supabase signUp)
 *   2. Registro con Google (OAuth — mismo flujo que Login)
 *   3. Validación de contraseña en el cliente antes de enviar a Supabase:
 *      - Mínimo 6 caracteres (requerimiento de Supabase por defecto)
 *      - Confirmación de contraseña (los dos campos deben coincidir)
 *   4. Manejo de dos escenarios post-registro:
 *      a. Supabase con "confirm email" activado → mostramos mensaje de verificación
 *      b. Supabase sin "confirm email" → login automático, redirigimos al onboarding
 *
 * ¿Por qué validamos en el cliente si Supabase también valida?
 * Para dar feedback inmediato sin esperar el round-trip al servidor.
 * La validación del servidor sigue siendo necesaria como última línea de defensa.
 *
 * Estilo: 100% consistente con el design system de DevForge.
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import Header from '../components/ui/Header.jsx'

/**
 * ConfirmationMessage — pantalla de éxito cuando Supabase requiere
 * confirmación de email antes de activar la cuenta.
 *
 * @param {string} email — el email al que se envió el link de confirmación
 * @param {function} onBack — callback para volver al formulario si el usuario
 *                            quiere intentar con otro email
 */
function ConfirmationMessage({ email, onBack }) {
  const { t } = useTranslation()
  return (
    <div className="w-full max-w-md animate-slide-up">

      {/* Encabezado */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-px bg-forge-amber" />
          <span className="font-mono text-forge-subtle text-xs uppercase tracking-widest">
            {t('auth.verifyLabel')}
          </span>
        </div>
        <h1 className="font-display font-extrabold text-3xl text-forge-text">
          {t('auth.verifyTitle')}
        </h1>
      </div>

      {/* Card con el mensaje */}
      <div className="card border-forge-border">
        <div
          className="font-mono text-forge-amber text-4xl font-bold mb-4 opacity-60"
          aria-hidden="true"
        >
          [ @ ]
        </div>

        <p className="font-mono text-forge-subtle text-sm leading-relaxed mb-4">
          {t('auth.verifySent')}
        </p>

        <p className="font-mono text-forge-text text-sm font-bold mb-6 px-3 py-2 border border-forge-border bg-forge-bg">
          {email}
        </p>

        <p className="font-mono text-forge-subtle text-xs leading-relaxed mb-6">
          {t('auth.verifyInstruction')}
        </p>

        <button onClick={onBack} className="btn-secondary w-full">
          {t('auth.verifyOtherEmail')}
        </button>
      </div>

      <p className="font-mono text-forge-subtle text-xs text-center mt-6">
        {t('auth.verifyConfirmed')}{' '}
        <Link to="/login" className="text-forge-amber hover:underline">
          {t('auth.loginLink')}
        </Link>
      </p>
    </div>
  )
}

/**
 * Register — componente principal de la página de registro.
 */
export default function Register() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const { t } = useTranslation()

  // ─── Estado del formulario ──────────────────────────────────────────────
  const [email, setEmail]             = useState('')    // campo email
  const [password, setPassword]       = useState('')    // campo contraseña
  const [confirmPassword, setConfirmPassword] = useState('') // confirmación
  const [error, setError]             = useState(null)  // error a mostrar
  const [loading, setLoading]         = useState(false) // submit en proceso
  const [confirmed, setConfirmed]     = useState(false) // ¿mostrar pantalla de éxito?

  /**
   * validateForm — valida los campos del formulario antes de enviar a Supabase.
   *
   * Hacemos esto en el cliente para dar feedback inmediato.
   * Retorna null si todo está OK, o un string con el mensaje de error.
   *
   * @returns {string|null}
   */
  function validateForm() {
    if (!email.includes('@') || !email.includes('.')) {
      return t('auth.errorInvalidEmail')
    }
    if (password.length < 6) {
      return t('auth.errorShortPassword')
    }
    if (password !== confirmPassword) {
      return t('auth.errorPasswordMatch')
    }
    return null
  }

  /**
   * handleSubmit — maneja el envío del formulario de registro.
   *
   * Flujo:
   *   1. Valida el formulario en el cliente
   *   2. Llama a signUp() del AuthContext
   *   3. Escenario A: Supabase pide confirmación de email → mostramos pantalla de aviso
   *   4. Escenario B: registro + login automático → redirigimos al onboarding
   */
  async function handleSubmit(e) {
    e.preventDefault()  // evita recarga de página
    setError(null)

    // Validación en cliente antes de hacer el request
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return // no seguimos si hay error de validación
    }

    setLoading(true)

    const { error, needsConfirmation } = await signUp(email, password)

    if (error) {
      setError(translateError(error.message))
      setLoading(false)
      return
    }

    if (needsConfirmation) {
      // Supabase tiene activado "confirm email" → mostramos pantalla de aviso
      // El usuario debe ir a su casilla y clickear el link antes de poder loguearse
      setConfirmed(true)
      setLoading(false)
      return
    }

    // Registro exitoso con login automático (sin confirmación de email)
    // → redirigimos al onboarding porque es un usuario nuevo
    navigate('/onboarding', { replace: true })
  }

  /**
   * translateError — traduce errores de Supabase al español.
   * Igual que en Login.jsx, pero con mensajes específicos de registro.
   */
  function translateError(message) {
    const errorMap = {
      'User already registered':                          t('auth.errorEmailExists'),
      'Password should be at least 6 characters':        t('auth.errorShortPassword'),
      'Unable to validate email address: invalid format': t('auth.errorInvalidEmailFormat'),
      'Signup is disabled':                               t('auth.errorDisabled'),
      'Too many requests':                                t('auth.errorRateLimit'),
    }
    return errorMap[message] ?? `Error: ${message}`
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-forge-bg flex flex-col">

      {/* Header compartido */}
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-16">

        {/* Si el usuario se registró y Supabase pide confirmación, mostramos
            la pantalla de éxito en lugar del formulario */}
        {confirmed ? (
          <ConfirmationMessage
            email={email}
            onBack={() => setConfirmed(false)} // permite volver al form
          />
        ) : (
          <div className="w-full max-w-md animate-slide-up">

            {/* ── Encabezado ── */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-px bg-forge-amber" />
                <span className="font-mono text-forge-subtle text-xs uppercase tracking-widest">
                  {t('auth.registerLabel')}
                </span>
              </div>
              <h1 className="font-display font-extrabold text-3xl text-forge-text">
                {t('auth.registerTitle')}
              </h1>
              <p className="font-mono text-forge-subtle text-sm mt-2">
                {t('auth.registerSubtitle')}
              </p>
            </div>

            {/* ── Card del formulario ── */}
            <div className="card border-forge-border">

              {/* ── Formulario ── */}
              <form onSubmit={handleSubmit} noValidate>

                {/* Campo email */}
                <div className="mb-4">
                  <label
                    htmlFor="email"
                    className="block font-mono text-forge-subtle text-xs uppercase tracking-widest mb-2"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    required
                    autoComplete="email"
                    className="input-forge"
                  />
                </div>

                {/* Campo contraseña */}
                <div className="mb-4">
                  <label
                    htmlFor="password"
                    className="block font-mono text-forge-subtle text-xs uppercase tracking-widest mb-2"
                  >
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('auth.passwordMin')}
                    required
                    autoComplete="new-password"
                    className="input-forge"
                  />
                </div>

                {/* Campo confirmación de contraseña */}
                <div className="mb-6">
                  <label
                    htmlFor="confirm-password"
                    className="block font-mono text-forge-subtle text-xs uppercase tracking-widest mb-2"
                  >
                    {t('auth.confirmPassword')}
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.repeatPassword')}
                    required
                    autoComplete="new-password"
                    className="input-forge"
                  />
                </div>

                {/* ── Mensaje de error ── */}
                {error && (
                  <div
                    className="animate-fade-in mb-4 px-4 py-3 border border-forge-red"
                    style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)' }}
                  >
                    <p className="font-mono text-forge-red text-xs">{error}</p>

                    {/* Si el error es que el usuario ya existe, ofrecemos ir al login */}
                    {error.includes('Ya existe una cuenta') && (
                      <Link
                        to="/login"
                        className="block mt-2 text-forge-amber text-xs hover:underline"
                      >
                        Ir al login →
                      </Link>
                    )}
                  </div>
                )}

                {/* ── Botón submit ── */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? t('auth.registerLoading') : t('auth.registerBtn')}
                </button>

              </form>
            </div>

            {/* ── Link al login ── */}
            <p className="font-mono text-forge-subtle text-xs text-center mt-6">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-forge-amber hover:underline">
                {t('auth.loginLink')}
              </Link>
            </p>

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="forge-footer">
        <span>{t('landing.footer')}</span>
        <span>{t('landing.poweredBy')}</span>
      </footer>

    </div>
  )
}
