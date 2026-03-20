/**
 * src/pages/ResetPassword.jsx
 *
 * RECUPERACIÓN DE CONTRASEÑA — paso 2: el usuario llega acá desde el
 * link del email de Supabase y establece su nueva contraseña.
 *
 * ¿Cómo funciona el token?
 *   Supabase incluye el access_token en el HASH de la URL (no en query params).
 *   Ejemplo: /reset-password#access_token=xxx&type=recovery
 *   El cliente de Supabase (supabase-js) detecta automáticamente este hash
 *   al inicializarse y establece una sesión temporal de tipo "recovery".
 *   Luego llamamos a supabase.auth.updateUser({ password }) para cambiarla.
 *
 * ¿Por qué en el hash y no en query params?
 *   El hash nunca se envía al servidor — queda solo en el cliente.
 *   Es más seguro porque los tokens no aparecen en logs de servidor.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Header from '../components/ui/Header.jsx'

export default function ResetPassword() {
  const navigate = useNavigate()

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [tokenOk,   setTokenOk]   = useState(false)  // el hash de la URL es válido
  const [done,      setDone]      = useState(false)

  // Verificamos que la URL tenga un token de recovery válido.
  // supabase-js dispara el evento PASSWORD_RECOVERY cuando detecta
  // un hash con type=recovery en la URL.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTokenOk(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (updateError) {
      setError('No se pudo cambiar la contraseña. El link puede haber expirado.')
      return
    }

    setDone(true)
    // Redirigimos al dashboard después de 2 segundos
    setTimeout(() => navigate('/dashboard', { replace: true }), 2000)
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
                Nueva contraseña
              </span>
            </div>
            <h1 className="font-display font-extrabold text-3xl text-forge-text">
              Resetear contraseña
            </h1>
            <p className="font-mono text-forge-subtle text-sm mt-2">
              Elegí una contraseña nueva para tu cuenta.
            </p>
          </div>

          <div className="card border-forge-border">

            {/* ── Estado: contraseña cambiada exitosamente ── */}
            {done ? (
              <div className="animate-fade-in text-center">
                <div
                  className="mb-5 px-4 py-4 border border-forge-green"
                  style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)' }}
                >
                  <p className="font-mono text-forge-green text-xs leading-relaxed">
                    ✓ Contraseña actualizada correctamente.<br />
                    Redirigiendo al dashboard...
                  </p>
                </div>
              </div>

            ) : !tokenOk ? (
              /* ── Link inválido o expirado ── */
              <div className="animate-fade-in">
                <div
                  className="mb-5 px-4 py-4 border border-forge-red"
                  style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)' }}
                >
                  <p className="font-mono text-forge-red text-xs leading-relaxed">
                    El link de recuperación es inválido o ya expiró.<br />
                    Solicitá uno nuevo desde la pantalla de login.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/forgot-password')}
                  className="btn-primary w-full"
                >
                  Solicitar nuevo link →
                </button>
              </div>

            ) : (
              /* ── Formulario de nueva contraseña ── */
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                  <label
                    htmlFor="password"
                    className="block font-mono text-forge-subtle text-xs uppercase tracking-widest mb-2"
                  >
                    Nueva contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    autoFocus
                    autoComplete="new-password"
                    className="input-forge"
                  />
                </div>

                <div className="mb-6">
                  <label
                    htmlFor="confirm"
                    className="block font-mono text-forge-subtle text-xs uppercase tracking-widest mb-2"
                  >
                    Confirmá la contraseña
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repetí la contraseña"
                    required
                    autoComplete="new-password"
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
                  disabled={loading || !password || !confirm}
                  className="btn-primary w-full"
                >
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña →'}
                </button>
              </form>
            )}
          </div>

        </div>
      </main>

      <footer className="forge-footer">
        <span>DevForge — preparación técnica</span>
        <span>Powered by Claude</span>
      </footer>
    </div>
  )
}
