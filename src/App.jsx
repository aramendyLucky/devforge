import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from './store/index.jsx'
import { applyTheme } from './components/ui/ThemeSwitcher.jsx'
import i18n from './i18n/index.js'
import PrivateRoute       from './components/ui/PrivateRoute.jsx'
import Landing            from './pages/Landing.jsx'
import Login              from './pages/Login.jsx'
import Register           from './pages/Register.jsx'
import ForgotPassword    from './pages/ForgotPassword.jsx'
import ResetPassword     from './pages/ResetPassword.jsx'
import Onboarding         from './pages/Onboarding.jsx'
import Dashboard          from './pages/Dashboard.jsx'
import Session            from './pages/Session.jsx'
import Topic              from './pages/Topic.jsx'
import History            from './pages/History.jsx'
import QuickReview        from './pages/QuickReview.jsx'
import InterviewSetup     from './pages/InterviewSetup.jsx'
import Interview          from './pages/Interview.jsx'
import InterviewResults   from './pages/InterviewResults.jsx'
import InterviewHistory   from './pages/InterviewHistory.jsx'

/**
 * NoiseOverlay — capa de ruido visual fija sobre toda la app.
 * Da la textura "impresa" característica del diseño de DevForge.
 * aria-hidden="true" la oculta de los lectores de pantalla (es puramente decorativa).
 */
function NoiseOverlay() {
  return <div className="noise-overlay" aria-hidden="true" />
}

/**
 * ThemeInitializer — componente sin UI que aplica el tema guardado en el estado.
 *
 * ¿Por qué es un componente separado y no está directo en App?
 * Porque necesita acceder a useStore(), que es un hook. Los hooks solo pueden
 * usarse dentro de componentes funcionales. Al separarlo, App queda limpio
 * y este componente tiene una única responsabilidad: sincronizar el tema.
 *
 * Cada vez que state.config.theme cambia (el usuario cambia el tema),
 * useEffect dispara applyTheme() que actualiza la clase en el <html>.
 */
function ThemeInitializer() {
  const { state } = useStore()
  useEffect(() => {
    applyTheme(state.config?.theme || 'forge')
  }, [state.config?.theme])
  return null
}

/**
 * LanguageInitializer — sincroniza i18n con el idioma guardado en el store.
 *
 * Se ejecuta cada vez que state.config.language cambia, incluyendo cuando
 * LOAD_STATE carga los datos del usuario desde Supabase al hacer login.
 * Sin esto, el idioma del store y el de i18n quedan desincronizados.
 */
function LanguageInitializer() {
  const { state } = useStore()
  useEffect(() => {
    const lang = state.config?.language || 'es'
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang)
      localStorage.setItem('devforge_lang', lang)
    }
  }, [state.config?.language])
  return null
}

/**
 * App — componente raíz que define el sistema de rutas de DevForge.
 *
 * RUTAS PÚBLICAS (sin autenticación):
 *   /          → Landing page (página de bienvenida y marketing)
 *   /login     → Formulario de inicio de sesión
 *   /register  → Formulario de registro
 *
 * RUTAS PRIVADAS (requieren sesión activa — protegidas por <PrivateRoute>):
 *   /onboarding        → Setup inicial del usuario (primera vez)
 *   /dashboard         → Hub principal con progreso y recomendaciones
 *   /topic/:id         → Práctica de un tema específico
 *   /session           → Resultados de sesión activa
 *   /history           → Historial de sesiones pasadas
 *   /quick-review      → Revisión rápida de 5 preguntas
 *   /interview-setup   → Configuración de entrevista simulada
 *   /interview         → Entrevista simulada en progreso
 *   /interview-results → Resultados y análisis de la entrevista
 *   /interview-history → Historial de entrevistas pasadas
 *
 * ¿Cómo funciona <PrivateRoute>?
 * Envuelve el elemento de cada ruta protegida. Si el usuario no tiene sesión,
 * PrivateRoute lo redirige a /login (guardando la URL original para redirigirlo
 * después de que se loguee). Si sí tiene sesión, renderiza el elemento normal.
 */
export default function App() {
  return (
    <>
      <NoiseOverlay />
      <ThemeInitializer />
      <LanguageInitializer />
      <Routes>

        {/* ── Rutas públicas ─────────────────────────────────────────── */}
        {/* Cualquier visitante puede acceder, logueado o no */}
        <Route path="/"         element={<Landing />} />
        <Route path="/login"            element={<Login />} />
        <Route path="/register"         element={<Register />} />
        <Route path="/forgot-password"  element={<ForgotPassword />} />
        <Route path="/reset-password"   element={<ResetPassword />} />

        {/* ── Rutas privadas ─────────────────────────────────────────── */}
        {/* Solo accesibles con sesión activa — PrivateRoute actúa de guardia */}

        <Route path="/onboarding" element={
          <PrivateRoute><Onboarding /></PrivateRoute>
        } />

        <Route path="/dashboard" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />

        <Route path="/topic/:id" element={
          <PrivateRoute><Topic /></PrivateRoute>
        } />

        <Route path="/session" element={
          <PrivateRoute><Session /></PrivateRoute>
        } />

        <Route path="/history" element={
          <PrivateRoute><History /></PrivateRoute>
        } />

        <Route path="/quick-review" element={
          <PrivateRoute><QuickReview /></PrivateRoute>
        } />

        <Route path="/interview-setup" element={
          <PrivateRoute><InterviewSetup /></PrivateRoute>
        } />

        <Route path="/interview" element={
          <PrivateRoute><Interview /></PrivateRoute>
        } />

        <Route path="/interview-results" element={
          <PrivateRoute><InterviewResults /></PrivateRoute>
        } />

        <Route path="/interview-history" element={
          <PrivateRoute><InterviewHistory /></PrivateRoute>
        } />

        {/* Cualquier ruta no definida redirige al home */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </>
  )
}
