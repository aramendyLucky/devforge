/**
 * src/components/ui/CVMatcherPanel.jsx
 *
 * PANEL DE CV MATCHER — analiza la compatibilidad entre el CV del usuario
 * y una oferta laboral usando IA (Groq llama-3.3-70b).
 *
 * ¿Qué hace?
 *   1. Permite subir un CV (PDF, DOCX, TXT, MD) o pegar el texto directamente
 *   2. Usa la oferta del store (rawOffers) o permite pegar una oferta personalizada
 *   3. Llama a Groq con un prompt especializado en ATS y CV matching para obtener:
 *      - Score global (0-100) + breakdown por categoría
 *      - Skills que ya tiene el candidato (matching)
 *      - Skills que faltan (gaps) con urgencia y tiempo estimado de aprendizaje
 *      - Proyectos sugeridos concretos y realizables para cerrar los gaps
 *      - Análisis ATS: keywords faltantes y tips de formato
 *      - Análisis de seniority: lo que pide el JD vs lo que demuestra el CV
 *      - Quick wins: 3 acciones accionables para hacer hoy en < 30 minutos
 *   4. Muestra los resultados en 6 tabs visuales dentro del panel lateral
 *
 * Arquitectura:
 *   - Mismo patrón que ResourcePanel: overlay + panel fijo derecho 420px
 *   - Llama a Groq directamente (callGroq local, mismo endpoint que useAI.js)
 *   - Usa extractTextFromFile de fileParser.js para leer el CV subido
 *   - Lee state.user.rawOffers del store como oferta pre-cargada por defecto
 *   - max_tokens 2500 porque el JSON de respuesta completo es grande (~1500 tokens)
 *
 * Props:
 *   onClose — callback para cerrar el panel
 *
 * Notas de diseño (basadas en research de mejores prácticas):
 *   - score_breakdown separado del score global porque son problemas distintos:
 *     skills técnicas != keywords ATS. Un candidato puede tener las skills pero
 *     un CV que los ATS filtran por no usar los términos exactos del JD.
 *   - learning_time_weeks en missing_skills convierte "te falta X" (desalentador)
 *     en "te falta X — 3 semanas" (accionable con el roadmap de DevForge).
 *   - quick_wins al inicio del flujo porque la mayoría de personas no saben
 *     qué hacer después del análisis. 3 acciones hoy reducen la fricción a cero.
 */

import { useState, useRef } from 'react'
import { useStore }          from '../../store/index.jsx'
import { extractTextFromFile, isFileSupported } from '../../lib/fileParser.js'

// ── Constantes de Groq (mismo endpoint que useAI.js) ──────────────────────
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL    = 'llama-3.3-70b-versatile'

/**
 * callGroq — llama a la API de Groq para el análisis de CV.
 *
 * ¿Por qué max_tokens 2500?
 * El JSON de respuesta completo (score_breakdown + 6 missing_skills + 3 proyectos
 * + ATS keywords + seniority + quick_wins) ocupa entre 1200-1800 tokens.
 * Con 1000 (el default de useAI.js) el JSON se cortaría y fallaría el parse.
 */
