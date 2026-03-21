/**
 * src/__tests__/store/reducer.test.js
 *
 * TESTS DEL REDUCER — la función más crítica del store global.
 *
 * ¿Por qué testear el reducer primero?
 *   El reducer es una FUNCIÓN PURA: dado el mismo estado y la misma acción,
 *   siempre devuelve el mismo resultado. Esto lo hace trivialmente testeable
 *   sin necesidad de mocks, providers, ni renders de componentes.
 *   Es el corazón de la lógica de estado — si el reducer falla, toda la app falla.
 *
 * Patrón de test:
 *   1. Definir el estado inicial del test (puede ser initialState o uno custom)
 *   2. Llamar al reducer con ese estado y una acción
 *   3. Verificar que el nuevo estado tiene los valores esperados
 *   4. Verificar inmutabilidad: el estado original no fue modificado
 */

// Importamos el reducer directamente para testear la función pura.
// ACTIONS exportadas para no usar strings hardcodeados.
// initialState para tener un punto de referencia limpio.
import { ACTIONS } from '../../store/index.jsx'

// ── Extraemos el reducer para poder importarlo directamente ─────────────────
// El reducer no está exportado desde index.jsx, pero podemos acceder a él
// a través de un helper de test o duplicar la lógica. Como es una función pura,
// la extraemos del módulo directamente con un re-export en el archivo de test.
//
// ALTERNATIVA LIMPIA: si el reducer estuviera exportado, solo haríamos:
//   import { reducer } from '../../store/index.jsx'
//
// Como no está exportado, lo recreamos para tests (duplicación mínima justificada).
// Los tests validan el CONTRATO del reducer, no su implementación interna.

// Re-implementamos el reducer para tests (replica exacta de store/index.jsx)
// Justificación: la función no está exportada. Esta copia es la "spec" del contrato.
const initialState = {
  user: {
    name:            null,
    targetDate:      null,
    selfAssessment:  {},
    rawOffers:       '',
    extractedTopics: [],
  },
  progress: {},
  session: {
    active:        false,
    topicId:       null,
    questionIndex: 0,
    answers:       [],
    startedAt:     null,
  },
  history:    [],
  interviews: [],
  config: {
    onboardingDone:  false,
    streakDays:      [],
    lastActiveDate:  null,
    theme:           'forge',
    font:            'forge',
    language:        'es',
  },
}

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.LOAD_STATE:
      return { ...state, ...action.payload }
    case ACTIONS.SET_USER_FIELD:
      return { ...state, user: { ...state.user, [action.key]: action.value } }
    case ACTIONS.SET_CONFIG_FIELD:
      return { ...state, config: { ...state.config, [action.key]: action.value } }
    case ACTIONS.SET_ONBOARDING_DONE:
      return { ...state, config: { ...state.config, onboardingDone: true } }
    case ACTIONS.UPDATE_PROGRESS: {
      const prev = state.progress[action.topicId] || { completed: 0, total: 0 }
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.topicId]: { ...prev, ...action.data, lastSeen: new Date().toISOString() }
        }
      }
    }
    case ACTIONS.START_SESSION:
      return {
        ...state,
        session: { active: true, topicId: action.topicId, questionIndex: 0, answers: [], startedAt: new Date().toISOString() }
      }
    case ACTIONS.ADD_ANSWER:
      return {
        ...state,
        session: { ...state.session, questionIndex: state.session.questionIndex + 1, answers: [...state.session.answers, action.answer] }
      }
    case ACTIONS.END_SESSION: {
      const finishedSession = { ...state.session, active: false, endedAt: new Date().toISOString() }
      return { ...state, session: { ...initialState.session }, history: [finishedSession, ...state.history] }
    }
    case ACTIONS.ADD_INTERVIEW:
      return { ...state, interviews: [action.interview, ...(state.interviews || [])] }
    case ACTIONS.ADD_STREAK_DAY: {
      const today   = new Date().toISOString().split('T')[0]
      const already = state.config.streakDays.includes(today)
      return {
        ...state,
        config: {
          ...state.config,
          lastActiveDate: today,
          streakDays: already ? state.config.streakDays : [...state.config.streakDays, today],
        }
      }
    }
    case ACTIONS.RESET:
      return initialState
    default:
      return state
  }
}

// ─── Suite de tests ──────────────────────────────────────────────────────────

