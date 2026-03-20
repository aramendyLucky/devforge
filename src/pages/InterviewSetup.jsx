/**
 * src/pages/InterviewSetup.jsx
 *
 * CONFIGURACIÓN DE ENTREVISTA — rediseñado para soportar:
 *   1. Ofertas rápidas (3 presets fijos)
 *   2. Mis ofertas guardadas (localStorage — persisten entre sesiones)
 *   3. Análisis de nueva oferta con IA (URL / Archivo / Texto)
 *   4. Modo personalizado (topic picker manual)
 *
 * ── Flujo de "Mis ofertas" ───────────────────────────────────────────────
 *   El usuario analiza una oferta → la IA extrae skills + summary
 *   → el usuario le pone un nombre → se guarda en localStorage
 *   → aparece en "Mis ofertas" en sesiones futuras
 *   → puede borrarla cuando quiera
 *
 * ── SkillsBreakdown ──────────────────────────────────────────────────────
 *   Cada vez que se selecciona un perfil (fijo o guardado), se muestra
 *   un desglose de las skills agrupadas por:
 *     - Tier (Crítico / Importante / Diferenciador)
 *     - Cobertura (cuántas tienen preguntas en DevForge)
 *
 * ── localStorage key ─────────────────────────────────────────────────────
 *   'devforge_saved_offers' → Array<{ id, name, summary, topics, savedAt }>
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOPICS } from '../data/topics.js'
import { getQuestions } from '../data/questions.js'
import { useAI } from '../hooks/useAI.js'
import {
  extractTextFromFile,
  isFileSupported,
  getSupportedExtensions,
  fetchTextFromUrl,
  BLOCKED_SITES_INFO,
} from '../lib/fileParser.js'
import {
  loadOffers as dbLoadOffers,
  saveOffer  as dbSaveOffer,
  deleteOffer as dbDeleteOffer,
} from '../lib/db.js'
import { supabase } from '../lib/supabase.js'
import Header from '../components/ui/Header.jsx'

// ─── Constantes ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'devforge_saved_offers'

const DURATIONS = [
  { value: 20, label: '20 min', desc: 'Corta — ~6 preguntas'    },
  { value: 45, label: '45 min', desc: 'Estándar — ~12 preguntas' },
  { value: 60, label: '60 min', desc: 'Extensa — ~16 preguntas'  },
]

const DIFFICULTIES = [
  { value: 'basic',  label: 'Junior',    desc: 'Solo básicas',         color: 'var(--green)'   },
  { value: 'mixed',  label: 'Mid-level', desc: 'Básico + intermedio',  color: 'var(--primary)' },
  { value: 'senior', label: 'Senior',    desc: 'Intermedio + senior',  color: 'var(--red)'     },
]

// Ofertas fijas: los topics tienen tier=1 por defecto (todos son críticos en el preset)
const FIXED_PRESETS = [
  {
    id: 'python_aws',
    label: 'Python / AWS',
    icon: '☁️',
    topicIds: ['python', 'apis', 'git_cicd', 'aws', 'docker'],
  },
  {
    id: 'fullstack',
    label: 'Full Stack',
    icon: '🖥️',
    topicIds: ['python', 'django_flask', 'apis', 'sql', 'nextjs', 'docker'],
  },
  {
    id: 'ai_engineer',
    label: 'Agentic AI',
    icon: '🤖',
    topicIds: ['python', 'fastapi', 'ai_agents', 'git_cicd', 'ai_tools'],
  },
]

const TIER_META = {
  1: { label: 'Crítico',       color: 'var(--red)',     bg: 'color-mix(in srgb, var(--red) 8%, transparent)'     },
  2: { label: 'Importante',    color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)' },
  3: { label: 'Diferenciador', color: 'var(--subtle)',  bg: 'transparent'                                        },
}

// ─── useSavedOffers ───────────────────────────────────────────────────────
/**
 * Hook de persistencia de ofertas en Supabase (tabla saved_offers).
 *
 * Al montar, migra automáticamente cualquier oferta en localStorage
 * (legado) a Supabase y limpia el storage local.
 *
 * saveOffer devuelve la oferta guardada con su UUID real de Supabase,
 * lo que permite seleccionarla inmediatamente sin hacks de setTimeout.
 */
