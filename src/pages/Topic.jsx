import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProgress } from '../hooks/useProgress.js'
import { getTopicById, TOPICS } from '../data/topics.js'
import { getQuestions, DIFFICULTY_LABEL } from '../data/questions.js'
import { getWeekForTopic, ROADMAP } from '../data/roadmap.js'
import Header from '../components/ui/Header.jsx'
import ResourcePanel from '../components/ui/ResourcePanel.jsx'

const DIFF_COLOR  = { basic: 'var(--green)', mid: 'var(--primary)', senior: 'var(--red)' }
const CAT_ICONS   = { backend:'⚙️', frontend:'🖥️', cloud:'☁️', database:'🗄️', devops:'🔧', ai:'🤖', methodology:'📋' }

function scoreColor(s) {
  if (!s) return 'var(--subtle)'
  if (s >= 8) return 'var(--green)'
  if (s >= 5) return 'var(--primary)'
  return 'var(--red)'
}

function Divider({ children }) {
  return (
    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
    </div>
  )
}

// ─── Fila de pregunta ─────────────────────────────────────
function QuestionRow({ q, index, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={() => onClick(q)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--card)' : 'var(--surface)',
        border: `1px solid ${hovered ? 'var(--primary)' : 'var(--border)'}`,
        padding: '12px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', width: 20, flexShrink: 0, marginTop: 2 }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: `1px solid ${DIFF_COLOR[q.difficulty]}`, color: DIFF_COLOR[q.difficulty] }}>
            {DIFFICULTY_LABEL[q.difficulty]}
          </span>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: '1px solid var(--border)', color: 'var(--subtle)', textTransform: 'uppercase' }}>
            {q.type}
          </span>
        </div>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
          {q.question}
        </p>
      </div>
      <span style={{ color: hovered ? 'var(--primary)' : 'var(--muted)', fontSize: 14, flexShrink: 0, marginTop: 2, transition: 'color 0.15s' }}>→</span>
    </div>
  )
}

