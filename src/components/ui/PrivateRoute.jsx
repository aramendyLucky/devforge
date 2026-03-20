/**
 * src/components/ui/PrivateRoute.jsx
 *
 * GUARDIA DE RUTAS PROTEGIDAS — decide si un usuario puede ver una página.
 *
 * ¿Qué problema resuelve?
 * Sin este componente, cualquier persona podría navegar directamente a
 * /dashboard o /session escribiendo la URL, aunque no esté logueada.
 * PrivateRoute actúa como portero: si no hay sesión, te manda al login.
 *
 * ¿Cómo funciona con React Router v6?
 * En lugar de <Route element={<Dashboard />}> ponemos
 * <Route element={<PrivateRoute><Dashboard /></PrivateRoute>}>
 *
 * Internamente, PrivateRoute decide qué renderizar:
 *   - loading=true  → spinner (evita redirección prematura antes de saber el estado)
 *   - autenticado   → renderiza los children (la página solicitada)
 *   - no autenticado → <Navigate to="/login"> con el estado de la URL original
 *
 * ¿Por qué guardamos la URL original en el state de Navigate?
 * Para que después del login, podamos redirigir al usuario a donde quería ir.
 * Ejemplo: el usuario va a /dashboard → lo mandamos a /login?from=/dashboard
 * → después del login, lo llevamos a /dashboard (no al home).
 * En Login.jsx lo recuperamos con useLocation() y location.state?.from.
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * PrivateRoute — componente guardia para rutas que requieren autenticación.
 *
 * @param {React.ReactNode} children — el componente de página a proteger
 *
 * Uso en App.jsx:
 *   <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
 */
export default function PrivateRoute({ children }) {
  // Obtenemos el estado de autenticación desde el contexto global
  const { isAuthenticated, loading } = useAuth()

  // useLocation nos da la URL actual para guardarla y redirigir después del login
  const location = useLocation()

  // ── Estado 1: Cargando ────────────────────────────────────────────────────
  // Mientras Supabase verifica si hay una sesión activa (getSession),
  // no sabemos si el usuario está logueado o no.
  // Si renderizamos <Navigate to="/login"> en este momento, mandaríamos
  // al login a usuarios que SÍ tienen sesión válida, lo cual es un bug grave.
  // La solución: mostrar un spinner mientras esperamos la respuesta inicial.
  if (loading) {
    return (
      <div
        // Pantalla completa centrada, con el color de fondo del tema activo
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: 'var(--bg)',
        }}
      >
        {/* Indicador visual de carga — estilo terminal con cursor parpadeante */}
        <div
          style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '12px',
            color: 'var(--subtle)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
          className="cursor-blink" // clase de globals.css: █ parpadeante
        >
          Verificando sesión
        </div>
      </div>
    )
  }

  // ── Estado 2: No autenticado ──────────────────────────────────────────────
  // El usuario no tiene sesión activa → lo redirigimos al login.
  // Guardamos la URL actual en state.from para poder redirigirlo después
  // de que se loguee exitosamente.
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }} // { from: { pathname: '/dashboard', ... } }
        replace                    // replace=true evita que /dashboard quede en el historial
                                   // del navegador como página visitada sin sesión
      />
    )
  }

  // ── Estado 3: Autenticado ─────────────────────────────────────────────────
  // El usuario tiene sesión válida → renderizamos la página solicitada
  return children
}