function useSavedOffers() {
  const [offers,  setOffers]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setLoading(false); return }

      // ── Migración one-time desde localStorage ──────────────────────
      // Si el usuario tenía ofertas guardadas en el browser (versión anterior),
      // las movemos a Supabase y limpiamos localStorage para no repetir el proceso.
      try {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        if (local.length > 0) {
          await Promise.all(local.map(o => dbSaveOffer(user.id, o)))
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        // Migración fallida — no es crítico, ignoramos y seguimos
      }

      const loaded = await dbLoadOffers(user.id)
      if (!cancelled) {
        setOffers(loaded)
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // Guarda una oferta en Supabase y la agrega al estado local.
  // Devuelve la oferta con el UUID real asignado por la DB.
  const saveOffer = useCallback(async (offer) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const saved = await dbSaveOffer(user.id, offer)
    if (saved) setOffers(prev => [saved, ...prev])
    return saved
  }, [])

  // Elimina una oferta de Supabase y del estado local.
  const deleteOffer = useCallback(async (id) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await dbDeleteOffer(user.id, id)
    setOffers(prev => prev.filter(o => o.id !== id))
  }, [])

  return { offers, loading, saveOffer, deleteOffer }
}

// ─── SkillsBreakdown ──────────────────────────────────────────────────────
/**
 * Desglose visual de skills del perfil seleccionado.
 *
 * Muestra:
 *   - Skills agrupadas por Tier (Crítico / Importante / Diferenciador)
 *   - Indicador ✓ (tiene preguntas en DevForge) vs · (detectada, sin preguntas)
 *   - Resumen de cobertura: "X de Y skills cubiertas"
 *
 * @param {Array} topics — [{ id, name, tier, category }]
 */
