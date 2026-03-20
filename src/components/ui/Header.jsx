import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore, ACTIONS } from '../../store/index.jsx'
import { useAuth } from '../../context/AuthContext'
import { useTheme, useFont } from './ThemeSwitcher.jsx'
import ResourcePanel from './ResourcePanel.jsx'
import { TOPICS } from '../../data/topics.js'

// ─── Opciones de fuente ────────────────────────────────────
const FONT_OPTIONS = [
  {
    id: 'forge',
    label: 'Forge',
    desc: 'Syne · Space Mono',
    detail: 'Display geométrico + monoespaciado técnico',
    preview: { display: 'Syne, sans-serif', mono: 'Space Mono, monospace' },
  },
  {
    id: 'clean',
    label: 'Clean',
    desc: 'Inter · JetBrains Mono',
    detail: 'Sans-serif legible + código moderno',
    preview: { display: 'Inter, sans-serif', mono: 'JetBrains Mono, monospace' },
  },
  {
    id: 'terminal',
    label: 'Terminal',
    desc: 'Space Mono · Space Mono',
    detail: 'Estética hacker · todo monoespaciado',
    preview: { display: 'Space Mono, monospace', mono: 'Space Mono, monospace' },
  },
]

// ─── Temas ────────────────────────────────────────────────
const THEME_OPTIONS = [
  { id: 'forge', label: 'Forge Dark',   desc: 'Negro carbón · Ámbar · Alto contraste',     primary: '#f59e0b', bg: '#0e0e0e', surface: '#161616', border: '#2a2a2a', dots: ['#0e0e0e','#161616','#f59e0b','#f97316','#888'] },
  { id: 'dusk',  label: 'Dusk Stone',   desc: 'Carbón verdoso · Musgo · Nocturno suave',   primary: '#89B99A', bg: '#2C2E2B', surface: '#363830', border: '#4A4D43', dots: ['#2C2E2B','#363830','#89B99A','#C4B99A','#9A9'] },
  { id: 'chalk', label: 'Chalk & Sage', desc: 'Arena cálida · Tiza · Verde sage orgánico', primary: '#6BAE8C', bg: '#F5F0E6', surface: '#FDFAF4', border: '#E0D9CE', dots: ['#F5F0E6','#FDFAF4','#6BAE8C','#A8C5B0','#9A8'] },
]

