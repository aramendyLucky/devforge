import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.jsx'
import { getTopicById } from '../data/topics.js'
import Header from '../components/ui/Header.jsx'

function scoreColor(s) {
  if (s == null) return 'var(--subtle)'
  if (s >= 8) return 'var(--green)'
  if (s >= 5) return 'var(--primary)'
  return 'var(--red)'
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatDuration(start, end) {
  if (!start || !end) return '—'
  const mins = Math.round((new Date(end) - new Date(start)) / 60000)
  return `${mins} min`
}

function getAvg(answers = []) {
  const valid = answers.filter(a => !a.skipped && a.score != null)
  if (!valid.length) return null
  return Math.round(valid.reduce((a, b) => a + (b.score || 0), 0) / valid.length)
}

function Divider({ children }) {
  return (
    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
    </div>
  )
}

// ─── Mini sparkline de evolución ──────────────────────────
function Sparkline({ interviews }) {
  if (interviews.length < 2) return null
  const avgs  = interviews.map(iv => getAvg(iv.answers) || 0).reverse()
  const maxV  = Math.max(...avgs, 1)
  const w     = 120, h = 32
  const pts   = avgs.map((v, i) => {
    const x = (i / (avgs.length - 1)) * (w - 4) + 2
    const y = h - 2 - ((v / maxV) * (h - 4))
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
      {avgs.map((v, i) => {
        const x = (i / (avgs.length - 1)) * (w - 4) + 2
        const y = h - 2 - ((v / maxV) * (h - 4))
        return <circle key={i} cx={x} cy={y} r={i === avgs.length - 1 ? 4 : 2.5} fill={i === avgs.length - 1 ? 'var(--primary)' : 'var(--surface)'} stroke="var(--primary)" strokeWidth={1.5} />
      })}
    </svg>
  )
}

// ─── Card de entrevista ───────────────────────────────────
function InterviewCard({ interview, index, expanded, onExpand, onViewResults }) {
  const avg      = getAvg(interview.answers)
  const answered = (interview.answers || []).filter(a => !a.skipped)
  const skipped  = (interview.answers || []).filter(a => a.skipped)
  const levelMap = { basic: 'Junior', mixed: 'Mid-level', senior: 'Senior' }

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${expanded ? 'var(--primary)' : 'var(--border)'}`, marginBottom: 10, transition: 'border-color 0.2s' }}>

      {/* Header */}
      <div
        onClick={() => onExpand(index)}
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
      >
        {/* Score */}
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: scoreColor(avg), width: 42, textAlign: 'center', flexShrink: 0 }}>
          {avg != null ? avg : '—'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              🎯 Entrevista #{index + 1}
            </span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: '1px solid var(--border)', color: 'var(--subtle)', textTransform: 'uppercase' }}>
              {levelMap[interview.difficulty] || interview.difficulty}
            </span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
              {interview.duration} min
            </span>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>📅 {formatDate(interview.startedAt)}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>⏱ {formatDuration(interview.startedAt, interview.endedAt)}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>✅ {answered.length} resp · ⏭ {skipped.length} omitidas</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); onViewResults(interview) }}
            style={{ padding: '5px 12px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: 700 }}
          >
            Ver reporte
          </button>
          <span style={{ fontSize: 9, color: 'var(--subtle)', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>

      {/* Expandido */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px' }}>

          {/* Temas cubiertos */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Temas cubiertos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {(interview.topicIds || []).map(tid => {
                const t = getTopicById(tid)
                return t ? (
                  <span key={tid} style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 7px', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
                    {t.icon} {t.name}
                  </span>
                ) : null
              })}
            </div>
          </div>

          {/* Barras de score por pregunta */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Score por pregunta</div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 44 }}>
              {(interview.answers || []).map((a, i) => {
                const h = a.skipped ? 6 : Math.max(6, ((a.score || 0) / 10) * 36)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: a.skipped ? 'var(--muted)' : scoreColor(a.score) }}>
                      {a.skipped ? '—' : a.score || 0}
                    </span>
                    <div style={{ width: '100%', height: h, background: a.skipped ? 'var(--muted)' : scoreColor(a.score), borderRadius: 1, opacity: a.skipped ? 0.3 : 0.85 }} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Conceptos más faltantes */}
          {answered.some(a => a.feedback?.keyMissing) && (
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Conceptos a reforzar</div>
              {answered.filter(a => a.feedback?.keyMissing).slice(0, 3).map((a, i) => (
                <div key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)', display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span>💡</span><span>{a.feedback.keyMissing}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── InterviewHistory principal ───────────────────────────
export default function InterviewHistory() {
  const navigate   = useNavigate()
  const { state }  = useStore()
  const interviews = state.interviews || []
  const [expanded, setExpanded] = useState(null)

  function toggleExpand(i) {
    setExpanded(prev => prev === i ? null : i)
  }

  // Stats globales
  const totalInterviews = interviews.length
  const allAvgs = interviews.map(iv => getAvg(iv.answers)).filter(Boolean)
  const globalAvg = allAvgs.length ? Math.round(allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) : null
  const bestScore = allAvgs.length ? Math.max(...allAvgs) : null
  const trend = allAvgs.length >= 2
    ? allAvgs[0] > allAvgs[1] ? '↑ Mejorando' : allAvgs[0] < allAvgs[1] ? '↓ Bajando' : '→ Estable'
    : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      <Header backTo="/dashboard" backLabel="Dashboard" />

      <main className="forge-main forge-main-lg">

        {/* Título */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
            Entrevistas simuladas
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text)', margin: 0 }}>
            Historial de entrevistas
          </h1>
        </div>

        {/* Stats */}
        <div className="forge-grid-4" style={{ marginBottom: 32 }}>
          {[
            { label: 'Entrevistas',    value: totalInterviews,                       accent: true  },
            { label: 'Score promedio', value: globalAvg != null ? `${globalAvg}/10` : '—', accent: !!globalAvg },
            { label: 'Mejor score',    value: bestScore != null ? `${bestScore}/10` : '—' },
            { label: 'Tendencia',      value: trend || '—',                          accent: trend?.startsWith('↑') },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: s.accent ? 'var(--primary)' : 'var(--text)', marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Sparkline de evolución */}
        {interviews.length >= 2 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Evolución de scores</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: trend?.startsWith('↑') ? 'var(--green)' : trend?.startsWith('↓') ? 'var(--red)' : 'var(--subtle)' }}>
                {trend}
              </div>
            </div>
            <Sparkline interviews={interviews} />
          </div>
        )}

        {/* Lista */}
        {interviews.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>Sin entrevistas todavía</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', marginBottom: 24 }}>
              Completá tu primera entrevista simulada para verla acá.
            </div>
            <button
              onClick={() => navigate('/interview-setup')}
              style={{ padding: '10px 24px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}
            >
              Configurar entrevista →
            </button>
          </div>
        ) : (
          <div>
            <Divider>{totalInterviews} entrevista{totalInterviews !== 1 ? 's' : ''} · más reciente primero</Divider>
            {interviews.map((iv, i) => (
              <InterviewCard
                key={i}
                interview={iv}
                index={i}
                expanded={expanded === i}
                onExpand={toggleExpand}
                onViewResults={iv => navigate('/interview-results', { state: { interview: iv } })}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/interview-setup')}
            style={{ flex: 1, padding: '12px 0', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}
          >
            Nueva entrevista →
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ flex: 1, padding: '12px 0', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            Dashboard →
          </button>
        </div>

      </main>

      <footer className="forge-footer" style={{ marginTop: 20 }}>
        <span>DevForge</span>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>← Dashboard</button>
      </footer>
    </div>
  )
}
