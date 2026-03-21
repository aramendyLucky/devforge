import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSession } from '../hooks/useSession.js'
import { useProgress } from '../hooks/useProgress.js'
import { useAI } from '../hooks/useAI.js'
import { getTopicById } from '../data/topics.js'
import { getQuestions, getQuestionCount, DIFFICULTY_LABEL } from '../data/questions.js'
import { useTranslation } from 'react-i18next'
import Header from '../components/ui/Header.jsx'

const AI_MAX_QUESTIONS = 8

const STATE = {
  GENERATING: 'generating',
  QUESTION:   'question',
  EVALUATING: 'evaluating',
  FEEDBACK:   'feedback',
  FOLLOWUP:   'followup',
  DONE:       'done',
}

const DIFF_COLOR = { basic: 'var(--green)', mid: 'var(--primary)', senior: 'var(--red)' }

function scoreColor(s) {
  if (s == null) return 'var(--subtle)'
  if (s >= 8) return 'var(--green)'
  if (s >= 5) return 'var(--primary)'
  return 'var(--red)'
}

// ─── Barra de progreso de sesión ──────────────────────────
function SessionProgress({ current, total }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div style={{ width: '100%', height: 3, background: 'var(--muted)' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ─── Hint pill ────────────────────────────────────────────
function HintCard({ hint, level }) {
  const { t } = useTranslation()
  const colors = ['var(--green)', 'var(--primary)', 'var(--red)']
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${colors[level - 1]}`, padding: '12px 16px', marginBottom: 12, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: colors[level - 1], textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
        {t('session.hint', { level })}
      </div>
      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
        {hint}
      </p>
    </div>
  )
}

// ─── Feedback card ────────────────────────────────────────
function FeedbackCard({ evaluation, userAnswer }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'slideUp 0.35s ease' }}>

      {/* Score grande */}
      <div style={{ background: 'var(--surface)', border: `2px solid ${scoreColor(evaluation.score)}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 48, color: scoreColor(evaluation.score), lineHeight: 1, flexShrink: 0 }}>
          {evaluation.score}
        </div>
        <div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{t('session.score')}</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            {evaluation.score >= 8 ? t('session.scoreExcellent') : evaluation.score >= 5 ? t('session.scoreGood') : t('session.scoreNeedsWork')}
          </div>
        </div>
      </div>

      {/* Tu respuesta */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '12px 16px' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{t('session.yourAnswer')}</div>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{userAnswer}</p>
      </div>

      {/* Qué estuvo bien */}
      {evaluation.strengths?.length > 0 && (
        <div style={{ background: 'var(--card)', borderLeft: `3px solid var(--green)`, padding: '12px 16px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{t('session.strengths')}</div>
          {evaluation.strengths.map((s, i) => (
            <div key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', display: 'flex', gap: 8, marginBottom: 4, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--green)', flexShrink: 0 }}>→</span><span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Qué mejorar */}
      {evaluation.improvements?.length > 0 && (
        <div style={{ background: 'var(--card)', borderLeft: `3px solid var(--primary)`, padding: '12px 16px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{t('session.improvements')}</div>
          {evaluation.improvements.map((s, i) => (
            <div key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', display: 'flex', gap: 8, marginBottom: 4, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--primary)', flexShrink: 0 }}>→</span><span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Concepto clave faltante */}
      {evaluation.keyMissing && (
        <div style={{ background: 'var(--card)', borderLeft: `3px solid var(--red)`, padding: '12px 16px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{t('session.missingConcept')}</div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{evaluation.keyMissing}</p>
        </div>
      )}

      {/* Follow-up */}
      {evaluation.followUp && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '12px 16px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{t('session.followUp')}</div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>"{evaluation.followUp}"</p>
        </div>
      )}
    </div>
  )
}

// ─── Pantalla final ───────────────────────────────────────
function DoneScreen({ answers, topic, onRestart, onDashboard, onHistory }) {
  const { t } = useTranslation()
  const avg = answers.length
    ? Math.round(answers.reduce((a, b) => a + (b.score || 0), 0) / answers.length) : 0
  const best  = answers.reduce((a, b) => (b.score || 0) > (a.score || 0) ? b : a, answers[0])
  const worst = answers.reduce((a, b) => (b.score || 0) < (a.score || 0) ? b : a, answers[0])

  return (
    <div style={{ animation: 'slideUp 0.4s ease' }}>

      {/* Header resultado */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{t('session.complete')}</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36, color: 'var(--text)', marginBottom: 12 }}>
          {avg >= 8 ? t('session.msgExcellent') : avg >= 5 ? t('session.msgGood') : t('session.msgKeepGoing')}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: `2px solid ${scoreColor(avg)}`, padding: '10px 24px' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)' }}>{t('session.avgScore')}</span>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: scoreColor(avg) }}>{avg}/10</span>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="forge-grid-3" style={{ marginBottom: 28 }}>
        {[
          { labelKey: 'session.questions', value: answers.length },
          { labelKey: 'session.bestScore', value: best?.score || '—' },
          { labelKey: 'session.topic', value: topic?.icon || '—' },
        ].map(s => (
          <div key={s.labelKey} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--primary)', marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t(s.labelKey)}</div>
          </div>
        ))}
      </div>

      {/* Resumen por pregunta con barras */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
          {t('session.resultPerQuestion')}
          <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
        </div>

        {/* Barras horizontales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {answers.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', width: 20, flexShrink: 0, textAlign: 'right' }}>P{i+1}</span>
              <div style={{ flex: 1, height: 20, background: 'var(--surface)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: `${((a.score || 0) / 10) * 100}%`, height: '100%', background: scoreColor(a.score), opacity: 0.8, transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: scoreColor(a.score), width: 22, flexShrink: 0 }}>{a.score || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Área de mejora */}
      {worst && worst.feedback?.keyMissing && (
        <div style={{ background: 'var(--surface)', border: `1px solid var(--primary)`, padding: '14px 18px', marginBottom: 28 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>📌 {t('session.mainImprovement')}</div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{worst.feedback.keyMissing}</p>
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRestart} style={{ flex: 1, padding: '12px 0', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >{t('session.anotherRound')}</button>
        <button onClick={onHistory} style={{ flex: 1, padding: '12px 0', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >{t('session.viewHistory')}</button>
        <button onClick={onDashboard} style={{ flex: 1, padding: '12px 0', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>
          {t('common.dashboard')}
        </button>
      </div>
    </div>
  )
}

// ─── Session principal ────────────────────────────────────
export default function Session() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { t }     = useTranslation()
  const { startSession, submitAnswer, endSession } = useSession()
  const { updateProgress } = useProgress()
  const { evaluateAnswer, getHint, generateQuestion, loading } = useAI()

  const { topicId, questionId, difficulty, aiMode, hardMode } = location.state || {}
  const isAIMode   = !!aiMode
  const isHardMode = !!hardMode
  const topic    = getTopicById(topicId)
  const allQs    = getQuestions(topicId, difficulty)
  const questions = isAIMode ? [] : (questionId ? allQs.filter(q => q.id === questionId) : allQs)

  const [uiState,        setUiState]        = useState(isAIMode ? STATE.GENERATING : STATE.QUESTION)
  const [qIndex,         setQIndex]         = useState(0)
  const [answer,         setAnswer]         = useState('')
  const [evaluation,     setEvaluation]     = useState(null)
  const [hints,          setHints]          = useState([])
  const [hintLevel,      setHintLevel]      = useState(1)
  const [localAnswers,   setLocalAnswers]   = useState([])
  const [entering,       setEntering]       = useState(true)
  const [aiQuestions,    setAiQuestions]    = useState([])
  const [lastKeyMissing, setLastKeyMissing] = useState(null)
  const [currentFollowUp, setCurrentFollowUp] = useState(null)
  const [followUpAnswer,  setFollowUpAnswer]  = useState('')
  const [followUpEval,    setFollowUpEval]    = useState(null)
  const [followUpCount,   setFollowUpCount]   = useState(0)
  const textareaRef = useRef(null)

  const activeQuestions = isAIMode ? aiQuestions : questions
  const currentQ = activeQuestions[qIndex]
  const isLast   = isAIMode
    ? localAnswers.length >= AI_MAX_QUESTIONS - 1
    : qIndex >= questions.length - 1
  const canContinueFollowUp = followUpEval && followUpEval.score < 8 && followUpEval.followUp && followUpCount < 2

  useEffect(() => {
    if (topicId) startSession(topicId)
    if (isAIMode) {
      generateQuestion({ topicId, topicName: topic?.name, difficulty: difficulty || 'mid' })
        .then(q => {
          if (q) setAiQuestions([q])
          setUiState(STATE.QUESTION)
        })
    }
    setTimeout(() => setEntering(false), 50)
  }, [])

  useEffect(() => {
    if (uiState === STATE.QUESTION) {
      setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [uiState, qIndex])

  if (!topic || (!isAIMode && !questions.length)) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)', marginBottom: 20 }}>{t('session.noQuestions')}</p>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  async function handleEvaluate() {
    if (answer.trim().length < 10) return
    setUiState(STATE.EVALUATING)
    const result = await evaluateAnswer({ question: currentQ.question, answer, topic: topic.name })
    if (result) {
      setEvaluation(result)
      if (isAIMode && result.keyMissing) setLastKeyMissing(result.keyMissing)
      const record = { question: currentQ.question, userAnswer: answer, score: result.score, feedback: result }
      submitAnswer(record)
      setLocalAnswers(prev => [...prev, record])
      const progressData = isAIMode
        ? { completed: localAnswers.length + 1, lastScore: result.score }
        : { completed: localAnswers.length + 1, total: getQuestionCount(topicId), lastScore: result.score }
      updateProgress(topicId, progressData)
      setUiState(STATE.FEEDBACK)
    } else {
      setUiState(STATE.QUESTION)
    }
  }

  async function handleHint() {
    if (hintLevel > 3) return
    const h = await getHint({ question: currentQ.question, topic: topic.name, hintLevel })
    if (h) setHints(prev => [...prev, { text: h, level: hintLevel }])
    setHintLevel(prev => prev + 1)
  }

  function handleStartFollowUp() {
    setCurrentFollowUp(evaluation.followUp)
    setUiState(STATE.FOLLOWUP)
  }

  async function handleFollowUpEvaluate() {
    if (followUpAnswer.trim().length < 10) return
    const result = await evaluateAnswer({
      question: currentFollowUp,
      answer:   followUpAnswer,
      topic:    topic.name,
    })
    if (result) {
      setFollowUpEval(result)
      setFollowUpCount(prev => prev + 1)
    }
  }

  function handleNextFollowUp() {
    setCurrentFollowUp(followUpEval.followUp)
    setFollowUpAnswer('')
    setFollowUpEval(null)
  }

  async function handleNext() {
    setCurrentFollowUp(null)
    setFollowUpAnswer('')
    setFollowUpEval(null)
    setFollowUpCount(0)
    if (isLast) {
      endSession()
      setUiState(STATE.DONE)
    } else if (isAIMode) {
      setEntering(true)
      setUiState(STATE.GENERATING)
      const nextQ = await generateQuestion({
        topicId,
        topicName: topic.name,
        difficulty: difficulty || 'mid',
        previousQuestions: aiQuestions.map(q => q.question),
        keyMissing: lastKeyMissing,
      })
      if (nextQ) setAiQuestions(prev => [...prev, nextQ])
      setQIndex(prev => prev + 1)
      setAnswer('')
      setEvaluation(null)
      setHints([])
      setHintLevel(1)
      setLastKeyMissing(null)
      setUiState(STATE.QUESTION)
      setTimeout(() => setEntering(false), 50)
    } else {
      setEntering(true)
      setTimeout(() => {
        setQIndex(prev => prev + 1)
        setAnswer('')
        setEvaluation(null)
        setHints([])
        setHintLevel(1)
        setUiState(STATE.QUESTION)
        setEntering(false)
      }, 200)
    }
  }

  async function handleRestart() {
    setQIndex(0)
    setAnswer('')
    setEvaluation(null)
    setHints([])
    setHintLevel(1)
    setLocalAnswers([])
    setLastKeyMissing(null)
    startSession(topicId)
    if (isAIMode) {
      setAiQuestions([])
      setUiState(STATE.GENERATING)
      const firstQ = await generateQuestion({ topicId, topicName: topic.name, difficulty: difficulty || 'mid' })
      if (firstQ) setAiQuestions([firstQ])
      setUiState(STATE.QUESTION)
    } else {
      setUiState(STATE.QUESTION)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      <Header
        backTo={`/topic/${topicId}`}
        backLabel={topic.name}
        rightContent={uiState !== STATE.DONE && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)' }}>
              {isAIMode ? `${qIndex + 1}/${AI_MAX_QUESTIONS} ✨` : `${qIndex + 1}/${questions.length}`}
            </span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 7px', border: `1px solid ${DIFF_COLOR[currentQ?.difficulty]}`, color: DIFF_COLOR[currentQ?.difficulty] }}>
              {DIFFICULTY_LABEL[currentQ?.difficulty]}
            </span>
          </div>
        )}
      />

      {uiState !== STATE.DONE && uiState !== STATE.GENERATING && (
        <SessionProgress current={qIndex} total={isAIMode ? AI_MAX_QUESTIONS : questions.length} />
      )}

      <main className="forge-main forge-main-md" style={{ opacity: entering ? 0 : 1, transform: entering ? 'translateY(8px)' : 'translateY(0)', transition: 'opacity 0.25s, transform 0.25s' }}>

        {/* ── GENERANDO ── */}
        {uiState === STATE.GENERATING && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '80px 0', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: 'var(--subtle)' }}>Generando pregunta con IA...</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--muted)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
              {lastKeyMissing
                ? `Enfocando en: "${lastKeyMissing}"`
                : 'Analizando tu historial para personalizar la pregunta'}
            </div>
          </div>
        )}

        {/* ── SEGUIMIENTO (modo difícil) ── */}
        {uiState === STATE.FOLLOWUP && currentQ && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* Contexto: pregunta original + respuesta */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Contexto</div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', margin: '0 0 10px', lineHeight: 1.5 }}>{currentQ.question}</p>
              <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>Tu respuesta</div>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--muted)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{answer}</p>
              </div>
            </div>

            {/* Pregunta de seguimiento */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--red)', border: '1px solid var(--red)', padding: '2px 8px' }}>
                  ⚡ SEGUIMIENTO {followUpCount + 1}/3
                </span>
              </div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
                {currentFollowUp}
              </h2>
            </div>

            {/* Sin evaluar: textarea + botones */}
            {!followUpEval ? (
              <div>
                <textarea
                  value={followUpAnswer}
                  onChange={e => setFollowUpAnswer(e.target.value)}
                  disabled={loading}
                  placeholder="Profundizá tu respuesta. El entrevistador quiere más detalle..."
                  style={{ width: '100%', minHeight: 140, padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${followUpAnswer.length > 10 ? 'var(--red)' : 'var(--border)'}`, color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 13, lineHeight: 1.7, resize: 'vertical', outline: 'none', transition: 'border-color 0.2s', marginBottom: 12, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleNext}
                    style={{ padding: '10px 16px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--muted)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--subtle)' }}
                  >
                    Omitir →
                  </button>
                  <button
                    onClick={handleFollowUpEvaluate}
                    disabled={followUpAnswer.trim().length < 10 || loading}
                    style={{ flex: 1, padding: '10px 0', background: followUpAnswer.trim().length < 10 ? 'var(--muted)' : 'var(--red)', border: 'none', color: '#fff', cursor: followUpAnswer.trim().length < 10 ? 'default' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}
                  >
                    {loading
                      ? <><span style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />Evaluando...</>
                      : '⚡ Responder →'}
                  </button>
                </div>
              </div>
            ) : (
              /* Ya evaluado: mini-feedback + opciones */
              <div style={{ animation: 'slideUp 0.3s ease' }}>
                <div style={{ background: 'var(--surface)', border: `2px solid ${scoreColor(followUpEval.score)}`, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36, color: scoreColor(followUpEval.score), lineHeight: 1, flexShrink: 0 }}>
                    {followUpEval.score}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: followUpEval.keyMissing ? 4 : 0 }}>
                      {followUpEval.score >= 8 ? 'El entrevistador queda conforme.' : followUpEval.score >= 5 ? 'Mejor, pero aún hay margen.' : 'Necesita más trabajo.'}
                    </div>
                    {followUpEval.keyMissing && (
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5 }}>{followUpEval.keyMissing}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  {canContinueFollowUp && (
                    <button
                      onClick={handleNextFollowUp}
                      style={{ flex: 1, padding: '11px 0', background: 'var(--surface)', border: '1px solid var(--red)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                    >
                      ⚡ Otro seguimiento →
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    style={{ flex: 1, padding: '11px 0', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}
                  >
                    {isLast ? 'Ver resumen final →' : 'Siguiente pregunta →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DONE ── */}
        {uiState === STATE.DONE && (
          <DoneScreen
            answers={localAnswers}
            topic={topic}
            onRestart={handleRestart}
            onDashboard={() => navigate('/dashboard')}
            onHistory={() => navigate('/history')}
          />
        )}

        {/* ── PREGUNTA / EVALUANDO / FEEDBACK ── */}
        {uiState !== STATE.DONE && uiState !== STATE.GENERATING && uiState !== STATE.FOLLOWUP && currentQ && (
          <div>

            {/* Número y tipo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)' }}>
                {String(qIndex + 1).padStart(2, '0')}
              </span>
              <span style={{ width: 24, height: 1, background: 'var(--border)', display: 'inline-block' }} />
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {currentQ.type}
              </span>
              {currentQ.isAI && (
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--primary)', border: '1px solid var(--primary)', padding: '1px 5px', marginLeft: 4 }}>✨ IA</span>
              )}
            </div>

            {/* Pregunta */}
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', lineHeight: 1.4, marginBottom: 24 }}>
              {currentQ.question}
            </h2>

            {/* Hints */}
            {hints.map((h, i) => <HintCard key={i} hint={h.text} level={h.level} />)}

            {/* Input */}
            {(uiState === STATE.QUESTION || uiState === STATE.EVALUATING) && (
              <div>
                <textarea
                  ref={textareaRef}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  disabled={uiState === STATE.EVALUATING}
                  placeholder="Escribí tu respuesta. Explicá tu razonamiento, no solo la definición..."
                  style={{ width: '100%', minHeight: 160, padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${answer.length > 10 ? 'var(--primary)' : 'var(--border)'}`, color: 'var(--text)', fontFamily: 'Space Mono, monospace', fontSize: 13, lineHeight: 1.7, resize: 'vertical', outline: 'none', transition: 'border-color 0.2s', marginBottom: 12, boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <button
                    onClick={handleHint}
                    disabled={loading || hintLevel > 3}
                    style={{ padding: '9px 16px', background: 'var(--card)', border: '1px solid var(--border)', color: hintLevel > 3 ? 'var(--muted)' : 'var(--subtle)', cursor: hintLevel > 3 ? 'default' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11, transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (hintLevel <= 3) e.currentTarget.style.borderColor = 'var(--primary)' }}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    {hintLevel > 3 ? 'Sin más pistas' : `💡 Pista${hintLevel > 1 ? ` ${hintLevel}` : ''}`}
                  </button>

                  <button
                    onClick={handleEvaluate}
                    disabled={answer.trim().length < 10 || uiState === STATE.EVALUATING}
                    style={{ padding: '9px 24px', background: answer.trim().length < 10 ? 'var(--muted)' : 'var(--primary)', border: 'none', color: '#000', cursor: answer.trim().length < 10 ? 'default' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s' }}
                  >
                    {uiState === STATE.EVALUATING ? (
                      <>
                        <span style={{ width: 12, height: 12, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                        Evaluando...
                      </>
                    ) : 'Evaluar respuesta →'}
                  </button>
                </div>

                {answer.trim().length > 0 && answer.trim().length < 10 && (
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginTop: 8 }}>
                    Escribí al menos una respuesta corta para evaluar.
                  </p>
                )}
              </div>
            )}

            {/* Feedback */}
            {uiState === STATE.FEEDBACK && evaluation && (
              <div>
                <FeedbackCard evaluation={evaluation} userAnswer={answer} />
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Hard mode: follow-up CTA */}
                  {isHardMode && !isLast && evaluation.followUp && evaluation.score < 8 && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--red)', padding: '14px 18px' }}>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>⚡ El entrevistador presiona</div>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', margin: '0 0 12px', fontStyle: 'italic', lineHeight: 1.6 }}>"{evaluation.followUp}"</p>
                      <button
                        onClick={handleStartFollowUp}
                        style={{ width: '100%', padding: '10px 0', background: 'var(--red)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}
                      >
                        ⚡ Responder seguimiento →
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleNext}
                    style={{
                      width: '100%', padding: '13px 0', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
                      background: isHardMode && !isLast && evaluation.followUp && evaluation.score < 8 ? 'var(--surface)' : 'var(--primary)',
                      border:     isHardMode && !isLast && evaluation.followUp && evaluation.score < 8 ? '1px solid var(--border)' : 'none',
                      color:      isHardMode && !isLast && evaluation.followUp && evaluation.score < 8 ? 'var(--subtle)' : '#000',
                    }}
                  >
                    {isLast
                      ? 'Ver resumen final →'
                      : isHardMode && evaluation.followUp && evaluation.score < 8
                        ? 'Omitir seguimiento →'
                        : 'Siguiente pregunta →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
