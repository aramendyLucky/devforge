import { useStore, ACTIONS } from '../../store/index.jsx'
import { useEffect } from 'react'

export const THEMES = [
  {
    id: 'forge',
    label: 'Forge Dark',
    desc: 'Negro carbón · Ámbar · Alto contraste',
    dots: ['#0e0e0e', '#161616', '#f59e0b', '#f97316', '#888888'],
    preview: {
      bg: '#0e0e0e', surface: '#161616', border: '#2a2a2a', primary: '#f59e0b',
    },
  },
  {
    id: 'dusk',
    label: 'Dusk Stone',
    desc: 'Carbón verdoso · Musgo · Arena oscura',
    dots: ['#2C2E2B', '#363830', '#89B99A', '#C4B99A', '#9A9B8E'],
    preview: {
      bg: '#2C2E2B', surface: '#363830', border: '#4A4D43', primary: '#89B99A',
    },
  },
  {
    id: 'chalk',
    label: 'Chalk & Sage',
    desc: 'Arena cálida · Tiza · Verde sage suave',
    dots: ['#F5F0E6', '#FDFAF4', '#6BAE8C', '#A8C5B0', '#9A8F82'],
    preview: {
      bg: '#F5F0E6', surface: '#FDFAF4', border: '#E0D9CE', primary: '#6BAE8C',
    },
  },
]

// Aplica el atributo de fuente en <html>
export function applyFont(fontId) {
  document.documentElement.setAttribute('data-font', fontId || 'forge')
}

// Hook: sincroniza la fuente del store con el DOM
export function useFont() {
  const { state, dispatch } = useStore()
  const activeFont = state.config?.font || 'forge'

  useEffect(() => {
    applyFont(activeFont)
  }, [activeFont])

  function setFont(fontId) {
    applyFont(fontId)
    dispatch({
      type: ACTIONS.SET_CONFIG_FIELD,
      key: 'font',
      value: fontId,
    })
  }

  return { activeFont, setFont }
}

// Aplica la clase del tema en <html>
export function applyTheme(themeId) {
  const html = document.documentElement
  html.classList.remove('theme-forge', 'theme-dusk', 'theme-chalk')
  html.classList.add(`theme-${themeId}`)
}

// Hook: sincroniza el tema del store con el DOM
export function useTheme() {
  const { state, dispatch } = useStore()
  const activeTheme = state.config?.theme || 'forge'

  useEffect(() => {
    applyTheme(activeTheme)
  }, [activeTheme])

  function setTheme(themeId) {
    applyTheme(themeId)
    dispatch({
      type: ACTIONS.SET_CONFIG_FIELD,
      key: 'theme',
      value: themeId,
    })
  }

  return { activeTheme, setTheme }
}

// ─── Componente visual del switcher ─────────────────────
export default function ThemeSwitcher({ compact = false }) {
  const { activeTheme, setTheme } = useTheme()

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {THEMES.map(t => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setTheme(t.id)}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: t.dots[2],
              border: activeTheme === t.id
                ? `2px solid ${t.dots[2]}`
                : '2px solid transparent',
              outline: activeTheme === t.id
                ? `2px solid ${t.dots[2]}`
                : '2px solid transparent',
              outlineOffset: '2px',
              cursor: 'pointer',
              transform: activeTheme === t.id ? 'scale(1.25)' : 'scale(1)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    )
  }

  // Versión completa para Settings o Dashboard
  return (
    <div className="space-y-2">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={`
            w-full flex items-center gap-4 p-3 border transition-all duration-200 text-left
            ${activeTheme === t.id
              ? 'border-[var(--primary)] bg-[var(--surface)]'
              : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]'}
          `}
        >
          {/* Dots de color */}
          <div className="flex gap-1 shrink-0">
            {t.dots.map((color, i) => (
              <div
                key={i}
                className="rounded-full border border-[var(--border)]"
                style={{
                  width:  i === 2 ? 18 : 12,
                  height: i === 2 ? 18 : 12,
                  background: color,
                }}
              />
            ))}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[var(--text)] text-sm">
              {t.label}
            </div>
            <div className="font-mono text-[var(--subtle)] text-xs">
              {t.desc}
            </div>
          </div>

          {/* Check */}
          {activeTheme === t.id && (
            <span className="font-mono text-[var(--primary)] text-sm shrink-0">✓</span>
          )}
        </button>
      ))}
    </div>
  )
}
