/**
 * src/__tests__/hooks/useProgress.test.js
 *
 * TESTS DE useProgress — hook de consulta y actualización del progreso por topic.
 *
 * Estrategia de mock:
 *   useProgress depende de useStore() para leer el estado y hacer dispatch.
 *   En vez de renderizar el árbol completo de providers (AuthProvider + StoreProvider),
 *   mockeamos useStore() directamente. Esto:
 *   1. Aísla la lógica del hook de la complejidad del store
 *   2. Hace los tests más rápidos (no hay renders de contexto)
 *   3. Permite controlar exactamente qué estado "ve" el hook
 *
 * ¿Por qué testear este hook?
 *   Las funciones getOverallPercent y getWeakTopics son el algoritmo de "cuánto
 *   avanzaste y qué te falta". Si calculan mal, el usuario ve un progreso incorrecto.
 */

import { renderHook } from '@testing-library/react'
import { useProgress } from '../../hooks/useProgress.js'

// Mock del store: interceptamos useStore() y ACTIONS para controlar el estado
vi.mock('../../store/index.jsx', () => ({
  useStore: vi.fn(),
  ACTIONS: {
    UPDATE_PROGRESS: 'UPDATE_PROGRESS',
  },
}))

// Importamos el mock DESPUÉS del vi.mock() para poder configurarlo en cada test
import { useStore, ACTIONS } from '../../store/index.jsx'

