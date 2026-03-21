import { useState } from 'react'
import { useStore, ACTIONS } from '../../store/index.jsx'
import { useTheme } from './ThemeSwitcher.jsx'

const THEME_OPTIONS = [
  {
    id: 'forge',
    label: 'Forge Dark',
    desc: 'Negro carbón · Ámbar · Alto contraste',
    bg: '#0e0e0e', surface: '#161616', border: '#2a2a2a', primary: '#f59e0b', text: '#e8e8e8',
    dots: ['#0e0e0e', '#161616', '#1c1c1c', '#f59e0b', '#f97316', '#888888'],
  },
  {
    id: 'dusk',
    label: 'Dusk Stone',
    desc: 'Carbón verdoso · Musgo · Modo nocturno suave',
    bg: '#2C2E2B', surface: '#363830', border: '#4A4D43', primary: '#89B99A', text: '#E8E4DC',
    dots: ['#2C2E2B', '#363830', '#3F4238', '#89B99A', '#C4B99A', '#9A9B8E'],
  },
  {
    id: 'chalk',
    label: 'Chalk & Sage',
    desc: 'Arena cálida · Tiza · Verde sage orgánico',
    bg: '#F5F0E6', surface: '#FDFAF4', border: '#E0D9CE', primary: '#6BAE8C', text: '#2E2A20',
    dots: ['#F5F0E6', '#FDFAF4', '#FFFFFF', '#6BAE8C', '#A8C5B0', '#9A8F82'],
  },
]

function MiniPreview({ t }) {
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4, overflow: 'hidden', height: 52, marginBottom: 10 }}>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary }} />
        <div style={{ flex: 1, height: 3, background: t.border, borderRadius: 2 }} />
        <div style={{ width: 18, height: 3, background: t.primary, borderRadius: 2, opacity: 0.6 }} />
      </div>
      <div style={{ padding: '5px 8px', display: 'flex', gap: 5 }}>
        <div style={{ width: 18, background: t.surface, borderRadius: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 4, background: t.primary, borderRadius: 2, width: '55%', marginBottom: 3 }} />
          <div style={{ height: 3, background: t.border, borderRadius: 2, width: '85%', marginBottom: 2 }} />
          <div style={{ height: 3, background: t.border, borderRadius: 2, width: '65%' }} />
        </div>
      </div>
    </div>
  )
}

function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid var(--border)', marginBottom: 8, borderRadius: 2 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: open ? 'var(--surface)' : 'var(--card)',
          border: 'none', cursor: 'pointer', color: 'var(--text)',
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{icon}</span><span>{title}</span>
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--subtle)', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: 14, background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function SettingsPanel({ onClose }) {
  const { state, dispatch } = useStore()
  const { activeTheme, setTheme } = useTheme()
  const [nameEdit, setNameEdit] = useState(state.user?.name || '')
  const [saved, setSaved] = useState(false)

  function saveName() {
    if (!nameEdit.trim()) return
    dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'name', value: nameEdit.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 360,
        background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 1,
        }}>
          <div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 3 }}>Configuración</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>⚙️ {state.user?.name || 'DevForge'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', width: 32, height: 32, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, flex: 1 }}>

          <Accordion title="Perfil" icon="👤" defaultOpen={true}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Tu nombre</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: state.user?.targetDate ? 12 : 0 }}>
              <input
                type="text" value={nameEdit} onChange={e => setNameEdit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()} placeholder="Tu nombre..."
                style={{ flex: 1, padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 12, outline: 'none' }}
              />
              <button onClick={saveName} style={{ padding: '8px 12px', background: saved ? 'var(--green)' : 'var(--primary)', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                {saved ? '✓ Listo' : 'Guardar'}
              </button>
            </div>
            {state.user?.targetDate && (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)' }}>
                📅 Entrevista: {new Date(state.user.targetDate).toLocaleDateString('es-AR')}
              </div>
            )}
          </Accordion>

          <Accordion title="Apariencia" icon="🎨" defaultOpen={true}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.6, marginBottom: 14 }}>
              Tres temas de la misma familia cromática en distintos registros de luz.
            </p>
            {THEME_OPTIONS.map(theme => {
              const isActive = activeTheme === theme.id
              return (
                <div key={theme.id} onClick={() => setTheme(theme.id)} style={{
                  border: `2px solid ${isActive ? theme.primary : 'var(--border)'}`,
                  borderRadius: 4, padding: 12, marginBottom: 10, cursor: 'pointer',
                  background: isActive ? 'var(--surface)' : 'var(--card)',
                  transition: 'border-color 0.15s',
                }}>
                  <MiniPreview t={theme} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{theme.label}</div>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>{theme.desc}</div>
                    </div>
                    {isActive && (
                      <div style={{ padding: '3px 8px', background: theme.primary, color: '#000', fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>ACTIVO</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                    {theme.dots.map((color, i) => (
                      <div key={i} style={{ width: i === 3 ? 18 : 12, height: i === 3 ? 18 : 12, borderRadius: '50%', background: color, border: '1px solid rgba(128,128,128,0.25)' }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </Accordion>

          <Accordion title="Sesiones" icon="⚡">
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', textAlign: 'center', padding: '8px 0' }}>Próximamente: duración, dificultad por defecto, modo examen.</div>
          </Accordion>

          <Accordion title="Notificaciones" icon="🔔">
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', textAlign: 'center', padding: '8px 0' }}>Próximamente: recordatorios de práctica diaria.</div>
          </Accordion>

          <Accordion title="Datos" icon="💾">
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', textAlign: 'center', padding: '8px 0' }}>Próximamente: exportar progreso, reiniciar sesión.</div>
          </Accordion>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textAlign: 'center', background: 'var(--surface)' }}>
          DevForge beta · Lucas Y.Aramendy
        </div>
      </div>
    </>
  )
}
