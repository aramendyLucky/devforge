import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, ACTIONS } from '../store/index.jsx'
import { useProgress } from '../hooks/useProgress.js'
import { useRecommendations } from '../hooks/useRecommendations.js'
import { useTheme } from '../components/ui/ThemeSwitcher.jsx'
import { TOPICS, getTopicsByTier, ALL_TOPIC_IDS } from '../data/topics.js'
import { getQuestionCount } from '../data/questions.js'
import { ROADMAP } from '../data/roadmap.js'
import Header from '../components/ui/Header.jsx'
import SkillRadar from '../components/ui/SkillRadar.jsx'
import StreakCalendar from '../components/ui/StreakCalendar.jsx'
import { useTranslation } from 'react-i18next'

// ─── Helpers ──────────────────────────────────────────────
function getDaysLeft(d) {
  if (!d) return null
  return Math.ceil((new Date(d) - new Date()) / 86400000)
}
function getStreak(days = []) {
  if (!days.length) return 0
  const sorted = [...days].sort().reverse()
  let streak = 0, cur = new Date()
  for (const day of sorted) {
    if (day === cur.toISOString().split('T')[0]) { streak++; cur.setDate(cur.getDate()-1) } else break
  }
  return streak
}
function scoreColor(s) {
  if (!s) return 'var(--subtle)'
  if (s >= 8) return 'var(--green)'
  if (s >= 5) return 'var(--primary)'
  return 'var(--red)'
}

