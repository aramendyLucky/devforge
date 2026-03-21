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

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store/index.jsx'
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
  loadOffers      as dbLoadOffers,
  saveOffer       as dbSaveOffer,
  deleteOffer     as dbDeleteOffer,
  updateOfferName as dbUpdateOfferName,  // ← FASE 3: renombrado inline de ofertas
} from '../lib/db.js'
import { supabase } from '../lib/supabase.js'
import Header from '../components/ui/Header.jsx'

// ─── Constantes ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'devforge_saved_offers'

// Note: DURATIONS and DIFFICULTIES labels/descs are translated at render time using t()
const DURATIONS = [
  { value: 20, labelKey: 'interview.duration20', descKey: 'interview.duration20Desc' },
  { value: 45, labelKey: 'interview.duration45', descKey: 'interview.duration45Desc' },
  { value: 60, labelKey: 'interview.duration60', descKey: 'interview.duration60Desc' },
]

const DIFFICULTIES = [
  { value: 'basic',  labelKey: 'interview.levelJunior', descKey: 'interview.levelJuniorDesc', color: 'var(--green)'   },
  { value: 'mixed',  labelKey: 'interview.levelMid',    descKey: 'interview.levelMidDesc',    color: 'var(--primary)' },
  { value: 'senior', labelKey: 'interview.levelSenior', descKey: 'interview.levelSeniorDesc', color: 'var(--red)'     },
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
  1: { labelKey: 'common.tier1', color: 'var(--red)',     bg: 'color-mix(in srgb, var(--red) 8%, transparent)'     },
  2: { labelKey: 'common.tier2', color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)' },
  3: { labelKey: 'common.tier3', color: 'var(--subtle)',  bg: 'transparent'                                        },
}

// ─── useOfferMeta ─────────────────────────────────────────────────────────
/**
 * Hook de metadatos de oferta almacenados en localStorage.
 *
 * ¿Por qué localStorage y no Supabase?
 * Status (activa/aplicada/etc.) y pins son preferencias personales del dispositivo,
 * no datos de negocio. No vale la pena una migración de DB para esto.
 * Si el usuario cambia de dispositivo, empieza limpio — lo cual es aceptable.
 *
 * Claves utilizadas:
 *   devforge_offer_status → { [offerId]: 'active'|'applied'|'in_progress'|'discarded' }
 *   devforge_offer_pins   → { [offerId]: true }
 *
 * ¿Por qué dos claves separadas?
 * Modelos independientes: un pin no tiene relación con el estado de la oferta.
 * Permite limpiar uno sin afectar el otro (ej: "borrar todos los pins").
 */
