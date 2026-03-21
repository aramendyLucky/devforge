/**
 * src/__tests__/components/PrivateRoute.test.jsx
 *
 * TESTS DE PrivateRoute — guardia de rutas que requieren autenticación.
 *
 * ¿Qué testear en un guardia de rutas?
 *   1. Spinner mientras carga (loading=true) — evita flash de redirección
 *   2. Redirección a /login cuando no está autenticado
 *   3. Renderizado de children cuando está autenticado
 *   4. Que la URL actual se pasa en state.from para redirigir después del login
 *
 * Estrategia:
 *   Mockeamos useAuth() para controlar el estado de autenticación
 *   sin necesitar el AuthProvider completo.
 *   Usamos MemoryRouter para simular el router de React Router.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivateRoute from '../../components/ui/PrivateRoute.jsx'

// Mock de useAuth: lo controlamos en cada test
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../context/AuthContext.jsx'

// ── Wrapper de render con MemoryRouter ───────────────────────────────────
// MemoryRouter simula el historial de navegación sin un browser real.
// PrivateRoute usa useLocation (routing) así que necesita el Router context.
function renderPrivateRoute(children, initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PrivateRoute>{children}</PrivateRoute>
    </MemoryRouter>
  )
}

describe('PrivateRoute', () => {

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── Estado: Cargando ─────────────────────────────────────────────────────
  it('muestra spinner "Verificando sesión" mientras loading=true', () => {
    // ¿Por qué este test es crítico?
    // Sin el spinner, PrivateRoute mostraría el mensaje "redirect to /login"
    // durante los ~200ms que tarda Supabase en verificar la sesión.
    // Esto causaría un flash de /login para usuarios que SÍ tienen sesión.
    useAuth.mockReturnValue({ isAuthenticated: false, loading: true })

    renderPrivateRoute(<div>Contenido privado</div>)

    expect(screen.getByText('Verificando sesión')).toBeInTheDocument()
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })

  // ── Estado: No autenticado ───────────────────────────────────────────────
  it('renderiza un Navigate cuando loading=false y no está autenticado', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: false })

    // En tests, Navigate no cambia realmente la URL — pero sí renderiza.
    // Verificamos que el contenido protegido NO se muestra.
    renderPrivateRoute(<div>Contenido privado</div>)

    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument()
  })

  // ── Estado: Autenticado ──────────────────────────────────────────────────
  it('renderiza los children cuando loading=false y está autenticado', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })

    renderPrivateRoute(<div>Bienvenido al Dashboard</div>)

    expect(screen.getByText('Bienvenido al Dashboard')).toBeInTheDocument()
  })

  it('renderiza múltiples children sin problemas', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })

    renderPrivateRoute(
      <>
        <h1>Dashboard</h1>
        <p>Tu progreso</p>
      </>
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Tu progreso')).toBeInTheDocument()
  })

  // ── Transición loading → autenticado ─────────────────────────────────────
  it('no muestra el contenido mientras loading=true aunque isAuthenticated sea true', () => {
    // Caso edge: el usuario tiene sesión pero el contexto aún no terminó de cargar.
    // Igual mostramos el spinner para evitar renders prematuros.
    useAuth.mockReturnValue({ isAuthenticated: true, loading: true })

    renderPrivateRoute(<div>Contenido</div>)

    expect(screen.getByText('Verificando sesión')).toBeInTheDocument()
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument()
  })
})
