/**
 * src/components/ui/CVMatcherPanel.jsx
 *
 * PANEL DE CV MATCHER — analiza la compatibilidad entre el CV del usuario
 * y una oferta laboral usando IA (Groq llama-3.3-70b).
 *
 * ¿Qué hace?
 *   1. Permite subir un CV (PDF, DOCX, TXT, MD) o pegar el texto directamente
 *   2. Usa la oferta del store (rawOffers) o permite pegar una oferta personalizada
 *   3. Llama a Groq con un prompt especializado en ATS y CV matching:
 *      - Score global (0-100) + breakdown por categoría (4 ejes)
 *      - Skills que matchean con peso (critical/important/nice_to_have)
 *      - Skills que faltan con urgencia y semanas estimadas de aprendizaje
 *      - Proyectos concretos para cerrar los gaps (con días estimados y GitHub keywords)
 *      - ATS: keywords exactas a agregar + tips de formato
 *      - Análisis de seniority: lo que pide el JD vs lo que demuestra el CV
 *      - Quick Wins: 3 acciones para hoy en menos de 30 minutos
 *   4. Toda la UI usa react-i18next → responde al toggle ES/EN del header
 *   5. El idioma del análisis de IA también se adapta al idioma activo del store
 *
 * Arquitectura:
 *   - Mismo patrón que ResourcePanel: overlay + panel fijo derecho 420px
 *   - Llama a Groq directamente (callGroq local, mismo endpoint que useAI.js)
 *   - Usa extractTextFromFile de fileParser.js para leer el CV subido
 *   - Lee state.user.rawOffers del store como oferta pre-cargada por defecto
 *   - Lee state.config.language del store para adaptar el idioma de la IA
 *   - max_tokens 2500 porque el JSON de respuesta completo ocupa ~1500 tokens
 *
 * Props:
 *   onClose — callback para cerrar el panel
 */

import { useState, useRef, useEffect } from 'react'
import { useStore }                    from '../../store/index.jsx'
import { useAuth }                     from '../../context/AuthContext'
import { loadOffers }                  from '../../lib/db.js'
import { extractTextFromFile, isFileSupported } from '../../lib/fileParser.js'
import { useTranslation }              from 'react-i18next'

// ── Constantes de Groq (mismo endpoint que useAI.js) ──────────────────────
const MODEL = 'llama-3.3-70b-versatile'

/**
 * callGroq — llama a la API de Groq para el análisis de CV.
 *
 * ¿Por qué max_tokens 2500?
 * El JSON de respuesta completo (score_breakdown + 6+ items en varios arrays)
 * ocupa entre 1200-1800 tokens. Con 1000 (el default de useAI.js) el JSON
 * se cortaría y fallaría el parse.
 */
