import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore, ACTIONS } from '../store/index.jsx'
import { useAI } from '../hooks/useAI.js'
import { getTopicById, TOPICS } from '../data/topics.js'
import { getQuestions, DIFFICULTY_LABEL } from '../data/questions.js'
import Header from '../components/ui/Header.jsx'

const DIFF_COLOR = { basic: 'var(--green)', mid: 'var(--primary)', senior: 'var(--red)' }

function scoreColor(s) {
  if (s == null) return 'var(--subtle)'
  if (s >= 8) return 'var(--green)'
  if (s >= 5) return 'var(--primary)'
  return 'var(--red)'
}

// ─── Armar pool de preguntas ──────────────────────────────
function buildQuestionPool(topicIds, difficulty, durationMin) {
  const maxQ = Math.floor(durationMin / 3.5)
  const pool  = []

  topicIds.forEach(tid => {
    let qs = []
    if (difficulty === 'basic') {
      qs = getQuestions(tid, 'basic')
    } else if (difficulty === 'senior') {
      qs = [...getQuestions(tid, 'mid'), ...getQuestions(tid, 'senior')]
    } else {
      qs = [...getQuestions(tid, 'basic'), ...getQuestions(tid, 'mid')]
    }
    qs.forEach(q => pool.push({ topic: getTopicById(tid), question: q }))
  })

  // Mezclar (Fisher-Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, maxQ)
}

// ─── Timer principal de la entrevista ────────────────────
function InterviewTimer({ secondsLeft, totalSeconds }) {
  const pct     = secondsLeft / totalSeconds
  const mins    = Math.floor(secondsLeft / 60)
  const secs    = secondsLeft % 60
  const color   = pct > 0.5 ? 'var(--green)' : pct > 0.2 ? 'var(--primary)' : 'var(--red)'
  const urgent  = pct <= 0.2

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {urgent && (
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--red)', animation: 'pulse 1s infinite' }}>⚠</span>
      )}
      <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 13, color, minWidth: 42, textAlign: 'right' }}>
        {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
      </div>
      <div style={{ width: 80, height: 4, background: 'var(--muted)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, transition: 'width 1s linear, background 0.3s' }} />
      </div>
    </div>
  )
}

// ─── Pantalla de countdown ────────────────────────────────
function CountdownScreen({ onStart, duration, topicCount, questionCount }) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count === 0) { onStart(); return }
    const t = setTimeout(() => setCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count])

  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 24 }}>
        La entrevista empieza en
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 96, color: 'var(--primary)', lineHeight: 1, marginBottom: 24, animation: 'pulse 1s infinite' }}>
        {count === 0 ? '¡Ya!' : count}
      </div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)', lineHeight: 1.8 }}>
        {duration} min · {topicCount} temas · ~{questionCount} preguntas<br/>
        Sin hints · Sin pausas · Feedback al final
      </div>
    </div>
  )
}

