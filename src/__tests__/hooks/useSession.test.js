/**
 * src/__tests__/hooks/useSession.test.js
 *
 * TESTS DE useSession — hook que maneja el flujo de una sesión de práctica.
 *
 * ¿Qué testear?
 *   - startSession: despacha START_SESSION + ADD_STREAK_DAY (dos acciones en una)
 *   - submitAnswer: despacha ADD_ANSWER
 *   - endSession:   despacha END_SESSION
 *   - currentScore: cálculo del promedio de respuestas (lógica pura derivada del estado)
 *
 * Estrategia de mock:
 *   Igual que useProgress: mockeamos useStore() para aislar la lógica del hook.
 *   Configuramos el estado de sesión en cada test según lo que queremos verificar.
 */

import { renderHook } from '@testing-library/react'
import { useSession } from '../../hooks/useSession.js'

vi.mock('../../store/index.jsx', () => ({
  useStore: vi.fn(),
  ACTIONS: {
    START_SESSION:  'START_SESSION',
    ADD_ANSWER:     'ADD_ANSWER',
    END_SESSION:    'END_SESSION',
    ADD_STREAK_DAY: 'ADD_STREAK_DAY',
  },
}))

import { useStore, ACTIONS } from '../../store/index.jsx'

describe('useSession', () => {

  // ── Helper: crea mock del store con la sesión dada ───────────────────────
  function mockStoreWithSession(session = {}) {
    const defaultSession = {
      active:        false,
      topicId:       null,
      questionIndex: 0,
      answers:       [],
      startedAt:     null,
    }
    const mockDispatch = vi.fn()
    useStore.mockReturnValue({
      state: { session: { ...defaultSession, ...session } },
      dispatch: mockDispatch,
    })
    return { mockDispatch }
  }

  // ── Estado inicial ───────────────────────────────────────────────────────
  describe('Estado inicial', () => {
    it('isActive es false cuando no hay sesión activa', () => {
      mockStoreWithSession({ active: false })
      const { result } = renderHook(() => useSession())

      expect(result.current.isActive).toBe(false)
    })

    it('currentScore es null cuando no hay respuestas', () => {
      // ¿Por qué null y no 0? Para que el UI pueda distinguir entre
      // "no hay respuestas todavía" (null → no mostrar) vs "score = 0" (sí mostrar).
      mockStoreWithSession({ answers: [] })
      const { result } = renderHook(() => useSession())

      expect(result.current.currentScore).toBeNull()
    })
  })

  // ── currentScore ─────────────────────────────────────────────────────────
  describe('currentScore', () => {
    it('calcula el promedio redondeado de las respuestas actuales', () => {
      // 3 respuestas: 6, 8, 10 → promedio = 24/3 = 8 (exacto, no necesita redondeo)
      mockStoreWithSession({
        active:  true,
        topicId: 'python',
        answers: [
          { question: 'Q1', score: 6 },
          { question: 'Q2', score: 8 },
          { question: 'Q3', score: 10 },
        ],
      })
      const { result } = renderHook(() => useSession())

      expect(result.current.currentScore).toBe(8)
    })

    it('redondea el promedio al entero más cercano', () => {
      // 7 + 8 = 15 / 2 = 7.5 → Math.round(7.5) = 8
      mockStoreWithSession({
        answers: [{ score: 7 }, { score: 8 }],
      })
      const { result } = renderHook(() => useSession())

      expect(result.current.currentScore).toBe(8)
    })

    it('trata respuestas sin score como 0 en el promedio', () => {
      // Si una respuesta fue omitida (score undefined/null), cuenta como 0
      // ¿Por qué? Para que las omisiones penalicen el score total.
      mockStoreWithSession({
        answers: [{ score: 8 }, { score: undefined }],
      })
      const { result } = renderHook(() => useSession())

      // (8 + 0) / 2 = 4
      expect(result.current.currentScore).toBe(4)
    })
  })

  // ── startSession ─────────────────────────────────────────────────────────
  describe('startSession', () => {
    it('despacha START_SESSION con el topicId correcto', () => {
      const { mockDispatch } = mockStoreWithSession()
      const { result } = renderHook(() => useSession())

      result.current.startSession('python')

      expect(mockDispatch).toHaveBeenCalledWith({
        type:    ACTIONS.START_SESSION,
        topicId: 'python',
      })
    })

    it('también despacha ADD_STREAK_DAY para registrar la actividad', () => {
      // ¿Por qué ADD_STREAK_DAY en startSession?
      // Al comenzar una sesión, el usuario está activo hoy → registra el día en el streak.
      // Si solo lo despacháramos al terminar, una sesión interrumpida no contaría.
      const { mockDispatch } = mockStoreWithSession()
      const { result } = renderHook(() => useSession())

      result.current.startSession('sql')

      // Verificamos ambos dispatches en orden
      expect(mockDispatch).toHaveBeenCalledTimes(2)
      expect(mockDispatch).toHaveBeenNthCalledWith(1, { type: ACTIONS.START_SESSION, topicId: 'sql' })
      expect(mockDispatch).toHaveBeenNthCalledWith(2, { type: ACTIONS.ADD_STREAK_DAY })
    })
  })

  // ── submitAnswer ─────────────────────────────────────────────────────────
  describe('submitAnswer', () => {
    it('despacha ADD_ANSWER con la respuesta completa', () => {
      const { mockDispatch } = mockStoreWithSession({ active: true, topicId: 'python' })
      const { result } = renderHook(() => useSession())

      const answer = { question: '¿Qué es un generator?', userAnswer: 'Una función con yield', score: 9, feedback: 'Excelente' }
      result.current.submitAnswer(answer)

      expect(mockDispatch).toHaveBeenCalledOnce()
      expect(mockDispatch).toHaveBeenCalledWith({
        type:   ACTIONS.ADD_ANSWER,
        answer: answer,
      })
    })
  })

  // ── endSession ───────────────────────────────────────────────────────────
  describe('endSession', () => {
    it('despacha END_SESSION sin payload adicional', () => {
      // END_SESSION no necesita payload porque el reducer usa el estado actual
      // de la sesión (stateRef.current.session) para construir la sesión terminada.
      const { mockDispatch } = mockStoreWithSession({ active: true, answers: [{ score: 8 }] })
      const { result } = renderHook(() => useSession())

      result.current.endSession()

      expect(mockDispatch).toHaveBeenCalledOnce()
      expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.END_SESSION })
    })
  })

  // ── Valores derivados del estado ─────────────────────────────────────────
  describe('Valores derivados del estado de sesión', () => {
    it('expone el estado de sesión completo', () => {
      const sessionState = {
        active:        true,
        topicId:       'docker',
        questionIndex: 2,
        answers:       [{ score: 7 }, { score: 9 }],
        startedAt:     '2026-03-21T10:00:00Z',
      }
      mockStoreWithSession(sessionState)
      const { result } = renderHook(() => useSession())

      expect(result.current.session).toEqual(sessionState)
      expect(result.current.isActive).toBe(true)
    })
  })
})