// ─── Stat card ────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: accent ? 'var(--primary)' : 'var(--text)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: sub ? 4 : 0 }}>{label}</div>
      {sub && <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────
function TopicCard({ topic, progress, recommended }) {
  const navigate = useNavigate()
  const pct   = progress?.total ? Math.round((progress.completed / progress.total) * 100) : 0
  const total = getQuestionCount(topic.id)
  return (
    <div
      onClick={() => navigate(`/topic/${topic.id}`)}
      style={{ background: 'var(--surface)', border: `1px solid ${recommended ? 'var(--primary)' : 'var(--border)'}`, padding: 14, cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = recommended ? 'var(--primary)' : 'var(--border)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>{topic.icon}</span>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{topic.name}</span>
        </div>
        {recommended && <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--primary)', border: '1px solid var(--primary)', padding: '1px 5px', flexShrink: 0 }}>HOY</span>}
      </div>
      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {topic.description}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)', border: '1px solid var(--primary)', padding: '1px 5px' }}>TIER {topic.tier}</span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)' }}>{progress?.completed || 0}/{total}</span>
      </div>
      <div style={{ width: '100%', height: 3, background: 'var(--muted)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? 'var(--green)' : 'var(--primary)', transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ─── Divisor con texto ────────────────────────────────────
function Divider({ children }) {
  return (
    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
    </div>
  )
}

// ─── Dashboard principal ──────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { state } = useStore()
  const { t } = useTranslation()
  const { progress, getOverallPercent } = useProgress()
  const { getTopRecommendations } = useRecommendations()

  const user            = state.user
  const config          = state.config
  const daysLeft        = getDaysLeft(user?.targetDate)
  const streak          = getStreak(config?.streakDays)
  const overallPct      = getOverallPercent(ALL_TOPIC_IDS)
  const recommendations = getTopRecommendations(3)
  const recommended     = recommendations[0]?.topic || TOPICS[0]
  const lastSession     = state.history?.[0]
  const currentWeek = ROADMAP.find(w => w.topics.some(id => { const p = progress[id]; return !p || p.completed < (p.total || 1) })) || ROADMAP[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      <Header
        rightContent={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/history')} className="forge-hide-sm" style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--subtle)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >{t('dashboard.sessions')}</button>
            <button onClick={() => navigate('/interview-history')} className="forge-hide-sm" style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--subtle)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >{t('dashboard.interviews')}</button>
            <button onClick={() => navigate(`/topic/${recommended.id}`)} style={{ padding: '7px 16px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12 }}>
              {t('dashboard.practice')}
            </button>
          </div>
        }
      />

      <main className="forge-main forge-main-xl">

        {/* ── Bienvenida ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{t('dashboard.label')}</div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text)', margin: 0 }}>
            {user?.name ? t('dashboard.greeting', { name: user.name }) : t('dashboard.title')}
          </h1>
          {user?.targetDate && daysLeft != null && (
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: daysLeft <= 7 ? 'var(--red)' : 'var(--subtle)', marginTop: 6 }}>
              {daysLeft > 0 ? t('dashboard.daysLeft', { count: daysLeft }) : t('dashboard.todayIsTheDay')}
            </p>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="forge-grid-4 forge-section">
          <StatCard label={t('dashboard.globalProgress')} value={`${overallPct}%`} sub={t('dashboard.topics', { count: ALL_TOPIC_IDS.length })} accent />
          <StatCard label={t('dashboard.streak')} value={streak > 0 ? `${streak}d` : '—'} sub={streak > 0 ? t('dashboard.streakDays') : t('dashboard.noStreak')} />
          <StatCard label={t('dashboard.daysToInterview')} value={daysLeft != null ? (daysLeft > 0 ? `${daysLeft}d` : '¡Hoy!') : '—'} sub={user?.targetDate ? new Date(user.targetDate).toLocaleDateString(state.config?.language === 'en' ? 'en-US' : 'es-AR') : '—'} accent={daysLeft != null && daysLeft <= 7} />
          <StatCard label={t('dashboard.lastSession')} value={lastSession ? `${lastSession.answers?.length || 0}` : '—'} sub={lastSession ? t('dashboard.questions') : t('dashboard.noSessions')} />
        </div>

        {/* ── Progreso general ── */}
        <div className="forge-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{t('dashboard.progressLabel')}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{overallPct}%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--muted)', borderRadius: 3 }}>
            <div style={{ width: `${overallPct}%`, height: '100%', background: 'var(--primary)', borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginTop: 6 }}>
            {overallPct < 20 && t('dashboard.progressMsg0')}
            {overallPct >= 20 && overallPct < 50 && t('dashboard.progressMsg25')}
            {overallPct >= 50 && overallPct < 80 && t('dashboard.progressMsg50')}
            {overallPct >= 80 && t('dashboard.progressMsg75')}
          </p>
        </div>

        {/* ── SkillRadar + Streak — dos columnas ── */}
        <div className="forge-grid-2-wide forge-section">

          {/* Radar */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px 24px' }}>
            <Divider>{t('dashboard.skillsMap')}</Divider>
            <SkillRadar progress={progress} topics={TOPICS} />
          </div>

          {/* Streak */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px 24px' }}>
            <Divider>{t('dashboard.activity')}</Divider>
            <StreakCalendar streakDays={config?.streakDays || []} />
          </div>
        </div>

        {/* ── Modos de práctica ── */}
        <div className="forge-grid-2 forge-section">

          {/* Repaso rápido */}
          <div
            onClick={() => navigate('/quick-review')}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: 8 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 24 }}>⚡</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: '1px solid var(--border)', color: 'var(--subtle)' }}>~10 MIN</span>
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{t('dashboard.quickReview')}</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5 }}>{t('dashboard.quickReviewDesc')}</div>
            <div style={{ marginTop: 4, fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)' }}>{t('common.start')}</div>
          </div>

          {/* Entrevista simulada */}
          <div
            onClick={() => navigate('/interview-setup')}
            style={{ background: 'var(--surface)', border: '1px solid var(--primary)', padding: '18px 20px', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', flexDirection: 'column', gap: 8 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 24 }}>🎯</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '2px 6px', border: '1px solid var(--primary)', color: 'var(--primary)' }}>20–60 MIN</span>
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{t('dashboard.mockInterview')}</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5 }}>{t('dashboard.mockInterviewDesc')}</div>
            <div style={{ marginTop: 4, fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)' }}>{t('dashboard.configure')}</div>
          </div>
        </div>

        {/* ── Recomendado ── */}
        <div className="forge-section">
          <Divider>{t('dashboard.recommended')}</Divider>

          {/* Card principal — top #1 */}
          <div
            onClick={() => navigate(`/topic/${recommended.id}`)}
            style={{ background: 'var(--surface)', border: '2px solid var(--primary)', padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 36, flexShrink: 0 }}>{recommended.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{t('dashboard.nextTopic')}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>{recommended.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {recommendations[0]?.reasons.map(r => (
                    <span key={r} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--primary)', border: '1px solid var(--primary)', padding: '1px 6px' }}>{r}</span>
                  ))}
                </div>
              </div>
            </div>
            <button style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {t('dashboard.begin')}
            </button>
          </div>

          {/* Cards secundarias — #2 y #3 */}
          {recommendations.length > 1 && (
            <div className="forge-grid-2">
              {recommendations.slice(1).map(({ topic: t, reasons }) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/topic/${t.id}`)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{t.icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 5 }}>{t.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {reasons.slice(0, 2).map(r => (
                        <span key={r} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)', border: '1px solid var(--border)', padding: '1px 5px' }}>{r}</span>
                      ))}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--primary)', flexShrink: 0 }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Temas por Tier ── */}
        {[1, 2, 3].map(tier => (
          <div key={tier} style={{ marginBottom: 40 }}>
            <Divider>{tier === 1 ? t('dashboard.tier1Label') : tier === 2 ? t('dashboard.tier2Label') : t('dashboard.tier3Label')}</Divider>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {getTopicsByTier(tier).map(topic => (
                <TopicCard key={topic.id} topic={topic} progress={progress[topic.id]} recommended={topic.id === recommended.id} />
              ))}
            </div>
          </div>
        ))}

        {/* ── Roadmap ── */}
        <div>
          <Divider>{t('dashboard.weekPlan')}</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {ROADMAP.map(w => {
              const isCurrent = w.week === currentWeek?.week
              const wTopics   = TOPICS.filter(t => w.topics.includes(t.id))
              return (
                <div key={w.week} style={{ background: 'var(--surface)', border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border)'}`, padding: 16 }}>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: isCurrent ? 'var(--primary)' : 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {t('dashboard.week', { num: w.week })}{isCurrent ? ` · ${t('dashboard.inProgress')}` : ''}
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>{w.title}</div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginBottom: 12, lineHeight: 1.5 }}>{w.description}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {wTopics.map(t => (
                      <button key={t.id} onClick={() => navigate(`/topic/${t.id}`)}
                        style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '3px 7px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--subtle)' }}
                      >
                        {t.icon} {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </main>

      <footer className="forge-footer" style={{ marginTop: 40 }}>
        <span>{t('dashboard.footer')}</span>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>{t('dashboard.footerHome')}</button>
      </footer>

    </div>
  )
}