async function callGroq(messages) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 2500,
      messages,
    }),
  })
  if (!response.ok) throw new Error(`Groq error: ${response.status}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Prompt del sistema — diseñado para precisión ATS y CV matching ─────────
// El scoring sigue una fórmula clara para hacer el score interpretable:
//   40% skills técnicas | 25% seniority | 20% dominio | 15% keywords ATS
// Cada campo del JSON tiene un propósito de UX específico (ver comentarios arriba).
const SYSTEM_PROMPT = `Sos un experto en reclutamiento técnico y optimización de CVs para el mercado tech latinoamericano y global.
Tenés experiencia como tech recruiter en empresas de software, revisor de CVs para posiciones backend/fullstack/AI, y especialista en ATS.

Tu tarea: analizar la compatibilidad entre un CV y una descripción de puesto (JD) con máxima precisión.

REGLAS DE ANÁLISIS:
1. "compatibility_score" (0-100) se calcula así:
   - 40% skills técnicas que coinciden vs requeridas
   - 25% match de seniority (junior/mid/senior/lead)
   - 20% experiencia en el dominio
   - 15% keywords ATS presentes literalmente en el CV

2. "missing_skills" — solo incluir skills que el JD menciona EXPLÍCITAMENTE:
   - urgency "critical" = mencionado como excluyente/must-have
   - urgency "important" = valoramos/nice-to-have
   - urgency "nice_to_have" = mencionado una vez o en sección de bonus
   - learning_time_weeks: estimado realista de semanas para aprender lo básico

3. "matching_skills" — skills presentes en AMBOS documentos (con variaciones semánticas).
   Máximo 10 items.

4. "project_suggestions" — EXACTAMENTE 2-3 proyectos realizables en 1-2 semanas.
   Que cierren múltiples gaps a la vez.

5. "ats_optimization" — los ATS hacen matching literal. "APIs REST" no matchea "RESTful services".
   Busca keywords exactas del JD que NO aparecen literalmente en el CV.

6. "quick_wins" — EXACTAMENTE 3 acciones para hacer HOY en menos de 30 minutos.

Respondé SOLO en JSON válido, sin texto adicional, sin backticks, sin comentarios.
Todos los strings en español (Argentina/Latinoamérica).

{
  "compatibility_score": <number 0-100>,
  "score_breakdown": {
    "technical_skills": <number 0-100>,
    "seniority_match": <number 0-100>,
    "domain_experience": <number 0-100>,
    "keywords_ats": <number 0-100>
  },
  "verdict": "<1-2 oraciones, honesto y constructivo>",
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
    "gap": "<string o null>",
    "recommendation": "<string o null>"
  },
  "quick_wins": ["<acción concreta 1>", "<acción concreta 2>", "<acción concreta 3>"]
}`

// ── Helpers de color y estilos ─────────────────────────────────────────────

/** Devuelve el color CSS según el nivel del score */
function scoreColor(score) {
  if (score >= 75) return '#22c55e'   // verde — alto match
  if (score >= 50) return '#f59e0b'   // ámbar — match medio
  return '#ef4444'                    // rojo — bajo match / brecha crítica
}

/** Convierte un score 0-100 en una barra de progreso simple */
function ScoreBar({ value, color }) {
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <div style={{
        height: '100%',
        width:  `${Math.min(100, Math.max(0, value))}%`,
        background: color || scoreColor(value),
        borderRadius: 2,
        transition: 'width 0.6s ease-out',
      }} />
    </div>
  )
}

/** Badge de urgencia para los skill gaps — colores semáforo */
function UrgencyBadge({ level }) {
  const map = {
    critical:     { label: 'Crítico',  bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
    important:    { label: 'Importante', bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    nice_to_have: { label: 'Nice-to-have', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  }
  const style = map[level] || map.nice_to_have
  return (
    <span style={{
      display:    'inline-block',
      padding:    '1px 6px',
      background: style.bg,
      color:      style.color,
      borderRadius: 3,
      fontFamily: 'Space Mono, monospace',
      fontSize:   9,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {style.label}
    </span>
  )
}

/** Badge de peso/importancia para los skills que matchean */
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

// ─────────────────────────────────────────────────────────────────────────
export default function CVMatcherPanel({ onClose }) {
  const { state }     = useStore()
  const fileInputRef  = useRef(null)

  // ── Estado del flujo ──────────────────────────────────────────────────
  const [cvText,    setCvText]    = useState('')
  const [jobText,   setJobText]   = useState(state.user?.rawOffers || '')
  const [fileName,  setFileName]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [result,    setResult]    = useState(null)
  // tabs: 'quickwins' | 'matches' | 'gaps' | 'projects' | 'ats' | 'seniority'
  const [activeTab, setActiveTab] = useState('quickwins')

  // ── Manejo del archivo de CV ──────────────────────────────────────────
  /**
   * handleFile — extrae el texto del CV usando fileParser.js.
   * Soporta PDF, DOCX, TXT, MD. Si el formato no es soportado muestra error.
   */
  async function handleFile(file) {
    if (!file) return
    if (!isFileSupported(file)) {
      setError('Formato no soportado. Usá PDF, DOCX, TXT o MD.')
      return
    }
    setError(null)
    setFileName(file.name)
    try {
      const text = await extractTextFromFile(file)
      setCvText(text)
    } catch (err) {
      setError(`No se pudo leer el archivo: ${err.message}`)
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
   * Estrategia de parsing robusta:
   * 1. Intenta JSON.parse directo del texto limpio
   * 2. Si falla, extrae el primer bloque { ... } con regex (Groq a veces
   *    agrega texto antes/después del JSON a pesar del prompt)
   */
  async function analyze() {
    if (!cvText.trim()) { setError('Primero subí tu CV o pegá el texto.'); return }
    if (!jobText.trim()) { setError('Pegá el texto de la oferta laboral.'); return }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Limitamos el texto para evitar truncamiento del JSON de respuesta.
      // 4000 chars del CV y 3000 del JD es suficiente para un análisis preciso.
      const userMsg = `CV DEL CANDIDATO:
