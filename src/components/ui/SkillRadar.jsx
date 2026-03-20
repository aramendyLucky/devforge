// ─── SkillRadar — gráfico de araña por categoría ─────────
// Usa SVG puro, sin dependencias externas

const CATEGORIES = [
  { id: 'backend',     label: 'Backend'     },
  { id: 'cloud',       label: 'Cloud'       },
  { id: 'devops',      label: 'DevOps'      },
  { id: 'database',    label: 'Database'    },
  { id: 'frontend',    label: 'Frontend'    },
  { id: 'ai',          label: 'AI'          },
  { id: 'methodology', label: 'Methodology' },
]

function polarToXY(angle, radius, cx, cy) {
  const rad = (angle - 90) * (Math.PI / 180)
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

export default function SkillRadar({ progress = {}, topics = [] }) {
  const size   = 260
  const cx     = size / 2
  const cy     = size / 2
  const maxR   = 90
  const levels = [0.25, 0.5, 0.75, 1]
  const n      = CATEGORIES.length
  const step   = 360 / n

  // Calcular score por categoría (0–1)
  function getCategoryScore(catId) {
    const catTopics = topics.filter(t => t.category === catId)
    if (!catTopics.length) return 0
    const total = catTopics.reduce((acc, t) => {
      const p = progress[t.id]
      if (!p || !p.total) return acc
      return acc + (p.completed / p.total)
    }, 0)
    return total / catTopics.length
  }

  const scores = CATEGORIES.map(c => getCategoryScore(c.id))

  // Puntos del polígono de datos
  const dataPoints = CATEGORIES.map((_, i) => {
    const angle = i * step
    const r     = scores[i] * maxR
    return polarToXY(angle, r, cx, cy)
  })
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} style={{ overflow: 'visible' }}>

        {/* Anillos de referencia */}
        {levels.map((l, li) => {
          const pts = CATEGORIES.map((_, i) => polarToXY(i * step, l * maxR, cx, cy))
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
          return (
            <path key={li} d={path} fill="none" stroke="var(--border)" strokeWidth={1} />
          )
        })}

        {/* Ejes */}
        {CATEGORIES.map((_, i) => {
          const end = polarToXY(i * step, maxR, cx, cy)
          return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="var(--border)" strokeWidth={1} />
        })}

        {/* Polígono de datos */}
        <path d={dataPath} fill="var(--primary)" fillOpacity={0.18} stroke="var(--primary)" strokeWidth={2} />

        {/* Puntos en los vértices */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--primary)" />
        ))}

        {/* Etiquetas */}
        {CATEGORIES.map((cat, i) => {
          const angle  = i * step
          const labelR = maxR + 22
          const pos    = polarToXY(angle, labelR, cx, cy)
          const score  = Math.round(scores[i] * 100)
          return (
            <g key={i}>
              <text
                x={pos.x} y={pos.y - 4}
                textAnchor="middle"
                style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, fill: 'var(--subtle)', textTransform: 'uppercase' }}
              >
                {cat.label}
              </text>
              <text
                x={pos.x} y={pos.y + 10}
                textAnchor="middle"
                style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, fill: score > 0 ? 'var(--primary)' : 'var(--muted)' }}
              >
                {score}%
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