// ─── Mini preview ─────────────────────────────────────────
function ThemePreview({ t }) {
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 3, overflow: 'hidden', height: 48, marginBottom: 8 }}>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.primary }} />
        <div style={{ flex: 1, height: 2, background: t.border, borderRadius: 2 }} />
      </div>
      <div style={{ padding: '5px 6px', display: 'flex', gap: 4 }}>
        <div style={{ width: 16, background: t.surface, borderRadius: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 3, background: t.primary, borderRadius: 2, width: '55%', marginBottom: 2 }} />
          <div style={{ height: 2, background: t.border, borderRadius: 2, width: '80%', marginBottom: 2 }} />
          <div style={{ height: 2, background: t.border, borderRadius: 2, width: '60%' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Acordeón ─────────────────────────────────────────────
function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid var(--border)', marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: open ? 'var(--surface)' : 'var(--card)', border: 'none', cursor: 'pointer', color: 'var(--text)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>{icon}</span><span>{title}</span></span>
        <span style={{ fontSize: 9, color: 'var(--subtle)', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && <div style={{ padding: 14, background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  )
}

// ─── Panel de ajustes ─────────────────────────────────────
function SettingsPanel({ onClose }) {
  const { state, dispatch } = useStore()
  const { activeTheme, setTheme } = useTheme()
  const { activeFont, setFont } = useFont()
  const { signOut }             = useAuth()   // función de cierre de sesión de Supabase
  const navigate                = useNavigate()
  const [nombre, setNombre] = useState(state.user?.name || '')
  const [saved, setSaved]   = useState(false)
  const [loggingOut, setLoggingOut] = useState(false) // evita doble click en logout

  // Idioma activo desde el store (defecto 'es' si aún no está guardado)
  const activeLanguage = state.config?.language || 'es'

  function guardar() {
    if (!nombre.trim()) return
    dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'name', value: nombre.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  /**
   * cambiarIdioma — guarda la preferencia de idioma en el store.
   *
   * Por ahora solo persiste la elección en Supabase.
   * Las traducciones reales de la UI se implementan en una fase futura,
   * cuando tengamos un sistema de i18n (ej: react-i18next).
   * Guardar la preferencia ahora significa que cuando llegue ese sistema,
   * cada usuario ya tendrá su idioma configurado automáticamente.
   *
   * @param {'es'|'en'} lang — código del idioma seleccionado
   */
  function cambiarIdioma(lang) {
    dispatch({ type: ACTIONS.SET_CONFIG_FIELD, key: 'language', value: lang })
  }

  /**
   * handleLogout — cierra la sesión del usuario.
   *
   * Flujo:
   *   1. Llama a signOut() de Supabase → invalida el token JWT
   *   2. onAuthStateChange en AuthContext detecta el cambio → setUser(null)
   *   3. El useEffect del store detecta user=null → dispatch(RESET) → limpia el estado
   *   4. Navegamos a '/' → el usuario ve la landing como visitante
   *   5. Cerramos el panel de ajustes
   */
  async function handleLogout() {
    setLoggingOut(true)
    await signOut()
    onClose()
    navigate('/', { replace: true })
    // No necesitamos setLoggingOut(false) porque el componente se desmonta
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, background: 'var(--bg)', borderLeft: '2px solid var(--primary)', zIndex: 101, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* cabecera */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 3 }}>DevForge</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>Ajustes</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* cuerpo */}
        <div style={{ padding: 16, flex: 1 }}>

          <Accordion title="Usuario" icon="👤" defaultOpen={true}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Nombre</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardar()} placeholder="Tu nombre..." style={{ flex: 1, padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 12, outline: 'none' }} />
              <button onClick={guardar} style={{ padding: '8px 12px', background: saved ? 'var(--green)' : 'var(--primary)', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                {saved ? '✓ Guardado' : 'Guardar'}
              </button>
            </div>
            {state.user?.targetDate && (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                📅 Entrevista: <strong style={{ color: 'var(--primary)' }}>{new Date(state.user.targetDate).toLocaleDateString('es-AR')}</strong>
              </div>
            )}
          </Accordion>

          <Accordion title="Apariencia" icon="🎨" defaultOpen={true}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.6, marginBottom: 14 }}>
              Tres temas de la misma familia cromática. Elegí el que mejor se adapte a tu entorno de estudio.
            </p>
            {THEME_OPTIONS.map(t => {
              const active = activeTheme === t.id
              return (
                <div key={t.id} onClick={() => setTheme(t.id)} style={{ border: `2px solid ${active ? t.primary : 'var(--border)'}`, borderRadius: 3, padding: 12, marginBottom: 10, cursor: 'pointer', background: active ? 'var(--surface)' : 'var(--card)', transition: 'border-color 0.15s' }}>
                  <ThemePreview t={t} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{t.label}</div>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>{t.desc}</div>
                    </div>
                    {active && <div style={{ padding: '3px 8px', background: t.primary, color: '#000', fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>ACTIVO</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.dots.map((c, i) => <div key={i} style={{ width: i === 2 ? 16 : 11, height: i === 2 ? 16 : 11, borderRadius: '50%', background: c, border: '1px solid rgba(128,128,128,0.2)' }} />)}
                  </div>
                </div>
              )
            })}

            {/* ─── Font picker ─────────────────────────── */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 14, marginBottom: 4 }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Estilo tipográfico</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FONT_OPTIONS.map(f => {
                  const active = activeFont === f.id
                  return (
                    <div
                      key={f.id}
                      onClick={() => setFont(f.id)}
                      style={{ border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`, padding: '10px 12px', cursor: 'pointer', background: active ? 'var(--surface)' : 'var(--card)', transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      {/* Preview swatch */}
                      <div style={{ width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontFamily: f.preview.display, fontWeight: 700, fontSize: 13, color: active ? 'var(--primary)' : 'var(--text)', lineHeight: 1 }}>Ag</div>
                        <div style={{ fontFamily: f.preview.mono, fontSize: 9, color: 'var(--subtle)', lineHeight: 1 }}>01;</div>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{f.label}</div>
                        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>{f.desc}</div>
                        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{f.detail}</div>
                      </div>
                      {active && <div style={{ padding: '2px 6px', background: 'var(--primary)', color: '#000', fontFamily: 'Space Mono, monospace', fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0 }}>ON</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </Accordion>

          <Accordion title="Sesiones" icon="⚡">
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', padding: '10px 0', textAlign: 'center', lineHeight: 1.7 }}>Próximamente<br/>Duración · Dificultad · Modo examen</div>
          </Accordion>

          <Accordion title="Notificaciones" icon="🔔">
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', padding: '10px 0', textAlign: 'center', lineHeight: 1.7 }}>Próximamente<br/>Recordatorios de práctica diaria</div>
          </Accordion>

          <Accordion title="Datos y privacidad" icon="💾">
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', padding: '10px 0', textAlign: 'center', lineHeight: 1.7 }}>Próximamente<br/>Exportar progreso · Reiniciar sesión</div>
          </Accordion>

          <Accordion title="Acerca de DevForge" icon="ℹ️">
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.8 }}>
              <div>Versión: <strong style={{ color: 'var(--primary)' }}>0.1.0 beta</strong></div>
              <div>Motor: <strong style={{ color: 'var(--primary)' }}>Claude Sonnet</strong></div>
              <div>Stack: <strong style={{ color: 'var(--primary)' }}>React + Vite + Tailwind</strong></div>
            </div>
          </Accordion>

          {/* ── Idioma ───────────────────────────────────────────────────────────
              Guarda la preferencia ya. Las traducciones de UI llegan en fase futura.
              Usamos dos botones tipo "tab" que reflejan el idioma activo del store.
          ─────────────────────────────────────────────────────────────────────── */}
          <Accordion title="Idioma / Language" icon="🌐">
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Idioma de la interfaz
            </div>

            {/* Selector de idioma: dos botones tipo toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[
                { id: 'es', label: '🇦🇷  Español' },
                { id: 'en', label: '🇺🇸  English' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => cambiarIdioma(id)}
                  style={{
                    flex: 1,
                    padding: '9px 0',
                    // Si está activo: fondo primario con texto negro (contraste)
                    // Si no: fondo de superficie con borde sutil
                    background:   activeLanguage === id ? 'var(--primary)' : 'var(--surface)',
                    border:       `1px solid ${activeLanguage === id ? 'var(--primary)' : 'var(--border)'}`,
                    color:        activeLanguage === id ? '#000' : 'var(--subtle)',
                    cursor:       'pointer',
                    fontFamily:   'Syne, sans-serif',
                    fontWeight:   700,
                    fontSize:     12,
                    transition:   'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Aviso de que las traducciones vienen en el futuro */}
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.6, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
              Tu preferencia queda guardada.
              Las traducciones de la UI llegan en una próxima versión.
            </div>
          </Accordion>

        </div>

        {/* ── Cerrar sesión ─────────────────────────────────────────────────────
            Va fuera del scroll y pegado al footer del panel,
            así siempre es visible sin necesidad de hacer scroll.
            Color rojo para que sea claramente una acción destructiva.
        ─────────────────────────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              width:       '100%',
              padding:     '10px 0',
              background:  'transparent',
              // Borde rojo tenue — acción importante pero no alarmante visualmente
              border:      '1px solid var(--red)',
              color:       'var(--red)',
              cursor:      loggingOut ? 'not-allowed' : 'pointer',
              fontFamily:  'Syne, sans-serif',
              fontWeight:  700,
              fontSize:    13,
              letterSpacing: '0.05em',
              transition:  'all 0.15s',
              opacity:     loggingOut ? 0.6 : 1,
            }}
            // Hover: rellena de rojo para dejar claro que es una acción importante
            onMouseEnter={e => {
              if (!loggingOut) {
                e.currentTarget.style.background = 'var(--red)'
                e.currentTarget.style.color = '#fff'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--red)'
            }}
          >
            {loggingOut ? 'Cerrando sesión...' : '→ Cerrar sesión'}
          </button>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textAlign: 'center' }}>
          DevForge beta · Powered by Claude
        </div>
      </div>
    </>
  )
}

// ─── Header compartido — va en TODAS las páginas ──────────
/**
 * Header — barra de navegación global presente en todas las páginas internas.
 *
 * Props:
 *   backTo      {string}        — ruta de la flecha "← Volver" (opcional)
 *   backLabel   {string}        — texto del botón de volver (opcional)
 *   rightContent {ReactNode}   — contenido extra en la zona derecha (opcional)
 *
 * Contiene:
 *   - Logo DEVFORGE (navega a /)
 *   - Botón de volver (si se pasa backTo)
 *   - rightContent (contenido específico de cada página, ej: botón "Empezar")
 *   - Botón "📚 Recursos" — abre ResourcePanel. Detecta la página actual:
 *       · Si estamos en /topic/:id → abre recursos para ese topic directamente
 *       · Si estamos en cualquier otra página → abre el picker de temas
 *   - Botón "⚙ Ajustes" — abre SettingsPanel (temas, fuente, logout, etc.)
 */
export default function Header({ backTo, backLabel, rightContent }) {
  const navigate   = useNavigate()
  const location   = useLocation()  // para detectar la página actual y extraer el topic
  const { state }  = useStore()
  const [settingsOpen,  setSettingsOpen]  = useState(false)

  // ── Estado del panel de recursos ──────────────────────────────────────
  // resourceTopic = null → abrir en modo picker (el usuario elige el tema)
  // resourceTopic = objeto topic → abrir directamente en los recursos de ese tema
  const [resourceOpen,  setResourceOpen]  = useState(false)
  const [resourceTopic, setResourceTopic] = useState(null)

  const userName = state.user?.name

  // Aplica la fuente guardada en cada página que use Header
  useFont()

  /**
   * openResources — determina el modo del ResourcePanel según la página actual.
   *
   * Si el usuario está en /topic/:id → extractamos el topicId de la URL y
   * abrimos el panel en modo recurso para ese topic específico.
   * Esto es conveniente: si estoy estudiando Python, hago click en 📚
   * y veo directamente los recursos de Python sin tener que seleccionarlo.
   *
   * En cualquier otra página → abrimos en modo picker para que el usuario
   * elija qué tema quiere estudiar, con sus puntos débiles destacados.
   */
  function openResources() {
    // Intentamos extraer el topicId de la URL: /topic/:id
    const match = location.pathname.match(/^\/topic\/(.+)$/)
    if (match) {
      const topicId = match[1]
      const found   = TOPICS.find(t => t.id === topicId)
      // Si encontramos el topic en el catálogo → modo recurso para ese topic
      setResourceTopic(found || null)
    } else {
      // En cualquier otra página → modo picker (muestra todos los temas con progreso)
      setResourceTopic(null)
    }
    setResourceOpen(true)
  }

  return (
    <>
      {/* Panel de ajustes (settings) */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Panel de recursos — global, disponible en toda la app */}
      {resourceOpen && (
        <ResourcePanel
          topic={resourceTopic}
          onClose={() => setResourceOpen(false)}
        />
      )}

      <header className="forge-header">
        {/* Izquierda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <span
            onClick={() => navigate('/')}
            style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 15, color: 'var(--primary)', cursor: 'pointer', letterSpacing: '-0.02em', flexShrink: 0 }}
          >
            DEV<span style={{ color: 'var(--text)' }}>FORGE</span>
          </span>

          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="forge-hide-sm"
              style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11, padding: 0, whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
            >
              ← {backLabel || 'Volver'}
            </button>
          )}
        </div>

        {/* Derecha */}
        <div className="forge-header-right">
          {rightContent}

          {/* ── Botón Recursos (📚) ─────────────────────────────────────────────
              Disponible en TODA la app gracias a estar en el Header global.
              El comportamiento cambia según la página (ver openResources arriba).
          ─────────────────────────────────────────────────────────────────────── */}
          <button
            onClick={openResources}
            title="Recursos de aprendizaje"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, transition: 'border-color 0.15s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span>📚</span>
            <span className="forge-hide-sm">Recursos</span>
          </button>

          {/* ── Botón Ajustes ── */}
          <button
            onClick={() => setSettingsOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, transition: 'border-color 0.15s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span>⚙</span>
            <span className="forge-hide-sm">{userName || 'Ajustes'}</span>
          </button>
        </div>
      </header>

    </>
  )
}
