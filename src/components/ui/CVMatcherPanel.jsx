/**
 * src/components/ui/CVMatcherPanel.jsx
 *
 * PANEL DE CV MATCHER — analiza la compatibilidad entre el CV del usuario
 * y una oferta laboral usando IA (Groq llama-3.3-70b).
 *
 * ¿Qué hace?
 *   1. Permite subir un CV (PDF, DOCX, TXT, MD) o pegar el texto directamente
 *   2. Usa la oferta del store (rawOffers) o permite pegar una oferta propia
 *   3. Llama a Groq para obtener:
 *      - Score de compatibilidad (0-100)
 *      - Skills que ya tiene (matching)
 *      - Skills que faltan (gaps) con nivel de importancia
 *      - Proyectos sugeridos para llenar los gaps
 *      - Tips de optimización ATS
 *   4. Muestra los resultados en tabs visuales dentro del panel lateral
 *
 * Arquitectura:
 *   - Sigue el mismo patrón que ResourcePanel: overlay + panel fijo derecho
 *   - Llama a Groq directamente (mismo patrón que useAI.js)
 *   - Usa extractTextFromFile de fileParser.js para leer el archivo del CV
 *   - Lee state.user.rawOffers del store como oferta por defecto
 *
 * Props:
 *   onClose — callback para cerrar el panel
 */

import { useState, useRef } from 'react'
import { useStore }          from '../../store/index.jsx'
import { extractTextFromFile, isFileSupported } from '../../lib/fileParser.js'
import { useTranslation }    from 'react-i18next'

// ── Constantes de Groq (mismo endpoint que useAI.js) ──────────────────────
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL    = 'llama-3.3-70b-versatile'

