import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, ACTIONS } from '../store/index.jsx'
import { useSession } from '../hooks/useSession.js'
import { useProgress } from '../hooks/useProgress.js'
import { useAI } from '../hooks/useAI.js'
import { TOPICS, ALL_TOPIC_IDS } from '../data/topics.js'
import { getQuestions, getQuestionCount, DIFFICULTY_LABEL } from '../data/questions.js'
import Header from '../components/ui/Header.jsx'

const TOTAL_QUESTIONS = 5
const DIFF_COLOR = { basic: 'var(--green)', mid: 'var(--primary)', senior: 'var(--red)' }

function scoreColor(s) {
  if (s == null) return 'var(--subtle)'
  if (s >= 8) return 'var(--green)'
  if (s >= 5) return 'var(--primary)'
  return 'var(--red)'
}

// ─── Selecciona 5 preguntas random de temas débiles ───────
function pickQuestions(progress, count = 5) {
  // Temas débiles: < 50% completado o nunca tocados
  const weak = TOPICS.filter(t => {
    const p = progress[t.id]
    if (!p || !p.total) return true
    return (p.completed / p.total) < 0.5
  })

  // Si no hay suficientes temas débiles, usar todos
  const pool = weak.length >= 3 ? weak : TOPICS

  const picked = []
  const usedTopics = new Set()

  // Intentar variar temas
  for (let attempt = 0; attempt < 50 && picked.length < count; attempt++) {
    const topic = pool[Math.floor(Math.random() * pool.length)]
    const qs    = getQuestions(topic.id)
    if (!qs.length) continue

    // Preferir temas no repetidos
    if (usedTopics.has(topic.id) && picked.length < count - 1) continue

    const q = qs[Math.floor(Math.random() * qs.length)]
    const already = picked.find(p => p.questionId === q.id)
    if (already) continue

    picked.push({ topic, question: q, questionId: q.id })
    usedTopics.add(topic.id)
  }

  return picked.slice(0, count)
}

// ─── Timer circular ───────────────────────────────────────
function Timer({ seconds, total }) {
  const pct = seconds / total
  const r   = 18
  const circ = 2 * Math.PI * r
  const dash = circ * pct

  const color = seconds > total * 0.5
    ? 'var(--green)'
    : seconds > total * 0.2
    ? 'var(--primary)'
    : 'var(--red)'

  return (
    <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
      <svg width={48} height={48} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={24} cy={24} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
        <circle cx={24} cy={24} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="butt"
          style={{ transition: 'stroke-dasharray 0.5s linear, stroke 0.3s' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, color }}>
        {seconds}
      </div>
    </div>
  )
}

// ─── Pantalla de intro ────────────────────────────────────
function IntroScreen({ questions, onStart }) {
  const topicNames = [...new Set(questions.map(q => q.topic.name))]
  return (
    <div style={{ textAlign: 'center', animation: 'slideUp 0.3s ease' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
        Modo repaso rápido
      </div>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 30, color: 'var(--text)', marginBottom: 12 }}>
        {TOTAL_QUESTIONS} preguntas · ~10 min
      </h1>
      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)', lineHeight: 1.7, marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
        Preguntas random de tus temas más débiles. Sin presión — aprendé del feedback y seguí adelante.
      </p>

      {/* Temas que van a aparecer */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 20px', marginBottom: 28, display: 'inline-block', textAlign: 'left', minWidth: 280 }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
          Temas de esta sesión
        </div>
        {questions.map((q, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', width: 16 }}>{i + 1}.</span>
            <span style={{ fontSize: 14 }}>{q.topic.icon}</span>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{q.topic.name}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '1px 5px', border: `1px solid ${DIFF_COLOR[q.question.difficulty]}`, color: DIFF_COLOR[q.question.difficulty], marginLeft: 'auto' }}>
              {DIFFICULTY_LABEL[q.question.difficulty]}
            </span>
          </div>
        ))}
      </div>

      <div>
        <button onClick={onStart} style={{ padding: '13px 36px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 }}>
          Empezar repaso →
        </button>
      </div>
    </div>
  )
}

