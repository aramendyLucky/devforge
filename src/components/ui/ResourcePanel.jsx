/**
 * src/components/ui/ResourcePanel.jsx
 *
 * PANEL DE RECURSOS — drawer lateral que carga y muestra recursos de
 * aprendizaje curados por IA para un tema técnico específico.
 *
 * ── Modos de operación ────────────────────────────────────────────────────
 *
 *   MODO PICKER (prop `topic` = null / undefined):
 *     Se usa cuando el usuario abre el panel desde el Header global,
 *     sin estar en una página de topic específico. Muestra TODOS los
 *     temas del catálogo organizados en dos secciones:
 *       1. "Tus puntos débiles" — temas sin practicar o con score < 7,
 *          ordenados por tier (críticos primero) y luego por score ascendente.
 *          Esto le muestra al usuario DÓNDE estudiar primero.
 *       2. "Tus fortalezas" — temas con score ≥ 7, como referencia.
 *     Al hacer click en un tema, se carga en modo recurso.
 *
 *   MODO RECURSO (prop `topic` = objeto de topic):
 *     El comportamiento original: muestra recursos curados por IA para
 *     ese topic específico. Ahora también incluye una tarjeta de progreso
 *     del usuario para ese topic (si ya lo practicó).
 *
 * ── Integración ──────────────────────────────────────────────────────────
 *   - Header.jsx lo instancia globalmente (disponible en TODA la app)
 *   - Topic.jsx lo sigue usando localmente para el botón "Recursos" de la página
 *   - Ambos usos son compatibles porque la API de props no cambió
 *
 * Props:
 *   topic   {Object|null}  — topic del catálogo ({ id, name, icon, description })
 *                            Si es null, arranca en modo picker
 *   onClose {Function}     — callback para cerrar el panel
 */

import { useState, useEffect } from 'react'
import { useStore } from '../../store/index.jsx'
import { TOPICS } from '../../data/topics.js'
import { RoadmapPanelWithStore } from './RoadmapPanel.jsx'

// ─── Constantes de la API de Groq ─────────────────────────────────────────
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL    = 'llama-3.3-70b-versatile'

// ─── Etiquetas de tier ────────────────────────────────────────────────────
const TIER_LABEL = { 1: '🔥 Crítico', 2: '⭐ Importante', 3: '💡 Diferenciador' }

// ─── Íconos y colores por tipo de recurso ────────────────────────────────
const TYPE_ICONS = {
  docs: '📄', tutorial: '🎓', video: '▶️',
  article: '📰', repo: '💻', course: '🏫', cheatsheet: '⚡',
}

const TYPE_COLORS = {
  docs: '#3b82f6', tutorial: '#8b5cf6', video: '#ef4444',
  article: 'var(--primary)', repo: 'var(--green)',
  course: '#f97316', cheatsheet: 'var(--primary)',
}

// ─── fetchResources ───────────────────────────────────────────────────────
/**
 * Llama a la API de Groq para obtener recursos curados para un tema.
 * Devuelve un array de objetos { title, url, source, type, description, free }.
 *
 * @param {string} topicName — nombre del tema (ej: "Python Core")
 * @param {string} topicDesc — descripción del tema
 * @returns {Promise<Array>} — array de recursos
 */
