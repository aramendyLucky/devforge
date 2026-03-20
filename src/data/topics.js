// Catálogo completo de temas técnicos
// tier: 1=crítico | 2=importante | 3=diferenciador
// category: backend | frontend | cloud | database | devops | ai | methodology

export const TOPICS = [
  // ── TIER 1 ─────────────────────────────────────────────
  {
    id: 'python',
    name: 'Python Core',
    tier: 1,
    category: 'backend',
    icon: '🐍',
    description: 'Fundamentos sólidos de Python: tipos, estructuras de datos, OOP, decoradores, generators, context managers y patrones comunes en entornos productivos.',
    offers: [1, 2, 3],
    estimatedHours: 4,
  },
  {
    id: 'apis',
    name: 'REST APIs',
    tier: 1,
    category: 'backend',
    icon: '🔌',
    description: 'Diseño e implementación de APIs RESTful: verbos HTTP, status codes, versionado, autenticación, paginación e integración entre servicios.',
    offers: [1, 2, 3],
    estimatedHours: 3,
  },
  {
    id: 'git_cicd',
    name: 'Git & CI/CD',
    tier: 1,
    category: 'devops',
    icon: '🔀',
    description: 'Flujos con Git: branches, PRs, merge vs rebase, commits semánticos. CI/CD con GitHub Actions: pipelines, jobs, secrets y deploy automatizado.',
    offers: [1, 2, 3],
    estimatedHours: 3,
  },
  {
    id: 'django_flask',
    name: 'Django / Flask',
    tier: 1,
    category: 'backend',
    icon: '🌐',
    description: 'Frameworks web Python: modelos, vistas, serializers en Django REST Framework. Routing, blueprints y extensiones en Flask. Cuándo usar cada uno.',
    offers: [1, 2],
    estimatedHours: 5,
  },
  {
    id: 'fastapi',
    name: 'FastAPI',
    tier: 1,
    category: 'backend',
    icon: '⚡',
    description: 'Framework moderno async: type hints, Pydantic, dependency injection, OpenAPI automático, async/await y performance en APIs de alta carga.',
    offers: [3],
    estimatedHours: 3,
  },

  // ── TIER 2 ─────────────────────────────────────────────
  {
    id: 'sql',
    name: 'SQL',
    tier: 2,
    category: 'database',
    icon: '🗄️',
    description: 'Consultas avanzadas: JOINs, subqueries, window functions, índices y optimización. ORM con Django o SQLAlchemy. Migraciones y modelado relacional.',
    offers: [2],
    estimatedHours: 4,
  },
  {
    id: 'aws',
    name: 'AWS Core',
    tier: 2,
    category: 'cloud',
    icon: '☁️',
    description: 'Servicios clave: Lambda (serverless), EC2 (cómputo), ECS (containers), S3 (storage), RDS (bases de datos), API Gateway. IAM, VPC y buenas prácticas.',
    offers: [1],
    estimatedHours: 6,
  },
  {
    id: 'docker',
    name: 'Docker',
    tier: 2,
    category: 'devops',
    icon: '🐳',
    description: 'Containerización: Dockerfile, imágenes, capas, Docker Compose para entornos multi-servicio. Optimización de imágenes y patrones en producción.',
    offers: [2],
    estimatedHours: 3,
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    tier: 2,
    category: 'frontend',
    icon: '▲',
    description: 'React framework: SSR vs SSG vs ISR, App Router, Server Components, API Routes, optimización de imágenes y deploy en Vercel.',
    offers: [2],
    estimatedHours: 4,
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    tier: 2,
    category: 'backend',
    icon: '🟩',
    description: 'Runtime JavaScript: event loop, módulos, npm, Express básico, streams y uso como capa de integración junto a Python.',
    offers: [2],
    estimatedHours: 2,
  },
  {
    id: 'ai_agents',
    name: 'Agentes de IA',
    tier: 2,
    category: 'ai',
    icon: '🤖',
    description: 'Fundamentos de agentes: tool use, function calling, memory, RAG básico. Orquestación con LangChain o frameworks propios. Workflows agenticos.',
    offers: [3],
    estimatedHours: 5,
  },

  // ── TIER 3 ─────────────────────────────────────────────
  {
    id: 'graphql',
    name: 'GraphQL',
    tier: 3,
    category: 'backend',
    icon: '◈',
    description: 'Schema definition, queries, mutations, subscriptions. Comparativa con REST. Implementación con Strawberry (Python) o Apollo.',
    offers: [2],
    estimatedHours: 3,
  },
  {
    id: 'observability',
    name: 'Observabilidad',
    tier: 3,
    category: 'devops',
    icon: '📊',
    description: 'Monitoreo con Datadog y Sentry: métricas, logs, trazas distribuidas, alertas y dashboards. Qué medir y cómo instrumentar una aplicación.',
    offers: [2],
    estimatedHours: 2,
  },
  {
    id: 'agile',
    name: 'Agile / Scrum',
    tier: 3,
    category: 'methodology',
    icon: '📋',
    description: 'Ceremonias Scrum: sprints, planning, daily, retro. Kanban. Trabajo en equipos distribuidos, estimación y gestión de deuda técnica.',
    offers: [3],
    estimatedHours: 1,
  },
  {
    id: 'ai_tools',
    name: 'AI Tools (Claude Code / Copilot)',
    tier: 3,
    category: 'ai',
    icon: '🛠️',
    description: 'Uso profesional de asistentes IA en el flujo de desarrollo: prompting efectivo, revisión de código generado, integración en el editor y límites del tool.',
    offers: [3],
    estimatedHours: 2,
  },
]

// Helper: obtener tema por id
export function getTopicById(id) {
  return TOPICS.find(t => t.id === id) || null
}

// Helper: temas por tier
export function getTopicsByTier(tier) {
  return TOPICS.filter(t => t.tier === tier)
}

// Helper: todos los ids
export const ALL_TOPIC_IDS = TOPICS.map(t => t.id)