// ─── Interview principal ──────────────────────────────────
export default function Interview() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { dispatch } = useStore()
  const { evaluateAnswer, loading } = useAI()

  const { duration = 45, difficulty = 'mixed', topicIds = [] } = location.state || {}

  const totalSeconds = duration * 60
  const [questions,   setQuestions]   = useState([])
  const [phase,       setPhase]       = useState('countdown') // countdown | question | evaluating | done
  const [qIndex,      setQIndex]      = useState(0)
  const [answer,      setAnswer]      = useState('')
  const [allAnswers,  setAllAnswers]  = useState([])
  const [timeLeft,    setTimeLeft]    = useState(totalSeconds)
  const [startedAt,   setStartedAt]   = useState(null)
  const [skipped,     setSkipped]     = useState(0)
  const timerRef    = useRef(null)
  const textareaRef = useRef(null)

  // Construir preguntas una vez
  useEffect(() => {
    if (topicIds.length) {
      setQuestions(buildQuestionPool(topicIds, difficulty, duration))
    }
  }, [])

  // Timer global
  useEffect(() => {
    if (phase === 'question' || phase === 'evaluating') {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current)
            finishInterview()
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [phase])

  useEffect(() => {
    if (phase === 'question') textareaRef.current?.focus()
  }, [phase, qIndex])

  function handleStart() {
    setStartedAt(new Date().toISOString())
    setPhase('question')
  }

  async function handleEvaluate() {
    if (answer.trim().length < 5) return
    clearInterval(timerRef.current)
    setPhase('evaluating')

    const item   = questions[qIndex]
    const result = await evaluateAnswer({
      question: item.question.question,
      answer,
      topic: item.topic?.name || '',
    })

    const record = {
      question:   item.question.question,
      topicId:    item.topic?.id,
      topicName:  item.topic?.name,
      topicIcon:  item.topic?.icon,
      difficulty: item.question.difficulty,
      type:       item.question.type,
      userAnswer: answer,
      score:      result?.score || null,
      feedback:   result || null,
      skipped:    false,
    }

    const updated = [...allAnswers, record]
    setAllAnswers(updated)

    // Siguiente o terminar
    if (qIndex >= questions.length - 1 || timeLeft <= 10) {
      finishInterview(updated)
    } else {
      setQIndex(prev => prev + 1)
      setAnswer('')
      setPhase('question')
    }
  }

  function handleSkip() {
    const item   = questions[qIndex]
    const record = {
      question:   item.question.question,
      topicId:    item.topic?.id,
      topicName:  item.topic?.name,
      topicIcon:  item.topic?.icon,
      difficulty: item.question.difficulty,
      type:       item.question.type,
      userAnswer: '',
      score:      0,
      feedback:   null,
      skipped:    true,
    }
    const updated = [...allAnswers, record]
    setAllAnswers(updated)
    setSkipped(s => s + 1)

    if (qIndex >= questions.length - 1) {
      finishInterview(updated)
    } else {
      setQIndex(prev => prev + 1)
      setAnswer('')
    }
  }

  function finishInterview(answers = allAnswers) {
    clearInterval(timerRef.current)
    const endedAt = new Date().toISOString()

    // `skipped` como array de preguntas omitidas — coincide con la columna JSONB
    // en la tabla interviews (skipped JSONB DEFAULT '[]').
    // El estado `skipped` (number) solo se usa para el contador visual en vivo;
    // acá derivamos el array desde `answers` para persistencia correcta.
    const skippedRecords = answers.filter(a => a.skipped)

    const interviewRecord = {
      type:       'interview',
      topicIds,
      difficulty,
      duration,
      startedAt,
      endedAt,
      answers,
      skipped: skippedRecords,   // array → JSONB ✓
    }

    // NOTA: NO despachamos END_SESSION acá — esa acción es para sesiones de práctica
    // por topic, no para entrevistas simuladas. Despacharla acá causaba que el store
    // intentara guardar una sesión vacía en Supabase (topic_id NOT NULL → error silencioso).
    dispatch({ type: ACTIONS.ADD_INTERVIEW, interview: interviewRecord })
    navigate('/interview-results', { state: { interview: interviewRecord } })
  }

  const currentItem = questions[qIndex]
  const progress    = questions.length > 0 ? (qIndex / questions.length) * 100 : 0
  const answered    = allAnswers.filter(a => !a.skipped).length

  if (!topicIds.length) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)', marginBottom: 20 }}>
            Sin configuración de entrevista.
          </p>
          <button onClick={() => navigate('/interview-setup')} style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
            Configurar →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      {/* Header mínimo durante la entrevista */}
      {phase === 'countdown' ? (
        <Header backTo="/interview-setup" backLabel="Configuración" />
      ) : (
        <header className="forge-header" style={{ padding: '10px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 14, color: 'var(--primary)', flexShrink: 0 }}>
              DEV<span style={{ color: 'var(--text)' }}>FORGE</span>
            </span>
            <span className="forge-hide-sm" style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
              / Entrevista simulada
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
              {qIndex + 1}/{questions.length}
            </span>
            <InterviewTimer secondsLeft={timeLeft} totalSeconds={totalSeconds} />
          </div>
        </header>
      )}

      {/* Barra de progreso */}
      {phase !== 'countdown' && (
        <div style={{ width: '100%', height: 3, background: 'var(--muted)' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.4s' }} />
        </div>
      )}

      <main className="forge-main forge-main-md">

        {/* ── COUNTDOWN ── */}
        {phase === 'countdown' && questions.length > 0 && (
          <CountdownScreen
            onStart={handleStart}
            duration={duration}
            topicCount={topicIds.length}
            questionCount={questions.length}
          />
        )}

        {/* ── PREGUNTA ── */}
        {(phase === 'question' || phase === 'evaluating') && currentItem && (
          <div style={{ animation: 'slideUp 0.25s ease' }}>

            {/* Meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>{currentItem.topic?.icon}</span>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                {currentItem.topic?.name}
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: `1px solid ${DIFF_COLOR[currentItem.question.difficulty]}`, color: DIFF_COLOR[currentItem.question.difficulty] }}>
                {DIFFICULTY_LABEL[currentItem.question.difficulty]}
              </span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: '1px solid var(--border)', color: 'var(--subtle)', textTransform: 'uppercase' }}>
                {currentItem.question.type}
              </span>
            </div>

            {/* Pregunta */}
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', lineHeight: 1.4, marginBottom: 24 }}>
              {currentItem.question.question}
            </h2>

            {/* Sin hints — aviso */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
                🚫 Modo entrevista — sin hints disponibles
              </span>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              disabled={phase === 'evaluating'}
              placeholder="Escribí tu respuesta. Pensá en voz alta, explicá tu razonamiento..."
              style={{ width: '100%', minHeight: 160, padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${answer.length > 10 ? 'var(--primary)' : 'var(--border)'}`, color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 13, lineHeight: 1.7, resize: 'vertical', outline: 'none', transition: 'border-color 0.2s', marginBottom: 12, boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSkip}
                disabled={phase === 'evaluating'}
                style={{ padding: '10px 18px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--subtle)' }}
              >
                Omitir →
              </button>

              <button
                onClick={handleEvaluate}
                disabled={answer.trim().length < 5 || phase === 'evaluating'}
                style={{ flex: 1, padding: '10px 0', background: answer.trim().length < 5 ? 'var(--muted)' : 'var(--primary)', border: 'none', color: '#000', cursor: answer.trim().length < 5 ? 'default' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {phase === 'evaluating' ? (
                  <><span style={{ width: 14, height: 14, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />Evaluando...</>
                ) : 'Responder →'}
              </button>
            </div>

            {/* Stats en vivo */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 20, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {[
                { label: 'Respondidas', value: answered },
                { label: 'Omitidas',    value: skipped },
                { label: 'Restantes',   value: questions.length - qIndex - 1 },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--primary)' }}>{s.value}</div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes pulse   { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
      `}</style>
    </div>
  )
}
