// Banco de preguntas por tema
// difficulty: 'basic' | 'mid' | 'senior'
// type: 'concept' | 'practical' | 'scenario' | 'tradeoff'

export const QUESTIONS = {

  // ── PYTHON CORE ─────────────────────────────────────────
  python: [
    {
      id: 'py_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Cuál es la diferencia entre una lista y una tupla en Python? ¿Cuándo usarías cada una?',
      keyPoints: ['mutabilidad', 'uso como key de dict', 'rendimiento'],
    },
    {
      id: 'py_02',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué es un decorador en Python y para qué se usa? Mencioná un caso de uso real.',
      keyPoints: ['función que envuelve otra función', 'sin modificar el original', 'logging/auth/cache'],
    },
    {
      id: 'py_03',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué es el GIL en Python y cómo afecta la concurrencia?',
      keyPoints: ['Global Interpreter Lock', 'threading vs multiprocessing', 'I/O bound vs CPU bound'],
    },
    {
      id: 'py_04',
      difficulty: 'mid',
      type: 'practical',
      question: '¿Qué es un generator y cómo difiere de retornar una lista? ¿Cuándo conviene usarlo?',
      keyPoints: ['yield', 'lazy evaluation', 'memoria', 'itertools'],
    },
    {
      id: 'py_05',
      difficulty: 'mid',
      type: 'concept',
      question: 'Explicá los métodos de clase, métodos estáticos y métodos de instancia. ¿Cuándo usarías cada uno?',
      keyPoints: ['@classmethod', '@staticmethod', 'cls vs self', 'factory pattern'],
    },
    {
      id: 'py_06',
      difficulty: 'mid',
      type: 'practical',
      question: '¿Qué es un context manager? Implementá uno propio con __enter__ y __exit__.',
      keyPoints: ['with statement', 'manejo de recursos', '__enter__/__exit__', 'contextlib'],
    },
    {
      id: 'py_07',
      difficulty: 'senior',
      type: 'tradeoff',
      question: 'Tenés una función que se llama miles de veces. ¿Cómo identificarías y resolverías un cuello de botella de performance?',
      keyPoints: ['profiling', 'cProfile', 'timeit', 'algorítmica vs I/O', 'caching'],
    },
    {
      id: 'py_08',
      difficulty: 'senior',
      type: 'scenario',
      question: 'Describí cómo estructurarías un paquete Python grande para un proyecto en equipo. ¿Qué convenciones aplicarías?',
      keyPoints: ['__init__.py', 'módulos vs paquetes', 'imports relativos', 'typing', 'linting'],
    },
  ],

  // ── REST APIs ───────────────────────────────────────────
  apis: [
    {
      id: 'api_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Cuáles son los principales verbos HTTP y qué operación representa cada uno?',
      keyPoints: ['GET/POST/PUT/PATCH/DELETE', 'idempotencia', 'seguridad'],
    },
    {
      id: 'api_02',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué status codes HTTP conocés y cuándo usarías un 200, 201, 400, 401, 403, 404 y 500?',
      keyPoints: ['2xx éxito', '4xx cliente', '5xx servidor', 'semántica correcta'],
    },
    {
      id: 'api_03',
      difficulty: 'mid',
      type: 'tradeoff',
      question: '¿Cómo manejarías la autenticación en una API REST? Comparé JWT vs API Keys vs OAuth2.',
      keyPoints: ['stateless', 'expiración', 'refresh tokens', 'casos de uso de cada uno'],
    },
    {
      id: 'api_04',
      difficulty: 'mid',
      type: 'practical',
      question: '¿Cómo diseñarías la paginación de un endpoint que puede retornar millones de registros?',
      keyPoints: ['offset/limit', 'cursor-based', 'performance en tablas grandes', 'headers de metadata'],
    },
    {
      id: 'api_05',
      difficulty: 'mid',
      type: 'scenario',
      question: 'Un cliente reporta que tu API es lenta. ¿Por dónde empezarías a investigar?',
      keyPoints: ['logging de tiempos', 'N+1 queries', 'caché', 'índices', 'payload size'],
    },
    {
      id: 'api_06',
      difficulty: 'senior',
      type: 'tradeoff',
      question: '¿Cómo versionarías una API que ya tiene clientes en producción? ¿Qué estrategias existen y cuáles son sus trade-offs?',
      keyPoints: ['URL versioning', 'header versioning', 'deprecation policy', 'backward compatibility'],
    },
  ],

  // ── GIT & CI/CD ─────────────────────────────────────────
  git_cicd: [
    {
      id: 'git_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Cuál es la diferencia entre git merge y git rebase? ¿Cuándo usarías cada uno?',
      keyPoints: ['historial lineal', 'conflictos', 'golden rule of rebase', 'main branch'],
    },
    {
      id: 'git_02',
      difficulty: 'basic',
      type: 'practical',
      question: 'Describí tu flujo de trabajo con Git en un equipo. ¿Qué estrategia de branching usás?',
      keyPoints: ['GitFlow', 'trunk-based', 'feature branches', 'PRs y code review'],
    },
    {
      id: 'git_03',
      difficulty: 'mid',
      type: 'practical',
      question: '¿Cómo configurarías un pipeline de CI/CD con GitHub Actions para un proyecto Python?',
      keyPoints: ['workflow YAML', 'jobs y steps', 'lint + test + build', 'secrets', 'deploy'],
    },
    {
      id: 'git_04',
      difficulty: 'mid',
      type: 'scenario',
      question: 'Un compañero hizo un push a main con código que rompe producción. ¿Cómo revertís el daño?',
      keyPoints: ['git revert vs git reset', 'force push peligros', 'hotfix branch', 'comunicación'],
    },
    {
      id: 'git_05',
      difficulty: 'senior',
      type: 'tradeoff',
      question: '¿Qué incluirías en un pipeline de CD para garantizar que un deploy sea seguro en producción?',
      keyPoints: ['smoke tests', 'rollback automático', 'feature flags', 'blue-green / canary'],
    },
  ],

  // ── DJANGO / FLASK ──────────────────────────────────────
  django_flask: [
    {
      id: 'dj_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Cuáles son las principales diferencias entre Django y Flask? ¿Cuándo elegirías uno sobre el otro?',
      keyPoints: ['batteries included vs microframework', 'ORM', 'admin', 'escalabilidad', 'curva de aprendizaje'],
    },
    {
      id: 'dj_02',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué es el ORM de Django? Explicá cómo haría una query con filtros, joins y ordenamiento.',
      keyPoints: ['QuerySet', 'filter/exclude', 'select_related', 'prefetch_related', 'lazy vs eager'],
    },
    {
      id: 'dj_03',
      difficulty: 'mid',
      type: 'practical',
      question: 'Describí cómo crearías un endpoint REST en Django REST Framework con autenticación y permisos.',
      keyPoints: ['ViewSet', 'Serializer', 'Permission classes', 'Authentication classes', 'Router'],
    },
    {
      id: 'dj_04',
      difficulty: 'mid',
      type: 'scenario',
      question: 'Tenés una vista Django que tarda 3 segundos en responder. ¿Qué herramientas usarías para diagnosticar y cómo lo resolverías?',
      keyPoints: ['django-debug-toolbar', 'N+1', 'select_related', 'caché', 'celery para tareas async'],
    },
    {
      id: 'dj_05',
      difficulty: 'senior',
      type: 'tradeoff',
      question: '¿Cómo estructurarías un proyecto Django grande para que sea mantenible en un equipo de 5+ devs?',
      keyPoints: ['apps por dominio', 'settings por entorno', 'custom managers', 'signals con cuidado', 'testing'],
    },
  ],

  // ── FASTAPI ─────────────────────────────────────────────
  fastapi: [
    {
      id: 'fa_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué ventajas tiene FastAPI sobre Flask o Django REST Framework?',
      keyPoints: ['async nativo', 'type hints', 'OpenAPI automático', 'Pydantic', 'performance'],
    },
    {
      id: 'fa_02',
      difficulty: 'mid',
      type: 'practical',
      question: 'Explicá cómo funciona la dependency injection en FastAPI y un caso de uso práctico.',
      keyPoints: ['Depends()', 'reutilización', 'auth', 'db session', 'testabilidad'],
    },
    {
      id: 'fa_03',
      difficulty: 'mid',
      type: 'concept',
      question: '¿Cuándo usarías async def vs def en un endpoint de FastAPI?',
      keyPoints: ['I/O bound', 'CPU bound', 'blocking calls', 'thread pool', 'performance real'],
    },
    {
      id: 'fa_04',
      difficulty: 'senior',
      type: 'scenario',
      question: 'Diseñá la arquitectura de una API de alta concurrencia en FastAPI que consume servicios externos y una base de datos.',
      keyPoints: ['async SQLAlchemy', 'connection pooling', 'httpx async', 'background tasks', 'timeouts'],
    },
  ],

  // ── SQL ─────────────────────────────────────────────────
  sql: [
    {
      id: 'sql_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Cuáles son los tipos de JOIN en SQL? Explicá la diferencia con un ejemplo.',
      keyPoints: ['INNER/LEFT/RIGHT/FULL OUTER', 'NULL rows', 'producto cartesiano'],
    },
    {
      id: 'sql_02',
      difficulty: 'mid',
      type: 'practical',
      question: '¿Qué es un índice en SQL? ¿Cuándo lo crearías y cuándo podría ser contraproducente?',
      keyPoints: ['B-tree', 'lectura rápida', 'write overhead', 'columnas de filtro frecuente', 'cardinality'],
    },
    {
      id: 'sql_03',
      difficulty: 'mid',
      type: 'practical',
      question: 'Explicá qué son las window functions y dá un ejemplo de cuándo las usarías.',
      keyPoints: ['ROW_NUMBER', 'RANK', 'PARTITION BY', 'sin GROUP BY', 'rankings y acumulados'],
    },
    {
      id: 'sql_04',
      difficulty: 'senior',
      type: 'tradeoff',
      question: 'Una query que retorna el top 10 de usuarios por ventas tarda 8 segundos. ¿Cómo la optimizarías?',
      keyPoints: ['EXPLAIN ANALYZE', 'índices compuestos', 'materializar subqueries', 'denormalización estratégica'],
    },
  ],

  // ── AWS ─────────────────────────────────────────────────
  aws: [
    {
      id: 'aws_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué es AWS Lambda y cuándo lo usarías? ¿Cuáles son sus limitaciones?',
      keyPoints: ['serverless', 'cold start', 'timeout 15min', 'sin estado', 'event-driven'],
    },
    {
      id: 'aws_02',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Cuál es la diferencia entre S3, EBS y EFS? ¿Qué usarías para cada caso?',
      keyPoints: ['object vs block vs file', 'durabilidad', 'acceso concurrente', 'pricing'],
    },
    {
      id: 'aws_03',
      difficulty: 'mid',
      type: 'scenario',
      question: 'Diseñá una arquitectura serverless en AWS para una API REST con base de datos.',
      keyPoints: ['API Gateway', 'Lambda', 'RDS Proxy', 'IAM roles', 'VPC', 'secrets manager'],
    },
    {
      id: 'aws_04',
      difficulty: 'mid',
      type: 'concept',
      question: '¿Qué es IAM y cuáles son las buenas prácticas de seguridad en AWS?',
      keyPoints: ['least privilege', 'roles vs users', 'policies', 'MFA', 'no hardcodear credentials'],
    },
    {
      id: 'aws_05',
      difficulty: 'senior',
      type: 'tradeoff',
      question: '¿Cuándo usarías ECS vs Lambda vs EC2 para deployar una aplicación Python?',
      keyPoints: ['duración de ejecución', 'estado', 'costo', 'cold start', 'control del runtime'],
    },
  ],

  // ── DOCKER ──────────────────────────────────────────────
  docker: [
    {
      id: 'dok_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué diferencia hay entre una imagen Docker y un contenedor?',
      keyPoints: ['imagen inmutable', 'contenedor instancia en ejecución', 'layers', 'registry'],
    },
    {
      id: 'dok_02',
      difficulty: 'mid',
      type: 'practical',
      question: 'Describí cómo escribirías un Dockerfile optimizado para una app Python en producción.',
      keyPoints: ['multi-stage build', 'imagen base slim', 'layer caching', 'non-root user', '.dockerignore'],
    },
    {
      id: 'dok_03',
      difficulty: 'mid',
      type: 'practical',
      question: 'Explicá cómo usarías Docker Compose para un entorno de desarrollo con Python + PostgreSQL + Redis.',
      keyPoints: ['services', 'volumes', 'networks', 'depends_on', 'environment variables'],
    },
  ],

  // ── NEXT.JS ─────────────────────────────────────────────
  nextjs: [
    {
      id: 'nx_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Cuál es la diferencia entre SSR, SSG e ISR en Next.js? ¿Cuándo usarías cada uno?',
      keyPoints: ['Server Side Rendering', 'Static Generation', 'Incremental Static Regeneration', 'SEO', 'performance'],
    },
    {
      id: 'nx_02',
      difficulty: 'mid',
      type: 'concept',
      question: '¿Qué son los Server Components en Next.js App Router y cómo cambian la arquitectura de una app?',
      keyPoints: ['sin JS en cliente', 'data fetching directo', 'composición con Client Components', 'streaming'],
    },
    {
      id: 'nx_03',
      difficulty: 'mid',
      type: 'practical',
      question: '¿Cómo conectarías un frontend Next.js con una API Python? ¿Qué consideraciones tendrías en producción?',
      keyPoints: ['API Routes proxy', 'CORS', 'env variables', 'error handling', 'loading states'],
    },
  ],

  // ── AGENTES DE IA ────────────────────────────────────────
  ai_agents: [
    {
      id: 'ai_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué es un agente de IA y en qué se diferencia de una simple llamada a un LLM?',
      keyPoints: ['herramientas', 'loop de razonamiento', 'autonomía', 'memoria', 'plan y ejecución'],
    },
    {
      id: 'ai_02',
      difficulty: 'mid',
      type: 'practical',
      question: '¿Qué es el "tool use" o function calling en un LLM? Describí cómo implementarías una herramienta que consulte una base de datos.',
      keyPoints: ['definición de schema', 'parsing de respuesta', 'ejecución real', 'resultado al modelo'],
    },
    {
      id: 'ai_03',
      difficulty: 'mid',
      type: 'tradeoff',
      question: '¿Qué estrategias de memoria usarías en un agente conversacional de larga duración?',
      keyPoints: ['in-context', 'vector store', 'resumen progresivo', 'memoria episódica vs semántica'],
    },
    {
      id: 'ai_04',
      difficulty: 'senior',
      type: 'scenario',
      question: 'Diseñá un workflow agentico que tome una tarea compleja, la divida en subtareas y las ejecute con manejo de errores.',
      keyPoints: ['planning', 'subagentes', 'retry logic', 'observabilidad', 'human in the loop'],
    },
  ],

  // ── GRAPHQL ─────────────────────────────────────────────
  graphql: [
    {
      id: 'gql_01',
      difficulty: 'basic',
      type: 'tradeoff',
      question: '¿Cuáles son las ventajas y desventajas de GraphQL vs REST? ¿Cuándo elegiría cada uno?',
      keyPoints: ['over/under fetching', 'schema', 'N+1 en GraphQL', 'caché HTTP', 'curva de aprendizaje'],
    },
    {
      id: 'gql_02',
      difficulty: 'mid',
      type: 'practical',
      question: 'Explicá qué son las queries, mutations y subscriptions en GraphQL.',
      keyPoints: ['operaciones', 'tiempo real', 'WebSocket', 'casos de uso de cada uno'],
    },
  ],

  // ── OBSERVABILIDAD ──────────────────────────────────────
  observability: [
    {
      id: 'obs_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Cuáles son los tres pilares de la observabilidad? ¿Para qué sirve cada uno?',
      keyPoints: ['logs', 'métricas', 'trazas', 'diferencias', 'cuándo usar cada uno'],
    },
    {
      id: 'obs_02',
      difficulty: 'mid',
      type: 'scenario',
      question: 'Tu app en producción empieza a dar errores 500 esporádicos. ¿Cómo usarías Sentry y Datadog para diagnosticar el problema?',
      keyPoints: ['error tracking', 'stack trace', 'APM', 'correlación de métricas', 'alertas'],
    },
  ],

  // ── AGILE ───────────────────────────────────────────────
  agile: [
    {
      id: 'ag_01',
      difficulty: 'basic',
      type: 'concept',
      question: 'Describí las ceremonias de Scrum y el rol de cada una en el proceso de desarrollo.',
      keyPoints: ['sprint planning', 'daily', 'review', 'retro', 'refinement', 'timeboxing'],
    },
    {
      id: 'ag_02',
      difficulty: 'mid',
      type: 'scenario',
      question: 'Estás en mitad de un sprint y llega un cambio urgente de negocio. ¿Cómo lo manejarías?',
      keyPoints: ['priorización', 'comunicación con PO', 'scope del sprint', 'deuda técnica', 'impacto en el equipo'],
    },
  ],

  // ── AI TOOLS ────────────────────────────────────────────
  ai_tools: [
    {
      id: 'ait_01',
      difficulty: 'basic',
      type: 'practical',
      question: '¿Cómo usás herramientas como Claude Code o GitHub Copilot en tu flujo de trabajo diario? ¿Qué limitaciones tienen?',
      keyPoints: ['pair programming con IA', 'revisión crítica del output', 'context window', 'alucinaciones', 'seguridad'],
    },
    {
      id: 'ait_02',
      difficulty: 'mid',
      type: 'tradeoff',
      question: 'Un compañero propone usar IA para generar el 80% del código. ¿Qué riesgos ves y cómo los mitigarías?',
      keyPoints: ['comprensión del código', 'bugs sutiles', 'dependencia', 'testing', 'code review reforzado'],
    },
  ],

  // ── NODE.JS ─────────────────────────────────────────────
  nodejs: [
    {
      id: 'nd_01',
      difficulty: 'basic',
      type: 'concept',
      question: '¿Qué es el event loop de Node.js y cómo maneja la concurrencia?',
      keyPoints: ['single thread', 'non-blocking I/O', 'callbacks', 'Promises', 'async/await'],
    },
    {
      id: 'nd_02',
      difficulty: 'mid',
      type: 'tradeoff',
      question: '¿Cuándo usarías Node.js en lugar de Python para un backend? ¿Y cuándo al revés?',
      keyPoints: ['I/O intensivo', 'tiempo real', 'ecosistema npm', 'data science', 'equipo y expertise'],
    },
  ],
}

// Helper: preguntas de un tema por dificultad
export function getQuestions(topicId, difficulty = null) {
  const qs = QUESTIONS[topicId] || []
  if (!difficulty) return qs
  return qs.filter(q => q.difficulty === difficulty)
}

// Helper: pregunta aleatoria de un tema
export function getRandomQuestion(topicId, excludeIds = []) {
  const qs = (QUESTIONS[topicId] || []).filter(q => !excludeIds.includes(q.id))
  if (!qs.length) return null
  return qs[Math.floor(Math.random() * qs.length)]
}

// Helper: total de preguntas por tema
export function getQuestionCount(topicId) {
  return (QUESTIONS[topicId] || []).length
}

export const DIFFICULTY_LABEL = {
  basic:  'Básico',
  mid:    'Intermedio',
  senior: 'Senior',
}

export const DIFFICULTY_COLOR = {
  basic:  'badge-green',
  mid:    'badge-amber',
  senior: 'badge-red',
}
