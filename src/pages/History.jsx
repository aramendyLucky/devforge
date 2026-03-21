import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.jsx'
import { getTopicById } from '../data/topics.js'
import { useTranslation } from 'react-i18next'
import Header from '../components/ui/Header.jsx'

function formatDate(iso, lang = 'es') {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(start, end) {
  if (!start || !end) return '—'
  const mins = Math.round((new Date(end) - new Date(start)) / 60000)
  if (mins < 1) return '< 1 min'
  return `${mins} min`
}

function avgScore(answers = []) {
  if (!answers.length) return null
  return Math.round(answers.reduce((a, b) => a + (b.score || 0), 0) / answers.length)
}

function scoreColor(score) {
  if (score == null) return 'var(--subtle)'
  if (score >= 8) return 'var(--green)'
  if (score >= 5) return 'var(--primary)'
  return 'var(--red)'
}

function ScoreBadge({ score, size = 'md' }) {
  const color = scoreColor(score)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${color}`, color, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: size === 'lg' ? 22 : 13, padding: size === 'lg' ? '6px 14px' : '2px 7px', minWidth: size === 'lg' ? 54 : 32, flexShrink: 0 }}>
      {score != null ? score : '—'}
    </div>
  )
}

function ResumoStat({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 18px' }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: accent ? 'var(--primary)' : 'var(--text)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}

function SessionCard({ session, index, onExpand, expanded, lang }) {
  const { t }   = useTranslation()
  const topic   = getTopicById(session.topicId)
  const avg     = avgScore(session.answers)
  const answers = session.answers || []

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${expanded ? 'var(--primary)' : 'var(--border)'}`, marginBottom: 10, transition: 'border-color 0.2s' }}>

      <div onClick={() => onExpand(index)} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
        <ScoreBadge score={avg} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {topic?.icon} {topic?.name || session.topicId}
            </span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
              TIER {topic?.tier || '?'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>📅 {formatDate(session.startedAt, lang)}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>⏱ {formatDuration(session.startedAt, session.endedAt)}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>❓ {answers.length} {t('history.statQuestions').toLowerCase()}</span>
          </div>
        </div>
        <span style={{ fontSize: 9, color: 'var(--subtle)', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▼</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {answers.length > 0 ? (
            <div style={{ padding: '14px 18px' }}>
              {/* Gráfico de barras de scores */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 50, marginBottom: 16, padding: '0 0 4px' }}>
                {answers.map((a, i) => {
                  const h = Math.max(6, ((a.score || 0) / 10) * 40)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: scoreColor(a.score) }}>{a.score || 0}</span>
                      <div style={{ width: '100%', height: h, background: scoreColor(a.score), borderRadius: 1, opacity: 0.85 }} />
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)' }}>P{i+1}</span>
                    </div>
                  )
                })}
              </div>

              {/* Preguntas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {answers.map((a, i) => (
                  <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <ScoreBadge score={a.score} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text)', lineHeight: 1.5, margin: '0 0 6px' }}>
                        {a.question}
                      </p>
                      {a.feedback?.keyMissing && (
                        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)', borderLeft: '2px solid var(--primary)', paddingLeft: 8, margin: 0 }}>
                          💡 {a.feedback.keyMissing}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 16, fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', textAlign: 'center' }}>
              {t('history.noQuestionsRecorded')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function History() {
  const navigate  = useNavigate()
  const { state } = useStore()
  const { t }     = useTranslation()
  const history   = state.history || []
  const lang      = state.config?.language || 'es'
  const [expanded, setExpanded] = useState(null)

  const totalSesiones  = history.length
  const totalPreguntas = history.reduce((acc, s) => acc + (s.answers?.length || 0), 0)
  const allScores      = history.flatMap(s => (s.answers || []).map(a => a.score || 0)).filter(Boolean)
  const scoreGlobal    = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null
  const topicsCovered  = [...new Set(history.map(s => s.topicId).filter(Boolean))].length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      <Header backTo="/dashboard" backLabel="Dashboard" />

      <main className="forge-main forge-main-lg">

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{t('history.label')}</div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text)', margin: 0 }}>{t('history.title')}</h1>
        </div>

        <div className="forge-grid-4" style={{ marginBottom: 36 }}>
          <ResumoStat label={t('history.statSessions')} value={totalSesiones} accent />
          <ResumoStat label={t('history.statQuestions')} value={totalPreguntas} />
          <ResumoStat label={t('history.statAvgScore')} value={scoreGlobal != null ? `${scoreGlobal}/10` : '—'} accent={scoreGlobal != null} />
          <ResumoStat label={t('history.statTopics')} value={topicsCovered} />
        </div>

        {history.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>{t('history.empty').replace('📭 ', '')}</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', marginBottom: 24 }}>{t('history.emptyDesc')}</div>
            <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>
              {t('history.goDashboard')}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
              {totalSesiones} {t('history.statSessions').toLowerCase()}
              <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
            </div>
            {history.map((session, i) => (
              <SessionCard key={i} session={session} index={i} lang={lang} onExpand={i => setExpanded(prev => prev === i ? null : i)} expanded={expanded === i} />
            ))}
          </div>
        )}

      </main>

      <footer className="forge-footer">
        <span>{t('history.footer')}</span>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>{t('history.backDashboard')}</button>
      </footer>

    </div>
  )
}