async function fetchResources(topicName, topicDesc) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: `Sos un experto en desarrollo de software. Respondés ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks.
Formato exacto: {"resources":[{"title":"...","url":"https://...","source":"...","type":"docs|tutorial|video|article|repo|course|cheatsheet","description":"...","free":true}]}
Reglas: 6 recursos, URLs reales y verificables, description máximo 80 caracteres.`,
        },
        {
          role: 'user',
          content: `Dame los 6 mejores recursos de aprendizaje para: ${topicName}\nContexto: ${topicDesc}`,
        },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Groq error: ${response.status}`)
  const data  = await response.json()
  const text  = data.choices?.[0]?.message?.content || ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean).resources || []
}

// ─── Skeleton ─────────────────────────────────────────────────────────────
/**
 * Placeholder animado mientras cargan los recursos de la API.
 * Muestra 6 "tarjetas fantasma" para evitar el salto de layout.
 */
function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1,2,3,4,5,6].map(i => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <div style={{ width: 20, height: 20, background: 'var(--muted)', borderRadius: '50%', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
            <div style={{ width: '60%', height: 12, background: 'var(--muted)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
          </div>
          <div style={{ width: '85%', height: 10, background: 'var(--muted)', borderRadius: 2, animation: 'pulse 1.5s infinite', marginBottom: 6 }} />
          <div style={{ width: '40%', height: 10, background: 'var(--muted)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
        </div>
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}

// ─── ResourceCard ─────────────────────────────────────────────────────────
/**
 * Tarjeta individual de un recurso de aprendizaje.
 * Muestra título, tipo, fuente, descripción y botón para abrir en nueva pestaña.
 */
function ResourceCard({ resource }) {
  const [hovered, setHovered] = useState(false)
  const icon  = TYPE_ICONS[resource.type]  || '🔗'
  const color = TYPE_COLORS[resource.type] || 'var(--primary)'

  function getDomain(url) {
    try { return new URL(url).hostname.replace('www.', '') }
    catch { return resource.source || url }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? 'var(--card)' : 'var(--surface)', border: `1px solid ${hovered ? color : 'var(--border)'}`, padding: '12px 14px', transition: 'all 0.15s' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', lineHeight: 1.3, marginBottom: 3 }}>
            {resource.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>{getDomain(resource.url)}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, padding: '1px 5px', border: `1px solid ${color}`, color, textTransform: 'uppercase' }}>{resource.type}</span>
            {resource.free && <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, padding: '1px 5px', border: '1px solid var(--green)', color: 'var(--green)', textTransform: 'uppercase' }}>gratis</span>}
          </div>
        </div>
      </div>
      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5, margin: '0 0 10px', paddingLeft: 26 }}>
        {resource.description}
      </p>
      <div style={{ paddingLeft: 26 }}>
        <button
          onClick={() => window.open(resource.url, '_blank', 'noopener,noreferrer')}
          style={{ padding: '5px 12px', background: hovered ? color : 'var(--card)', border: `1px solid ${color}`, color: hovered ? '#000' : color, cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700, transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          Abrir en nueva pestaña ↗
        </button>
      </div>
    </div>
  )
}

// ─── TopicProgressCard ────────────────────────────────────────────────────
/**
 * Tarjeta que muestra el progreso del usuario en un topic específico.
 * Se muestra en la parte superior del panel cuando el usuario tiene
 * al menos una sesión completada en ese topic.
 *
 * Esto conecta los recursos con el estado real del usuario: si el score
 * es bajo, el usuario entiende inmediatamente POR QUÉ está buscando recursos.
 *
 * @param {{ completed, total, lastScore, lastSeen }} progress — progreso del topic
 */
function TopicProgressCard({ progress }) {
  if (!progress || progress.completed === 0) return null

  // Color del score según rendimiento
  const scoreColor = progress.lastScore >= 8
    ? 'var(--green)'
    : progress.lastScore >= 5
      ? 'var(--primary)'
      : 'var(--red)'

  const scoreLabel = progress.lastScore >= 8
    ? 'Buen nivel — seguí repasando'
    : progress.lastScore >= 5
      ? 'En progreso — estos recursos te ayudan'
      : 'Necesita refuerzo — buen momento para estudiar'

  const lastSeen = progress.lastSeen
    ? new Date(progress.lastSeen).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
    : null

  return (
    <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${scoreColor}`, borderLeft: `3px solid ${scoreColor}` }}>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
        Tu progreso en este tema
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Score */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: scoreColor, lineHeight: 1 }}>
            {progress.lastScore ?? '—'}<span style={{ fontSize: 12, color: 'var(--subtle)' }}>/10</span>
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)', marginTop: 2 }}>último score</div>
        </div>
        {/* Sesiones */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', lineHeight: 1 }}>
            {progress.completed}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)', marginTop: 2 }}>sesiones</div>
        </div>
        {/* Última vez */}
        {lastSeen && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', lineHeight: 1 }}>
              {lastSeen}
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)', marginTop: 2 }}>última práctica</div>
          </div>
        )}
      </div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: scoreColor, marginTop: 10, lineHeight: 1.4 }}>
        {scoreLabel}
      </div>
    </div>
  )
}

