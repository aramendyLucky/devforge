// Orden recomendado de estudio según urgencia e impacto
// Basado en las 3 ofertas de referencia

export const ROADMAP = [
  {
    week: 1,
    title: 'Fundamentos Python & APIs',
    description: 'La base de las 3 ofertas. Sin esto, nada más funciona.',
    topics: ['python', 'apis'],
    milestone: 'Podés explicar cómo funciona Python y diseñar una API REST desde cero.',
  },
  {
    week: 2,
    title: 'Frameworks backend',
    description: 'Django/Flask para las ofertas 1 y 2. FastAPI para la oferta 3.',
    topics: ['django_flask', 'fastapi'],
    milestone: 'Podés construir un endpoint con autenticación y permisos en cualquier framework.',
  },
  {
    week: 3,
    title: 'Git, CI/CD y SQL',
    description: 'Herramientas de equipo y datos. Presentes en todas las ofertas.',
    topics: ['git_cicd', 'sql'],
    milestone: 'Configurás un pipeline de CI/CD y optimizás queries SQL.',
  },
  {
    week: 4,
    title: 'Cloud & Containers',
    description: 'AWS es crítico para la oferta 1. Docker aparece en la oferta 2.',
    topics: ['aws', 'docker'],
    milestone: 'Diseñás una arquitectura serverless en AWS y containerizás una app.',
  },
  {
    week: 5,
    title: 'Frontend & Agentes IA',
    description: 'Next.js para la oferta 2. Agentes IA para la oferta 3.',
    topics: ['nextjs', 'ai_agents'],
    milestone: 'Conectás un frontend Next.js a una API Python y describís un workflow agentico.',
  },
  {
    week: 6,
    title: 'Diferenciadores',
    description: 'Los extras que te destacan: GraphQL, observabilidad, Agile y AI tools.',
    topics: ['graphql', 'observability', 'agile', 'ai_tools'],
    milestone: 'Podés hablar con criterio de todos los ítems opcionales de las ofertas.',
  },
]

// Semana recomendada para un tema
export function getWeekForTopic(topicId) {
  const week = ROADMAP.find(w => w.topics.includes(topicId))
  return week?.week || null
}

// Temas de una semana
export function getTopicsForWeek(weekNumber) {
  const week = ROADMAP.find(w => w.week === weekNumber)
  return week?.topics || []
}