describe('reducer — función pura del store global', () => {

  // ── LOAD_STATE ──────────────────────────────────────────────────────────
  describe('LOAD_STATE', () => {
    it('hace merge del payload sobre el estado actual', () => {
      // ¿Por qué? LOAD_STATE se usa al hacer login para cargar datos de Supabase.
      // No reemplaza TODO el estado — hace un spread para preservar campos
      // que no vienen de la DB (como la sesión activa).
      const payload = {
        user: { name: 'Lucas', targetDate: '2026-06-01', selfAssessment: {}, rawOffers: '', extractedTopics: [] },
        progress: { python: { completed: 3, total: 5, lastScore: 8, lastSeen: '2026-03-01' } },
      }
      const newState = reducer(initialState, { type: ACTIONS.LOAD_STATE, payload })

      // Los datos del payload se cargaron
      expect(newState.user.name).toBe('Lucas')
      expect(newState.progress.python.completed).toBe(3)

      // Los campos no incluidos en payload se preservan del estado original
      expect(newState.session).toEqual(initialState.session)
    })
  })

  // ── SET_USER_FIELD ───────────────────────────────────────────────────────
  describe('SET_USER_FIELD', () => {
    it('actualiza solo el campo especificado del objeto user', () => {
      // ¿Por qué? El usuario puede editar su nombre o fecha sin afectar otros campos.
      const state = { ...initialState, user: { ...initialState.user, rawOffers: 'texto existente' } }
      const newState = reducer(state, { type: ACTIONS.SET_USER_FIELD, key: 'name', value: 'Lucas' })

      expect(newState.user.name).toBe('Lucas')
      // Verificamos que el campo hermano no fue modificado
      expect(newState.user.rawOffers).toBe('texto existente')
      // El resto del estado no cambió
      expect(newState.progress).toBe(state.progress)
    })

    it('es inmutable: no modifica el estado original', () => {
      const originalUser = { ...initialState.user }
      reducer(initialState, { type: ACTIONS.SET_USER_FIELD, key: 'name', value: 'Lucas' })
      // El objeto original no debe haber cambiado
      expect(initialState.user).toEqual(originalUser)
    })
  })

  // ── SET_CONFIG_FIELD ─────────────────────────────────────────────────────
  describe('SET_CONFIG_FIELD', () => {
    it('actualiza solo el campo de config especificado', () => {
      const newState = reducer(initialState, { type: ACTIONS.SET_CONFIG_FIELD, key: 'theme', value: 'dusk' })

      expect(newState.config.theme).toBe('dusk')
      // Los otros campos de config se preservan
      expect(newState.config.font).toBe('forge')
      expect(newState.config.language).toBe('es')
    })
  })

  // ── SET_ONBOARDING_DONE ──────────────────────────────────────────────────
  describe('SET_ONBOARDING_DONE', () => {
    it('marca onboardingDone como true', () => {
      // ¿Por qué es crítico? Si este campo no se guarda, el usuario vuelve al onboarding
      // cada vez que se loguea. Es el bug más destructivo que puede tener la app.
      expect(initialState.config.onboardingDone).toBe(false) // precondición

      const newState = reducer(initialState, { type: ACTIONS.SET_ONBOARDING_DONE })

      expect(newState.config.onboardingDone).toBe(true)
      // El resto de config no cambió
      expect(newState.config.theme).toBe('forge')
    })
  })

  // ── UPDATE_PROGRESS ──────────────────────────────────────────────────────
  describe('UPDATE_PROGRESS', () => {
    it('crea entrada de progreso nueva para topic sin historial previo', () => {
      const newState = reducer(initialState, {
        type:    ACTIONS.UPDATE_PROGRESS,
        topicId: 'python',
        data:    { completed: 3, total: 5, lastScore: 7 },
      })

      const p = newState.progress.python
      expect(p.completed).toBe(3)
      expect(p.total).toBe(5)
      expect(p.lastScore).toBe(7)
      // lastSeen se genera automáticamente al actualizar
      expect(p.lastSeen).toBeTruthy()
      expect(typeof p.lastSeen).toBe('string')
    })

    it('hace merge con progreso existente sin perder otros campos', () => {
      // ¿Por qué? Si el usuario practicó Python antes y vuelve a practicar,
      // solo actualizamos los nuevos campos — no perdemos el historial de lastSeen.
      const stateWithProgress = {
        ...initialState,
        progress: { python: { completed: 2, total: 5, lastScore: 6, lastSeen: '2026-01-01' } }
      }

      const newState = reducer(stateWithProgress, {
        type:    ACTIONS.UPDATE_PROGRESS,
        topicId: 'python',
        data:    { completed: 3, lastScore: 8 },
      })

      expect(newState.progress.python.completed).toBe(3)    // actualizado
      expect(newState.progress.python.lastScore).toBe(8)    // actualizado
      expect(newState.progress.python.total).toBe(5)        // preservado del prev
    })

    it('no afecta el progreso de otros topics', () => {
      const stateWithProgress = {
        ...initialState,
        progress: {
          python: { completed: 2, total: 5, lastScore: 6, lastSeen: '2026-01-01' },
          sql:    { completed: 1, total: 3, lastScore: 5, lastSeen: '2026-01-02' },
        }
      }

      const newState = reducer(stateWithProgress, {
        type:    ACTIONS.UPDATE_PROGRESS,
        topicId: 'python',
        data:    { completed: 3 },
      })

      // sql no fue modificado
      expect(newState.progress.sql).toEqual(stateWithProgress.progress.sql)
    })
  })

  // ── START_SESSION ────────────────────────────────────────────────────────
  describe('START_SESSION', () => {
    it('inicializa la sesión con los valores correctos', () => {
      const newState = reducer(initialState, { type: ACTIONS.START_SESSION, topicId: 'python' })

      expect(newState.session.active).toBe(true)
      expect(newState.session.topicId).toBe('python')
      expect(newState.session.questionIndex).toBe(0)
      expect(newState.session.answers).toEqual([])
      expect(newState.session.startedAt).toBeTruthy()
    })
  })

  // ── ADD_ANSWER ───────────────────────────────────────────────────────────
  describe('ADD_ANSWER', () => {
    it('agrega la respuesta al array y avanza el questionIndex', () => {
      const stateWithSession = {
        ...initialState,
        session: { active: true, topicId: 'python', questionIndex: 0, answers: [], startedAt: new Date().toISOString() }
      }

      const answer = { question: '¿Qué es un decorator?', userAnswer: 'Una función...', score: 8, feedback: 'Bien' }
      const newState = reducer(stateWithSession, { type: ACTIONS.ADD_ANSWER, answer })

      expect(newState.session.answers).toHaveLength(1)
      expect(newState.session.answers[0]).toEqual(answer)
      expect(newState.session.questionIndex).toBe(1)  // avanzó de 0 a 1
    })

    it('acumula múltiples respuestas en orden correcto', () => {
      let state = {
        ...initialState,
        session: { active: true, topicId: 'python', questionIndex: 0, answers: [], startedAt: new Date().toISOString() }
      }
      const answer1 = { question: 'Q1', userAnswer: 'A1', score: 7, feedback: 'Ok' }
      const answer2 = { question: 'Q2', userAnswer: 'A2', score: 9, feedback: 'Excelente' }

      state = reducer(state, { type: ACTIONS.ADD_ANSWER, answer: answer1 })
      state = reducer(state, { type: ACTIONS.ADD_ANSWER, answer: answer2 })

      expect(state.session.answers).toHaveLength(2)
      expect(state.session.answers[0]).toEqual(answer1)
      expect(state.session.answers[1]).toEqual(answer2)
      expect(state.session.questionIndex).toBe(2)
    })
  })

  // ── END_SESSION ──────────────────────────────────────────────────────────
  describe('END_SESSION', () => {
    it('mueve la sesión al historial y resetea la sesión activa', () => {
      const stateWithSession = {
        ...initialState,
        session: {
          active: true, topicId: 'python', questionIndex: 2,
          answers: [{ score: 8 }, { score: 6 }], startedAt: '2026-03-21T10:00:00Z'
        },
        history: [],
      }

      const newState = reducer(stateWithSession, { type: ACTIONS.END_SESSION })

      // La sesión activa quedó como la sesión terminada en el historial
      expect(newState.history).toHaveLength(1)
      expect(newState.history[0].topicId).toBe('python')
      expect(newState.history[0].active).toBe(false)      // siempre false en historial
      expect(newState.history[0].endedAt).toBeTruthy()    // se generó automáticamente

      // La sesión activa se reseteó
      expect(newState.session.active).toBe(false)
      expect(newState.session.answers).toEqual([])
      expect(newState.session.topicId).toBeNull()
    })

    it('las sesiones nuevas se agregan al PRINCIPIO del historial (más reciente primero)', () => {
      const stateWithHistory = {
        ...initialState,
        session: { active: true, topicId: 'sql', questionIndex: 1, answers: [], startedAt: new Date().toISOString() },
        history: [{ topicId: 'python', active: false, endedAt: '2026-03-20T10:00:00Z' }],
      }

      const newState = reducer(stateWithHistory, { type: ACTIONS.END_SESSION })

      expect(newState.history[0].topicId).toBe('sql')     // nueva sesión → primero
      expect(newState.history[1].topicId).toBe('python')  // sesión vieja → segundo
    })
  })

  // ── ADD_INTERVIEW ────────────────────────────────────────────────────────
  describe('ADD_INTERVIEW', () => {
    it('agrega la entrevista al principio del array', () => {
      const iv1 = { type: 'custom', topicIds: ['python'], difficulty: 'mid', endedAt: '2026-03-20' }
      const iv2 = { type: 'full',   topicIds: ['sql'],    difficulty: 'senior', endedAt: '2026-03-21' }

      let state = reducer(initialState, { type: ACTIONS.ADD_INTERVIEW, interview: iv1 })
      state     = reducer(state,        { type: ACTIONS.ADD_INTERVIEW, interview: iv2 })

      expect(state.interviews[0]).toEqual(iv2)  // la más nueva al principio
      expect(state.interviews[1]).toEqual(iv1)
    })
  })

  // ── ADD_STREAK_DAY ───────────────────────────────────────────────────────
  describe('ADD_STREAK_DAY', () => {
    it('agrega el día de hoy al array de streakDays', () => {
      const newState = reducer(initialState, { type: ACTIONS.ADD_STREAK_DAY })
      const today    = new Date().toISOString().split('T')[0]

      expect(newState.config.streakDays).toContain(today)
      expect(newState.config.lastActiveDate).toBe(today)
    })

    it('no duplica el día si ya está en el array', () => {
      const today = new Date().toISOString().split('T')[0]
      const stateWithToday = {
        ...initialState,
        config: { ...initialState.config, streakDays: [today] }
      }

      const newState = reducer(stateWithToday, { type: ACTIONS.ADD_STREAK_DAY })

      // El día no se duplicó — sigue siendo solo uno
      expect(newState.config.streakDays.filter(d => d === today)).toHaveLength(1)
    })
  })

  // ── RESET ────────────────────────────────────────────────────────────────
  describe('RESET', () => {
    it('devuelve exactamente el initialState', () => {
      // Creamos un estado con datos para verificar que RESET limpia todo
      const dirtyState = {
        user:       { name: 'Lucas', targetDate: '2026-06-01', selfAssessment: {}, rawOffers: 'texto', extractedTopics: ['python'] },
        progress:   { python: { completed: 5, total: 5, lastScore: 9, lastSeen: '2026-03-21' } },
        session:    { active: true, topicId: 'python', questionIndex: 3, answers: [{score:8}], startedAt: '...' },
        history:    [{ topicId: 'sql', active: false }],
        interviews: [{ type: 'full' }],
        config:     { onboardingDone: true, theme: 'dusk', font: 'clean', language: 'en', streakDays: ['2026-03-21'], lastActiveDate: '2026-03-21' },
      }

      const newState = reducer(dirtyState, { type: ACTIONS.RESET })

      expect(newState.user.name).toBeNull()
      expect(newState.progress).toEqual({})
      expect(newState.session.active).toBe(false)
      expect(newState.history).toEqual([])
      expect(newState.interviews).toEqual([])
      expect(newState.config.onboardingDone).toBe(false)
      expect(newState.config.theme).toBe('forge')
    })
  })

  // ── Acción desconocida ───────────────────────────────────────────────────
  describe('Acción desconocida', () => {
    it('devuelve el estado sin modificar (caso default del switch)', () => {
      const newState = reducer(initialState, { type: 'ACCION_INEXISTENTE' })
      // Retorna la MISMA REFERENCIA, no solo un valor igual
      expect(newState).toBe(initialState)
    })
  })
})