// ─── TopicPickerCard ──────────────────────────────────────────────────────
/**
 * Tarjeta de topic en el modo picker (selector de temas).
 * Muestra el nombre del topic, su tier y el progreso actual del usuario.
 * El color del borde y el badge de score cambian según el rendimiento:
 *   - Rojo → score < 5 (debilidad crítica)
 *   - Ámbar → score 5-6 (en progreso)
 *   - Verde → score ≥ 7 (fortaleza)
 *   - Gris → nunca practicado
 *
 * @param {Object}   topic    — topic del catálogo
 * @param {Object}   progress — estado global de progreso (state.progress)
 * @param {Function} onSelect — callback cuando el usuario hace click
 * @param {boolean}  isWeak   — si true, se destaca visualmente como punto débil
 */
function TopicPickerCard({ topic, progress, onSelect, isWeak }) {
  const [hovered, setHovered] = useState(false)
  const p = progress[topic.id]

  // ── Determinar estado del progreso ──
  const hasProgress = p && p.completed > 0
  const score = hasProgress ? (p.lastScore ?? 0) : null

  // Color del borde activo según rendimiento
  const accentColor = !hasProgress
    ? 'var(--subtle)'
    : score >= 7 ? 'var(--green)'
    : score >= 5 ? 'var(--primary)'
    : 'var(--red)'

  // Badge de score
  function ScoreBadge() {
    if (!hasProgress) {
      return (
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--muted)', padding: '2px 6px', border: '1px solid var(--border)' }}>
          Sin iniciar
        </span>
      )
    }
    return (
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: accentColor, padding: '2px 6px', border: `1px solid ${accentColor}`, fontWeight: 700 }}>
        {score}/10 · {p.completed} {p.completed === 1 ? 'sesión' : 'sesiones'}
      </span>
    )
  }

  return (
    <div
      onClick={() => onSelect(topic)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--card)' : 'var(--surface)',
        border: `1px solid ${hovered ? accentColor : 'var(--border)'}`,
        // Línea izquierda de color si es un punto débil — destaca visualmente
        borderLeft: isWeak ? `3px solid ${accentColor}` : `1px solid ${hovered ? accentColor : 'var(--border)'}`,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{topic.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
          {topic.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {TIER_LABEL[topic.tier]}
          </span>
          <ScoreBadge />
        </div>
      </div>
      {/* Flecha → indica que es clickeable */}
      <span style={{ color: hovered ? accentColor : 'var(--border)', fontSize: 14, transition: 'color 0.15s', flexShrink: 0 }}>→</span>
    </div>
  )
}

// ─── TopicPicker ──────────────────────────────────────────────────────────
/**
 * Vista de selección de tema — modo picker del panel de recursos.
 *
 * Organiza los temas en dos secciones:
 *   1. "Tus puntos débiles": temas sin practicar o con score < 7.
 *      Ordenados por tier (críticos primero) y luego por score ascendente
 *      (el más bajo aparece primero — es el que más necesita atención).
 *   2. "Tus fortalezas": temas con score ≥ 7 (sirven para repasar).
 *
 * Si el usuario aún no practicó ningún tema, muestra todos como "sin iniciar"
 * organizados por tier — mostrando primero los temas críticos (tier 1).
 *
 * @param {Object}   progress — estado global de progreso (state.progress)
 * @param {Function} onSelect — callback que recibe el topic seleccionado
 */
function TopicPicker({ progress, onSelect }) {
  // Separo temas débiles (sin practicar o score < 7) de fortalezas (score ≥ 7)
  const weak = TOPICS.filter(t => {
    const p = progress[t.id]
    if (!p || p.completed === 0) return true   // nunca practicado
    return (p.lastScore || 0) < 7              // score insuficiente
  }).sort((a, b) => {
    // Primero por tier (críticos primero), después por score ascendente
    if (a.tier !== b.tier) return a.tier - b.tier
    const sa = progress[a.id]?.lastScore || 0
    const sb = progress[b.id]?.lastScore || 0
    return sa - sb  // el score más bajo primero
  })

  const strong = TOPICS.filter(t => {
    const p = progress[t.id]
    return p && p.completed > 0 && (p.lastScore || 0) >= 7
  }).sort((a, b) => {
    // Fortalezas: las de mayor score primero (inspirador verlas bien)
    const sa = progress[a.id]?.lastScore || 0
    const sb = progress[b.id]?.lastScore || 0
    return sb - sa
  })

  return (
    <div style={{ padding: 16 }}>

      {/* ── Sección puntos débiles ── */}
      {weak.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span> Tus puntos débiles — estudiá primero
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weak.map(t => (
              <TopicPickerCard key={t.id} topic={t} progress={progress} onSelect={onSelect} isWeak />
            ))}
          </div>
        </div>
      )}

      {/* ── Sección fortalezas ── */}
      {strong.length > 0 && (
        <div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✅</span> Tus fortalezas — para repasar
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {strong.map(t => (
              <TopicPickerCard key={t.id} topic={t} progress={progress} onSelect={onSelect} isWeak={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ResourcePanel (componente principal) ────────────────────────────────
/**
 * Panel deslizable de recursos de aprendizaje.
 *
 * Soporta dos modos (ver cabecera del archivo para detalle):
 *   - Modo PICKER: `topic` = null → muestra selector de temas con progreso
 *   - Modo RECURSO: `topic` = objeto → muestra progreso + recursos IA para ese tema
 *
 * El modo picker → recurso es unidireccional: el usuario hace click en un
 * tema y ve sus recursos. Puede volver al picker con "← Temas" solo si
 * vino del picker (si `topic` fue null al montar el componente, mostramos
 * el botón de volver; si fue pasado por prop, no lo mostramos).
 *
 * @param {Object|null} topic   — topic del catálogo o null para modo picker
 * @param {Function}    onClose — cierra el panel
 */
export default function ResourcePanel({ topic, onClose }) {
  const { state } = useStore()
  const progress  = state.progress

  // ¿El componente fue montado sin topic? → el usuario viene del Header global
  // En ese caso sí mostramos el botón "← Temas" cuando pasa a modo recurso.
  // Si fue montado con topic (desde Topic.jsx), no mostramos volver.
  const startedInPickerMode = !topic

  // selectedTopic = null → modo picker; objeto → modo recurso
  const [selectedTopic, setSelectedTopic] = useState(topic || null)
  const [resources, setResources] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  // showRoadmap = true → modo roadmap (generador de roadmap personalizado)
  const [showRoadmap, setShowRoadmap] = useState(false)

  // Si el parent cambia el topic (ej: el usuario navega entre /topic/ pages),
  // sincronizamos el estado interno con el nuevo topic
  useEffect(() => {
    setSelectedTopic(topic || null)
    setResources([])
    setError(null)
  }, [topic?.id])

  // Carga recursos cada vez que cambia el topic seleccionado
  useEffect(() => {
    if (!selectedTopic) return  // en modo picker, no hay nada que cargar aún

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchResources(selectedTopic.name, selectedTopic.description)
        setResources(res)
      } catch {
        setError('No se pudieron cargar los recursos. Revisá tu API key de Groq en el archivo .env')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedTopic?.id])

  // Progreso del usuario para el topic actualmente seleccionado
  const topicProgress = selectedTopic ? progress[selectedTopic.id] : null

  // Cuando el usuario navega de picker → recurso y quiere volver
  function volverAlPicker() {
    setSelectedTopic(null)
    setResources([])
    setError(null)
  }

  return (
    <>
      {/* Overlay semitransparente — click para cerrar */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }} />

      {/* Panel deslizable */}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, background: 'var(--bg)', borderLeft: '2px solid var(--primary)', zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto', animation: 'slideInRight 0.25s ease-out' }}>

        {/* ── Cabecera del panel ── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Botones de navegación según el modo */}
            {showRoadmap && (
              <button
                onClick={() => setShowRoadmap(false)}
                style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '0 0 6px', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
              >
                ← Recursos
              </button>
            )}
            {!showRoadmap && selectedTopic && startedInPickerMode && (
              <button
                onClick={volverAlPicker}
                style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '0 0 6px', display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
              >
                ← Temas
              </button>
            )}

            {/* Título del panel según el modo */}
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 3 }}>
              {showRoadmap
                ? '📖 Mi roadmap de aprendizaje'
                : selectedTopic ? 'Recursos de aprendizaje' : '📚 Buscá qué estudiar'}
            </div>

            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              {showRoadmap ? (
                <span>Roadmap Personalizado</span>
              ) : selectedTopic ? (
                <>
                  <span>{selectedTopic.icon}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedTopic.name}</span>
                </>
              ) : (
                <span>Elegí un tema para estudiar</span>
              )}
            </div>
          </div>

          {/* Botón de cerrar */}
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* ── Subtítulo contextual ── */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0, lineHeight: 1.6 }}>
            {showRoadmap
              ? 'Generado por IA en base a tu perfil y progreso. Exportable como PDF con índice.'
              : selectedTopic
                ? 'Artículos, docs y tutoriales seleccionados por IA. Cada link abre en pestaña nueva.'
                : 'Tus puntos débiles aparecen primero. Hacé click en un tema para ver sus recursos.'}
          </p>
        </div>

        {/* ── Contenido principal ── */}
        <div style={{ flex: 1 }}>

          {/* MODO ROADMAP: generador de roadmap personalizado */}
          {showRoadmap && (
            <RoadmapPanelWithStore state={state} onBack={() => setShowRoadmap(false)} />
          )}

          {/* MODO PICKER: selector de temas con progreso */}
          {!showRoadmap && !selectedTopic && (
            <>
              {/* Banner de Roadmap — acceso rápido */}
              <div
                onClick={() => setShowRoadmap(true)}
                style={{ margin: '16px 16px 0', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 8%, var(--surface))' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>📖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>
                    Generar Mi Roadmap PDF
                  </div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
                    Roadmap 0→100 personalizado · Exportar como PDF
                  </div>
                </div>
                <span style={{ color: 'var(--primary)', fontSize: 14, flexShrink: 0 }}>→</span>
              </div>

              <TopicPicker progress={progress} onSelect={setSelectedTopic} />
            </>
          )}

          {/* MODO RECURSO: progreso + recursos */}
          {!showRoadmap && selectedTopic && (
            <>
              {/* Tarjeta de progreso del usuario (solo si ya practicó este tema) */}
              <div style={{ paddingTop: 12 }}>
                <TopicProgressCard progress={topicProgress} />
              </div>

              {/* Recursos generados por IA */}
              <div style={{ padding: '0 16px 16px' }}>
                {loading && <Skeleton />}
                {error && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--red)', padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--red)', margin: 0, lineHeight: 1.6 }}>{error}</p>
                  </div>
                )}
                {!loading && !error && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {resources.map((r, i) => <ResourceCard key={i} resource={r} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer del panel ── */}
        {!showRoadmap && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textAlign: 'center' }}>
            {selectedTopic
              ? 'Recursos sugeridos por Groq · Verificá siempre el contenido'
              : `${TOPICS.length} temas disponibles · Seleccioná uno para ver recursos`}
          </div>
        )}
      </div>

      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
    </>
  )
}
