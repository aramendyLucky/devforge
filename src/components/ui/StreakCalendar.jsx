// ─── StreakCalendar — últimos 35 días ─────────────────────

export default function StreakCalendar({ streakDays = [] }) {
  const today    = new Date()
  const days     = []

  // Generar últimos 35 días (5 semanas)
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    days.push({
      iso,
      day:     d.getDate(),
      month:   d.toLocaleString('es-AR', { month: 'short' }),
      isToday: i === 0,
      active:  streakDays.includes(iso),
    })
  }

  // Agrupar en semanas de 7
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const totalActive = streakDays.length

  // Racha actual
  let streak = 0
  for (let i = 0; i < days.length; i++) {
    const d = days[days.length - 1 - i]
    if (d.active) streak++
    else break
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
        <div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: streak > 0 ? 'var(--primary)' : 'var(--subtle)' }}>{streak}</span>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginLeft: 6 }}>racha actual</span>
        </div>
        <div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)' }}>{totalActive}</span>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--subtle)', marginLeft: 6 }}>días totales</span>
        </div>
      </div>

      {/* Grid de días */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', gap: 4 }}>
            {week.map((d, di) => (
              <div
                key={di}
                title={d.iso}
                style={{
                  width: 28, height: 28,
                  background: d.active
                    ? 'var(--primary)'
                    : d.isToday
                    ? 'var(--surface)'
                    : 'var(--card)',
                  border: d.isToday
                    ? '1px solid var(--primary)'
                    : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 2,
                  transition: 'background 0.2s',
                  position: 'relative',
                  opacity: d.active ? 1 : 0.5,
                }}
              >
                <span style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 8,
                  color: d.active ? '#000' : 'var(--subtle)',
                  fontWeight: d.active ? 700 : 400,
                }}>
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <div style={{ width: 10, height: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 1 }} />
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>Sin actividad</span>
        <div style={{ width: 10, height: 10, background: 'var(--primary)', borderRadius: 1, marginLeft: 8 }} />
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)' }}>Día activo</span>
      </div>
    </div>
  )
}