/**
 * callGroq — llama a la API de Groq con el prompt de CV matching.
 *
 * max_tokens más alto que el resto de los prompts porque el análisis de CV
 * genera bastante JSON (skills, proyectos, tips). 1800 es suficiente para
 * 5-8 skills, 3 proyectos y 5 tips ATS sin cortar el JSON.
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
      max_tokens: 1800,
      messages,
    }),
  })
  if (!response.ok) throw new Error(`Groq error: ${response.status}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Prompt del sistema para el análisis de CV ─────────────────────────────
// El formato JSON DEBE coincidir con lo que renderizamos abajo.
// Cualquier cambio aquí requiere actualizar la función renderResults().
const SYSTEM_PROMPT = `Sos un experto en RRHH tech y ATS (Applicant Tracking System) con 10 años de experiencia
evaluando CVs para roles de desarrollo de software (Python, Full Stack, AI Engineer, Backend, etc.).

Tu tarea: analizar la compatibilidad entre un CV y una oferta laboral y devolver SOLO JSON sin texto adicional,
sin backticks, sin comentarios. El JSON debe tener exactamente este formato:

{
  "score": <número entero 0-100>,
  "verdict": "ALTO" | "MEDIO" | "BAJO",
  "summary": "<2 oraciones concisas sobre la compatibilidad general>",
  "matchingSkills": ["skill1", "skill2"],
  "missingSkills": [
    { "skill": "<nombre>", "importance": "alta" | "media" | "baja", "why": "<por qué es importante para este rol>" }
  ],
  "projectSuggestions": [
    { "title": "<nombre del proyecto>", "tech": ["tech1", "tech2"], "description": "<qué construir y por qué mejora el CV para este rol>" }
  ],
  "atsTips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

Reglas:
- score refleja cuánto del JD cubre el CV (keywords, experiencia, stack)
- matchingSkills: máximo 10 items, solo los más relevantes para el rol
- missingSkills: máximo 6, priorizados por importancia para ATS
- projectSuggestions: exactamente 2-3 proyectos concretos y realizables
- atsTips: exactamente 4-5 consejos específicos para pasar el ATS
- Responde en el mismo idioma que el CV/oferta (español si están en español)`

// ── Colores del score según nivel ─────────────────────────────────────────
function getScoreColor(score) {
  if (score >= 75) return '#22c55e'  // verde — alto match
  if (score >= 50) return '#f59e0b'  // ámbar — match medio
  return '#ef4444'                   // rojo — bajo match
}

// ── Icono de importancia para los skill gaps ──────────────────────────────
function ImportanceBadge({ level }) {
  const map = {
    alta:  { label: 'Alta',  bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
    media: { label: 'Media', bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    baja:  { label: 'Baja',  bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  }
  const { label, bg, color } = map[level] || map.baja
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px',
      background: bg, color, borderRadius: 3,
      fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────
export default function CVMatcherPanel({ onClose }) {
  const { state }      = useStore()
  const { t }          = useTranslation()
  const fileInputRef   = useRef(null)

  // ── Estado del flujo ──────────────────────────────────────────────────
  // tab controla qué sección de resultados se muestra
  const [cvText,    setCvText]    = useState('')           // texto extraído del CV
  const [jobText,   setJobText]   = useState(             // oferta: pre-cargada desde el store
    state.user?.rawOffers || ''
  )
  const [fileName,  setFileName]  = useState('')           // nombre del archivo subido
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [result,    setResult]    = useState(null)         // JSON parseado de Groq
  const [activeTab, setActiveTab] = useState('matches')    // 'matches'|'gaps'|'projects'|'ats'

  // ── Manejo del archivo de CV ──────────────────────────────────────────
  /**
   * handleFile — extrae el texto del archivo usando fileParser.js.
   * Soporta PDF, DOCX, TXT, MD, CSV.
   * Muestra error si el formato no es soportado.
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

  // Drop de archivo sobre el área de upload
  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  // Selección manual de archivo con input[type=file]
  function handleFileInput(e) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  // ── Análisis de compatibilidad ────────────────────────────────────────
  /**
   * analyze — envía CV + oferta a Groq y parsea el JSON de respuesta.
   *
   * ¿Por qué parseamos con un try/catch extra?
   * Groq a veces agrega texto antes o después del JSON a pesar del prompt.
   * El regex extrae el primer bloque { ... } para mayor robustez.
   */
  async function analyze() {
    if (!cvText.trim()) {
      setError('Primero subí tu CV o pegá el texto.')
      return
    }
    if (!jobText.trim()) {
      setError('Pegá el texto de la oferta laboral.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const userMsg = `CV DEL CANDIDATO:
${cvText.slice(0, 3000)}

OFERTA LABORAL:
${jobText.slice(0, 2000)}`

      const raw = await callGroq([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMsg },
      ])

      // Extrae el primer bloque JSON de la respuesta (Groq puede agregar texto extra)
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('La IA no devolvió un JSON válido. Intentá de nuevo.')

      const parsed = JSON.parse(match[0])
      setResult(parsed)
      setActiveTab('matches')
    } catch (err) {
      setError(err.message || 'Error al analizar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Renderizado de resultados por tab ─────────────────────────────────
  /**
   * renderResults — muestra la sección activa según el tab seleccionado.
   * Cada tab tiene su propio layout adaptado al tipo de dato:
   *   - matches: lista simple de tags verdes
   *   - gaps:    lista con badge de importancia + explicación
   *   - projects: cards con nombre, stack y descripción
   *   - ats:      lista numerada de tips
   */
  function renderResults() {
    if (!result) return null

    if (activeTab === 'matches') {
      return (
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 12px' }}>
            Skills y keywords encontradas en tu CV que coinciden con la oferta.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(result.matchingSkills || []).map((skill, i) => (
              <span key={i} style={{
                padding: '4px 10px',
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 3,
                fontFamily: 'Space Mono, monospace',
                fontSize: 11,
              }}>
                ✓ {skill}
              </span>
            ))}
          </div>
          {result.matchingSkills?.length === 0 && (
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)' }}>
              No se encontraron matches claros. Revisá el texto del CV.
            </p>
          )}
        </div>
      )
    }

    if (activeTab === 'gaps') {
      return (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0 }}>
            Skills del JD que no encontré en tu CV. Priorizalas para mejorar tu score ATS.
          </p>
          {(result.missingSkills || []).map((item, i) => (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                  {item.skill}
                </span>
                <ImportanceBadge level={item.importance} />
              </div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0, lineHeight: 1.5 }}>
                {item.why}
              </p>
            </div>
          ))}
        </div>
      )
    }

    if (activeTab === 'projects') {
      return (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0 }}>
            Proyectos concretos para llenar los gaps más importantes y pasar el filtro ATS.
          </p>
          {(result.projectSuggestions || []).map((proj, i) => (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--primary)',
              borderRadius: 4,
              padding: '12px 14px',
            }}>
              {/* Número + nombre del proyecto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--primary)', color: 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                  {proj.title}
                </span>
              </div>

              {/* Stack de tecnologías */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {(proj.tech || []).map((t, j) => (
                  <span key={j} style={{
                    padding: '2px 7px',
                    background: 'rgba(var(--primary-rgb, 245,158,11),0.1)',
                    color: 'var(--primary)',
                    border: '1px solid rgba(var(--primary-rgb, 245,158,11),0.25)',
                    borderRadius: 3,
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 10,
                  }}>
                    {t}
                  </span>
                ))}
              </div>

              {/* Descripción */}
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: 0, lineHeight: 1.6 }}>
                {proj.description}
              </p>
            </div>
          ))}
        </div>
      )
    }

    if (activeTab === 'ats') {
      return (
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 12px' }}>
            Tips para optimizar tu CV y pasar los filtros automáticos de ATS.
          </p>
          <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(result.atsTips || []).map((tip, i) => (
              <li key={i} style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: 11,
                color: 'var(--text)',
                lineHeight: 1.6,
              }}>
                {tip}
              </li>
            ))}
          </ol>
        </div>
      )
    }
  }

  // ── Estilo compartido de los botones de tab ───────────────────────────
  function tabStyle(id) {
    const isActive = activeTab === id
    return {
      flex: 1,
      padding: '8px 4px',
      background: isActive ? 'var(--primary)' : 'transparent',
      color:      isActive ? 'var(--bg)'      : 'var(--subtle)',
      border:     'none',
      cursor:     'pointer',
      fontFamily: 'Space Mono, monospace',
      fontSize:   10,
      fontWeight: isActive ? 700 : 400,
      transition: 'all 0.15s',
      letterSpacing: '0.04em',
    }
  }

  // ── Render principal ──────────────────────────────────────────────────
  return (
    <>
      {/* Overlay semitransparente — cierra el panel al hacer click fuera */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 40,
        }}
      />

      {/* Panel lateral derecho */}
      <div style={{
        position:  'fixed',
        top: 0, right: 0, bottom: 0,
        width:     420,
        background:  'var(--bg)',
        borderLeft:  '2px solid var(--primary)',
        zIndex:      50,
        display:     'flex',
        flexDirection: 'column',
        overflowY:   'auto',
        animation:   'slideInRight 0.25s ease-out',
      }}>

        {/* ── Cabecera ── */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background:   'var(--surface)',
          position:     'sticky',
          top: 0,
          zIndex: 1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              CV Matcher
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginTop: 2 }}>
              Compatibilidad con la oferta · powered by Groq AI
            </div>
          </div>
          {/* Botón cerrar */}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--subtle)', cursor: 'pointer',
              fontSize: 18, lineHeight: 1, padding: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* ── Contenido scrollable ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* ── Sección: subir CV ── */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
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
                border:       '1px dashed var(--border)',
                borderRadius: 4,
                padding:      '14px',
                textAlign:    'center',
                cursor:       'pointer',
                background:   'var(--surface)',
                marginBottom: 8,
                transition:   'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.6 }}>
                {fileName
                  ? <><span style={{ color: 'var(--primary)' }}>✓ {fileName}</span><br />Click para cambiar</>
                  : <>Arrastrá tu CV aquí<br />o <span style={{ color: 'var(--primary)' }}>hacé click para seleccionar</span><br />(PDF, DOCX, TXT, MD)</>
                }
              </div>
            </div>
            {/* Input oculto para selección de archivo */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />

            {/* Textarea para pegar el texto del CV manualmente */}
            <textarea
              value={cvText}
              onChange={e => { setCvText(e.target.value); setFileName('') }}
              placeholder="O pegá el texto de tu CV acá..."
              rows={4}
              style={{
                width:        '100%',
                background:   'var(--surface)',
                border:       '1px solid var(--border)',
                borderRadius: 4,
                color:        'var(--text)',
                fontFamily:   'Space Mono, monospace',
                fontSize:     11,
                padding:      '8px 10px',
                resize:       'vertical',
                boxSizing:    'border-box',
                outline:      'none',
                lineHeight:   1.5,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* ── Sección: oferta laboral ── */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11,
              color: 'var(--text)', margin: '0 0 8px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              2 · Oferta laboral
            </p>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 8px' }}>
              {jobText
                ? 'Pre-cargada desde tu perfil. Podés editarla.'
                : 'Pegá el texto de la oferta que querés matchear.'}
            </p>
            <textarea
              value={jobText}
              onChange={e => setJobText(e.target.value)}
              placeholder="Pegá aquí el texto completo de la oferta laboral..."
              rows={5}
              style={{
                width:        '100%',
                background:   'var(--surface)',
                border:       '1px solid var(--border)',
                borderRadius: 4,
                color:        'var(--text)',
                fontFamily:   'Space Mono, monospace',
                fontSize:     11,
                padding:      '8px 10px',
                resize:       'vertical',
                boxSizing:    'border-box',
                outline:      'none',
                lineHeight:   1.5,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* ── Mensaje de error ── */}
          {error && (
            <div style={{
              margin:  '12px 20px 0',
              padding: '10px 12px',
              background: 'rgba(239,68,68,0.1)',
              border:     '1px solid rgba(239,68,68,0.3)',
              borderRadius: 4,
              fontFamily: 'Space Mono, monospace',
              fontSize:   10,
              color:      '#ef4444',
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* ── Botón analizar ── */}
          <div style={{ padding: '16px 20px' }}>
            <button
              onClick={analyze}
              disabled={loading || !cvText.trim() || !jobText.trim()}
              style={{
                width:        '100%',
                padding:      '12px',
                background:   loading ? 'var(--surface)' : 'var(--primary)',
                color:        loading ? 'var(--subtle)'  : 'var(--bg)',
                border:       '1px solid var(--primary)',
                borderRadius: 4,
                cursor:       loading ? 'not-allowed' : 'pointer',
                fontFamily:   'Syne, sans-serif',
                fontWeight:   700,
                fontSize:     13,
                letterSpacing: '0.04em',
                transition:   'opacity 0.15s',
                opacity:      (!cvText.trim() || !jobText.trim()) ? 0.5 : 1,
              }}
            >
              {loading ? '⏳ Analizando compatibilidad...' : '⚡ Analizar compatibilidad'}
            </button>
          </div>

          {/* ── Resultados ── */}
          {result && (
            <>
              {/* Score y veredicto */}
              <div style={{
                margin:     '0 20px 16px',
                padding:    '16px',
                background: 'var(--surface)',
                border:     '1px solid var(--border)',
                borderRadius: 4,
                display:    'flex',
                alignItems: 'center',
                gap:        16,
              }}>
                {/* Número de score grande */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize:   36,
                    fontWeight: 700,
                    color:      getScoreColor(result.score),
                    lineHeight: 1,
                  }}>
                    {result.score}
                  </div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 2 }}>
                    / 100
                  </div>
                </div>

                {/* Veredicto + resumen */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display:     'inline-block',
                    padding:     '2px 8px',
                    background:  `${getScoreColor(result.score)}22`,
                    color:       getScoreColor(result.score),
                    border:      `1px solid ${getScoreColor(result.score)}44`,
                    borderRadius: 3,
                    fontFamily:  'Space Mono, monospace',
                    fontSize:    9,
                    fontWeight:  700,
                    letterSpacing: '0.08em',
                    marginBottom: 6,
                  }}>
                    {result.verdict === 'ALTO' ? '● ALTO MATCH'
                      : result.verdict === 'MEDIO' ? '● MATCH MEDIO'
                      : '● BAJO MATCH'}
                  </div>
                  <p style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize:   10,
                    color:      'var(--subtle)',
                    margin:     0,
                    lineHeight: 1.5,
                  }}>
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* Tabs de navegación de resultados */}
              <div style={{
                display:      'flex',
                borderTop:    '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                background:   'var(--surface)',
                marginBottom: 0,
              }}>
                {[
                  { id: 'matches',  label: '✓ Matches'  },
                  { id: 'gaps',     label: '✗ Gaps'     },
                  { id: 'projects', label: '⬡ Proyectos'},
                  { id: 'ats',      label: '▲ ATS'      },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(tab.id)}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Contenido del tab activo */}
              {renderResults()}
            </>
          )}
        </div>

        {/* ── Footer del panel ── */}
        <div style={{
          padding:    '10px 20px',
          borderTop:  '1px solid var(--border)',
          background: 'var(--surface)',
          fontFamily: 'Space Mono, monospace',
          fontSize:    9,
          color:      'var(--subtle)',
          textAlign:  'center',
        }}>
          DevForge CV Matcher · Lucas Y.Aramendy · powered by Groq llama-3.3-70b
        </div>
      </div>

      {/* Animación de entrada del panel (misma que ResourcePanel) */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0 }
          to   { transform: translateX(0);    opacity: 1 }
        }
      `}</style>
    </>
  )
}