// ─── Pantalla final ───────────────────────────────────────
function ResultScreen({ answers, onRestart, onDashboard }) {
  const avg   = answers.length ? Math.round(answers.reduce((a, b) => a + (b.score || 0), 0) / answers.length) : 0
  const emoji = avg >= 8 ? '🔥' : avg >= 5 ? '💪' : '📚'

  return (
    <div style={{ animation: 'slideUp 0.3s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{emoji}</div>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Repaso completado</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: 'var(--text)', marginBottom: 16 }}>
          {avg >= 8 ? '¡Sólido!' : avg >= 5 ? 'Buen trabajo.' : 'Hay que practicar más.'}
        </h2>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: `2px solid ${scoreColor(avg)}`, padding: '10px 28px' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)' }}>Score promedio</span>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 30, color: scoreColor(avg) }}>{avg}/10</span>
        </div>
      </div>

      {/* Barras por pregunta */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          Detalle por pregunta
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        {answers.map((a, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: scoreColor(a.score), width: 28, flexShrink: 0, textAlign: 'center' }}>{a.score || '—'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>
                {a.topicIcon} {a.topicName}
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.question}
              </div>
              {a.feedback?.keyMissing && (
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)', marginTop: 4 }}>
                  💡 {a.feedback.keyMissing}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRestart} style={{ flex: 1, padding: '12px 0', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >Otro repaso ⚡</button>
        <button onClick={onDashboard} style={{ flex: 1, padding: '12px 0', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>
          Dashboard →
        </button>
      </div>
    </div>
  )
}

// ─── QuickReview principal ────────────────────────────────
export default function QuickReview() {
  const navigate  = useNavigate()
  const { state } = useStore()
  const { submitAnswer, startSession, endSession } = useSession()
  const { progress, updateProgress } = useProgress()
  const { evaluateAnswer, getHint, loading } = useAI()

  const [phase,        setPhase]        = useState('intro')  // intro | question | evaluating | feedback | done
  const [questions,    setQuestions]    = useState([])
  const [qIndex,       setQIndex]       = useState(0)
  const [answer,       setAnswer]       = useState('')
  const [evaluation,   setEvaluation]   = useState(null)
  const [hints,        setHints]        = useState([])
  const [hintLevel,    setHintLevel]    = useState(1)
  const [allAnswers,   setAllAnswers]   = useState([])
  const [timeLeft,     setTimeLeft]     = useState(120)
  const [timerActive,  setTimerActive]  = useState(false)
  const textareaRef = useRef(null)
  const timerRef    = useRef(null)

  // Generar preguntas al montar
  useEffect(() => {
    setQuestions(pickQuestions(progress))
  }, [])

  // Timer
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); return 0 }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [timerActive, phase])

  useEffect(() => {
    if (phase === 'question') textareaRef.current?.focus()
  }, [phase, qIndex])

  const currentItem = questions[qIndex]
  const isLast      = qIndex >= questions.length - 1

  function handleStart() {
    startSession('quick_review')
    setPhase('question')
    setTimerActive(true)
    setTimeLeft(120)
  }

  async function handleEvaluate() {
    if (answer.trim().length < 10) return
    clearInterval(timerRef.current)
    setTimerActive(false)
    setPhase('evaluating')

    const result = await evaluateAnswer({
      question: currentItem.question.question,
      answer,
      topic: currentItem.topic.name,
    })

    if (result) {
      setEvaluation(result)
      const record = {
        question:  currentItem.question.question,
        topicName: currentItem.topic.name,
        topicIcon: currentItem.topic.icon,
        userAnswer: answer,
        score:      result.score,
        feedback:   result,
      }
      submitAnswer(record)
      setAllAnswers(prev => [...prev, record])
      updateProgress(currentItem.topic.id, {
        completed: (progress[currentItem.topic.id]?.completed || 0) + 1,
        total:     getQuestionCount(currentItem.topic.id),
        lastScore: result.score,
      })
      setPhase('feedback')
    } else {
      setPhase('question')
      setTimerActive(true)
    }
  }

  async function handleHint() {
    if (hintLevel > 3) return
    const h = await getHint({ question: currentItem.question.question, topic: currentItem.topic.name, hintLevel })
    if (h) setHints(prev => [...prev, { text: h, level: hintLevel }])
    setHintLevel(prev => prev + 1)
  }

  function handleNext() {
    if (isLast) {
      endSession()
      setPhase('done')
    } else {
      setQIndex(prev => prev + 1)
      setAnswer('')
      setEvaluation(null)
      setHints([])
      setHintLevel(1)
      setTimeLeft(120)
      setTimerActive(true)
      setPhase('question')
    }
  }

  function handleRestart() {
    setQuestions(pickQuestions(progress))
    setQIndex(0)
    setAnswer('')
    setEvaluation(null)
    setHints([])
    setHintLevel(1)
    setAllAnswers([])
    setTimeLeft(120)
    setPhase('intro')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      <Header backTo="/dashboard" backLabel="Dashboard" />

      {/* Barra de progreso */}
      {phase !== 'intro' && phase !== 'done' && (
        <div style={{ width: '100%', height: 3, background: 'var(--muted)' }}>
          <div style={{ width: `${(qIndex / questions.length) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.4s' }} />
        </div>
      )}

      <main className="forge-main forge-main-md">

        {/* ── INTRO ── */}
        {phase === 'intro' && questions.length > 0 && (
          <IntroScreen questions={questions} onStart={handleStart} />
        )}

        {/* ── PREGUNTA / EVALUANDO / FEEDBACK ── */}
        {(phase === 'question' || phase === 'evaluating' || phase === 'feedback') && currentItem && (
          <div style={{ animation: 'slideUp 0.25s ease' }}>

            {/* Meta info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)' }}>
                {qIndex + 1}/{questions.length}
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 16 }}>{currentItem.topic.icon}</span>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{currentItem.topic.name}</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: `1px solid ${DIFF_COLOR[currentItem.question.difficulty]}`, color: DIFF_COLOR[currentItem.question.difficulty] }}>
                {DIFFICULTY_LABEL[currentItem.question.difficulty]}
              </span>
              {(phase === 'question' || phase === 'evaluating') && (
                <Timer seconds={timeLeft} total={120} />
              )}
            </div>

            {/* Pregunta */}
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 21, color: 'var(--text)', lineHeight: 1.4, marginBottom: 20 }}>
              {currentItem.question.question}
            </h2>

            {/* Hints */}
            {hints.map((h, i) => (
              <div key={i} style={{ background: 'var(--surface)', borderLeft: `3px solid ${['var(--green)','var(--primary)','var(--red)'][h.level-1]}`, padding: '10px 14px', marginBottom: 10, animation: 'fadeIn 0.3s ease' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: ['var(--green)','var(--primary)','var(--red)'][h.level-1], textTransform: 'uppercase', marginBottom: 4 }}>💡 Pista {h.level}</div>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{h.text}</p>
              </div>
            ))}

            {/* Input */}
            {(phase === 'question' || phase === 'evaluating') && (
              <div>
                <textarea
                  ref={textareaRef}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  disabled={phase === 'evaluating'}
                  placeholder="Tu respuesta..."
                  style={{ width: '100%', minHeight: 140, padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${answer.length > 10 ? 'var(--primary)' : 'var(--border)'}`, color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 12, lineHeight: 1.7, resize: 'vertical', outline: 'none', transition: 'border-color 0.2s', marginBottom: 12, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleHint} disabled={loading || hintLevel > 3}
                    style={{ padding: '9px 16px', background: 'var(--card)', border: '1px solid var(--border)', color: hintLevel > 3 ? 'var(--muted)' : 'var(--subtle)', cursor: hintLevel > 3 ? 'default' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11 }}>
                    {hintLevel > 3 ? 'Sin más pistas' : `💡 Pista${hintLevel > 1 ? ` ${hintLevel}` : ''}`}
                  </button>
                  <button onClick={handleEvaluate} disabled={answer.trim().length < 10 || phase === 'evaluating'}
                    style={{ flex: 1, padding: '9px 0', background: answer.trim().length < 10 ? 'var(--muted)' : 'var(--primary)', border: 'none', color: '#000', cursor: answer.trim().length < 10 ? 'default' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {phase === 'evaluating' ? (
                      <><span style={{ width: 12, height: 12, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />Evaluando...</>
                    ) : 'Evaluar →'}
                  </button>
                </div>
              </div>
            )}

            {/* Feedback */}
            {phase === 'feedback' && evaluation && (
              <div style={{ animation: 'slideUp 0.3s ease' }}>
                {/* Score */}
                <div style={{ background: 'var(--surface)', border: `2px solid ${scoreColor(evaluation.score)}`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 40, color: scoreColor(evaluation.score), lineHeight: 1, flexShrink: 0 }}>{evaluation.score}</div>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
                      {evaluation.score >= 8 ? '¡Excelente!' : evaluation.score >= 5 ? 'Aceptable.' : 'A mejorar.'}
                    </div>
                    {evaluation.keyMissing && (
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--primary)' }}>💡 {evaluation.keyMissing}</div>
                    )}
                  </div>
                </div>

                {/* Strengths + improvements compactos */}
                {evaluation.strengths?.length > 0 && (
                  <div style={{ background: 'var(--card)', borderLeft: '3px solid var(--green)', padding: '10px 14px', marginBottom: 8 }}>
                    {evaluation.strengths.slice(0, 2).map((s, i) => (
                      <div key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', display: 'flex', gap: 6, marginBottom: 2 }}>
                        <span style={{ color: 'var(--green)' }}>✓</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {evaluation.improvements?.length > 0 && (
                  <div style={{ background: 'var(--card)', borderLeft: '3px solid var(--primary)', padding: '10px 14px', marginBottom: 12 }}>
                    {evaluation.improvements.slice(0, 2).map((s, i) => (
                      <div key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', display: 'flex', gap: 6, marginBottom: 2 }}>
                        <span style={{ color: 'var(--primary)' }}>→</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={handleNext} style={{ width: '100%', padding: '12px 0', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}>
                  {isLast ? 'Ver resultado final →' : 'Siguiente →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── DONE ── */}
        {phase === 'done' && (
          <ResultScreen
            answers={allAnswers}
            onRestart={handleRestart}
            onDashboard={() => navigate('/dashboard')}
          />
        )}
      </main>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin    { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
