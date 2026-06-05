import { useState } from 'react'

const MODEL = 'llama-3.3-70b-versatile'

async function callGroq(messages, systemPrompt = '') {
  const allMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  const response = await fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: allMessages,
    }),
  })

  if (!response.ok) throw new Error(`Groq API error: ${response.status}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── Hook principal ───────────────────────────────────────
export function useAI() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // Evalúa la respuesta del usuario a una pregunta técnica
  async function evaluateAnswer({ question, answer, topic }) {
    setLoading(true)
    setError(null)
    try {
      const system = `Sos un entrevistador técnico senior especializado en desarrollo de software.
Evaluás respuestas de candidatos a puestos de Python backend, Full Stack y AI Engineer.
Respondés SOLO en JSON con este formato exacto, sin texto adicional ni backticks:
{
  "score": <número del 1 al 10>,
  "strengths": ["punto positivo 1", "punto positivo 2"],
  "improvements": ["qué mejorar 1", "qué mejorar 2"],
  "keyMissing": "concepto clave ausente o null si no falta nada",
  "followUp": "pregunta de profundización para el candidato"
}`
      const text = await callGroq([
        { role: 'user', content: `Tema: ${topic}\n\nPregunta de entrevista:\n${question}\n\nRespuesta del candidato:\n${answer}` }
      ], system)

      const clean = text.replace(/```json|```/g, '').trim()
      return JSON.parse(clean)
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  /**
   * extractTopicsFromOffers — extrae tecnologías de texto de ofertas laborales.
   *
   * ── Por qué el prompt está estructurado así ────────────────────────────
   *
   * PROBLEMA original: el prompt genérico devolvía IDs inventados que no
   * matcheaban con los IDs del catálogo de DevForge (ej: "node_js" en vez
   * de "nodejs", "react.js" en vez de "react"). Esto rompía el match con
   * los temas reales de la app.
   *
   * SOLUCIÓN: el prompt incluye el catálogo oficial de IDs como referencia.
   * La IA elige del catálogo cuando hay match, o crea un ID snake_case cuando
   * el tech no está en el catálogo. También pedimos un `summary` para mostrar
   * al usuario qué entendió la IA del texto completo.
   *
   * TIER LOGIC:
   *   Tier 1 = mencionado en "Requisitos excluyentes" o "Must have" o repetido 3+ veces
   *   Tier 2 = mencionado en "Requisitos deseables" o "Nice to have"
   *   Tier 3 = mencionado una sola vez o en sección de "Valoramos" / diferenciadores
   *
   * @param {string} rawText — texto de las ofertas (pegado o extraído de archivo)
   * @returns {Promise<Array<{ id, name, tier, category }>>}
   */
  async function extractTopicsFromOffers(rawText) {
    setLoading(true)
    setError(null)
    try {
      // El catálogo de IDs conocidos ayuda a la IA a no inventar IDs nuevos
      // para tecnologías que ya existen en DevForge
      const knownIds = [
        'python', 'apis', 'git_cicd', 'sql', 'django_flask', 'docker',
        'aws', 'testing', 'system_design', 'fastapi', 'react', 'nextjs',
        'typescript', 'postgresql', 'redis', 'graphql', 'ai_ml', 'monitoring',
      ]

      const system = `Sos un analizador experto de ofertas laborales tech para el mercado latinoamericano.
Tu tarea: extraer las tecnologías, frameworks y habilidades técnicas mencionadas en las ofertas.

REGLAS IMPORTANTES:
1. Para cada tecnología detectada, usá uno de estos IDs conocidos si hay match exacto: ${knownIds.join(', ')}
   Si la tecnología no está en la lista, creá un id en snake_case (ej: "kubernetes", "terraform")
2. Asignación de tiers:
   - Tier 1 (CRÍTICO): tecnología en "Requisitos excluyentes", "Indispensable", "Requerido", o mencionada 3+ veces
   - Tier 2 (IMPORTANTE): tecnología en "Requisitos deseables", "Valoramos", "Nice to have", o mencionada 2 veces
   - Tier 3 (DIFERENCIADOR): mencionada una sola vez, o en sección de "Bonus" / "Plusses"
3. Categorías válidas: backend, frontend, cloud, database, devops, ai, methodology
4. Incluí un "summary" de 1-2 oraciones describiendo el perfil que buscan las ofertas
5. Máximo 15 tecnologías — priorizá las más relevantes si hay más

Respondés SOLO en JSON sin texto adicional ni backticks:
{
  "summary": "descripción breve del perfil técnico que buscan las ofertas",
  "topics": [
    { "id": "python", "name": "Python", "tier": 1, "category": "backend" }
  ]
}`

      const text = await callGroq([
        { role: 'user', content: `Analizá estas ofertas laborales y extraé el stack técnico requerido:\n\n${rawText.slice(0, 6000)}` }
        // .slice(0, 6000): limitamos a 6000 chars para no exceder el contexto de Groq
        // Una oferta típica tiene ~500-1000 chars, así que caben varias
      ], system)

      const clean  = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      // Devolvemos también el summary para el extraction preview
      return {
        topics:  parsed.topics  || [],
        summary: parsed.summary || '',
      }
    } catch (err) {
      setError(err.message)
      return { topics: [], summary: '' }
    } finally {
      setLoading(false)
    }
  }

  // Genera una pista progresiva
  async function getHint({ question, topic, hintLevel = 1 }) {
    setLoading(true)
    setError(null)
    try {
      const system = `Sos un mentor técnico. Das pistas progresivas sin revelar la respuesta.
Nivel 1: orientación general del concepto
Nivel 2: menciona el enfoque técnico sin el detalle
Nivel 3: da la estructura de la respuesta sin el contenido
Respondés en 2-3 oraciones, en español, sin formateo markdown.`

      const text = await callGroq([
        { role: 'user', content: `Tema: ${topic}\nPregunta: ${question}\nDame una pista de nivel ${hintLevel}` }
      ], system)

      return text.trim()
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Genera una pregunta técnica única con IA
  async function generateQuestion({ topicId, topicName, difficulty = 'mid', previousQuestions = [], keyMissing = null }) {
    setLoading(true)
    setError(null)
    try {
      const avoidList = previousQuestions.length
        ? `\n\nNO repitas estas preguntas ya formuladas:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
        : ''
      const weaknessHint = keyMissing
        ? `\n\nEl candidato mostró debilidad en: "${keyMissing}". Enfocá la pregunta en ese concepto o en uno directamente relacionado.`
        : ''

      const system = `Sos un entrevistador técnico senior especializado en desarrollo de software.
Generás UNA sola pregunta de entrevista técnica, desafiante y específica.
Respondés SOLO en JSON sin texto adicional ni backticks:
{
  "question": "texto completo de la pregunta",
  "type": "concept|practical|scenario|tradeoff",
  "focus": "aspecto técnico específico que evalúa esta pregunta"
}`

      const text = await callGroq([{
        role: 'user',
        content: `Tema: ${topicName}
Dificultad: ${difficulty} (basic=fundamentos, mid=implementación real, senior=arquitectura/tradeoffs)${avoidList}${weaknessHint}

Generá UNA pregunta de entrevista técnica para nivel ${difficulty}.`
      }], system)

      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      return {
        id: `ai_${Date.now()}`,
        question: parsed.question,
        type: parsed.type || 'concept',
        difficulty,
        focus: parsed.focus || '',
        isAI: true,
      }
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    evaluateAnswer,
    extractTopicsFromOffers,
    getHint,
    generateQuestion,
  }
}
