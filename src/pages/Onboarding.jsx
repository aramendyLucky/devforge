import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, ACTIONS } from '../store/index.jsx'
import { useAI } from '../hooks/useAI.js'
import { extractTextFromFile, isFileSupported, getSupportedExtensions } from '../lib/fileParser.js'
import Header from '../components/ui/Header.jsx'

// ─── Temas por defecto si la IA falla ────────────────────
const DEFAULT_TOPICS = [
  { id: 'python',      name: 'Python Core',       tier: 1, category: 'backend'     },
  { id: 'apis',        name: 'REST APIs',          tier: 1, category: 'backend'     },
  { id: 'git',         name: 'Git & CI/CD',        tier: 1, category: 'devops'      },
  { id: 'django',      name: 'Django / Flask',     tier: 1, category: 'backend'     },
  { id: 'fastapi',     name: 'FastAPI',            tier: 1, category: 'backend'     },
  { id: 'sql',         name: 'SQL',                tier: 2, category: 'database'    },
  { id: 'aws',         name: 'AWS (Lambda/S3/RDS)',tier: 2, category: 'cloud'       },
  { id: 'docker',      name: 'Docker',             tier: 2, category: 'devops'      },
  { id: 'nextjs',      name: 'Next.js',            tier: 2, category: 'frontend'    },
  { id: 'ai_agents',   name: 'Agentes de IA',      tier: 2, category: 'ai'          },
  { id: 'graphql',     name: 'GraphQL',            tier: 3, category: 'backend'     },
  { id: 'observability',name: 'Datadog / Sentry',  tier: 3, category: 'devops'      },
  { id: 'agile',       name: 'Agile / Scrum',      tier: 3, category: 'methodology' },
]

const TIER_LABELS = { 1: 'Crítico', 2: 'Importante', 3: 'Diferenciador' }
const TIER_COLORS = {
  1: 'badge-amber',
  2: 'border-forge-blue text-blue-400 bg-blue-400/10',
  3: 'badge-muted',
}

const CATEGORY_ICONS = {
  backend:     '⚙️',
  frontend:    '🖥️',
  cloud:       '☁️',
  database:    '🗄️',
  devops:      '🔧',
  ai:          '🤖',
  methodology: '📋',
}

