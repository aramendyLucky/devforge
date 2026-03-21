import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store/index.jsx'
import { getTopicById, TOPICS } from '../data/topics.js'
import { useTranslation } from 'react-i18next'
import Header from '../components/ui/Header.jsx'

function scoreColor(s) {
  if (s == null) return 'var(--subtle)'
  if (s >= 8) return 'var(--green)'
  if (s >= 5) return 'var(--primary)'
  return 'var(--red)'
}

function scoreLabel(s, t) {
  if (s == null) return '—'
  if (s >= 8) return t('interview.scoreExcellent')
  if (s >= 5) return t('interview.scoreGood')
  return t('interview.scoreNeedsWork')
}

function formatDuration(start, end) {
  if (!start || !end) return '—'
  const mins = Math.round((new Date(end) - new Date(start)) / 60000)
  return `${mins} min`
}

function Divider({ children }) {
  return (
    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '32px 0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
    </div>
  )
}

// ─── Score circular grande ────────────────────────────────
function ScoreCircle({ score, size = 120 }) {
  const r     = size / 2 - 8
  const circ  = 2 * Math.PI * r
  const dash  = circ * (score / 10)
  const color = scoreColor(score)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="butt" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: size * 0.28, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: size * 0.09, color: 'var(--subtle)' }}>/10</div>
      </div>
    </div>
  )
}

