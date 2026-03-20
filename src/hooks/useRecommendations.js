import { useStore } from '../store/index.jsx'
import { TOPICS } from '../data/topics.js'

// ─── Pesos por tier ───────────────────────────────────────
const TIER_WEIGHT = { 1: 40, 2: 25, 3: 10 }

// ─── Helpers de cálculo ───────────────────────────────────
function daysSince(isoString) {
  if (!isoString) return Infinity
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000)
}

function recencyBonus(lastSeen) {
  const days = daysSince(lastSeen)
  if (days === Infinity) return 20  // nunca visto → urgencia máxima
  if (days >= 7)  return 20
  if (days >= 3)  return 12
  if (days >= 1)  return 5
  return 0                          // visto hoy
}

function selfAssessmentBonus(level) {
  // level: 1 (muy débil) → 5 (muy seguro)
  if (!level) return 0
  if (level <= 1) return 15
  if (level === 2) return 8
  if (level === 3) return 0
  if (level === 4) return -8
  return -15
}

// ─── Hook principal ───────────────────────────────────────
export function useRecommendations() {
  const { state } = useStore()
  const { progress, user } = state

  const daysLeft = user?.targetDate
    ? Math.ceil((new Date(user.targetDate) - new Date()) / 86400000)
    : null

  function scoreAndReason(topic) {
    const p           = progress[topic.id]
    const completed   = p?.completed ?? 0
    const total       = p?.total ?? 0
    const lastScore   = p?.lastScore ?? null
    const lastSeen    = p?.lastSeen ?? null
    const selfLevel   = user?.selfAssessment?.[topic.id]
    const inExtracted = Array.isArray(user?.extractedTopics)
      && user.extractedTopics.includes(topic.id)

    const completionRatio = total > 0 ? completed / total : 0

    let score = TIER_WEIGHT[topic.tier] ?? 10
    const reasons = []

    // 1. Debilidad por completado (máx +30)
    score += (1 - completionRatio) * 30
    if (completionRatio === 0)       reasons.push('Sin comenzar')
    else if (completionRatio < 0.5)  reasons.push('Progreso bajo')

    // 2. Score bajo en última sesión (máx +20)
    if (lastScore !== null) {
      if (lastScore < 5)      { score += 20; reasons.push(`Score bajo (${lastScore}/10)`) }
      else if (lastScore < 7) { score += 10; reasons.push(`Score regular (${lastScore}/10)`) }
    }

    // 3. Recencia — repetición espaciada (máx +20)
    const rec = recencyBonus(lastSeen)
    score += rec
    if (rec >= 12 && completionRatio > 0) {
      const days = daysSince(lastSeen)
      reasons.push(`Sin practicar hace ${days === Infinity ? 'mucho' : `${days}d`}`)
    }

    // 4. Relevancia para oferta objetivo (+15)
    if (inExtracted) {
      score += 15
      reasons.push('En tu oferta objetivo')
    }

    // 5. Autoevaluación del usuario
    const selfBonus = selfAssessmentBonus(selfLevel)
    score += selfBonus
    if (selfLevel && selfLevel <= 2) reasons.push('Autoevaluación baja')

    // 6. Urgencia: pocos días + tier crítico (+25)
    if (daysLeft !== null && daysLeft <= 14 && topic.tier === 1 && completionRatio < 0.8) {
      score += 25
      reasons.push('¡Crítico para tu entrevista!')
    } else if (topic.tier === 1 && completionRatio < 0.5) {
      reasons.push('Tema crítico')
    }

    // Fallback: al menos una razón visible
    if (reasons.length === 0) reasons.push('Buena práctica de repaso')

    return { topic, score, reasons }
  }

  // Devuelve los N temas con mayor score, ordenados
  function getTopRecommendations(count = 3) {
    return TOPICS
      .map(scoreAndReason)
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
  }

  // Score numérico de un tema específico (útil para ordenar listas externas)
  function getPriorityScore(topicId) {
    const topic = TOPICS.find(t => t.id === topicId)
    if (!topic) return 0
    return scoreAndReason(topic).score
  }

  return { getTopRecommendations, getPriorityScore }
}