describe('useProgress', () => {

  // ── Helper: crea un mock del store con el progreso dado ──────────────────
  function mockStoreWith(progress = {}) {
    const mockDispatch = vi.fn()
    useStore.mockReturnValue({ state: { progress }, dispatch: mockDispatch })
    return { mockDispatch }
  }

  // ── getTopicProgress ─────────────────────────────────────────────────────
  describe('getTopicProgress', () => {
    it('retorna valores por defecto para un topic sin progreso', () => {
      // ¿Por qué? El dashboard y las páginas de topic leen este valor.
      // Si devuelve null/undefined en vez del default, el UI explota.
      mockStoreWith({})
      const { result } = renderHook(() => useProgress())

      const p = result.current.getTopicProgress('python')
      expect(p.completed).toBe(0)
      expect(p.total).toBe(0)
      expect(p.lastScore).toBeNull()
      expect(p.lastSeen).toBeNull()
    })

    it('retorna el progreso real cuando existe en el store', () => {
      mockStoreWith({
        python: { completed: 4, total: 5, lastScore: 8, lastSeen: '2026-03-20' }
      })
      const { result } = renderHook(() => useProgress())

      const p = result.current.getTopicProgress('python')
      expect(p.completed).toBe(4)
      expect(p.total).toBe(5)
      expect(p.lastScore).toBe(8)
      expect(p.lastSeen).toBe('2026-03-20')
    })
  })

  // ── getOverallPercent ────────────────────────────────────────────────────
  describe('getOverallPercent', () => {
    it('retorna 0 cuando se pasa un array vacío', () => {
      // ¿Por qué? Si no hay topics, el denominador sería 0 → NaN o división por cero.
      mockStoreWith({})
      const { result } = renderHook(() => useProgress())

      expect(result.current.getOverallPercent([])).toBe(0)
    })

    it('retorna 0 cuando ningún topic tiene progreso', () => {
      mockStoreWith({})
      const { result } = renderHook(() => useProgress())

      expect(result.current.getOverallPercent(['python', 'sql', 'docker'])).toBe(0)
    })

    it('calcula el porcentaje global correctamente con progreso parcial', () => {
      // python: 2/4 = 50%, sql: 0/5 = 0%, docker: 3/3 = 100%
      // Promedio: (50 + 0 + 100) / 3 = 50%
      mockStoreWith({
        python: { completed: 2, total: 4, lastScore: 7, lastSeen: '2026-03-01' },
        sql:    { completed: 0, total: 5, lastScore: null, lastSeen: null },
        docker: { completed: 3, total: 3, lastScore: 9, lastSeen: '2026-03-15' },
      })
      const { result } = renderHook(() => useProgress())

      const pct = result.current.getOverallPercent(['python', 'sql', 'docker'])
      expect(pct).toBe(50)
    })

    it('retorna 100 cuando todos los topics están completados', () => {
      mockStoreWith({
        python: { completed: 5, total: 5, lastScore: 9, lastSeen: '2026-03-01' },
        sql:    { completed: 3, total: 3, lastScore: 8, lastSeen: '2026-03-01' },
      })
      const { result } = renderHook(() => useProgress())

      expect(result.current.getOverallPercent(['python', 'sql'])).toBe(100)
    })

    it('ignora topics incluidos en el argumento pero sin progreso en el store', () => {
      // Si topicIds incluye 'aws' pero el usuario nunca practicó aws,
      // ese topic contribuye 0 al promedio (no es ignorado, cuenta como 0%)
      mockStoreWith({ python: { completed: 4, total: 4, lastScore: 9, lastSeen: '2026-03-01' } })
      const { result } = renderHook(() => useProgress())

      // python=100%, aws=0% → promedio = 50%
      const pct = result.current.getOverallPercent(['python', 'aws'])
      expect(pct).toBe(50)
    })
  })

  // ── getWeakTopics ────────────────────────────────────────────────────────
  describe('getWeakTopics', () => {
    it('incluye todos los topics cuando no hay progreso (vacío = débil)', () => {
      // ¿Por qué? Un topic sin progreso (0/0) se considera débil porque
      // el usuario nunca lo practicó. Es el estado más urgente.
      mockStoreWith({})
      const { result } = renderHook(() => useProgress())

      const weak = result.current.getWeakTopics(['python', 'sql'])
      expect(weak).toContain('python')
      expect(weak).toContain('sql')
    })

    it('incluye topics con menos del 50% de completado', () => {
      mockStoreWith({
        python: { completed: 2, total: 5, lastScore: 6, lastSeen: '2026-03-01' },  // 40% < 50%
      })
      const { result } = renderHook(() => useProgress())

      expect(result.current.getWeakTopics(['python'])).toContain('python')
    })

    it('excluye topics con 50% o más de completado', () => {
      mockStoreWith({
        python: { completed: 3, total: 5, lastScore: 8, lastSeen: '2026-03-01' },  // 60% >= 50%
        sql:    { completed: 5, total: 5, lastScore: 9, lastSeen: '2026-03-01' },  // 100%
      })
      const { result } = renderHook(() => useProgress())

      const weak = result.current.getWeakTopics(['python', 'sql'])
      expect(weak).not.toContain('python')
      expect(weak).not.toContain('sql')
    })

    it('incluye topics con exactamente 0 total como débiles', () => {
      mockStoreWith({
        python: { completed: 0, total: 0, lastScore: null, lastSeen: null },
      })
      const { result } = renderHook(() => useProgress())

      expect(result.current.getWeakTopics(['python'])).toContain('python')
    })
  })

  // ── updateProgress ───────────────────────────────────────────────────────
  describe('updateProgress', () => {
    it('llama a dispatch con UPDATE_PROGRESS y los datos correctos', () => {
      const { mockDispatch } = mockStoreWith({})
      const { result } = renderHook(() => useProgress())

      result.current.updateProgress('python', { completed: 3, total: 5, lastScore: 8 })

      expect(mockDispatch).toHaveBeenCalledOnce()
      expect(mockDispatch).toHaveBeenCalledWith({
        type:    ACTIONS.UPDATE_PROGRESS,
        topicId: 'python',
        data:    { completed: 3, total: 5, lastScore: 8 },
      })
    })
  })

  // ── progress (estado raw) ────────────────────────────────────────────────
  describe('progress (objeto expuesto)', () => {
    it('expone el objeto progress directamente del store', () => {
      const progressData = { python: { completed: 2, total: 5, lastScore: 7, lastSeen: '2026-03-01' } }
      mockStoreWith(progressData)
      const { result } = renderHook(() => useProgress())

      expect(result.current.progress).toEqual(progressData)
    })
  })
})