function useOfferMeta() {
  // Leemos del localStorage al iniciar — si está vacío, usamos {} como default
  const [statusMap, setStatusMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('devforge_offer_status') || '{}') }
    catch { return {} }
  })
  const [pinMap, setPinMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('devforge_offer_pins') || '{}') }
    catch { return {} }
  })

  /** Retorna el estado de una oferta. Default: 'active' si nunca se configuró. */
  function getStatus(id) { return statusMap[id] || 'active' }

  /**
   * Cambia el estado de una oferta y lo persiste en localStorage.
   * @param {string} id     — UUID de la oferta
   * @param {string} status — 'active' | 'applied' | 'in_progress' | 'discarded'
   */
  function setStatus(id, status) {
    const next = { ...statusMap, [id]: status }
    setStatusMap(next)
    localStorage.setItem('devforge_offer_status', JSON.stringify(next))
  }

  /** Retorna true si la oferta está fijada arriba. */
  function isPinned(id) { return !!pinMap[id] }

  /** Alterna el pin de una oferta. Las fijadas flotan al tope de la lista. */
  function togglePin(id) {
    const next = { ...pinMap }
    if (next[id]) { delete next[id] } else { next[id] = true }
    setPinMap(next)
    localStorage.setItem('devforge_offer_pins', JSON.stringify(next))
  }

  /**
   * Limpia los metadatos huérfanos de una oferta eliminada.
   * Se llama desde el handler de delete para evitar que el localStorage crezca
   * indefinidamente con IDs de ofertas que ya no existen.
   * @param {string} id — UUID de la oferta eliminada
   */
  function cleanMeta(id) {
    const nextStatus = { ...statusMap }
    const nextPins   = { ...pinMap }
    delete nextStatus[id]
    delete nextPins[id]
    setStatusMap(nextStatus)
    setPinMap(nextPins)
    localStorage.setItem('devforge_offer_status', JSON.stringify(nextStatus))
    localStorage.setItem('devforge_offer_pins',   JSON.stringify(nextPins))
  }

  return { getStatus, setStatus, isPinned, togglePin, cleanMeta, pinMap }
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

  /**
   * Renombra una oferta en Supabase y actualiza el estado local de forma optimista.
   * "Optimista" = actualizamos la UI primero y revertimos si falla.
   *
   * ¿Por qué optimista?
   * Elimina el lag visual: el nombre cambia al instante en lugar de esperar la DB.
   * Si Supabase falla (raro), el usuario ve que volvió el nombre anterior — señal clara.
   *
   * @param {string} id      — UUID de la oferta a renombrar
   * @param {string} newName — Nuevo nombre (ya trimmed por el caller)
   */
  const updateOfferName = useCallback(async (id, newName) => {
    // Actualización optimista: cambiamos el nombre localmente antes de ir a DB
    const prev = offers.find(o => o.id === id)
    setOffers(curr => curr.map(o => o.id === id ? { ...o, name: newName } : o))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setOffers(curr => curr.map(o => o.id === id ? { ...o, name: prev?.name } : o)); return }

    const ok = await dbUpdateOfferName(user.id, id, newName)
    if (!ok && prev) {
      // Revertimos al nombre anterior si Supabase falló
      setOffers(curr => curr.map(o => o.id === id ? { ...o, name: prev.name } : o))
    }
  }, [offers])

  return { offers, loading, saveOffer, deleteOffer, updateOfferName }
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
  const { t } = useTranslation()
  if (!topics || topics.length === 0) return null

  // Separar skills por tier
  const byTier = { 1: [], 2: [], 3: [] }
  topics.forEach(tp => {
    const tier = tp.tier || 1
    if (byTier[tier]) byTier[tier].push(tp)
  })

  // Calcular cobertura (cuántas tienen preguntas en DevForge)
  const covered = topics.filter(tp => TOPICS.some(x => x.id === tp.id))
  const pct = Math.round((covered.length / topics.length) * 100)

  return (
    <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--border)' }}>

      {/* Header de cobertura */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {t('interview.skillsBreakdown')}
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
              {t(meta.labelKey)}
            </div>
            {/* Chips de skills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {tierTopics.map(tp => {
                const inCatalog = TOPICS.some(x => x.id === tp.id)
                const topicData = TOPICS.find(x => x.id === tp.id)
                return (
                  <span
                    key={tp.id}
                    title={inCatalog ? t('interview.hasQuestions') : t('interview.noQuestions')}
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
                    {topicData?.icon || (inCatalog ? '✓' : '·')} {tp.name}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Leyenda */}
      {topics.some(tp => !TOPICS.some(x => x.id === tp.id)) && (
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
  const { t }   = useTranslation()
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

// ─── StepBar ──────────────────────────────────────────────────────────────
/**
 * Barra de progreso visual para el flujo de 3 pasos de FASE 4.
 *
 * Diseño: círculo numerado → ✓ cuando el paso ya pasó · línea conectora coloreada
 * Las transiciones (color, background) son CSS transitions de 0.25s para que se
 * vea fluido al avanzar entre pasos.
 *
 * @param {number}   step   — paso activo (1, 2 o 3)
 * @param {string[]} labels — etiqueta de cada paso (ya traducida por el caller)
 */
function StepBar({ step, labels }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 28 }}>
      {labels.map((label, i) => {
        const n      = i + 1
        const done   = step > n
        const active = step === n
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'flex-start', flex: i < labels.length - 1 ? 1 : 'none' }}>
            {/* Columna: círculo indicador + etiqueta */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {/* Círculo: relleno (done) / borde+color primary (active) / gris (pending) */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? 'var(--primary)' : active ? 'color-mix(in srgb, var(--primary) 15%, var(--surface))' : 'var(--surface)',
                border: `2px solid ${done || active ? 'var(--primary)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
                color: done ? '#000' : active ? 'var(--primary)' : 'var(--subtle)',
                transition: 'all 0.25s',
                flexShrink: 0,
              }}>
                {done ? '✓' : n}
              </div>
              {/* Etiqueta en uppercase debajo del círculo */}
              <div style={{
                fontFamily: 'Space Mono, monospace', fontSize: 8,
                color: active ? 'var(--primary)' : done ? 'var(--text)' : 'var(--subtle)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                whiteSpace: 'nowrap', transition: 'color 0.25s',
              }}>
                {label}
              </div>
            </div>
            {/* Línea conectora — se pinta de primary cuando el paso fue completado */}
            {i < labels.length - 1 && (
              <div style={{
                flex: 1, height: 2,
                marginTop: 13,  // centrada sobre el círculo de 28px (28/2 - 2/2 = 13)
                background: step > n ? 'var(--primary)' : 'var(--border)',
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── InterviewSetup principal ─────────────────────────────────────────────
export default function InterviewSetup() {
  const { t }       = useTranslation()
  const navigate    = useNavigate()
  const { state }   = useStore()   // ← para acceder a state.interviews y calcular uso de ofertas

  // ── Hooks de ofertas ─────────────────────────────────────────────────────
  const { offers: savedOffers, loading: offersLoading, saveOffer, deleteOffer, updateOfferName } = useSavedOffers()
  const { getStatus, setStatus, isPinned, togglePin, cleanMeta, pinMap } = useOfferMeta()

  // ── Estado base ──────────────────────────────────────────────────────────
  const [duration,      setDuration]      = useState(45)
  const [difficulty,    setDifficulty]    = useState('mixed')
  const [selectedId,    setSelectedId]    = useState('fullstack')   // preset ID seleccionado
  const [customTopics,  setCustomTopics]  = useState([])
  const [showAnalysis,  setShowAnalysis]  = useState(false)

  // ── Estado FASE 4: flujo multi-paso + smart default ─────────────────────
  /**
   * step: paso activo del flujo de configuración.
   *   1 = Selección de perfil (ofertas, presets, custom)
   *   2 = Configuración (duración + dificultad)
   *   3 = Resumen y lanzamiento
   */
  const [step,              setStep]              = useState(1)
  /**
   * difficultyAutoSet: true cuando el nivel fue sugerido automáticamente
   * por el stack de una oferta guardada. Se limpia si el usuario elige manualmente.
   */
  const [difficultyAutoSet, setDifficultyAutoSet] = useState(false)

  // ── Estado FASE 3: búsqueda, orden, edición inline, confirmación delete ──
  const [offerSearch,     setOfferSearch]     = useState('')           // filtro texto libre
  const [offerSort,       setOfferSort]       = useState('date')       // 'date' | 'name' | 'stack'
  const [editingOfferId,  setEditingOfferId]  = useState(null)         // UUID de la oferta en edición
  const [editingName,     setEditingName]     = useState('')           // nombre temporal durante edición
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)        // UUID de oferta con confirm visible

  // ── Estadísticas de uso por oferta ──────────────────────────────────────
  /**
   * Calcula cuántas entrevistas simuladas se hicieron con cada oferta.
   * Estrategia: si una entrevista tiene al menos un topic que también tiene la oferta,
   * la contamos como "usada con esa oferta".
   *
   * ¿Por qué useMemo?
   * state.interviews puede tener muchas entradas. Cruzarlas contra savedOffers
   * en cada render sería costoso. useMemo solo recalcula cuando cambia interviews o savedOffers.
   *
   * @returns {Object} — { [offerId]: number }
   */
  const interviewCountByOffer = useMemo(() => {
    const interviews = state.interviews || []
    const result = {}
    for (const offer of savedOffers) {
      const offerTopicIds = new Set((offer.topics || []).map(tp => tp.id))
      result[offer.id] = interviews.filter(iv =>
        (iv.topicIds || []).some(tid => offerTopicIds.has(tid))
      ).length
    }
    return result
  }, [savedOffers, state.interviews])

  // ── Lista filtrada + ordenada de ofertas (FASE 3) ────────────────────────
  /**
   * displayedOffers — la lista que se renderiza en pantalla.
   *
   * Orden de operaciones:
   *   1. Filtrado por texto libre (nombre + summary + topics)
   *   2. Ordenado por el criterio elegido (fecha / nombre / stack size)
   *   3. Los fijados (pinned) siempre flotan al tope — aplicado al final
   *
   * ¿Por qué el pin sort es el último?
   * Si aplicamos el pin antes del sort por nombre, los fijados podrían
   * quedar intercalados con los no fijados dentro del mismo criterio.
   * Al aplicar pin al final, los fijados siempre están arriba, ordenados
   * entre sí por el criterio elegido, y los no fijados debajo también ordenados.
   */
  const displayedOffers = useMemo(() => {
    let list = [...savedOffers]

    // 1. Filtro por texto libre — busca en nombre, resumen y topics
    if (offerSearch.trim()) {
      const q = offerSearch.toLowerCase().trim()
      list = list.filter(o =>
        o.name.toLowerCase().includes(q) ||
        (o.summary || '').toLowerCase().includes(q) ||
        (o.topics  || []).some(tp => tp.name.toLowerCase().includes(q))
      )
    }

    // 2. Ordenado por criterio — 'date' ya viene ordenado desde Supabase (DESC)
    if (offerSort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (offerSort === 'stack') {
      // Stack size: más topics = más cobertura técnica → aparece primero
      list.sort((a, b) => (b.topics?.length || 0) - (a.topics?.length || 0))
    }

    // 3. Pins al tope — siempre después del sort para mantener consistencia
    list.sort((a, b) => {
      const pa = isPinned(a.id) ? 1 : 0
      const pb = isPinned(b.id) ? 1 : 0
      return pb - pa
    })

    return list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOffers, offerSearch, offerSort, pinMap])

  // ── Smart default de dificultad (FASE 4) ─────────────────────────────────
  /**
   * Cuando el usuario selecciona una oferta guardada, inferimos el nivel apropiado
   * contando cuántos topics son Tier 1 (críticos):
   *   ≥ 5 Tier-1  → Senior  (stack exigente, muchos requisitos core)
   *   3-4 Tier-1  → Mid     (stack balanceado)
   *   < 3 Tier-1  → Junior  (stack pequeño o mayoritariamente nice-to-have)
   *
   * El hint ⚡ en Paso 2 informa al usuario que el nivel fue sugerido.
   * Si el usuario elige manualmente otra opción, setDifficultyAutoSet(false) apaga el hint.
   *
   * Solo se ejecuta cuando cambia selectedId, no cuando cambia savedOffers,
   * para no resetear la elección manual en cada re-render.
   */
  useEffect(() => {
    const savedOffer = savedOffers.find(o => o.id === selectedId)
    if (!savedOffer?.topics) { setDifficultyAutoSet(false); return }

    const tier1Count = savedOffer.topics.filter(tp => tp.tier === 1).length
    const suggested  = tier1Count >= 5 ? 'senior' : tier1Count >= 3 ? 'mixed' : 'basic'

    setDifficulty(suggested)
    setDifficultyAutoSet(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])  // Intencional: solo reacciona a cambio de oferta seleccionada

  // ── Edición inline de nombre ─────────────────────────────────────────────
  /** Inicia la edición de nombre para una oferta */
  function startEdit(offer, e) {
    e.stopPropagation()
    setEditingOfferId(offer.id)
    setEditingName(offer.name)
  }

  /** Confirma el nuevo nombre: persiste en Supabase y limpia el estado de edición */
  async function commitEdit(e) {
    e?.preventDefault?.()
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== savedOffers.find(o => o.id === editingOfferId)?.name) {
      await updateOfferName(editingOfferId, trimmed)
    }
    setEditingOfferId(null)
    setEditingName('')
  }

  /** Cancela la edición sin guardar */
  function cancelEdit() {
    setEditingOfferId(null)
    setEditingName('')
  }

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

  // ── Label del perfil activo para el resumen (Paso 3) ─────────────────────
  /**
   * Devuelve un string legible del perfil seleccionado para mostrar en el resumen.
   * preset fijo → "icono + nombre" | oferta guardada → nombre | custom → "Personalizada (N)"
   */
  function getActiveProfileLabel() {
    const fixed = FIXED_PRESETS.find(p => p.id === selectedId)
    if (fixed) return `${fixed.icon} ${fixed.label}`

    const saved = savedOffers.find(o => o.id === selectedId)
    if (saved) return saved.name

    if (selectedId === 'custom') {
      return `${t('interview.customLabel')}${customTopics.length > 0 ? ` (${customTopics.length})` : ''}`
    }
    return '—'
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

        {/* Título de página */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
            {t('interview.configureLabel')}
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text)', margin: '0 0 4px' }}>
            {t('interview.configureTitle')}
          </h1>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.7, margin: 0 }}>
            {t('interview.configureSubtitle')}
          </p>
        </div>

        {/* ── Barra de progreso de pasos ─────────────────────────────────────────
            Muestra en qué paso está el usuario y cuáles ya completó.
            StepBar recibe los labels ya traducidos para soportar i18n. */}
        <StepBar
          step={step}
          labels={[t('interview.step1Label'), t('interview.step2Label'), t('interview.step3Label')]}
        />

        {/* ═══════════════════════════════════════════════════════════════════
            PASO 1 — Selección de perfil
            Contiene: presets fijos + ofertas guardadas + custom
            Navegación: Siguiente → solo habilitado cuando hay topics seleccionados
        ═══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div key="step1" style={{ animation: 'stepIn 0.2s ease' }}>

            {/* ─── SECCIÓN A: Ofertas rápidas (presets fijos) ─── */}
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              {t('interview.quickOffers')}
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
                          const tp = TOPICS.find(x => x.id === tid)
                          return tp ? (
                            <span key={tid} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, padding: '1px 5px', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, color: sel ? 'var(--primary)' : 'var(--subtle)' }}>
                              {tp.icon} {tp.name}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: savedOffers.length > 0 ? 8 : 10 }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {t('interview.savedOffers')}
              </div>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
                {t('interview.savedCount', { count: savedOffers.length })}
              </span>
            </div>

            {/* Toolbar: búsqueda + orden — solo si hay ofertas */}
            {!offersLoading && savedOffers.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  type="text"
                  value={offerSearch}
                  onChange={e => setOfferSearch(e.target.value)}
                  placeholder={t('interview.searchPlaceholder')}
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 10, outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>
                    {t('interview.sortLabel')}
                  </span>
                  <select
                    value={offerSort}
                    onChange={e => setOfferSort(e.target.value)}
                    style={{ padding: '5px 6px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 10, cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="date">{t('interview.sortDate')}</option>
                    <option value="name">{t('interview.sortName')}</option>
                    <option value="stack">{t('interview.sortStack')}</option>
                  </select>
                </div>
              </div>
            )}

            {/* Lista de ofertas guardadas */}
            {offersLoading ? (
              <div style={{ padding: '12px 14px', background: 'var(--card)', border: '1px dashed var(--border)', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textAlign: 'center', marginBottom: 10 }}>
                {t('interview.loadingOffers')}
              </div>

            ) : savedOffers.length === 0 ? (
              <div style={{ padding: '12px 14px', background: 'var(--card)', border: '1px dashed var(--border)', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textAlign: 'center', marginBottom: 10 }}>
                {t('interview.noSavedOffers')}
              </div>

            ) : displayedOffers.length === 0 ? (
              <div style={{ padding: '12px 14px', background: 'var(--card)', border: '1px dashed var(--border)', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textAlign: 'center', marginBottom: 10 }}>
                {t('interview.noSearchResults', { query: offerSearch })}
              </div>

            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {displayedOffers.map(offer => {
                  const sel      = selectedId === offer.id
                  const pinned   = isPinned(offer.id)
                  const status   = getStatus(offer.id)
                  const useCount = interviewCountByOffer[offer.id] ?? 0
                  const covered  = (offer.topics || []).filter(tp => TOPICS.some(x => x.id === tp.id))
                  const isEditing          = editingOfferId  === offer.id
                  const isConfirmingDelete = confirmDeleteId === offer.id

                  // Paleta de colores por estado de la oferta
                  const STATUS_COLORS = {
                    active:      { color: 'var(--green)',   bg: 'color-mix(in srgb, var(--green) 10%, transparent)'   },
                    applied:     { color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 10%, transparent)' },
                    in_progress: { color: '#60a5fa',        bg: 'rgba(96,165,250,0.1)'                                },
                    discarded:   { color: 'var(--red)',     bg: 'color-mix(in srgb, var(--red) 10%, transparent)'     },
                  }
                  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.active

                  return (
                    <div
                      key={offer.id}
                      onClick={() => {
                        // No seleccionar mientras hay una acción inline en progreso
                        if (isEditing || isConfirmingDelete) return
                        setSelectedId(offer.id)
                        setShowAnalysis(false)
                      }}
                      style={{
                        ...CARD(sel),
                        position: 'relative',
                        // Borde izquierdo dorado indica que la oferta está fijada (pin)
                        borderLeft: pinned ? '3px solid var(--primary)' : `2px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: 0,
                        padding: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                        <span style={{ fontSize: 16, flexShrink: 0, opacity: pinned ? 1 : 0.6 }}>
                          {pinned ? '📌' : '📋'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isEditing ? (
                            <form onSubmit={commitEdit} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                              <input
                                autoFocus
                                type="text"
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                                placeholder={t('interview.editNamePlaceholder')}
                                onClick={e => e.stopPropagation()}
                                style={{ flex: 1, padding: '3px 6px', background: 'var(--bg)', border: '1px solid var(--primary)', color: 'var(--text)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, outline: 'none' }}
                              />
                              <button type="submit" onClick={e => e.stopPropagation()}
                                style={{ padding: '3px 7px', background: 'var(--primary)', border: 'none', color: 'var(--bg)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                                ✓
                              </button>
                              <button type="button" onClick={e => { e.stopPropagation(); cancelEdit() }}
                                style={{ padding: '3px 7px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontSize: 10 }}>
                                ✕
                              </button>
                            </form>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: sel ? 'var(--primary)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {offer.name}
                              </div>
                              {/* Badge de estado con dropdown colorizado */}
                              <select
                                value={status}
                                onClick={e => e.stopPropagation()}
                                onChange={e => { e.stopPropagation(); setStatus(offer.id, e.target.value) }}
                                style={{ padding: '1px 4px', border: 'none', background: statusStyle.bg, color: statusStyle.color, fontFamily: 'Space Mono, monospace', fontSize: 8, fontWeight: 700, cursor: 'pointer', flexShrink: 0, outline: 'none' }}
                              >
                                <option value="active">{t('interview.statusActive')}</option>
                                <option value="applied">{t('interview.statusApplied')}</option>
                                <option value="in_progress">{t('interview.statusInProgress')}</option>
                                <option value="discarded">{t('interview.statusDiscarded')}</option>
                              </select>
                            </div>
                          )}
                          {!isEditing && (
                            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {offer.summary}
                            </div>
                          )}
                          {!isEditing && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: covered.length > 0 ? 'var(--primary)' : 'var(--subtle)' }}>
                                {t('interview.skillsInDevForge', { covered: covered.length, total: offer.topics?.length || 0 })}
                              </span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)' }}>
                                {new Date(offer.savedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                              </span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: useCount > 0 ? 'var(--green)' : 'var(--muted)' }}>
                                {t('interview.usedInInterviews', { count: useCount })}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Acciones: pin + editar + borrar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          {sel && !isEditing && (
                            <span style={{ color: 'var(--primary)', fontSize: 12, marginRight: 4 }}>✓</span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); togglePin(offer.id) }}
                            title={pinned ? t('interview.unpinOffer') : t('interview.pinOffer')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '2px 3px', color: pinned ? 'var(--primary)' : 'var(--subtle)', lineHeight: 1 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = pinned ? 'var(--primary)' : 'var(--subtle)'}
                          >
                            {pinned ? '📌' : '📍'}
                          </button>
                          <button
                            onClick={e => startEdit(offer, e)}
                            title={t('interview.editName')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '2px 3px', color: 'var(--subtle)', lineHeight: 1 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(offer.id) }}
                            title={t('interview.confirmDelete')}
                            style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontSize: 11, padding: '2px 3px', lineHeight: 1 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      {/* Confirmación de borrado inline — no modal.
                          limpia metadatos huérfanos de localStorage al confirmar. */}
                      {isConfirmingDelete && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', background: 'color-mix(in srgb, var(--red) 6%, var(--surface))', display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--red)', flex: 1 }}>
                            {t('interview.confirmDelete')}
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              if (sel) setSelectedId('fullstack')
                              cleanMeta(offer.id)   // elimina pin + status huérfanos
                              deleteOffer(offer.id)
                              setConfirmDeleteId(null)
                            }}
                            style={{ padding: '4px 10px', background: 'var(--red)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700 }}
                          >
                            {t('interview.confirmDeleteYes')}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                            style={{ padding: '4px 10px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9 }}
                          >
                            {t('interview.confirmDeleteNo')}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Botón analizar nueva oferta con IA */}
            <button
              onClick={() => { setShowAnalysis(s => !s); setSelectedId('') }}
              style={{ width: '100%', padding: '10px 0', background: showAnalysis ? 'var(--surface)' : 'var(--card)', border: `1px solid ${showAnalysis ? 'var(--primary)' : 'var(--border)'}`, color: showAnalysis ? 'var(--primary)' : 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s', marginBottom: showAnalysis ? 0 : 16 }}
            >
              <span style={{ fontSize: 14 }}>📎</span>
              {showAnalysis ? t('interview.closeAnalysis') : t('interview.analyzeNew')}
              <span style={{ padding: '1px 5px', background: 'var(--primary)', color: '#000', fontFamily: 'Space Mono, monospace', fontSize: 8, fontWeight: 700 }}>IA</span>
            </button>

            {showAnalysis && (
              <OfferAnalysisPanel
                onSave={handleOfferSaved}
                onCancel={() => setShowAnalysis(false)}
              />
            )}

            {/* ─── SECCIÓN C: Personalizada ─── */}
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, marginTop: showAnalysis ? 14 : 16 }}>
              {t('interview.customMode')}
            </div>
            <div onClick={() => { setSelectedId('custom'); setShowAnalysis(false) }} style={CARD(selectedId === 'custom')}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>⚙️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: selectedId === 'custom' ? 'var(--primary)' : 'var(--text)', marginBottom: 3 }}>
                  {t('interview.customLabel')}
                </div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
                  {selectedId === 'custom' && customTopics.length > 0
                    ? t('interview.customTopicsSelected', { count: customTopics.length })
                    : t('interview.customDesc')
                  }
                </div>
              </div>
              {selectedId === 'custom' && <span style={{ color: 'var(--primary)', fontSize: 12, flexShrink: 0 }}>✓</span>}
            </div>

            {/* Topic picker custom */}
            {selectedId === 'custom' && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 5 }}>
                  {TOPICS.map(tp => {
                    const sel = customTopics.includes(tp.id)
                    return (
                      <div key={tp.id} onClick={() => toggleCustomTopic(tp.id)}
                        style={{ padding: '7px 11px', background: sel ? 'var(--surface)' : 'var(--card)', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7 }}
                      >
                        <span style={{ fontSize: 13 }}>{tp.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: sel ? 'var(--primary)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tp.name}</div>
                          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)' }}>Tier {tp.tier}</div>
                        </div>
                        {sel && <span style={{ color: 'var(--primary)', fontSize: 10, flexShrink: 0 }}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Preview de skills del perfil seleccionado */}
            {selectedId !== 'custom' && activeTopics.length > 0 && (
              <SkillsBreakdown topics={activeTopics} />
            )}

            {/* Aviso si la oferta no tiene topics con preguntas en DevForge */}
            {selectedId !== 'custom' && activeTopics.length > 0 && selectedTopicIds.length === 0 && (
              <div style={{ marginTop: 10, padding: '9px 12px', background: 'color-mix(in srgb, var(--primary) 6%, transparent)', border: '1px solid var(--primary)' }}>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)', margin: 0, lineHeight: 1.6 }}>
                  {t('interview.step3NoTopics')}
                </p>
              </div>
            )}

            {/* Botón Siguiente → Paso 2.
                Deshabilitado si no hay topics con preguntas para evitar un Paso 3 inútil. */}
            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedTopicIds.length}
                style={{ width: '100%', padding: '13px 0', background: selectedTopicIds.length ? 'var(--primary)' : 'var(--muted)', border: 'none', color: '#000', cursor: selectedTopicIds.length ? 'pointer' : 'default', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}
              >
                {t('interview.nextStep')}
              </button>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PASO 2 — Configuración de la sesión
            Duración + nivel de dificultad + hint de smart default + skills preview
        ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div key="step2" style={{ animation: 'stepIn 0.2s ease' }}>

            <Divider>{t('interview.durationLabel')}</Divider>
            <div className="forge-grid-3" style={{ marginBottom: 4 }}>
              {DURATIONS.map(d => (
                <div key={d.value} onClick={() => setDuration(d.value)}
                  style={{ padding: '12px 10px', background: 'var(--surface)', border: `2px solid ${duration === d.value ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer', transition: 'border-color 0.15s', textAlign: 'center' }}
                >
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: duration === d.value ? 'var(--primary)' : 'var(--text)', marginBottom: 3 }}>{t(d.labelKey)}</div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>{t(d.descKey)}</div>
                </div>
              ))}
            </div>

            <Divider>{t('interview.difficultyLabel')}</Divider>

            {/* Hint de smart default — aparece solo cuando el nivel fue sugerido automáticamente.
                Se apaga al instante cuando el usuario elige manualmente. */}
            {difficultyAutoSet && (
              <div style={{ marginBottom: 10, padding: '7px 12px', background: 'color-mix(in srgb, var(--primary) 8%, transparent)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>⚡</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)' }}>
                  {t('interview.smartDefaultHint')}
                </span>
              </div>
            )}

            <div className="forge-grid-3">
              {DIFFICULTIES.map(d => (
                <div key={d.value}
                  onClick={() => { setDifficulty(d.value); setDifficultyAutoSet(false) }}
                  style={{ padding: '12px 10px', background: 'var(--surface)', border: `2px solid ${difficulty === d.value ? d.color : 'var(--border)'}`, cursor: 'pointer', transition: 'border-color 0.15s', textAlign: 'center' }}
                >
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: difficulty === d.value ? d.color : 'var(--text)', marginBottom: 3 }}>{t(d.labelKey)}</div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>{t(d.descKey)}</div>
                </div>
              ))}
            </div>

            {/* Skills breakdown — recordatorio del perfil mientras configura el nivel */}
            {selectedId !== 'custom' && activeTopics.length > 0 && (
              <SkillsBreakdown topics={activeTopics} />
            )}

            {/* Navegación Paso 2: Volver + Siguiente */}
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button
                onClick={() => setStep(1)}
                style={{ flex: 1, padding: '12px 0', background: 'transparent', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}
              >
                {t('interview.prevStep')}
              </button>
              <button
                onClick={() => setStep(3)}
                style={{ flex: 2, padding: '12px 0', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}
              >
                {t('interview.nextStep')}
              </button>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PASO 3 — Resumen y lanzamiento
            Resume toda la configuración elegida. El botón "Iniciar" SOLO está aquí:
            obliga a revisar la config completa antes de comenzar la entrevista.
        ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div key="step3" style={{ animation: 'stepIn 0.2s ease' }}>

            {/* Tarjeta de resumen */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 16, background: 'var(--card)', overflow: 'hidden' }}>
              <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>✅</span>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {t('interview.step3Ready')}
                </div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                {/* Perfil */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 13, paddingBottom: 13, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', flexShrink: 0, marginRight: 12 }}>
                    {t('interview.step3Profile')}
                  </span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>
                    {getActiveProfileLabel()}
                  </span>
                </div>
                {/* Duración */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
                    {t('interview.step3Duration')}
                  </span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>
                    {duration} min
                  </span>
                </div>
                {/* Nivel */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
                    {t('interview.step3Level')}
                  </span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: DIFFICULTIES.find(d => d.value === difficulty)?.color }}>
                    {t(DIFFICULTIES.find(d => d.value === difficulty)?.labelKey)}
                  </span>
                </div>
                {/* Topics / preguntas estimadas */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
                    {t('interview.step3Topics')}
                  </span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700, color: selectedTopicIds.length ? 'var(--green)' : 'var(--red)' }}>
                    {selectedTopicIds.length > 0
                      ? t('interview.step3Estimated', { count: approxQ })
                      : t('interview.step3NoTopics')}
                  </span>
                </div>
              </div>
            </div>

            {/* Recordatorio de reglas de la entrevista */}
            <div style={{ marginBottom: 18, fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textAlign: 'center', letterSpacing: '0.06em' }}>
              {t('interview.rules')}
            </div>

            {/* Botón iniciar — protagonista del Paso 3 */}
            <button
              onClick={handleStart}
              disabled={!selectedTopicIds.length}
              style={{ width: '100%', padding: '16px 0', background: selectedTopicIds.length ? 'var(--primary)' : 'var(--muted)', border: 'none', color: '#000', cursor: selectedTopicIds.length ? 'pointer' : 'default', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 10, letterSpacing: '0.02em' }}
            >
              {t('interview.startInterview')}
            </button>

            {/* Volver al Paso 2 */}
            <button
              onClick={() => setStep(2)}
              style={{ width: '100%', padding: '10px 0', background: 'transparent', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}
            >
              {t('interview.prevStep')}
            </button>

          </div>
        )}

      </main>

      <footer className="forge-footer">
        <span>{t('history.footer')}</span>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>
          {t('history.backDashboard')}
        </button>
      </footer>

      {/* Keyframes: stepIn (transición entre pasos) + spin/slideDown (subcomponentes internos) */}
      <style>{`
        @keyframes stepIn    { from { opacity: 0; transform: translateX(10px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes spin      { to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
