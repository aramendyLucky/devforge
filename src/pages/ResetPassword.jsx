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
 *
 * BUG CORREGIDO (race condition):
 *   El problema original era que `tokenOk` arrancaba en `false`, lo que
 *   hacía que el mensaje de "link inválido" apareciera INMEDIATAMENTE al
 *   cargar la página, ANTES de que Supabase procesara el token del hash.
 *
 *   Solución: agregamos `checking` (true por defecto) que muestra un spinner
 *   mientras Supabase procesa el hash. Sólo después de recibir el evento
 *   PASSWORD_RECOVERY (o que expire el timeout) mostramos el estado final.
 *
 *   Flujo correcto:
 *     checking=true  → spinner "Verificando link..."
 *     PASSWORD_RECOVERY dispara  → checking=false, tokenOk=true → formulario
 *     timeout (4s) sin evento    → checking=false, tokenOk=false → error
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Header from '../components/ui/Header.jsx'

export default function ResetPassword() {
  const navigate = useNavigate()

  // ── Estado del formulario ────────────────────────────────────────────────
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)   // enviando el update
  const [error,     setError]     = useState(null)
  const [done,      setDone]      = useState(false)   // contraseña actualizada con éxito

  // ── Estado del token ─────────────────────────────────────────────────────
  /**
   * checking: true mientras esperamos que Supabase procese el hash de la URL.
   * Arranca en true para mostrar un spinner en lugar del mensaje de error.
   * Se pone en false cuando llegue el evento PASSWORD_RECOVERY o el timeout.
   */
  const [checking,  setChecking]  = useState(true)

  /**
   * tokenOk: true si Supabase confirmó que el hash es un token de recovery válido.
   * Se define sólo cuando checking pasa a false.
   */
  const [tokenOk,   setTokenOk]   = useState(false)

  useEffect(() => {
    /**
     * Escuchamos el evento PASSWORD_RECOVERY que supabase-js dispara
     * cuando detecta un hash de tipo recovery en la URL.
     *
     * Si el evento llega → token válido → mostramos el formulario.
     * Si no llega en 4 segundos → token inválido/expirado → mostramos error.
     *
     * Los 4 segundos son conservadores: en la práctica supabase-js procesa
     * el hash en menos de 1 segundo, pero queremos dar margen para conexiones lentas.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Token válido — habilitamos el formulario
        setTokenOk(true)
        setChecking(false)
      }
    })

    // Timeout de seguridad: si a los 4 segundos no llegó el evento,
    // asumimos que el link es inválido o expiró.
    const timeout = setTimeout(() => {
      setChecking(prev => {
        // Si todavía estamos checking (el evento no llegó), marcamos como inválido
        if (prev) setTokenOk(false)
        return false
      })
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  /**
   * handleSubmit — valida y actualiza la contraseña en Supabase.
   *
   * supabase.auth.updateUser() usa la sesión temporal de recovery
   * establecida por el token del hash. Si la sesión expiró, devuelve error.
   *
   * Verificamos explícitamente que la sesión de recovery sigue activa ANTES
   * de intentar el update. Esto cubre el caso donde el usuario abrió el link,
   * dejó la pestaña abierta por más de 1 hora (el token de Supabase expira),
   * y recién entonces intentó cambiar la contraseña. Sin esta verificación,
   * updateUser() devolvería un error genérico difícil de interpretar.
   */
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

    // Verificación explícita de sesión antes del update
    // El token de recovery de Supabase expira en ~1 hora.
    // Si el usuario tardó demasiado, esta verificación lo detecta
    // y muestra un mensaje claro en lugar de un error genérico.
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (!currentSession?.user) {
      setLoading(false)
      setError('El link de recuperación expiró. Solicitá uno nuevo.')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (updateError) {
      setError('No se pudo cambiar la contraseña. El link puede haber expirado.')
      return
    }

    // Éxito: marcamos done y redirigimos al dashboard después de 2 segundos
    setDone(true)
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

            {/* ── Estado: verificando token (spinner) ── */}
            {checking ? (
              <div className="animate-fade-in text-center py-6">
                {/*
                 * Mostramos este spinner mientras Supabase procesa el hash.
                 * Sin este estado, el usuario vería "link inválido" por un flash
                 * de ~500ms antes de que llegue el evento PASSWORD_RECOVERY.
                 */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-forge-amber border-t-transparent rounded-full animate-spin" />
                  <p className="font-mono text-forge-subtle text-xs">
                    Verificando link de recuperación...
                  </p>
                </div>
              </div>

            ) : done ? (
              /* ── Estado: contraseña cambiada exitosamente ── */
              <div className="animate-fade-in text-center">
                <div
                  className="mb-5 px-4 py-4 border border-forge-green"
                  style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)' }}
                >
                  <p className="font-mono text-forge-green text-xs leading-relaxed">
                    Contrasena actualizada correctamente.<br />
                    Redirigiendo al dashboard...
                  </p>
                </div>
              </div>

            ) : !tokenOk ? (
              /* ── Estado: link inválido o expirado ── */
              <div className="animate-fade-in">
                <div
                  className="mb-5 px-4 py-4 border border-forge-red"
                  style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)' }}
                >
                  <p className="font-mono text-forge-red text-xs leading-relaxed">
                    El link de recuperacion es invalido o ya expiro.<br />
                    Solicitá uno nuevo desde la pantalla de login.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/forgot-password')}
                  className="btn-primary w-full"
                >
                  Solicitar nuevo link
                </button>
              </div>

            ) : (
              /* ── Estado: formulario de nueva contraseña ── */
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
                    placeholder="Minimo 8 caracteres"
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
                    Confirma la contraseña
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeti la contraseña"
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
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>
            )}
          </div>

        </div>
      </main>

      <footer className="forge-footer">
        <span>DevForge — preparacion tecnica</span>
        <span>Lucas Y.Aramendy</span>
      </footer>
    </div>
  )
}
