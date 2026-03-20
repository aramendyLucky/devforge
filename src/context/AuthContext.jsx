/**
 * src/context/AuthContext.jsx
 *
 * CONTEXTO DE AUTENTICACIÓN — el "cerebro" del sistema de auth de DevForge.
 *
 * ¿Qué es un Context en React?
 * Es una forma de compartir datos entre componentes sin tener que pasarlos
 * manualmente por props en cada nivel del árbol. En este caso, cualquier
 * componente de la app puede saber si hay un usuario logueado, quién es,
 * y puede llamar a signIn/signOut sin importar dónde esté en el árbol.
 *
 * ¿Por qué está separado del StoreContext (store/index.jsx)?
 * Porque tienen responsabilidades distintas:
 *   - AuthContext → ¿quién sos? (sesión, tokens, identidad)
 *   - StoreContext → ¿qué hiciste? (progreso, historial, configuración)
 * Mezclarlos crearía un contexto gigante, difícil de testear y de mantener.
 *
 * Flujo general:
 *   1. Al montar <AuthProvider>, se llama a supabase.auth.getSession()
 *      para ver si ya hay una sesión activa (ej: usuario que no cerró sesión)
 *   2. Se suscribe a onAuthStateChange para recibir cambios en tiempo real
 *      (login, logout, expiración de token, refresh automático)
 *   3. Expone { user, session, loading, signIn, signUp, signOut, signInWithGoogle }
 *      a toda la app mediante el hook useAuth()
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Creación del contexto ────────────────────────────────────────────────────
// El valor inicial es null — significa "no hay contexto todavía"
// Si alguien usa useAuth() fuera de <AuthProvider>, lo detectamos y avisamos
const AuthContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
/**
 * AuthProvider — componente que envuelve toda la app (en main.jsx).
 *
 * @param {React.ReactNode} children — todo el árbol de componentes de la app
 *
 * Mantiene en su estado local:
 *   - user: objeto con info del usuario autenticado (email, id, metadata)
 *           null si no hay sesión activa
 *   - session: objeto completo de Supabase con access_token, refresh_token, etc.
 *              null si no hay sesión activa
 *   - loading: true mientras verificamos si hay sesión al iniciar la app
 *              Mientras loading=true, mostramos un spinner en PrivateRoute
 *              para no redirigir al usuario antes de saber si está logueado
 */
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)    // datos del usuario autenticado
  const [session, setSession] = useState(null)    // sesión completa (tokens)
  const [loading, setLoading] = useState(true)    // esperando respuesta inicial de Supabase

  useEffect(() => {
    /**
     * PASO 1: Verificar si ya existe una sesión guardada.
     *
     * Supabase guarda el token en localStorage automáticamente.
     * Al recargar la app, getSession() lo recupera sin pedirle al usuario
     * que vuelva a loguearse. Esto es lo que hace que "la sesión persista".
     */
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)  // si hay sesión, extraemos el user; si no, null
      setLoading(false)               // terminamos de verificar → ya podemos renderizar
    })

    /**
     * PASO 2: Suscribirse a cambios de autenticación en tiempo real.
     *
     * onAuthStateChange dispara un callback cada vez que:
     *   - El usuario hace login (event = 'SIGNED_IN')
     *   - El usuario hace logout (event = 'SIGNED_OUT')
     *   - El token expira y se refresca automáticamente (event = 'TOKEN_REFRESHED')
     *   - El usuario confirma su email (event = 'USER_UPDATED')
     *
     * Esto es crucial: garantiza que el estado de la app siempre refleja
     * la realidad de la sesión, sin polling ni timers manuales.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    /**
     * LIMPIEZA: cuando el componente se desmonta (raro, pero posible),
     * cancelamos la suscripción para evitar memory leaks.
     * Es el equivalente a removeEventListener en el mundo vanilla JS.
     */
    return () => subscription.unsubscribe()
  }, []) // [] → solo se ejecuta al montar el componente, una sola vez

  // ─── Funciones de autenticación ───────────────────────────────────────────

  /**
   * signIn — inicia sesión con email y contraseña.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ error: Error|null, user: Object|null }>}
   *
   * Retornamos tanto el error como el user para que Login.jsx pueda
   * usar el user.id inmediatamente después del login, sin esperar
   * a que el store termine de cargar los datos desde Supabase.
   * Esto resuelve la race condition donde navigate() se ejecutaba
   * antes de que loadUserData() terminara.
   */
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { error, user: data?.user ?? null }
  }

  /**
   * signUp — registra un nuevo usuario con email y contraseña.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ error: Error|null, needsConfirmation: boolean }>}
   *
   * needsConfirmation: true si Supabase tiene activado el "confirm email"
   * en su configuración. En ese caso, el usuario recibe un email y debe
   * hacer click antes de poder loguearse. Si está desactivado, el login
   * es inmediato después del registro.
   */
  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })

    // Si el usuario existe pero no confirmó su email, Supabase devuelve
    // un objeto con identities vacío en lugar de un error explícito.
    // Lo normalizamos para que Register.jsx lo maneje consistentemente.
    const needsConfirmation = !error && !data.session

    return { error, needsConfirmation }
  }

  /**
   * signOut — cierra la sesión del usuario.
   *
   * Supabase borra el token de localStorage y dispara onAuthStateChange
   * con event='SIGNED_OUT', lo que setea user y session a null automáticamente.
   * El componente PrivateRoute redirige al usuario a /login.
   */
  async function signOut() {
    await supabase.auth.signOut()
  }

  /**
   * signInWithGoogle — OAuth con Google.
   *
   * Redirige al usuario a la pantalla de login de Google.
   * Después de autenticarse, Google redirige de vuelta a la app
   * en la URL configurada en Supabase (Authentication → URL Configuration).
   *
   * redirectTo: la URL a la que Supabase redirige después del OAuth.
   * En desarrollo es localhost, en producción sería tu dominio real.
   */
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Redirige al dashboard después del login con Google
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    return { error }
  }

  // ─── Valor expuesto al contexto ───────────────────────────────────────────
  // Todo lo que listamos acá es accesible desde cualquier componente
  // que llame al hook useAuth()
  const value = {
    user,             // objeto con email, id, metadata del usuario — null si no está logueado
    session,          // sesión completa con tokens — null si no está logueado
    loading,          // true mientras carga el estado inicial
    signIn,           // fn(email, password) → { error }
    signUp,           // fn(email, password) → { error, needsConfirmation }
    signOut,          // fn() → void
    signInWithGoogle, // fn() → { error }
    isAuthenticated: !!user, // booleano conveniente: true si hay usuario
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook de acceso ───────────────────────────────────────────────────────────
/**
 * useAuth — hook personalizado para consumir el AuthContext.
 *
 * Uso en cualquier componente:
 *   const { user, signIn, signOut, isAuthenticated } = useAuth()
 *
 * Lanza un error descriptivo si se usa fuera de <AuthProvider>,
 * lo que evita bugs silenciosos difíciles de rastrear.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('[DevForge] useAuth() debe usarse dentro de <AuthProvider>. ' +
      'Verificá que <AuthProvider> esté en main.jsx envolviendo toda la app.')
  }
  return ctx
}
