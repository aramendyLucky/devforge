/**
 * src/__tests__/hooks/useAI.test.js
 *
 * TESTS DEL HOOK DE IA — valida la integración con la API de Groq.
 *
 * ¿Qué testear en un hook que llama a una API externa?
 *   1. Que las llamadas se hacen con los parámetros correctos (URL, método, headers, body)
 *   2. Que el JSON de respuesta se parsea y transforma correctamente
 *   3. Que los errores de la API se manejan sin romper la app (error handling)
 *   4. Que el estado de loading se gestiona correctamente (true → false)
 *
 * Estrategia:
 *   Mockeamos global.fetch para no hacer llamadas reales a Groq.
 *   Esto garantiza que los tests son rápidos, deterministas y gratuitos
 *   (no consumen tokens de la API en cada ejecución de la CI).
 *
 * ¿Por qué mockear fetch y no la función callGroq?
 *   callGroq es una función interna no exportada. Mockear fetch es más limpio
 *   porque testea el comportamiento completo del hook (el "qué hace")
 *   sin acoplarse a la implementación interna (el "cómo lo hace").
 */

import { renderHook, act } from '@testing-library/react'
import { useAI } from '../../hooks/useAI.js'

// ─── Mock de fetch global ──────────────────────────────────────────────────
// En jsdom (el environment de los tests), fetch no existe de forma nativa.
// Lo creamos como un mock antes de cada test para controlarlo completamente.

// ── Helper: crea una respuesta de fetch mockeada con el contenido deseado
function mockFetchResponse(content, { ok = true, status = 200 } = {}) {
  const responseBody = {
    choices: [{ message: { content } }],
  }
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: vi.fn().mockResolvedValueOnce(responseBody),
  })
}