// ─── Score por categoría ──────────────────────────────────
function CategoryBreakdown({ answers }) {
  const byCategory = {}

  answers.forEach(a => {
    if (a.skipped || !a.topicId) return
    const topic = getTopicById(a.topicId)
    if (!topic) return
    const cat = topic.category
    if (!byCategory[cat]) byCategory[cat] = { scores: [], name: cat, icon: getCatIcon(cat) }
    if (a.score != null) byCategory[cat].scores.push(a.score)
  })

  const entries = Object.values(byCategory).map(c => ({
    ...c,
    avg: c.scores.length ? Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length) : null,
    count: c.scores.length,
  })).sort((a, b) => (b.avg || 0) - (a.avg || 0))

  if (!entries.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(c => (
        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{c.icon}</span>
          <div style={{ width: 80, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text)', flexShrink: 0, textTransform: 'capitalize' }}>{c.name}</div>
          <div style={{ flex: 1, height: 20, background: 'var(--surface)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: c.avg != null ? `${(c.avg / 10) * 100}%` : '0%', height: '100%', background: scoreColor(c.avg), opacity: 0.85, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: scoreColor(c.avg), width: 28, textAlign: 'right', flexShrink: 0 }}>
            {c.avg != null ? c.avg : '—'}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', width: 40, flexShrink: 0 }}>
            {c.count}p
          </div>
        </div>
      ))}
    </div>
  )
}

function getCatIcon(cat) {
  const m = { backend:'⚙️', frontend:'🖥️', cloud:'☁️', database:'🗄️', devops:'🔧', ai:'🤖', methodology:'📋' }
  return m[cat] || '📌'
}

// ─── Puntos fuertes y débiles ─────────────────────────────
function InsightPanel({ answers }) {
  const { t }    = useTranslation()
  const answered = answers.filter(a => !a.skipped && a.score != null)
  if (!answered.length) return null

  const sorted   = [...answered].sort((a, b) => (b.score || 0) - (a.score || 0))
  const top3     = sorted.slice(0, 3)
  const bottom3  = sorted.slice(-3).reverse()

  const allKeyMissing = answered
    .filter(a => a.feedback?.keyMissing)
    .map(a => a.feedback.keyMissing)

  // Frecuencia de conceptos faltantes
  const freq = {}
  allKeyMissing.forEach(k => { freq[k] = (freq[k] || 0) + 1 })
  const topMissing = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <div className="forge-insights-grid">

      {/* Fortalezas */}
      <div style={{ background: 'var(--surface)', borderLeft: '3px solid var(--green)', padding: '14px 16px' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
          {t('interview.bestAnswers')}
        </div>
        {top3.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: scoreColor(a.score), flexShrink: 0, width: 22 }}>{a.score}</div>
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginBottom: 2 }}>{a.topicIcon} {a.topicName}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--text)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.question}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Áreas de mejora */}
      <div style={{ background: 'var(--surface)', borderLeft: '3px solid var(--red)', padding: '14px 16px' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
          {t('interview.reinforce')}
        </div>
        {bottom3.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: scoreColor(a.score), flexShrink: 0, width: 22 }}>{a.score}</div>
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginBottom: 2 }}>{a.topicIcon} {a.topicName}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--text)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.question}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Conceptos clave faltantes */}
      {topMissing.length > 0 && (
        <div style={{ gridColumn: '1 / -1', background: 'var(--surface)', borderLeft: '3px solid var(--primary)', padding: '14px 16px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
            {t('interview.missingConcepts')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topMissing.map(([concept, count], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', width: 16, textAlign: 'center', flexShrink: 0 }}>
                  {count}×
                </div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', flex: 1 }}>
                  {concept}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Detalle pregunta por pregunta ────────────────────────
function AnswerDetail({ answers }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {answers.map((a, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${a.skipped ? 'var(--border)' : scoreColor(a.score)}22`, padding: '12px 16px', opacity: a.skipped ? 0.6 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

            {/* Score */}
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: a.skipped ? 'var(--muted)' : scoreColor(a.score), width: 28, flexShrink: 0, textAlign: 'center', marginTop: 2 }}>
              {a.skipped ? '—' : a.score}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Meta */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>{a.topicIcon} {a.topicName}</span>
                {a.skipped && <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '1px 5px', border: '1px solid var(--muted)', color: 'var(--subtle)' }}>{t('interview.skipped')}</span>}
                {!a.skipped && <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: scoreColor(a.score) }}>{scoreLabel(a.score, t)}</span>}
              </div>

              {/* Pregunta */}
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', lineHeight: 1.5, margin: '0 0 6px' }}>
                {a.question}
              </p>

              {/* Key missing */}
              {a.feedback?.keyMissing && (
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)', borderLeft: '2px solid var(--primary)', paddingLeft: 8, margin: 0, lineHeight: 1.5 }}>
                  💡 {a.feedback.keyMissing}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Comparativa con entrevistas anteriores ───────────────
function HistoryComparison({ interviews, currentAvg }) {
  const { t } = useTranslation()
  if (interviews.length < 2) return null

  const last5 = interviews.slice(0, 5)

  return (
    <div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        {t('interview.evolution', { count: last5.length })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60 }}>
        {last5.reverse().map((iv, i) => {
          const answered = (iv.answers || []).filter(a => !a.skipped && a.score != null)
          const avg = answered.length ? Math.round(answered.reduce((a, b) => a + (b.score || 0), 0) / answered.length) : 0
          const isLast = i === last5.length - 1
          const h = Math.max(8, (avg / 10) * 50)
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: isLast ? 'var(--primary)' : 'var(--subtle)' }}>{avg}</span>
              <div style={{ width: '100%', height: h, background: isLast ? 'var(--primary)' : 'var(--border)', borderRadius: 1, transition: 'height 0.4s' }} />
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--muted)' }}>#{i + 1}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── InterviewResults principal ───────────────────────────
export default function InterviewResults() {
  const { t }      = useTranslation()
  const navigate   = useNavigate()
  const location   = useLocation()
  const { state }  = useStore()

  const interview  = location.state?.interview
  const interviews = state.interviews || []

  if (!interview) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)', marginBottom: 16 }}>{t('interview.noConfig')}</p>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{t('history.backDashboard')}</button>
        </div>
      </div>
    )
  }

  const answers   = interview.answers || []
  const answered  = answers.filter(a => !a.skipped && a.score != null)
  const skipped   = answers.filter(a => a.skipped)
  const avg       = answered.length ? Math.round(answered.reduce((a, b) => a + (b.score || 0), 0) / answered.length) : 0
  const pct80     = answered.filter(a => a.score >= 8).length
  const pct50     = answered.filter(a => a.score >= 5 && a.score < 8).length
  const pctLow    = answered.filter(a => a.score < 5).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      <Header backTo="/dashboard" backLabel="Dashboard" />

      <main className="forge-main forge-main-lg">

        {/* ── Resultado global ── */}
        <div className="forge-score-hero" style={{ background: 'var(--surface)', border: `2px solid ${scoreColor(avg)}`, padding: '24px 28px', marginBottom: 8 }}>
          <ScoreCircle score={avg} size={110} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('interview.resultLabel')}
            </div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: 'var(--text)', margin: '0 0 8px' }}>
              {avg >= 8 ? t('interview.resultExcellent') : avg >= 6 ? t('interview.resultGood') : avg >= 4 ? t('interview.resultMedium') : t('interview.resultLow')}
            </h1>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', rowGap: 10 }}>
              {[
                { label: t('interview.answeredLabel'), value: answered.length },
                { label: t('interview.skippedLabel'), value: skipped.length  },
                { label: t('interview.durationResultLabel'), value: formatDuration(interview.startedAt, interview.endedAt) },
                { label: t('interview.levelLabel'), value: interview.difficulty === 'basic' ? t('interview.levelJunior') : interview.difficulty === 'senior' ? t('interview.levelSenior') : t('interview.levelMid') },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>{s.value}</div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Distribución de scores */}
        <div className="forge-grid-3" style={{ marginBottom: 8 }}>
          {[
            { label: t('interview.scoreDistExcellent'), count: pct80,  color: 'var(--green)'   },
            { label: t('interview.scoreDistAcceptable'), count: pct50, color: 'var(--primary)' },
            { label: t('interview.scoreDistNeedsWork'),  count: pctLow, color: 'var(--red)'    },
          ].map(d => (
            <div key={d.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: d.color }}>{d.count}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>{d.label}</div>
            </div>
          ))}
        </div>

        {/* ── Score por categoría ── */}
        <Divider>{t('interview.scorePerCategory')}</Divider>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 8 }}>
          <CategoryBreakdown answers={answers} />
        </div>

        {/* ── Insights ── */}
        <Divider>{t('interview.strengthsWeaknesses')}</Divider>
        <InsightPanel answers={answers} />

        {/* ── Comparativa histórica ── */}
        {interviews.length >= 2 && (
          <>
            <Divider>{t('interview.historicalEvolution')}</Divider>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 20px' }}>
              <HistoryComparison interviews={interviews} currentAvg={avg} />
            </div>
          </>
        )}

        {/* ── Detalle completo ── */}
        <Divider>{t('interview.questionDetail')}</Divider>
        <AnswerDetail answers={answers} />

        {/* ── Acciones ── */}
        <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
          <button
            onClick={() => navigate('/interview-setup')}
            style={{ flex: 1, padding: '13px 0', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            {t('interview.newInterview')}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ flex: 1, padding: '13px 0', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}
          >
            {t('common.dashboard')}
          </button>
        </div>

      </main>

      <footer className="forge-footer" style={{ marginTop: 20 }}>
        <span>{t('history.footer')}</span>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>{t('history.backDashboard')}</button>
      </footer>
    </div>
  )
}