async function callGroq(messages) {
  const response = await fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages }),
  })
  if (!response.ok) throw new Error(`Groq error: ${response.status}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * buildSystemPrompt — genera el prompt del sistema adaptado al idioma.
 *
 * ¿Por qué el idioma importa en el prompt?
 * Aunque Groq puede detectar el idioma del CV, sin instrucción explícita
 * puede mezclar inglés y español en el JSON de respuesta. Forzamos el idioma
 * de respuesta para que coincida con el toggle del header.
 *
 * Scoring formula (40/25/20/15):
 *   40% skills técnicas  — lo más relevante para el filtro técnico
 *   25% match de seniority — afecta si el CV pasa el primer filtro de RRHH
 *   20% dominio/industria — experiencia en el sector (fintech, SaaS, etc.)
 *   15% keywords ATS — matching literal que hacen los robots de selección
 */
function buildSystemPrompt(lang) {
  const langInstruction = lang === 'en'
    ? 'Respond entirely in English. All strings in the JSON must be in English.'
    : 'Respondé completamente en español (Argentina/Latinoamérica). Todos los strings del JSON en español.'

  return `You are an expert in tech recruitment and ATS (Applicant Tracking System) optimization with 10 years of experience evaluating CVs for software development roles (Python, Full Stack, AI Engineer, Backend, etc.).

Your task: analyze the compatibility between a CV and a job description (JD) with maximum precision.

${langInstruction}

SCORING RULES:
- compatibility_score (0-100): 40% technical skills match + 25% seniority match + 20% domain experience + 15% ATS keywords literally present in CV
- missing_skills urgency: "critical" = must-have/required, "important" = nice-to-have/valued, "nice_to_have" = mentioned once or in bonus section
- matching_skills: semantic variations count (FastAPI matches "Python web framework"). Max 10 items.
- project_suggestions: EXACTLY 2-3 concrete projects doable in 1-2 weeks. Prioritize closing multiple gaps at once.
- ats_optimization: ATS does literal keyword matching. "REST APIs" does NOT match "RESTful services" in most ATS.
- quick_wins: EXACTLY 3 actions the candidate can take TODAY in under 30 minutes.

Respond ONLY with valid JSON, no extra text, no backticks, no comments:
{
  "compatibility_score": <number 0-100>,
  "score_breakdown": {
    "technical_skills": <number 0-100>,
    "seniority_match": <number 0-100>,
    "domain_experience": <number 0-100>,
    "keywords_ats": <number 0-100>
  },
  "verdict": "<1-2 honest and constructive sentences>",
  "matching_skills": [
    { "skill": "<string>", "found_in_cv": "<string>", "found_in_jd": "<string>", "weight": "critical|important|nice_to_have" }
  ],
  "missing_skills": [
    { "skill": "<string>", "context_in_jd": "<string>", "urgency": "critical|important|nice_to_have", "learning_time_weeks": <number> }
  ],
  "project_suggestions": [
    { "title": "<string>", "description": "<string>", "skills_covered": ["<string>"], "difficulty": "beginner|intermediate|advanced", "estimated_days": <number>, "github_keywords": ["<string>"] }
  ],
  "ats_optimization": {
    "overall_ats_score": <number 0-100>,
    "keywords_to_add": [
      { "keyword": "<string>", "reason": "<string>", "suggested_placement": "<string>" }
    ],
    "formatting_tips": ["<string>"]
  },
  "seniority_analysis": {
    "jd_requires": "junior|mid|senior|lead|staff",
    "cv_demonstrates": "junior|mid|mid-senior|senior|lead",
    "gap": "<string or null>",
    "recommendation": "<string or null>"
  },
  "quick_wins": ["<string>", "<string>", "<string>"]
}`
}

// ── Helpers visuales ───────────────────────────────────────────────────────

/** Color CSS según nivel de score (semáforo verde/ámbar/rojo) */
function scoreColor(score) {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

/** Barra de progreso horizontal para el score breakdown */
function ScoreBar({ value }) {
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <div style={{
        height: '100%',
        width:  `${Math.min(100, Math.max(0, value))}%`,
        background: scoreColor(value),
        borderRadius: 2,
        transition: 'width 0.6s ease-out',
      }} />
    </div>
  )
}

/**
 * UrgencyBadge — badge de urgencia para los skill gaps.
 * Acepta el label traducido para que cambie con el idioma activo.
 */
function UrgencyBadge({ level, label }) {
  const colorMap = {
    critical:     { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
    important:    { bg: 'rgba(245,158,11,0.15)',   color: '#f59e0b' },
    nice_to_have: { bg: 'rgba(100,116,139,0.15)',  color: '#94a3b8' },
  }
  const style = colorMap[level] || colorMap.nice_to_have
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px',
      background: style.bg, color: style.color, borderRadius: 3,
      fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {label}
    </span>
  )
}

/** WeightBadge — estrellas de prioridad para los skills que matchean */
function WeightBadge({ level }) {
  const map = {
    critical:     { label: '★★★', color: '#22c55e' },
    important:    { label: '★★',  color: '#f59e0b' },
    nice_to_have: { label: '★',   color: '#94a3b8' },
  }
  const style = map[level] || map.nice_to_have
  return (
    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: style.color }}>
      {style.label}
    </span>
  )
}

// ── buildJobText ──────────────────────────────────────────────────────────
/**
 * Reconstruye un texto de oferta laboral a partir de una oferta guardada.
 *
 * ¿Por qué reconstruir y no guardar el texto raw?
 * La tabla saved_offers almacena nombre + resumen + topics extraídos por IA
 * (no el texto crudo original). Con esos datos podemos construir un JD sintético
 * que Groq puede analizar perfectamente — el modelo entiende el formato.
 *
 * Formato final (ejemplo):
 *   Oferta: Startup FinTech · Senior Python
 *   Descripción: Buscamos Python Backend Engineer con FastAPI...
 *   Tecnologías críticas: Python, FastAPI, PostgreSQL
 *   Tecnologías importantes: Redis, Docker
 *   Nice to have: Kubernetes
 *
 * @param {Object} offer — { name, summary, topics: [{ name, tier }] }
 * @returns {string}
 */
function buildJobText(offer) {
  const byTier = (tier) => (offer.topics || [])
    .filter(tp => tp.tier === tier)
    .map(tp => tp.name)
    .join(', ')

  const critical  = byTier(1)
  const important = byTier(2)
  const nice      = byTier(3)

  return [
    `Oferta: ${offer.name}`,
    offer.summary ? `\nDescripción: ${offer.summary}` : '',
    critical  ? `\nTecnologías críticas: ${critical}`    : '',
    important ? `\nTecnologías importantes: ${important}` : '',
    nice      ? `\nNice to have: ${nice}`                 : '',
  ].join('').trim()
}

// ─────────────────────────────────────────────────────────────────────────
export default function CVMatcherPanel({ onClose }) {
  const { state }    = useStore()
  const { user }     = useAuth()           // ← usuario autenticado para cargar sus ofertas
  const { t }        = useTranslation()   // hook de i18n → toda la UI responde al toggle ES/EN
  const fileInputRef = useRef(null)

  // Idioma activo del store → determina el idioma de respuesta de la IA
  const activeLang = state.config?.language || 'es'

  // ── Estado del flujo ──────────────────────────────────────────────────
  const [cvText,    setCvText]    = useState('')
  const [jobText,   setJobText]   = useState(state.user?.rawOffers || '')
  const [fileName,  setFileName]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [result,    setResult]    = useState(null)
  // Tab por defecto: 'quickwins' — es lo más accionable para el usuario
  const [activeTab, setActiveTab] = useState('quickwins')

  // ── Estado del selector de ofertas guardadas ──────────────────────────
  const [savedOffers,    setSavedOffers]    = useState([])
  const [offersLoading,  setOffersLoading]  = useState(true)
  const [selectedOfferId, setSelectedOfferId] = useState(null)

  // ── Carga de ofertas guardadas desde Supabase ─────────────────────────
  /**
   * Se ejecuta una sola vez al montar el panel.
   * Carga las ofertas del usuario usando loadOffers(userId) de db.js.
   *
   * ¿Por qué no leerlas del store?
   * Las saved_offers NO están en el store global (solo el rawOffers crudo
   * del onboarding vive ahí). Las ofertas analizadas viven en Supabase y
   * se cargan bajo demanda desde los componentes que las necesitan.
   */
  useEffect(() => {
    if (!user?.id) { setOffersLoading(false); return }
    loadOffers(user.id)
      .then(offers => setSavedOffers(offers))
      .catch(() => setSavedOffers([]))
      .finally(() => setOffersLoading(false))
  }, [user?.id])

  /**
   * selectOffer — cuando el usuario elige una oferta guardada:
   *   1. Marca cuál está seleccionada (para el estilo activo)
   *   2. Reconstruye el texto del JD desde los datos estructurados
   *   3. Pone ese texto en el textarea para que sea editable antes de analizar
   */
  function selectOffer(offer) {
    setSelectedOfferId(offer.id)
    setJobText(buildJobText(offer))
  }

  // ── Labels de urgencia traducidos ────────────────────────────────────
  // Se calculan a partir de las keys del locale para que cambien con el idioma
  const urgencyLabel = {
    critical:     t('cvmatcher.skillCritical'),
    important:    t('cvmatcher.skillImportant'),
    nice_to_have: t('cvmatcher.skillNiceToHave'),
  }

  // ── Manejo del archivo de CV ──────────────────────────────────────────
  /**
   * handleFile — extrae el texto del CV usando fileParser.js.
   * Soporta PDF, DOCX, TXT, MD. Si el formato no es soportado muestra error.
   */
  async function handleFile(file) {
    if (!file) return
    if (!isFileSupported(file)) {
      setError(t('cvmatcher.errorUnsupported'))
      return
    }
    setError(null)
    setFileName(file.name)
    try {
      const text = await extractTextFromFile(file)
      setCvText(text)
    } catch (err) {
      setError(`${t('cvmatcher.errorUnsupported')}: ${err.message}`)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFile(e.dataTransfer?.files?.[0])
  }

  function handleFileInput(e) {
    handleFile(e.target.files?.[0])
  }

  // ── Análisis de compatibilidad ────────────────────────────────────────
  /**
   * analyze — envía CV + JD a Groq y parsea el JSON de respuesta.
   *
   * ¿Por qué slice(0, 4000) y slice(0, 3000)?
   * Con prompts más largos, llama-3.3-70b tiende a truncar el JSON de respuesta
   * o a no cerrar los brackets. Estos límites producen JSON consistente.
   *
   * Parsing robusto:
   *   1. Limpia backticks por si Groq los agrega
   *   2. Intenta JSON.parse directo
   *   3. Fallback: extrae el primer bloque { ... } con regex
   */
  async function analyze() {
    if (!cvText.trim()) { setError(t('cvmatcher.errorNoCV'));  return }
    if (!jobText.trim()) { setError(t('cvmatcher.errorNoJob')); return }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const userMsg = `CV:
--- START ---
${cvText.trim().slice(0, 4000)}
--- END ---

JOB DESCRIPTION:
--- START ---
${jobText.trim().slice(0, 3000)}
--- END ---

Analyze the compatibility and return the complete JSON.`

      const raw = await callGroq([
        { role: 'system', content: buildSystemPrompt(activeLang) },
        { role: 'user',   content: userMsg },
      ])

      // Parsing robusto — Groq a veces agrega texto antes/después del JSON
      const clean = raw.replace(/```json|```/g, '').trim()
      let parsed
      try {
        parsed = JSON.parse(clean)
      } catch {
        const match = clean.match(/\{[\s\S]*\}/)
        if (!match) throw new Error(t('cvmatcher.errorBadJSON'))
        parsed = JSON.parse(match[0])
      }

      // Validación mínima: si no hay score el JSON llegó incompleto
      if (typeof parsed.compatibility_score !== 'number') {
        throw new Error(t('cvmatcher.errorIncomplete'))
      }

      setResult(parsed)
      setActiveTab('quickwins')
    } catch (err) {
      setError(err.message || t('cvmatcher.errorBadJSON'))
    } finally {
      setLoading(false)
    }
  }

  // ── Render de tabs de resultados ──────────────────────────────────────

  function renderTabContent() {
    if (!result) return null

    // ── Quick Wins (tab por defecto) ─────────────────────────────────
    if (activeTab === 'quickwins') {
      return (
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 14px', lineHeight: 1.5 }}>
            {t('cvmatcher.quickWinsDesc')}
          </p>
          {(result.quick_wins || []).map((win, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, marginBottom: 12,
              padding: '10px 12px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)',
              borderRadius: 4,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--primary)', color: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
                flexShrink: 0, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
                {win}
              </p>
            </div>
          ))}

          {/* Análisis de seniority — complementa los quick wins con contexto */}
          {result.seniority_analysis && (
            <div style={{
              marginTop: 16, padding: '12px 14px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
            }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('cvmatcher.seniorityTitle')}
              </p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginBottom: 2 }}>
                    {t('cvmatcher.seniorityRequires')}
                  </div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {result.seniority_analysis.jd_requires}
                  </div>
                </div>
                <div style={{ color: 'var(--border)', fontFamily: 'Space Mono', fontSize: 16 }}>→</div>
                <div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginBottom: 2 }}>
                    {t('cvmatcher.seniorityDemonstrates')}
                  </div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: scoreColor(result.score_breakdown?.seniority_match || 50), fontWeight: 700, textTransform: 'uppercase' }}>
                    {result.seniority_analysis.cv_demonstrates}
                  </div>
                </div>
              </div>
              {result.seniority_analysis.recommendation && (
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0, lineHeight: 1.5 }}>
                  {result.seniority_analysis.recommendation}
                </p>
              )}
            </div>
          )}
        </div>
      )
    }

    // ── Matches ──────────────────────────────────────────────────────
    if (activeTab === 'matches') {
      return (
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 12px' }}>
            {t('cvmatcher.matchesDesc')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(result.matching_skills || []).map((item, i) => (
              <div key={i} style={{
                padding: '8px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: '#22c55e' }}>
                    ✓ {item.skill}
                  </span>
                  <WeightBadge level={item.weight} />
                </div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--text)' }}>{t('cvmatcher.matchCV')}:</span> {item.found_in_cv}
                  <span style={{ margin: '0 4px', color: 'var(--border)' }}>·</span>
                  <span style={{ color: 'var(--text)' }}>{t('cvmatcher.matchJD')}:</span> {item.found_in_jd}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // ── Gaps ─────────────────────────────────────────────────────────
    if (activeTab === 'gaps') {
      return (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0 }}>
            {t('cvmatcher.gapsDesc')}
          </p>
          {(result.missing_skills || []).map((item, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                  {item.skill}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Tiempo estimado — convierte "te falta X" en un plan concreto */}
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
                    ~{item.learning_time_weeks}{t('cvmatcher.weeks')}
                  </span>
                  <UrgencyBadge level={item.urgency} label={urgencyLabel[item.urgency]} />
                </div>
              </div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0, lineHeight: 1.5 }}>
                {item.context_in_jd}
              </p>
            </div>
          ))}
        </div>
      )
    }

    // ── Proyectos ────────────────────────────────────────────────────
    if (activeTab === 'projects') {
      return (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0 }}>
            {t('cvmatcher.projectsDesc')}
          </p>
          {(result.project_suggestions || []).map((proj, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderLeft: '3px solid var(--primary)', borderRadius: 4, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--primary)', color: 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                    {proj.title}
                  </div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
                    {proj.difficulty} · ~{proj.estimated_days} {t('cvmatcher.days')}
                  </div>
                </div>
              </div>

              {/* Stack de tecnologías del proyecto */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {(proj.skills_covered || []).map((tech, j) => (
                  <span key={j} style={{
                    padding: '2px 7px',
                    background: 'rgba(245,158,11,0.12)', color: 'var(--primary)',
                    border: '1px solid rgba(245,158,11,0.25)', borderRadius: 3,
                    fontFamily: 'Space Mono, monospace', fontSize: 10,
                  }}>
                    {tech}
                  </span>
                ))}
              </div>

              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 8px', lineHeight: 1.6 }}>
                {proj.description}
              </p>

              {/* GitHub keywords para buscar repos de referencia */}
              {proj.github_keywords?.length > 0 && (
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
                  <span style={{ color: 'var(--text)' }}>GitHub: </span>
                  {proj.github_keywords.join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    // ── ATS ──────────────────────────────────────────────────────────
    if (activeTab === 'ats') {
      const ats = result.ats_optimization
      if (!ats) return null
      return (
        <div style={{ padding: '16px 20px' }}>
          {/* ATS Score específico (diferente del score global) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 4, marginBottom: 16,
          }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 28, fontWeight: 700, color: scoreColor(ats.overall_ats_score), lineHeight: 1 }}>
              {ats.overall_ats_score}
            </div>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)' }}>
                {t('cvmatcher.atsScoreLabel')}
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 2 }}>
                {t('cvmatcher.atsScoreDesc')}
              </div>
            </div>
          </div>

          {/* Keywords exactas a agregar */}
          {ats.keywords_to_add?.length > 0 && (
            <>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('cvmatcher.atsKeywordsTitle')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {ats.keywords_to_add.map((kw, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginBottom: 4 }}>
                      "{kw.keyword}"
                    </div>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 4px', lineHeight: 1.5 }}>
                      {kw.reason}
                    </p>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--text)' }}>
                      📍 {kw.suggested_placement}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Tips de formato ATS */}
          {ats.formatting_tips?.length > 0 && (
            <>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('cvmatcher.atsFormattingTitle')}
              </p>
              <ol style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ats.formatting_tips.map((tip, i) => (
                  <li key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--text)', lineHeight: 1.6 }}>
                    {tip}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )
    }
  }

  // ── Estilo activo/inactivo de los tabs ────────────────────────────────
  function tabStyle(id) {
    const isActive = activeTab === id
    return {
      flex: 1, padding: '7px 2px',
      background: isActive ? 'var(--primary)' : 'transparent',
      color:      isActive ? 'var(--bg)'      : 'var(--subtle)',
      border: 'none', cursor: 'pointer',
      fontFamily: 'Space Mono, monospace', fontSize: 9,
      fontWeight: isActive ? 700 : 400,
      transition: 'all 0.15s', letterSpacing: '0.03em',
    }
  }

  // ── Render principal ──────────────────────────────────────────────────
  return (
    <>
      {/* Overlay para cerrar con click fuera del panel.
          zIndex: 35 — DEBAJO del header (z-index: 45 en globals.css) para que
          el toggle de idioma siga siendo clickeable mientras el panel está abierto.
          El panel mismo usa zIndex: 50 (definido abajo). */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 35 }}
      />

      {/* Panel lateral derecho — mismas dimensiones que ResourcePanel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'var(--bg)', borderLeft: '2px solid var(--primary)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        overflowY: 'auto', animation: 'slideInRight 0.25s ease-out',
      }}>

        {/* ── Cabecera sticky ── */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              ⚡ {t('cvmatcher.title')}
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 2 }}>
              {t('cvmatcher.subtitle')}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
          >
            ✕
          </button>
        </div>

        {/* ── Contenido scrollable ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* ── Sección 1: CV ── */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('cvmatcher.section1')}
            </p>
            {/* Área de drop */}
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '1px dashed var(--border)', borderRadius: 4,
                padding: '12px', textAlign: 'center', cursor: 'pointer',
                background: 'var(--surface)', marginBottom: 8, transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.6 }}>
                {fileName
                  ? <><span style={{ color: 'var(--primary)' }}>✓ {fileName}</span><br />{t('cvmatcher.dropChange')}</>
                  : <>{t('cvmatcher.dropHint')} <span style={{ color: 'var(--primary)' }}>{t('cvmatcher.dropClick')}</span><br />{t('cvmatcher.dropFormats')}</>
                }
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileInput} style={{ display: 'none' }} />
            <textarea
              value={cvText}
              onChange={e => { setCvText(e.target.value); setFileName('') }}
              placeholder={t('cvmatcher.cvPlaceholder')}
              rows={4}
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text)', fontFamily: 'Space Mono, monospace',
                fontSize: 11, padding: '8px 10px', resize: 'vertical', boxSizing: 'border-box',
                outline: 'none', lineHeight: 1.5,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* ── Sección 2: Oferta laboral ── */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('cvmatcher.section2')}
            </p>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', margin: '0 0 10px' }}>
              {t('cvmatcher.offerPickerDesc')}
            </p>

            {/* ── Picker de ofertas guardadas ────────────────────────────────
                Muestra las ofertas del usuario cargadas desde Supabase.
                Cada card tiene: nombre + top topics como badges + botón "Usar esta".
                Al seleccionar se reconstruye el JD y se pone en el textarea.
                Si no hay ofertas o aún carga, muestra mensaje informativo. */}
            {offersLoading ? (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', padding: '8px 0', marginBottom: 10 }}>
                ⏳ {t('cvmatcher.offerPickerLoading')}
              </div>
            ) : savedOffers.length === 0 ? (
              <div style={{
                padding: '10px 12px', background: 'var(--surface)',
                border: '1px dashed var(--border)', borderRadius: 4, marginBottom: 10,
              }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginBottom: 3 }}>
                  {t('cvmatcher.offerPickerEmpty')}
                </div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--muted)' }}>
                  {t('cvmatcher.offerPickerEmptyHint')}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {savedOffers.map(offer => {
                  const isSelected = selectedOfferId === offer.id
                  // Mostramos solo los topics críticos (tier 1) como preview del stack
                  const criticalTopics = (offer.topics || [])
                    .filter(tp => tp.tier === 1)
                    .slice(0, 4)
                  return (
                    <div
                      key={offer.id}
                      style={{
                        padding: '9px 11px',
                        background: isSelected ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'var(--surface)',
                        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                        borderLeft: `3px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 4,
                        transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Nombre de la oferta */}
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {offer.name}
                        </div>
                        {/* Badges de topics críticos — muestra el stack de un vistazo */}
                        {criticalTopics.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {criticalTopics.map((tp, i) => (
                              <span key={i} style={{
                                padding: '1px 6px',
                                background: 'rgba(245,158,11,0.1)', color: 'var(--primary)',
                                border: '1px solid rgba(245,158,11,0.2)', borderRadius: 3,
                                fontFamily: 'Space Mono, monospace', fontSize: 9,
                              }}>
                                {tp.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Botón de selección — "Usar esta" / "✓ Seleccionada" */}
                      <button
                        onClick={() => selectOffer(offer)}
                        style={{
                          padding: '5px 10px', flexShrink: 0,
                          background: isSelected ? 'var(--primary)' : 'var(--card)',
                          color: isSelected ? 'var(--bg)' : 'var(--subtle)',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: 3, cursor: 'pointer',
                          fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700,
                          transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                      >
                        {isSelected ? t('cvmatcher.offerSelected') : t('cvmatcher.offerSelect')}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Textarea manual — siempre visible ──────────────────────────
                Si el usuario seleccionó una oferta, muestra el JD reconstruido
                (editable antes de analizar). Si no seleccionó nada, es el campo
                libre de siempre. Así el usuario puede ajustar el texto si quiere. */}
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', margin: '0 0 6px' }}>
              {selectedOfferId
                ? t('cvmatcher.offerFromSaved')
                : savedOffers.length > 0 ? t('cvmatcher.offerPasteManual') : ''}
            </p>
            <textarea
              value={jobText}
              onChange={e => { setJobText(e.target.value); setSelectedOfferId(null) }}
              placeholder={t('cvmatcher.jobPlaceholder')}
              rows={selectedOfferId ? 4 : 5}
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text)', fontFamily: 'Space Mono, monospace',
                fontSize: 11, padding: '8px 10px', resize: 'vertical', boxSizing: 'border-box',
                outline: 'none', lineHeight: 1.5,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{
              margin: '12px 20px 0', padding: '10px 12px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 4, fontFamily: 'Space Mono, monospace', fontSize: 10,
              color: '#ef4444', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* ── Botón analizar ── */}
          <div style={{ padding: '14px 20px' }}>
            <button
              onClick={analyze}
              disabled={loading || !cvText.trim() || !jobText.trim()}
              style={{
                width: '100%', padding: '11px',
                background: loading ? 'var(--surface)' : 'var(--primary)',
                color:      loading ? 'var(--subtle)'  : 'var(--bg)',
                border: '1px solid var(--primary)', borderRadius: 4,
                cursor: (loading || !cvText.trim() || !jobText.trim()) ? 'not-allowed' : 'pointer',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.04em', transition: 'opacity 0.15s',
                opacity: (!cvText.trim() || !jobText.trim()) ? 0.5 : 1,
              }}
            >
              {loading ? t('cvmatcher.analyzingBtn') : t('cvmatcher.analyzeBtn')}
            </button>
          </div>

          {/* ── Resultados ── */}
          {result && (
            <>
              {/* ── Score global + breakdown ──────────────────────────────
                  Mejora visual (mar 2026): borde izquierdo con el color del score
                  para que el veredicto sea visualmente inmediato al ver el panel. */}
              <div style={{
                margin: '0 20px 14px', padding: '14px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${scoreColor(result.compatibility_score)}`,
                borderRadius: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  {/* Número de score grande — color semáforo */}
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 44, fontWeight: 700, color: scoreColor(result.compatibility_score), lineHeight: 1 }}>
                      {result.compatibility_score}
                    </div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 1 }}>/ 100</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {/* Badge de nivel: ALTO / MEDIO / BAJO MATCH */}
                    <div style={{
                      display: 'inline-block', padding: '3px 10px',
                      background: `${scoreColor(result.compatibility_score)}22`,
                      color: scoreColor(result.compatibility_score),
                      border: `1px solid ${scoreColor(result.compatibility_score)}55`,
                      borderRadius: 3, fontFamily: 'Space Mono, monospace',
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8,
                    }}>
                      {result.compatibility_score >= 75 ? t('cvmatcher.highMatch')
                        : result.compatibility_score >= 50 ? t('cvmatcher.medMatch')
                        : t('cvmatcher.lowMatch')}
                    </div>
                    {/* Veredicto textual de la IA */}
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
                      {result.verdict}
                    </p>
                  </div>
                </div>

                {/* Score breakdown — 4 barras */}
                {result.score_breakdown && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: t('cvmatcher.scoreBreakdownTechnical'), key: 'technical_skills'  },
                      { label: t('cvmatcher.scoreBreakdownSeniority'), key: 'seniority_match'   },
                      { label: t('cvmatcher.scoreBreakdownDomain'),    key: 'domain_experience' },
                      { label: t('cvmatcher.scoreBreakdownAts'),       key: 'keywords_ats'      },
                    ].map(({ label, key }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', width: 90, flexShrink: 0 }}>
                          {label}
                        </span>
                        <ScoreBar value={result.score_breakdown[key]} />
                        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: scoreColor(result.score_breakdown[key]), width: 24, textAlign: 'right', flexShrink: 0 }}>
                          {result.score_breakdown[key]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabs de navegación */}
              <div style={{ display: 'flex', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                {[
                  { id: 'quickwins', label: t('cvmatcher.tabToday')    },
                  { id: 'matches',   label: t('cvmatcher.tabMatches')  },
                  { id: 'gaps',      label: t('cvmatcher.tabGaps')     },
                  { id: 'projects',  label: t('cvmatcher.tabProjects') },
                  { id: 'ats',       label: t('cvmatcher.tabAts')      },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(tab.id)}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Contenido del tab activo */}
              {renderTabContent()}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', fontFamily: 'Space Mono, monospace',
          fontSize: 9, color: 'var(--subtle)', textAlign: 'center',
        }}>
          {t('cvmatcher.footer')}
        </div>
      </div>

      {/* Animación de entrada — misma que ResourcePanel */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0 }
          to   { transform: translateX(0);    opacity: 1 }
        }
      `}</style>
    </>
  )
}