describe('useAI', () => {

  beforeEach(() => {
    // Limpiamos el mock de fetch antes de cada test para evitar interferencias
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restauramos el fetch real (aunque en jsdom no existe, es buena práctica)
    if (global.fetch?.mockRestore) global.fetch.mockRestore()
  })

  // ── Estado inicial ───────────────────────────────────────────────────────
  describe('Estado inicial', () => {
    it('empieza con loading=false y error=null', () => {
      // No hacemos ninguna llamada — verificamos el estado en reposo
      const { result } = renderHook(() => useAI())

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  // ── evaluateAnswer ───────────────────────────────────────────────────────
  describe('evaluateAnswer', () => {
    it('llama a fetch con la URL, método y headers correctos', async () => {
      const mockResponse = JSON.stringify({
        score: 8,
        strengths: ['Buen manejo de excepciones'],
        improvements: ['Mencionar async'],
        keyMissing: null,
        followUp: '¿Cómo usás generators?',
      })
      mockFetchResponse(mockResponse)

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.evaluateAnswer({
          question: '¿Qué es un decorator?',
          answer:   'Una función que envuelve otra función',
          topic:    'Python Core',
        })
      })

      expect(global.fetch).toHaveBeenCalledOnce()
      const [url, options] = global.fetch.mock.calls[0]

      // Verificamos la URL de Groq
      expect(url).toBe('/api/groq')
      // Verificamos el método POST
      expect(options.method).toBe('POST')
      // Verificamos que Content-Type es JSON
      expect(options.headers['Content-Type']).toBe('application/json')
    })

    it('parsea y retorna el objeto de evaluación correctamente', async () => {
      const evaluation = {
        score: 7,
        strengths: ['Claro y conciso'],
        improvements: ['Agregar ejemplo de código'],
        keyMissing: 'Mención de async/await',
        followUp: '¿Cuándo usarías un generator vs una lista?',
      }
      // El hook hace .replace(/```json|```/g, '').trim() antes de JSON.parse
      // Simulamos que la IA devuelve JSON con backticks (caso común)
      mockFetchResponse('```json\n' + JSON.stringify(evaluation) + '\n```')

      const { result } = renderHook(() => useAI())

      let evaluation_result
      await act(async () => {
        evaluation_result = await result.current.evaluateAnswer({
          question: 'Q', answer: 'A', topic: 'Python'
        })
      })

      expect(evaluation_result.score).toBe(7)
      expect(evaluation_result.strengths).toEqual(['Claro y conciso'])
      expect(evaluation_result.keyMissing).toBe('Mención de async/await')
    })

    it('retorna null y setea error cuando la API falla (status 500)', async () => {
      // ¿Por qué retornar null y no lanzar? Para que el UI pueda mostrar
      // el error sin crashear la página.
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 })

      const { result } = renderHook(() => useAI())

      let evaluation_result
      await act(async () => {
        evaluation_result = await result.current.evaluateAnswer({ question: 'Q', answer: 'A', topic: 'T' })
      })

      expect(evaluation_result).toBeNull()
      expect(result.current.error).toBeTruthy()
      expect(result.current.loading).toBe(false)
    })

    it('vuelve loading=false después de resolver, sin importar el resultado', async () => {
      mockFetchResponse(JSON.stringify({ score: 8, strengths: [], improvements: [], keyMissing: null, followUp: '' }))

      const { result } = renderHook(() => useAI())

      await act(async () => {
        await result.current.evaluateAnswer({ question: 'Q', answer: 'A', topic: 'T' })
      })

      // loading siempre vuelve a false en el finally del try-catch
      expect(result.current.loading).toBe(false)
    })
  })

  // ── getHint ──────────────────────────────────────────────────────────────
  describe('getHint', () => {
    it('retorna el texto de la pista sin espacios extra', async () => {
      // La API puede devolver texto con espacios/saltos → .trim() lo limpia
      mockFetchResponse('  Esta es una pista sobre Python.  ')

      const { result } = renderHook(() => useAI())

      let hint
      await act(async () => {
        hint = await result.current.getHint({ question: 'Q', topic: 'Python', hintLevel: 1 })
      })

      expect(hint).toBe('Esta es una pista sobre Python.')
    })

    it('retorna null cuando la API falla', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useAI())

      let hint
      await act(async () => {
        hint = await result.current.getHint({ question: 'Q', topic: 'T', hintLevel: 2 })
      })

      expect(hint).toBeNull()
      expect(result.current.error).toBe('Network error')
    })
  })

  // ── generateQuestion ─────────────────────────────────────────────────────
  describe('generateQuestion', () => {
    it('retorna un objeto de pregunta con los campos requeridos', async () => {
      const apiQuestion = {
        question: '¿Cómo funciona el GIL en Python?',
        type:     'concept',
        focus:    'Threading y concurrencia',
      }
      mockFetchResponse(JSON.stringify(apiQuestion))

      const { result } = renderHook(() => useAI())

      let question
      await act(async () => {
        question = await result.current.generateQuestion({
          topicId:   'python',
          topicName: 'Python Core',
          difficulty: 'senior',
        })
      })

      // Los campos del resultado del hook
      expect(question.question).toBe(apiQuestion.question)
      expect(question.type).toBe('concept')
      expect(question.difficulty).toBe('senior')
      expect(question.isAI).toBe(true)
      // id generado automáticamente
      expect(question.id).toMatch(/^ai_\d+$/)
    })

    it('usa type="concept" como fallback cuando la API no devuelve el campo', async () => {
      // Caso de respuesta incompleta de la IA (solo question, sin type/focus)
      mockFetchResponse(JSON.stringify({ question: 'Una pregunta' }))

      const { result } = renderHook(() => useAI())

      let question
      await act(async () => {
        question = await result.current.generateQuestion({ topicId: 'python', topicName: 'Python' })
      })

      expect(question.type).toBe('concept')  // fallback
      expect(question.focus).toBe('')         // fallback vacío
    })
  })

  // ── extractTopicsFromOffers ──────────────────────────────────────────────
  describe('extractTopicsFromOffers', () => {
    it('retorna topics y summary del análisis de la oferta', async () => {
      const apiResponse = {
        summary: 'Buscan un Python backend developer con experiencia en FastAPI',
        topics:  [
          { id: 'python',  name: 'Python',  tier: 1, category: 'backend' },
          { id: 'fastapi', name: 'FastAPI', tier: 1, category: 'backend' },
        ],
      }
      mockFetchResponse(JSON.stringify(apiResponse))

      const { result } = renderHook(() => useAI())

      let extracted
      await act(async () => {
        extracted = await result.current.extractTopicsFromOffers('Texto de oferta laboral...')
      })

      expect(extracted.topics).toHaveLength(2)
      expect(extracted.topics[0].id).toBe('python')
      expect(extracted.summary).toBeTruthy()
    })

    it('retorna estructura vacía cuando la API falla', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Timeout'))

      const { result } = renderHook(() => useAI())

      let extracted
      await act(async () => {
        extracted = await result.current.extractTopicsFromOffers('texto')
      })

      expect(extracted.topics).toEqual([])
      expect(extracted.summary).toBe('')
      expect(result.current.error).toBe('Timeout')
    })
  })
})