// ─── Temas relacionados ───────────────────────────────────
function RelatedTopics({ topicId }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const current  = getTopicById(topicId)
  if (!current) return null

  const related = TOPICS.filter(t =>
    t.id !== topicId && (t.category === current.category || t.tier === current.tier)
  ).slice(0, 4)

  if (!related.length) return null

  return (
    <div>
      <Divider>{t('topic.relatedTopics')}</Divider>
      <div className="forge-grid-2">
        {related.map(t => (
          <div
            key={t.id}
            onClick={() => navigate(`/topic/${t.id}`)}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{t.name}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>Tier {t.tier} · {t.category}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Topic principal ──────────────────────────────────────
export default function Topic() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { getTopicProgress } = useProgress()
  const [activeFilter, setActiveFilter] = useState('all')
  const [resourcePanelOpen, setResourcePanelOpen] = useState(false)

  const topic = getTopicById(id)

  if (!topic) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--subtle)', marginBottom: 16 }}>{t('topic.notFound')}</p>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>{t('topic.backDashboard')}</button>
        </div>
      </div>
    )
  }

  const allQuestions = getQuestions(topic.id)
  const filtered     = activeFilter === 'all' ? allQuestions : allQuestions.filter(q => q.difficulty === activeFilter)
  const basic        = allQuestions.filter(q => q.difficulty === 'basic')
  const mid          = allQuestions.filter(q => q.difficulty === 'mid')
  const senior       = allQuestions.filter(q => q.difficulty === 'senior')
  const progress     = getTopicProgress(topic.id)
  const weekNum      = getWeekForTopic(topic.id)
  const week         = weekNum ? ROADMAP.find(w => w.week === weekNum) : null
  const pct          = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0

  function startQuestion(q) {
    navigate('/session', { state: { topicId: topic.id, questionId: q.id } })
  }

  function startAll(difficulty = null) {
    navigate('/session', { state: { topicId: topic.id, difficulty } })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      {resourcePanelOpen && (
        <ResourcePanel topic={topic} onClose={() => setResourcePanelOpen(false)} />
      )}

      <Header
        backTo="/dashboard"
        backLabel="Dashboard"
        rightContent={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setResourcePanelOpen(true)}
              style={{ padding: '7px 13px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--subtle)' }}
              title={t('common.resources')}
            >
              <span style={{ fontSize: 14 }}>📚</span>
              <span>{t('topic.resources')}</span>
            </button>
            <button onClick={() => startAll(null)} style={{ padding: '7px 16px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12 }}>
              {t('topic.practiceAll')}
            </button>
          </div>
        }
      />

      <main className="forge-main forge-main-lg">

        {/* ── Hero del tema ── */}
        <div style={{ marginBottom: 32, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 48, lineHeight: 1 }}>{topic.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 7px', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
                  TIER {topic.tier} — {topic.tier === 1 ? t('topic.tierCritical') : topic.tier === 2 ? t('topic.tierImportant') : t('topic.tierDifferentiator')}
                </span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 7px', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
                  {CAT_ICONS[topic.category]} {topic.category.toUpperCase()}
                </span>
                {week && (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 7px', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
                    SEMANA {weekNum}
                  </span>
                )}
                {topic.offers?.map(n => (
                  <span key={n} style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 7px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(var(--primary-rgb, 245,158,11),0.08)' }}>
                    OFERTA {n}
                  </span>
                ))}
              </div>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text)', margin: '0 0 8px' }}>
                {topic.name}
              </h1>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', lineHeight: 1.7, margin: 0 }}>
                {topic.description}
              </p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('topic.progress')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>
                  {t('topic.questionsCount', { completed: progress.completed || 0, total: allQuestions.length })}
                </span>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: pct >= 80 ? 'var(--green)' : 'var(--primary)' }}>{pct}%</span>
              </div>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--muted)', borderRadius: 3 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? 'var(--green)' : 'var(--primary)', borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            {progress.lastScore && (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: scoreColor(progress.lastScore), marginTop: 6 }}>
                {t('topic.lastScore', { score: progress.lastScore })}
              </div>
            )}
          </div>
        </div>

        {/* ── Acciones rápidas por dificultad ── */}
        <div className="forge-grid-3" style={{ marginBottom: 8 }}>
          {[
            { diff: 'basic',  labelKey: 'topic.basic',  count: basic.length,  icon: '🟢' },
            { diff: 'mid',    labelKey: 'topic.mid',    count: mid.length,    icon: '🟡' },
            { diff: 'senior', labelKey: 'topic.senior', count: senior.length, icon: '🔴' },
          ].map(d => (
            <button
              key={d.diff}
              onClick={() => startAll(d.diff)}
              disabled={!d.count}
              style={{ padding: '12px 8px', background: 'var(--surface)', border: `1px solid ${activeFilter === d.diff ? DIFF_COLOR[d.diff] : 'var(--border)'}`, color: d.count ? 'var(--text)' : 'var(--muted)', cursor: d.count ? 'pointer' : 'default', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, transition: 'border-color 0.15s', textAlign: 'center' }}
              onMouseEnter={e => { if (d.count) e.currentTarget.style.borderColor = DIFF_COLOR[d.diff] }}
              onMouseLeave={e => { if (d.count) e.currentTarget.style.borderColor = activeFilter === d.diff ? DIFF_COLOR[d.diff] : 'var(--border)' }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{d.icon}</div>
              <div>{t(d.labelKey)}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', marginTop: 2 }}>{t('topic.questionsNum', { count: d.count })}</div>
            </button>
          ))}
        </div>

        {/* ── Modo IA ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)', border: '1px solid var(--primary)', padding: '2px 8px', whiteSpace: 'nowrap' }}>{t('topic.aiMode')}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
            {['basic', 'mid', 'senior'].map(diff => (
              <button
                key={diff}
                onClick={() => navigate('/session', { state: { topicId: topic.id, difficulty: diff, aiMode: true } })}
                style={{ padding: '5px 12px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--subtle)' }}
              >
                {diff === 'basic' ? t('topic.basic') : diff === 'mid' ? t('topic.mid') : t('topic.senior')}
              </button>
            ))}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
            {t('topic.aiModeDesc2')}
          </div>
        </div>

        {/* ── Entrevistador difícil ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--red)', border: '1px solid var(--red)', padding: '2px 8px', whiteSpace: 'nowrap' }}>{t('topic.hardMode')}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
            {['mid', 'senior'].map(diff => (
              <button
                key={diff}
                onClick={() => navigate('/session', { state: { topicId: topic.id, difficulty: diff, aiMode: true, hardMode: true } })}
                style={{ padding: '5px 12px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--subtle)' }}
              >
                {diff === 'mid' ? t('topic.mid') : t('topic.senior')}
              </button>
            ))}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
            {t('topic.hardModeDesc2')}
          </div>
        </div>

        {/* ── Filtros ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['all', 'basic', 'mid', 'senior'].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{ padding: '5px 12px', background: activeFilter === f ? 'var(--primary)' : 'var(--surface)', border: `1px solid ${activeFilter === f ? 'var(--primary)' : 'var(--border)'}`, color: activeFilter === f ? '#000' : 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10, fontWeight: activeFilter === f ? 700 : 400, transition: 'all 0.15s', textTransform: 'uppercase' }}
            >
              {f === 'all'
                ? t('topic.allFilter', { count: allQuestions.length })
                : `${DIFFICULTY_LABEL[f]} (${allQuestions.filter(q => q.difficulty === f).length})`}
            </button>
          ))}
        </div>

        {/* ── Lista de preguntas ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 40 }}>
          {filtered.map((q, i) => (
            <QuestionRow key={q.id} q={q} index={i} onClick={startQuestion} />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--subtle)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {t('topic.noQuestionsFilter')}
            </div>
          )}
        </div>

        {/* ── Temas relacionados ── */}
        <RelatedTopics topicId={id} />

      </main>

      <footer className="forge-footer">
        <span>DevForge</span>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>{t('topic.backDashboard')}</button>
      </footer>

      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  )
}