function SkillsBreakdown({ topics }) {
  if (!topics || topics.length === 0) return null

  // Separar skills por tier
  const byTier = { 1: [], 2: [], 3: [] }
  topics.forEach(t => {
    const tier = t.tier || 1
    if (byTier[tier]) byTier[tier].push(t)
  })

  // Calcular cobertura (cuántas tienen preguntas en DevForge)
  const covered = topics.filter(t => TOPICS.some(x => x.id === t.id))
  const pct = Math.round((covered.length / topics.length) * 100)

  return (
    <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--border)' }}>

      {/* Header de cobertura */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Skills del perfil
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Barra de cobertura */}
          <div style={{ width: 60, height: 4, background: 'var(--muted)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--primary)' : 'var(--red)', transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
            {covered.length}/{topics.length} en DevForge
          </span>
        </div>
      </div>

      {/* Skills por tier */}
      {[1, 2, 3].map(tier => {
        const tierTopics = byTier[tier]
        if (!tierTopics.length) return null
        const meta = TIER_META[tier]
        return (
          <div key={tier} style={{ marginBottom: tier < 3 ? 10 : 0 }}>
            {/* Etiqueta del tier */}
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
              {meta.label}
            </div>
            {/* Chips de skills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {tierTopics.map(t => {
                const inCatalog = TOPICS.some(x => x.id === t.id)
                const topicData = TOPICS.find(x => x.id === t.id)
                return (
                  <span
                    key={t.id}
                    title={inCatalog ? `Tiene preguntas en DevForge` : 'Detectada — sin preguntas aún'}
                    style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: 9,
                      padding: '2px 7px',
                      border: `1px solid ${inCatalog ? meta.color : 'var(--border)'}`,
                      color: inCatalog ? meta.color : 'var(--subtle)',
                      background: inCatalog ? meta.bg : 'transparent',
                      opacity: inCatalog ? 1 : 0.65,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    {topicData?.icon || (inCatalog ? '✓' : '·')} {t.name}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Leyenda */}
      {topics.some(t => !TOPICS.some(x => x.id === t.id)) && (
        <div style={{ marginTop: 10, fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)', lineHeight: 1.5 }}>
          Skills sin borde = detectadas pero sin preguntas en DevForge aún
        </div>
      )}
    </div>
  )
}

// ─── OfferAnalysisPanel ───────────────────────────────────────────────────
/**
 * Panel de análisis de oferta con IA.
 * 3 modos: URL / Archivo / Texto
 * Después del análisis: muestra preview + input de nombre + botón guardar.
 *
 * @param {Function} onSave(offer) — cuando el usuario guarda la oferta analizada
 * @param {Function} onCancel — cuando el usuario cierra el panel
 */
function OfferAnalysisPanel({ onSave, onCancel }) {
  const fileRef = useRef(null)

  const [mode,       setMode]       = useState('url')   // 'url' | 'file' | 'text'
  const [url,        setUrl]        = useState('')
  const [pasted,     setPasted]     = useState('')
  const [dragging,   setDragging]   = useState(false)
  const [fileInfo,   setFileInfo]   = useState(null)
  const [result,     setResult]     = useState(null)    // { summary, topics } — después del análisis
  const [offerName,  setOfferName]  = useState('')
  const [error,      setError]      = useState(null)    // string | { type:'BLOCKED_SITE', siteInfo }
  const { extractTopicsFromOffers, loading } = useAI()

  // ── Función central de análisis ──────────────────────────────────────────
  async function analyze(rawText) {
    setError(null)
    const data = await extractTopicsFromOffers(rawText)
    if (!data?.topics?.length) {
      setError('No se detectaron tecnologías. Probá con otra oferta o más texto.')
      return
    }
    setResult(data)
    // Sugerir un nombre automático basado en el summary
    setOfferName('')
  }

  // ── Handlers por modo ────────────────────────────────────────────────────
  async function handleUrl() {
    if (!url.trim()) return
    setError(null)
    try {
      const text = await fetchTextFromUrl(url)
      await analyze(text)
    } catch (err) {
      // Error con guía específica para sitios bloqueados
      if (err.type === 'BLOCKED_SITE') {
        setError({ type: 'BLOCKED_SITE', siteInfo: err.blockedSite })
      } else {
        setError(err.message)
      }
    }
  }

  async function handleFile(file) {
    if (!file) return
    if (!isFileSupported(file)) {
      setError('Formato no soportado. Subí un PDF, Word (.docx) o texto (.txt).')
      return
    }
    setError(null)
    try {
      const text = await extractTextFromFile(file)
      setFileInfo({ name: file.name })
      await analyze(text)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleText() {
    if (pasted.trim().length < 50) {
      setError('El texto es muy corto. Pegá el contenido completo de la oferta.')
      return
    }
    await analyze(pasted)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  function handleSave() {
    if (!result || !offerName.trim()) return
    onSave({
      name:    offerName.trim(),
      summary: result.summary,
      topics:  result.topics,
    })
  }

  function resetAnalysis() {
    setResult(null)
    setOfferName('')
    setError(null)
  }

  // ── Helpers de estilo ─────────────────────────────────────────────────────
  const TAB = (active) => ({
    padding: '5px 12px',
    background: active ? 'var(--primary)' : 'transparent',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    color: active ? '#000' : 'var(--subtle)',
    cursor: 'pointer',
    fontFamily: 'Space Mono, monospace',
    fontSize: 10,
    fontWeight: active ? 700 : 400,
    transition: 'all 0.15s',
  })

  const SPINNER = (size = 12) => (
    <span style={{ width: size, height: size, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block', flexShrink: 0 }} />
  )

  return (
    <div style={{ marginTop: 10, padding: '16px 18px', background: 'var(--card)', border: '1px solid var(--primary)', animation: 'slideDown 0.2s ease' }}>

      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Análisis de oferta con IA
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10, padding: '0 4px' }}>✕</button>
      </div>

      {/* ── FASE 1: Entrada ── */}
      {!result && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
            <button style={TAB(mode === 'url')}  onClick={() => { setMode('url');  setError(null) }}>🔗 URL</button>
            <button style={TAB(mode === 'file')} onClick={() => { setMode('file'); setError(null) }}>📄 Archivo</button>
            <button style={TAB(mode === 'text')} onClick={() => { setMode('text'); setError(null) }}>📝 Texto</button>
          </div>

          {/* Tab URL */}
          {mode === 'url' && (
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginBottom: 8 }}>
                Pegá la URL de la oferta (Computrabajo, GetOnBoard, páginas de empresas, etc.)
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleUrl()}
                  placeholder="https://www.getonbrd.com/jobs/..."
                  disabled={loading}
                  style={{ flex: 1, padding: '8px 11px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 11, outline: 'none' }}
                />
                <button
                  onClick={handleUrl}
                  disabled={loading || !url.trim()}
                  style={{ padding: '8px 14px', background: loading || !url.trim() ? 'var(--muted)' : 'var(--primary)', border: 'none', color: '#000', cursor: loading || !url.trim() ? 'default' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {loading ? <>{SPINNER(11)} Analizando...</> : 'Analizar →'}
                </button>
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 6, lineHeight: 1.5 }}>
                ⚠ LinkedIn, Indeed y Glassdoor no permiten acceso automático → usá el tab "Texto"
              </div>
            </div>
          )}

          {/* Tab Archivo */}
          {mode === 'file' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !loading && fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
                  background: dragging ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'var(--surface)',
                  padding: '24px 14px',
                  textAlign: 'center',
                  cursor: loading ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 20, height: 20, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>Analizando {fileInfo?.name}...</span>
                  </div>
                ) : fileInfo ? (
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--primary)' }}>✓ {fileInfo.name} — clic para cambiar</div>
                ) : (
                  <>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>📄</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>Arrastrá o clic para subir</div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>PDF · Word (.docx) · TXT</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept={getSupportedExtensions()} style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
            </div>
          )}

          {/* Tab Texto */}
          {mode === 'text' && (
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginBottom: 7 }}>
                Pegá el texto completo de la oferta laboral
              </div>
              <textarea
                value={pasted}
                onChange={e => setPasted(e.target.value)}
                disabled={loading}
                placeholder="Buscamos Python Backend Engineer con experiencia en FastAPI, PostgreSQL, Docker...&#10;&#10;Requisitos:&#10;- Python 3.10+&#10;- REST APIs&#10;..."
                rows={6}
                style={{ width: '100%', padding: '9px 11px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 11, lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 9 }}
              />
              <button
                onClick={handleText}
                disabled={loading || pasted.trim().length < 50}
                style={{ width: '100%', padding: '9px 0', background: loading || pasted.trim().length < 50 ? 'var(--muted)' : 'var(--primary)', border: 'none', color: '#000', cursor: loading || pasted.trim().length < 50 ? 'default' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading ? <>{SPINNER(13)} Analizando con IA...</> : 'Analizar oferta →'}
              </button>
            </div>
          )}

          {/* ── Error genérico ── */}
          {error && typeof error === 'string' && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1px solid var(--red)' }}>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--red)', margin: 0, lineHeight: 1.6 }}>{error}</p>
            </div>
          )}

          {/* ── Error de sitio bloqueado: guía paso a paso ── */}
          {error?.type === 'BLOCKED_SITE' && (
            <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)', marginBottom: 8, fontWeight: 700 }}>
                {error.siteInfo.name} · {error.siteInfo.reason}
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginBottom: 10, lineHeight: 1.6 }}>
                Seguí estos pasos para copiar la descripción manualmente:
              </div>
              <ol style={{ margin: 0, paddingLeft: 16 }}>
                {error.siteInfo.steps.map((step, i) => (
                  <li key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--text)', lineHeight: 1.8, marginBottom: 2 }}>
                    {step}
                  </li>
                ))}
              </ol>
              <button
                onClick={() => { setMode('text'); setError(null) }}
                style={{ marginTop: 12, padding: '6px 14px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11 }}
              >
                Pegar texto →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── FASE 2: Preview del análisis + nombre + guardar ── */}
      {result && (
        <div>
          {/* Summary */}
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.6, marginBottom: 12, padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            💡 {result.summary}
          </div>

          {/* Desglose de skills */}
          <SkillsBreakdown topics={result.topics} />

          {/* Nombre para guardar */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Nombre para identificar esta oferta
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <input
                type="text"
                value={offerName}
                onChange={e => setOfferName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && offerName.trim() && handleSave()}
                placeholder="Ej: Startup FinTech · Senior Python · CABA"
                maxLength={60}
                style={{ flex: 1, padding: '8px 11px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 11, outline: 'none' }}
              />
              <button
                onClick={handleSave}
                disabled={!offerName.trim()}
                style={{ padding: '8px 14px', background: offerName.trim() ? 'var(--primary)' : 'var(--muted)', border: 'none', color: '#000', cursor: offerName.trim() ? 'pointer' : 'default', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
              >
                Guardar →
              </button>
            </div>
          </div>

          {/* Volver a analizar */}
          <button
            onClick={resetAnalysis}
            style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9, padding: 0, textDecoration: 'underline' }}
          >
            ← Analizar otra oferta
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────
function Divider({ children }) {
  return (
    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
    </div>
  )
}

// ─── InterviewSetup principal ─────────────────────────────────────────────
export default function InterviewSetup() {
  const navigate = useNavigate()
  const { offers: savedOffers, loading: offersLoading, saveOffer, deleteOffer } = useSavedOffers()

  const [duration,      setDuration]      = useState(45)
  const [difficulty,    setDifficulty]    = useState('mixed')
  const [selectedId,    setSelectedId]    = useState('fullstack')   // preset ID seleccionado
  const [customTopics,  setCustomTopics]  = useState([])
  const [showAnalysis,  setShowAnalysis]  = useState(false)

  // ── Resolver topics activos según el perfil seleccionado ────────────────
  function getActiveTopics() {
    // Preset fijo
    const fixed = FIXED_PRESETS.find(p => p.id === selectedId)
    if (fixed) {
      return fixed.topicIds.map(id => {
        const t = TOPICS.find(x => x.id === id)
        return t ? { id: t.id, name: t.name, tier: 1, category: t.category } : null
      }).filter(Boolean)
    }
    // Oferta guardada
    const saved = savedOffers.find(o => o.id === selectedId)
    if (saved) return saved.topics
    // Personalizada o sin selección
    return []
  }

  function getActiveTopicIds() {
    if (selectedId === 'custom') return customTopics
    const topics = getActiveTopics()
    // Solo los que tienen preguntas en DevForge
    return topics.map(t => t.id).filter(id => TOPICS.some(x => x.id === id))
  }

  const activeTopics    = getActiveTopics()
  const selectedTopicIds = getActiveTopicIds()

  function toggleCustomTopic(id) {
    setCustomTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const availableQ = selectedTopicIds.reduce((acc, tid) => {
    const diff = difficulty === 'senior' ? 'mid' : difficulty === 'mixed' ? null : difficulty
    return acc + getQuestions(tid, diff).length
  }, 0)
  const approxQ = Math.min(availableQ, Math.floor(duration / 3.5))

  function handleStart() {
    if (!selectedTopicIds.length) return
    navigate('/interview', { state: { duration, difficulty, topicIds: selectedTopicIds } })
  }

  async function handleOfferSaved(offer) {
    const saved = await saveOffer(offer)
    setShowAnalysis(false)
    // El UUID real viene directamente de Supabase — sin hacks de setTimeout
    if (saved?.id) setSelectedId(saved.id)
  }

  // ── Helpers de estilo de tarjetas ─────────────────────────────────────────
  const CARD = (selected) => ({
    padding: '11px 14px',
    background: 'var(--surface)',
    border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      <Header backTo="/dashboard" backLabel="Dashboard" />

      <main className="forge-main forge-main-md">

        {/* Título */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
            Modo entrevista
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text)', margin: '0 0 6px' }}>
            Configurá tu entrevista
          </h1>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.7, margin: 0 }}>
            Sin hints. Presión real. Feedback completo al final.
          </p>
        </div>

        {/* ── Duración ── */}
        <Divider>Duración</Divider>
        <div className="forge-grid-3" style={{ marginBottom: 4 }}>
          {DURATIONS.map(d => (
            <div key={d.value} onClick={() => setDuration(d.value)}
              style={{ padding: '12px 10px', background: 'var(--surface)', border: `2px solid ${duration === d.value ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer', transition: 'border-color 0.15s', textAlign: 'center' }}
            >
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: duration === d.value ? 'var(--primary)' : 'var(--text)', marginBottom: 3 }}>{d.label}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>{d.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Nivel ── */}
        <Divider>Nivel de dificultad</Divider>
        <div className="forge-grid-3">
          {DIFFICULTIES.map(d => (
            <div key={d.value} onClick={() => setDifficulty(d.value)}
              style={{ padding: '12px 10px', background: 'var(--surface)', border: `2px solid ${difficulty === d.value ? d.color : 'var(--border)'}`, cursor: 'pointer', transition: 'border-color 0.15s', textAlign: 'center' }}
            >
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: difficulty === d.value ? d.color : 'var(--text)', marginBottom: 3 }}>{d.label}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>{d.desc}</div>
            </div>
          ))}
        </div>

        {/* ── PERFIL DE ENTREVISTA ── */}
        <Divider>Perfil de entrevista</Divider>

        {/* ─── SECCIÓN A: Ofertas rápidas (presets fijos) ─── */}
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Ofertas rápidas
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {FIXED_PRESETS.map(p => {
            const sel = selectedId === p.id
            return (
              <div key={p.id} onClick={() => { setSelectedId(p.id); setShowAnalysis(false) }} style={CARD(sel)}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{p.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: sel ? 'var(--primary)' : 'var(--text)', marginBottom: 3 }}>{p.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {p.topicIds.map(tid => {
                      const t = TOPICS.find(x => x.id === tid)
                      return t ? (
                        <span key={tid} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, padding: '1px 5px', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, color: sel ? 'var(--primary)' : 'var(--subtle)' }}>
                          {t.icon} {t.name}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
                {sel && <span style={{ color: 'var(--primary)', fontSize: 12, flexShrink: 0 }}>✓</span>}
              </div>
            )
          })}
        </div>

        {/* ─── SECCIÓN B: Mis ofertas guardadas ─── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Mis ofertas guardadas
          </div>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
            {savedOffers.length} guardada{savedOffers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {offersLoading ? (
          <div style={{ padding: '12px 14px', background: 'var(--card)', border: '1px dashed var(--border)', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textAlign: 'center', marginBottom: 10 }}>
            Cargando ofertas...
          </div>
        ) : savedOffers.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {savedOffers.map(offer => {
              const sel = selectedId === offer.id
              const covered = (offer.topics || []).filter(t => TOPICS.some(x => x.id === t.id))
              return (
                <div key={offer.id} onClick={() => { setSelectedId(offer.id); setShowAnalysis(false) }}
                  style={{ ...CARD(sel), position: 'relative' }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>📋</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: sel ? 'var(--primary)' : 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {offer.name}
                    </div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {offer.summary}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: covered.length > 0 ? 'var(--primary)' : 'var(--subtle)' }}>
                        {covered.length}/{offer.topics?.length || 0} skills en DevForge
                      </span>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)' }}>
                        {new Date(offer.savedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  {sel && <span style={{ color: 'var(--primary)', fontSize: 12, flexShrink: 0, marginRight: 6 }}>✓</span>}
                  {/* Botón eliminar */}
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (sel) setSelectedId('fullstack')
                      deleteOffer(offer.id)
                    }}
                    title="Eliminar oferta"
                    style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontSize: 12, padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
                  >
                    🗑
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '12px 14px', background: 'var(--card)', border: '1px dashed var(--border)', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textAlign: 'center', marginBottom: 10 }}>
            Todavía no guardaste ninguna oferta analizada
          </div>
        )}

        {/* Botón analizar nueva oferta */}
        <button
          onClick={() => { setShowAnalysis(s => !s); setSelectedId('') }}
          style={{ width: '100%', padding: '10px 0', background: showAnalysis ? 'var(--surface)' : 'var(--card)', border: `1px solid ${showAnalysis ? 'var(--primary)' : 'var(--border)'}`, color: showAnalysis ? 'var(--primary)' : 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s', marginBottom: 18 }}
        >
          <span style={{ fontSize: 14 }}>📎</span>
          {showAnalysis ? '✕ Cerrar análisis' : '+ Analizar nueva oferta con IA'}
          <span style={{ padding: '1px 5px', background: 'var(--primary)', color: '#000', fontFamily: 'Space Mono, monospace', fontSize: 8, fontWeight: 700 }}>IA</span>
        </button>

        {/* Panel de análisis */}
        {showAnalysis && (
          <OfferAnalysisPanel
            onSave={handleOfferSaved}
            onCancel={() => setShowAnalysis(false)}
          />
        )}

        {/* ─── SECCIÓN C: Personalizada ─── */}
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, marginTop: savedOffers.length > 0 ? 0 : 4 }}>
          Modo personalizado
        </div>
        <div onClick={() => { setSelectedId('custom'); setShowAnalysis(false) }} style={CARD(selectedId === 'custom')}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚙️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: selectedId === 'custom' ? 'var(--primary)' : 'var(--text)', marginBottom: 3 }}>
              Personalizada
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
              {selectedId === 'custom' && customTopics.length > 0
                ? `${customTopics.length} tema${customTopics.length !== 1 ? 's' : ''} seleccionado${customTopics.length !== 1 ? 's' : ''}`
                : 'Elegí los temas vos mismo'
              }
            </div>
          </div>
          {selectedId === 'custom' && <span style={{ color: 'var(--primary)', fontSize: 12, flexShrink: 0 }}>✓</span>}
        </div>

        {/* Topic picker custom */}
        {selectedId === 'custom' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 5 }}>
              {TOPICS.map(t => {
                const sel = customTopics.includes(t.id)
                return (
                  <div key={t.id} onClick={() => toggleCustomTopic(t.id)}
                    style={{ padding: '7px 11px', background: sel ? 'var(--surface)' : 'var(--card)', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7 }}
                  >
                    <span style={{ fontSize: 13 }}>{t.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: sel ? 'var(--primary)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)' }}>Tier {t.tier}</div>
                    </div>
                    {sel && <span style={{ color: 'var(--primary)', fontSize: 10, flexShrink: 0 }}>✓</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Skills del perfil seleccionado ─── */}
        {selectedId !== 'custom' && activeTopics.length > 0 && (
          <SkillsBreakdown topics={activeTopics} />
        )}

        {/* Aviso si ai offer no tiene topics con preguntas */}
        {selectedId !== 'custom' && activeTopics.length > 0 && selectedTopicIds.length === 0 && (
          <div style={{ marginTop: 10, padding: '9px 12px', background: 'color-mix(in srgb, var(--primary) 6%, transparent)', border: '1px solid var(--primary)' }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)', margin: 0, lineHeight: 1.6 }}>
              ℹ Las skills de esta oferta aún no tienen preguntas en DevForge. Probá con "Personalizada".
            </p>
          </div>
        )}

        {/* ── Resumen + CTA ── */}
        <div style={{ marginTop: 28, background: 'var(--surface)', border: `2px solid ${selectedTopicIds.length ? 'var(--primary)' : 'var(--border)'}`, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', rowGap: 12 }}>
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
                Resumen de la entrevista
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>
                {duration} min · {DIFFICULTIES.find(d => d.value === difficulty)?.label} · ~{approxQ} preguntas
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
                {selectedTopicIds.length} tema{selectedTopicIds.length !== 1 ? 's' : ''} · Sin hints · Feedback al final
              </div>
            </div>
            <button
              onClick={handleStart}
              disabled={!selectedTopicIds.length}
              style={{ padding: '12px 28px', background: selectedTopicIds.length ? 'var(--primary)' : 'var(--muted)', border: 'none', color: '#000', cursor: selectedTopicIds.length ? 'pointer' : 'default', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Iniciar entrevista →
            </button>
          </div>
        </div>

      </main>

      <footer className="forge-footer">
        <span>DevForge</span>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>← Dashboard</button>
      </footer>
    </div>
  )
}