// ─── Step indicator ──────────────────────────────────────
function StepIndicator({ current }) {
  const steps = ['Ofertas', 'Autoevaluación', 'Objetivo']
  return (
    <div className="flex items-center gap-2 mb-10">
      {steps.map((label, i) => {
        const idx = i + 1
        const done    = idx < current
        const active  = idx === current
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`
              flex items-center justify-center w-7 h-7 font-mono text-xs font-bold
              border transition-all duration-300
              ${done   ? 'bg-forge-amber border-forge-amber text-forge-bg' : ''}
              ${active ? 'border-forge-amber text-forge-amber' : ''}
              ${!done && !active ? 'border-forge-muted text-forge-muted' : ''}
            `}>
              {done ? '✓' : idx}
            </div>
            <span className={`font-mono text-xs uppercase tracking-wider hidden sm:block
              ${active ? 'text-forge-text' : 'text-forge-subtle'}`}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className="w-8 h-px bg-forge-border mx-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── PASO 1: Cargá y analizá tus ofertas ────────────────
/**
 * ExtractionPreview — muestra los resultados del análisis de IA ANTES de avanzar.
 *
 * ¿Por qué un paso intermedio de preview?
 *   El análisis de IA puede extraer entre 5 y 15 tecnologías. Si el usuario
 *   va directo al Paso 2 sin ver qué encontró, puede llegar a la autoevaluación
 *   con temas que no reconoce o que la IA interpretó mal.
 *
 *   Con el preview el usuario tiene control: ve exactamente qué detectó la IA,
 *   puede confirmar y seguir, o volver y pegar un texto más completo.
 *   Esto también muestra el poder del análisis — es un momento "wow" de la app.
 *
 * @param {Array}    topics   — tecnologías detectadas por la IA
 * @param {string}   summary  — descripción en lenguaje natural del perfil detectado
 * @param {Function} onConfirm — callback para avanzar al Paso 2
 * @param {Function} onBack    — callback para volver a editar el texto
 */
function ExtractionPreview({ topics, summary, onConfirm, onBack }) {
  const tier1 = topics.filter(t => t.tier === 1)
  const tier2 = topics.filter(t => t.tier === 2)
  const tier3 = topics.filter(t => t.tier === 3)

  // Renderiza un grupo de topics del mismo tier
  function TierGroup({ tier, items, label }) {
    if (!items.length) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map(t => (
            <span
              key={t.id}
              style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: 11,
                padding: '4px 10px',
                border: `1px solid ${tier === 1 ? 'var(--primary)' : tier === 2 ? '#3b82f6' : 'var(--border)'}`,
                color:   tier === 1 ? 'var(--primary)' : tier === 2 ? '#3b82f6' : 'var(--subtle)',
                background: tier === 1
                  ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                  : 'transparent',
              }}
            >
              {CATEGORY_ICONS[t.category] || '📌'} {t.name}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      {/* ── Encabezado del resultado ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 28 }}>✅</span>
        <div>
          <h2 className="font-display font-extrabold text-3xl text-forge-text">
            Análisis completado
          </h2>
          <p className="font-mono text-forge-subtle text-xs mt-1">
            La IA detectó <strong style={{ color: 'var(--primary)' }}>{topics.length} tecnologías</strong> en tus ofertas
          </p>
        </div>
      </div>

      {/* ── Resumen en lenguaje natural ── */}
      {summary && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', padding: '12px 16px', marginBottom: 20, marginTop: 16 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
            Perfil detectado
          </div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
            {summary}
          </p>
        </div>
      )}

      {/* ── Tecnologías por tier ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px', marginBottom: 24 }}>
        <TierGroup tier={1} items={tier1} label="🔥 Críticos — dominá estos sí o sí" />
        <TierGroup tier={2} items={tier2} label="⭐ Importantes — te dan ventaja real" />
        <TierGroup tier={3} items={tier3} label="💡 Diferenciadores — suman puntos extra" />
      </div>

      {/* ── Acciones ── */}
      <div className="flex gap-4">
        <button className="btn-ghost" onClick={onBack}>
          ← Re-analizar
        </button>
        <button className="btn-primary flex-1" onClick={onConfirm}>
          Continuar con estos {topics.length} temas →
        </button>
      </div>

      <p className="font-mono text-forge-subtle text-xs mt-4 text-center">
        En el siguiente paso vas a autoevaluarte en cada uno de estos temas.
      </p>
    </div>
  )
}

/**
 * Step1 — paso de carga y análisis de ofertas laborales.
 *
 * Soporta tres formas de ingresar el texto de las ofertas:
 *   1. Pegar texto directamente en el textarea
 *   2. Subir un archivo (PDF, Word .docx, TXT) vía botón o drag & drop
 *   3. Usar el plan de referencia de DevForge (atajo rápido sin ofertas reales)
 *
 * Flujo con archivo:
 *   Archivo soltado/seleccionado
 *     → fileParser.extractTextFromFile() extrae el texto
 *     → El texto aparece en el textarea (el usuario puede editarlo)
 *     → El usuario hace click en "Analizar"
 *
 * Flujo de análisis:
 *   "Analizar" → extractTopicsFromOffers() (Groq IA)
 *     → Muestra ExtractionPreview (topics + summary)
 *     → El usuario confirma → avanza al Paso 2
 *
 * Decisión de diseño: no avanzamos automáticamente después del análisis.
 *   Le damos control al usuario para verificar qué encontró la IA antes
 *   de comprometerse con esos temas en el Paso 2 (autoevaluación).
 */
function Step1({ onNext }) {
  const { extractTopicsFromOffers, loading: aiLoading } = useAI()
  const { dispatch } = useStore()

  // Contenido del textarea — pegado o extraído de un archivo
  const [text, setText] = useState('')

  // Estado del procesamiento de archivo (separado del estado de la IA)
  // Porque file loading y AI loading son dos operaciones distintas
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError,   setFileError]   = useState(null)

  // Estado visual del drag & drop
  const [dragging, setDragging] = useState(false)

  // Errores del formulario (texto muy corto, etc.)
  const [error, setError] = useState('')

  // Preview de extracción: null = no analizado todavía; objeto = resultado listo
  const [preview, setPreview] = useState(null)

  // Ref al input[type=file] oculto — lo activamos desde el botón visible
  const fileInputRef = useRef(null)

  // ── Procesamiento de archivo ────────────────────────────────────────────

  /**
   * handleFile — procesa un archivo subido o arrastrado.
   *
   * Usa fileParser.extractTextFromFile() que internamente detecta el formato
   * y usa la librería correcta (FileReader / PDF.js / mammoth).
   * El texto extraído reemplaza el contenido del textarea.
   *
   * ¿Por qué mostramos el texto en el textarea y no lo mandamos directo a la IA?
   *   Porque el usuario puede querer:
   *   - Verificar que el texto se extrajo correctamente (especialmente PDFs)
   *   - Editar o agregar más texto antes del análisis
   *   - Combinar texto de un archivo con texto pegado manualmente
   */
  async function handleFile(file) {
    if (!isFileSupported(file)) {
      setFileError(
        `Formato .${file.name.split('.').pop()} no soportado. ` +
        'Subí un PDF, Word (.docx) o archivo de texto (.txt).'
      )
      return
    }

    setFileLoading(true)
    setFileError(null)
    setError('')

    try {
      const extracted = await extractTextFromFile(file)
      setText(extracted)
    } catch (e) {
      setFileError(e.message)
    } finally {
      setFileLoading(false)
    }
  }

  // ── Drag & Drop handlers ────────────────────────────────────────────────

  function onDragOver(e) {
    e.preventDefault()  // necesario para que onDrop funcione
    setDragging(true)
  }

  function onDragLeave(e) {
    // Solo desactivamos si el cursor salió del contenedor, no de un hijo
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragging(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileInputChange(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''  // reset para que el mismo archivo pueda volver a seleccionarse
  }

  // ── Análisis con IA ────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (text.trim().length < 50) {
      setError('Pegá al menos una oferta laboral completa para analizarla.')
      return
    }
    setError('')

    // extractTopicsFromOffers ahora devuelve { topics, summary }
    const result = await extractTopicsFromOffers(text)
    const topics = result.topics?.length > 0 ? result.topics : DEFAULT_TOPICS
    const summary = result.summary || ''

    // En vez de avanzar al Paso 2 directamente, mostramos la preview
    // para que el usuario confirme qué encontró la IA
    setPreview({ topics, summary })
  }

  // ── Confirmación: guardamos en el store y avanzamos ────────────────────

  function handleConfirm() {
    dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'rawOffers',       value: text })
    dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'extractedTopics', value: preview.topics })
    onNext(preview.topics)
  }

  // ── Render: si hay preview, mostramos ExtractionPreview ───────────────

  if (preview) {
    return (
      <ExtractionPreview
        topics={preview.topics}
        summary={preview.summary}
        onConfirm={handleConfirm}
        onBack={() => setPreview(null)}  // volver al textarea
      />
    )
  }

  // ── Render: formulario principal ───────────────────────────────────────

  // Conteo de palabras para el feedback al usuario
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const charCount = text.length

  return (
    <div className="animate-slide-up">
      <h2 className="font-display font-extrabold text-3xl text-forge-text mb-2">
        Cargá tus ofertas laborales
      </h2>
      <p className="font-mono text-forge-subtle text-sm mb-8 max-w-lg">
        Pegá el texto o subí el archivo de los puestos a los que querés aplicar.
        La IA extrae automáticamente el stack técnico requerido.
      </p>

      {/* ── Zona de drag & drop ────────────────────────────────────────────
          Acepta PDF, .docx y .txt. Usamos eventos nativos del DOM (no librerías)
          porque el drag & drop del browser es suficiente para este caso.
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border:      `2px dashed ${dragging ? 'var(--primary)' : fileError ? 'var(--red)' : 'var(--border)'}`,
          background:  dragging
            ? 'color-mix(in srgb, var(--primary) 6%, transparent)'
            : 'var(--surface)',
          padding:     '22px 24px',
          cursor:      'pointer',
          transition:  'all 0.15s',
          textAlign:   'center',
          marginBottom: 16,
          // Animación sutil cuando hay un archivo siendo procesado
          opacity: fileLoading ? 0.7 : 1,
        }}
      >
        {/* Input oculto — solo se activa desde el botón visible o el onClick del div */}
        <input
          ref={fileInputRef}
          type="file"
          accept={getSupportedExtensions()}
          onChange={onFileInputChange}
          style={{ display: 'none' }}
        />

        {fileLoading ? (
          /* Estado de carga del archivo */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ width: 14, height: 14, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)' }}>
              Extrayendo texto del archivo...
            </span>
          </div>
        ) : (
          /* Estado normal — instrucciones */
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>
              {dragging ? '📂' : '📁'}
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: dragging ? 'var(--primary)' : 'var(--text)', marginBottom: 4 }}>
              {dragging ? 'Soltá el archivo acá' : 'Arrastrá tu archivo o hacé click'}
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
              PDF · Word (.docx) · TXT · MD
            </div>
          </>
        )}
      </div>

      {/* Error al parsear el archivo */}
      {fileError && (
        <div style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1px solid var(--red)', padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--red)', margin: 0 }}>
            ⚠️ {fileError}
          </p>
        </div>
      )}

      {/* ── Divisor ── */}
      <div className="divider mb-4">o pegá el texto directamente</div>

      {/* ── Textarea ─────────────────────────────────────────────────────
          Si se subió un archivo, el texto extraído aparece acá automáticamente
          y el usuario puede editarlo antes del análisis.
      ─────────────────────────────────────────────────────────────────────── */}
      <textarea
        className="textarea-forge w-full mb-2"
        style={{ minHeight: text.length > 300 ? '280px' : '180px', transition: 'min-height 0.3s' }}
        placeholder={`Ejemplo:\n\nBuscamos Python Developer con experiencia en AWS Lambda, Django y REST APIs.\nRequisitos: Docker, CI/CD con GitHub Actions, SQL, Redis...\n\n(Podés pegar varias ofertas juntas)`}
        value={text}
        onChange={e => { setText(e.target.value); setError('') }}
      />

      {/* ── Estadísticas del texto ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: charCount > 0 ? 'var(--subtle)' : 'var(--muted)' }}>
          {charCount > 0
            ? `${charCount.toLocaleString()} caracteres · ${wordCount.toLocaleString()} palabras`
            : 'Mínimo 50 caracteres — una oferta completa'}
        </span>
        {text.length > 0 && (
          <button
            onClick={() => { setText(''); setFileError(null); setError('') }}
            style={{ background: 'none', border: 'none', fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
          >
            Limpiar ✕
          </button>
        )}
      </div>

      {/* Error de validación */}
      {error && (
        <p className="font-mono text-forge-red text-xs mb-4 mt-2">{error}</p>
      )}

      {/* ── Botón de análisis ── */}
      <div className="flex items-center justify-end mt-5">
        <button
          className="btn-primary"
          onClick={handleAnalyze}
          disabled={aiLoading || fileLoading || text.trim().length < 50}
          style={{ minWidth: 180 }}
        >
          {aiLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border border-forge-bg border-t-transparent rounded-full animate-spin" />
              Analizando con IA...
            </span>
          ) : 'Analizar ofertas →'}
        </button>
      </div>

      {/* ── Alternativa rápida ── */}
      <div className="divider mt-10 mb-6">o usá el plan de referencia</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 12 }}>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', margin: '0 0 10px', lineHeight: 1.7 }}>
          Si no tenés ofertas a mano, usá el stack de referencia de DevForge (13 tecnologías core
          para perfiles Python Backend / Full Stack). Podés cambiarlas después desde el Dashboard.
        </p>
        <button
          className="btn-secondary w-full"
          onClick={() => {
            dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'extractedTopics', value: DEFAULT_TOPICS })
            dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'rawOffers', value: 'Plan de referencia DevForge' })
            onNext(DEFAULT_TOPICS)
          }}
        >
          Usar stack de referencia ({DEFAULT_TOPICS.length} temas) →
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── PASO 2: Autoevaluación ──────────────────────────────
function Step2({ topics, onNext, onBack }) {
  const { dispatch } = useStore()
  const [scores, setScores] = useState(() =>
    Object.fromEntries(topics.map(t => [t.id, 2]))
  )

  const LABELS = ['', 'No lo conozco', 'Vi algo', 'Lo uso básico', 'Bastante sólido', 'Lo domino']

  function handleSave() {
    dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'selfAssessment', value: scores })
    onNext()
  }

  const tier1 = topics.filter(t => t.tier === 1)
  const tier2 = topics.filter(t => t.tier === 2)
  const tier3 = topics.filter(t => t.tier === 3)

  function TierGroup({ tier, items }) {
    if (!items.length) return null
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className={`badge ${TIER_COLORS[tier]}`}>Tier {tier}</span>
          <span className="font-mono text-forge-subtle text-xs">{TIER_LABELS[tier]}</span>
        </div>
        <div className="space-y-3">
          {items.map(topic => (
            <div key={topic.id} className="card py-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{CATEGORY_ICONS[topic.category] || '📌'}</span>
                  <span className="font-display font-bold text-forge-text text-sm">
                    {topic.name}
                  </span>
                </div>
                <span className="font-mono text-forge-amber text-xs">
                  {LABELS[scores[topic.id]]}
                </span>
              </div>
              <input
                type="range" min="1" max="5"
                value={scores[topic.id]}
                onChange={e => setScores(prev => ({ ...prev, [topic.id]: Number(e.target.value) }))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="font-mono text-forge-muted text-xs">Desconozco</span>
                <span className="font-mono text-forge-muted text-xs">Domino</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <h2 className="font-display font-extrabold text-3xl text-forge-text mb-2">
        ¿Cuánto sabés de cada tema?
      </h2>
      <p className="font-mono text-forge-subtle text-sm mb-8 max-w-lg">
        Sé honesto. Esto arma tu mapa de fortalezas y debilidades para priorizar el estudio.
      </p>

      <TierGroup tier={1} items={tier1} />
      <TierGroup tier={2} items={tier2} />
      <TierGroup tier={3} items={tier3} />

      <div className="flex gap-4 mt-6">
        <button className="btn-ghost" onClick={onBack}>← Volver</button>
        <button className="btn-primary flex-1" onClick={handleSave}>
          Guardar evaluación →
        </button>
      </div>
    </div>
  )
}

// ─── PASO 3: Fecha objetivo ──────────────────────────────
function Step3({ onBack, onFinish }) {
  const { dispatch } = useStore()
  const [date, setDate]     = useState('')
  const [name, setName]     = useState('')
  const [error, setError]   = useState('')

  function handleFinish() {
    if (!name.trim()) { setError('Ingresá tu nombre para personalizar DevForge.'); return }
    dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'name',        value: name.trim() })
    dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'targetDate',  value: date || null })
    dispatch({ type: ACTIONS.SET_ONBOARDING_DONE })
    onFinish()
  }

  const today = new Date().toISOString().split('T')[0]
  const daysLeft = date
    ? Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="animate-slide-up max-w-lg">
      <h2 className="font-display font-extrabold text-3xl text-forge-text mb-2">
        Casi listo
      </h2>
      <p className="font-mono text-forge-subtle text-sm mb-8">
        Un par de datos para personalizar tu entrenamiento.
      </p>

      <div className="space-y-5">
        <div>
          <label className="font-mono text-forge-subtle text-xs uppercase tracking-widest block mb-2">
            Tu nombre
          </label>
          <input
            type="text"
            className="input-forge"
            placeholder="ej: Martín"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
          />
        </div>

        <div>
          <label className="font-mono text-forge-subtle text-xs uppercase tracking-widest block mb-2">
            Fecha de entrevista objetivo <span className="text-forge-muted">(opcional)</span>
          </label>
          <input
            type="date"
            className="input-forge"
            min={today}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          {daysLeft !== null && daysLeft > 0 && (
            <p className="font-mono text-forge-amber text-xs mt-2">
              → {daysLeft} días para prepararte. {daysLeft < 14 ? '¡A full!' : 'Buen tiempo para prepararte bien.'}
            </p>
          )}
          {daysLeft !== null && daysLeft <= 0 && (
            <p className="font-mono text-forge-red text-xs mt-2">
              Esa fecha ya pasó. Elegí una futura.
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="font-mono text-forge-red text-xs mt-4">{error}</p>
      )}

      <div className="flex gap-4 mt-8">
        <button className="btn-ghost" onClick={onBack}>← Volver</button>
        <button className="btn-primary flex-1" onClick={handleFinish}>
          Ir al Dashboard →
        </button>
      </div>
    </div>
  )
}

// ─── Onboarding principal ────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep]     = useState(1)
  const [topics, setTopics] = useState([])

  function handleStep1Done(extractedTopics) {
    setTopics(extractedTopics)
    setStep(2)
  }

  return (
    <div className="min-h-screen bg-forge-bg flex flex-col">

      {/* Header */}
      <Header backTo="/" backLabel="Inicio" />

      {/* Contenido */}
      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <StepIndicator current={step} />

          {step === 1 && (
            <Step1 onNext={handleStep1Done} />
          )}
          {step === 2 && (
            <Step2
              topics={topics}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              onBack={() => setStep(2)}
              onFinish={() => navigate('/dashboard')}
            />
          )}
        </div>
      </main>

    </div>
  )
}