--- INICIO CV ---
${cvText.trim().slice(0, 4000)}
--- FIN CV ---

DESCRIPCIÓN DEL PUESTO (JD):
--- INICIO JD ---
${jobText.trim().slice(0, 3000)}
--- FIN JD ---

Analizá la compatibilidad y devolvé el JSON completo.`

      const raw = await callGroq([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMsg },
      ])

      // Parsing robusto: limpia backticks y extrae el bloque JSON
      const clean = raw.replace(/```json|```/g, '').trim()
      let parsed
      try {
        parsed = JSON.parse(clean)
      } catch {
        // Fallback: extrae el primer { ... } del texto
        const match = clean.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('La IA no devolvió un JSON válido. Intentá de nuevo.')
        parsed = JSON.parse(match[0])
      }

      // Validación mínima: si no hay score, el JSON llegó incompleto
      if (typeof parsed.compatibility_score !== 'number') {
        throw new Error('Respuesta incompleta de la IA. Intentá de nuevo.')
      }

      setResult(parsed)
      setActiveTab('quickwins')  // arranca siempre en Quick Wins (lo más accionable)
    } catch (err) {
      setError(err.message || 'Error al analizar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render de tabs de resultados ──────────────────────────────────────

  function renderTabContent() {
    if (!result) return null

    // ── Tab: Quick Wins ──────────────────────────────────────────────
    // Primero en el orden porque son las acciones más accionables para el usuario
    if (activeTab === 'quickwins') {
      return (
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 14px', lineHeight: 1.5 }}>
            3 acciones que podés hacer <strong style={{ color: 'var(--text)' }}>hoy</strong> en menos de 30 minutos para mejorar tu candidatura.
          </p>
          {(result.quick_wins || []).map((win, i) => (
            <div key={i} style={{
              display:    'flex',
              gap:        10,
              marginBottom: 12,
              padding:    '10px 12px',
              background: 'var(--surface)',
              border:     '1px solid var(--border)',
              borderLeft: '3px solid var(--primary)',
              borderRadius: 4,
            }}>
              {/* Número del quick win */}
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

          {/* Análisis de seniority debajo de quick wins — contexto adicional */}
          {result.seniority_analysis && (
            <div style={{
              marginTop: 16,
              padding: '12px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Análisis de Seniority
              </p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginBottom: 2 }}>PIDE</div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {result.seniority_analysis.jd_requires}
                  </div>
                </div>
                <div style={{ color: 'var(--border)', fontFamily: 'Space Mono', fontSize: 16 }}>→</div>
                <div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginBottom: 2 }}>TU CV DEMUESTRA</div>
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

    // ── Tab: Matches ─────────────────────────────────────────────────
    if (activeTab === 'matches') {
      return (
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 12px' }}>
            Skills y keywords encontradas en tu CV que coinciden con la oferta. ★★★ = crítico para el rol.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(result.matching_skills || []).map((item, i) => (
              <div key={i} style={{
                padding: '8px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: '#22c55e' }}>
                    ✓ {item.skill}
                  </span>
                  <WeightBadge level={item.weight} />
                </div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--text)' }}>CV:</span> {item.found_in_cv}
                  <span style={{ margin: '0 4px', color: 'var(--border)' }}>·</span>
                  <span style={{ color: 'var(--text)' }}>JD:</span> {item.found_in_jd}
                </div>
              </div>
            ))}
          </div>
          {(!result.matching_skills || result.matching_skills.length === 0) && (
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)' }}>
              No se encontraron matches claros. Revisá el texto del CV.
            </p>
          )}
        </div>
      )
    }

    // ── Tab: Gaps ────────────────────────────────────────────────────
    if (activeTab === 'gaps') {
      return (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0 }}>
            Skills del JD que no encontré en tu CV. Los críticos pueden ser bloqueantes para llegar a la entrevista.
          </p>
          {(result.missing_skills || []).map((item, i) => (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                  {item.skill}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Tiempo estimado de aprendizaje — convierte "te falta X" en un plan */}
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
                    ~{item.learning_time_weeks}sem
                  </span>
                  <UrgencyBadge level={item.urgency} />
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

    // ── Tab: Proyectos ───────────────────────────────────────────────
    if (activeTab === 'projects') {
      return (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0 }}>
            Proyectos concretos para cerrar los gaps y diferenciarte en la entrevista técnica.
          </p>
          {(result.project_suggestions || []).map((proj, i) => (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--primary)',
              borderRadius: 4,
              padding: '12px 14px',
            }}>
              {/* Header del proyecto: número + nombre + días estimados */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--primary)', color: 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                    {proj.title}
                  </div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>
                    {proj.difficulty} · ~{proj.estimated_days} días
                  </div>
                </div>
              </div>

              {/* Stack de tecnologías */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {(proj.skills_covered || []).map((tech, j) => (
                  <span key={j} style={{
                    padding: '2px 7px',
                    background: 'rgba(245,158,11,0.12)',
                    color: 'var(--primary)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 3,
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 10,
                  }}>
                    {tech}
                  </span>
                ))}
              </div>

              {/* Descripción */}
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 8px', lineHeight: 1.6 }}>
                {proj.description}
              </p>

              {/* GitHub keywords para buscar referencias */}
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

    // ── Tab: ATS ─────────────────────────────────────────────────────
    if (activeTab === 'ats') {
      const ats = result.ats_optimization
      if (!ats) return null
      return (
        <div style={{ padding: '16px 20px' }}>
          {/* Score ATS específico */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 28, fontWeight: 700,
              color: scoreColor(ats.overall_ats_score),
              lineHeight: 1,
            }}>
              {ats.overall_ats_score}
            </div>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)' }}>
                ATS Score
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 2 }}>
                Porcentaje del JD indexado por los robots de selección
              </div>
            </div>
          </div>

          {/* Keywords a agregar */}
          {ats.keywords_to_add?.length > 0 && (
            <>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Keywords a agregar
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {ats.keywords_to_add.map((kw, i) => (
                  <div key={i} style={{
                    padding: '10px 12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                  }}>
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

          {/* Tips de formato */}
          {ats.formatting_tips?.length > 0 && (
            <>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Tips de formato
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

  // ── Estilo de los botones de tab ──────────────────────────────────────
  function tabStyle(id) {
    const isActive = activeTab === id
    return {
      flex: 1,
      padding: '7px 2px',
      background: isActive ? 'var(--primary)' : 'transparent',
      color:      isActive ? 'var(--bg)'      : 'var(--subtle)',
      border:     'none',
      cursor:     'pointer',
      fontFamily: 'Space Mono, monospace',
      fontSize:   9,
      fontWeight: isActive ? 700 : 400,
      transition: 'all 0.15s',
      letterSpacing: '0.03em',
    }
  }

  // ── Render principal ──────────────────────────────────────────────────
  return (
    <>
      {/* Overlay para cerrar con click fuera del panel */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
      />

      {/* Panel lateral — mismo patrón que ResourcePanel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background:   'var(--bg)',
        borderLeft:   '2px solid var(--primary)',
        zIndex:       50,
        display:      'flex',
        flexDirection: 'column',
        overflowY:    'auto',
        animation:    'slideInRight 0.25s ease-out',
      }}>

        {/* ── Cabecera sticky ── */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky', top: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              ⚡ CV Matcher
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 2 }}>
              Compatibilidad ATS · powered by Groq AI
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--subtle)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
          >
            ✕
          </button>
        </div>

        {/* ── Contenido scrollable ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* ── Sección 1: upload del CV ── */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11,
              color: 'var(--text)', margin: '0 0 8px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              1 · Tu CV
            </p>

            {/* Área de drop de archivo */}
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '1px dashed var(--border)', borderRadius: 4,
                padding: '12px', textAlign: 'center', cursor: 'pointer',
                background: 'var(--surface)', marginBottom: 8,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.6 }}>
                {fileName
                  ? <><span style={{ color: 'var(--primary)' }}>✓ {fileName}</span><br />Click para cambiar</>
                  : <>Arrastrá tu CV o <span style={{ color: 'var(--primary)' }}>hacé click</span><br />(PDF · DOCX · TXT · MD)</>
                }
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileInput} style={{ display: 'none' }} />

            <textarea
              value={cvText}
              onChange={e => { setCvText(e.target.value); setFileName('') }}
              placeholder="O pegá el texto de tu CV acá..."
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

          {/* ── Sección 2: oferta laboral ── */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11,
              color: 'var(--text)', margin: '0 0 4px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              2 · Oferta laboral
            </p>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', margin: '0 0 8px' }}>
              {jobText ? 'Pre-cargada desde tu perfil. Podés editarla.' : 'Pegá el texto completo de la oferta.'}
            </p>
            <textarea
              value={jobText}
              onChange={e => setJobText(e.target.value)}
              placeholder="Pegá aquí el texto de la oferta laboral..."
              rows={5}
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
              {loading ? '⏳ Analizando...' : '⚡ Analizar compatibilidad'}
            </button>
          </div>

          {/* ── Resultados ── */}
          {result && (
            <>
              {/* Score global + breakdown */}
              <div style={{ margin: '0 20px 14px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}>
                {/* Score principal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 40, fontWeight: 700, color: scoreColor(result.compatibility_score), lineHeight: 1 }}>
                      {result.compatibility_score}
                    </div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 1 }}>/ 100</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'inline-block', padding: '2px 8px',
                      background: `${scoreColor(result.compatibility_score)}22`,
                      color: scoreColor(result.compatibility_score),
                      border: `1px solid ${scoreColor(result.compatibility_score)}44`,
                      borderRadius: 3, fontFamily: 'Space Mono, monospace',
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6,
                    }}>
                      {result.compatibility_score >= 75 ? '● ALTO MATCH'
                        : result.compatibility_score >= 50 ? '● MATCH MEDIO'
                        : '● BAJO MATCH'}
                    </div>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0, lineHeight: 1.5 }}>
                      {result.verdict}
                    </p>
                  </div>
                </div>

                {/* Score breakdown — 4 ejes con barra visual */}
                {result.score_breakdown && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'Skills técnicas',    key: 'technical_skills'  },
                      { label: 'Seniority',          key: 'seniority_match'   },
                      { label: 'Dominio/industria',  key: 'domain_experience' },
                      { label: 'Keywords ATS',       key: 'keywords_ats'      },
                    ].map(({ label, key }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', width: 100, flexShrink: 0 }}>
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
              <div style={{
                display: 'flex',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
              }}>
                {[
                  { id: 'quickwins', label: '⚡ Hoy'     },
                  { id: 'matches',   label: '✓ Match'    },
                  { id: 'gaps',      label: '✗ Gaps'     },
                  { id: 'projects',  label: '⬡ Proyectos'},
                  { id: 'ats',       label: '▲ ATS'      },
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

        {/* Footer del panel */}
        <div style={{
          padding: '8px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          fontFamily: 'Space Mono, monospace',
          fontSize: 9, color: 'var(--subtle)', textAlign: 'center',
        }}>
          DevForge CV Matcher · Lucas Y.Aramendy · Groq llama-3.3-70b
        </div>
      </div>

      {/* Animación de entrada del panel */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0 }
          to   { transform: translateX(0);    opacity: 1 }
        }
      `}</style>
    </>
  )
}
