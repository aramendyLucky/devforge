/**
 * src/store/index.jsx
 *
 * STORE GLOBAL — estado de la app con persistencia en Supabase.
 *
 * ¿Cómo funciona la sincronización?
 *
 *   Al LOGIN:
 *     → detectamos que user cambió de null a un objeto con id
 *     → llamamos a loadUserData(user.id) desde la DB
 *     → si hay datos, hacemos dispatch(LOAD_STATE) con todo el historial
 *     → si es un usuario nuevo, el estado inicial queda como está (onboarding)
 *
 *   Durante el uso:
 *     → los cambios en user y config se sincronizan con debounce de 800ms
 *       (evita saturar Supabase con un request por cada tecla)
 *     → los cambios en progress se sincronizan inmediatamente
 *     → END_SESSION: interceptamos en syncDispatch y guardamos la sesión
 *     → ADD_INTERVIEW: interceptamos en syncDispatch y guardamos la entrevista
 *
 *   Al LOGOUT:
 *     → detectamos que user pasó a null
 *     → hacemos dispatch(RESET) para limpiar el estado local
 *     → así el próximo usuario que se loguee no ve datos del anterior
 *
 * ¿Por qué usamos useRef para acceder al estado dentro de syncDispatch?
 *   Las funciones de callback en React tienen "closure" sobre el estado
 *   del render en que fueron creadas. Si usamos state directamente dentro
 *   de syncDispatch, estaríamos leyendo el estado "viejo" del render anterior.
 *   stateRef.current siempre apunta al estado más reciente.
 */

import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import * as db from '../lib/db'

// ─── Estado inicial ───────────────────────────────────────────────────────────
// Es el punto de partida cuando no hay datos cargados todavía
// (usuario nuevo o esperando que loadUserData termine)
const initialState = {
  // Perfil del usuario — se llena durante el onboarding
  user: {
    name:            null,
    targetDate:      null,       // fecha de la entrevista objetivo (ISO string)
    selfAssessment:  {},         // { topicId: 1-5 } evaluación propia
    rawOffers:       '',         // texto pegado de las ofertas laborales
    extractedTopics: [],         // temas extraídos por IA de las ofertas
  },

  // Progreso por tema — se actualiza después de cada sesión
  // { topicId: { completed, total, lastScore, lastSeen } }
  progress: {},

  // Sesión activa — estado temporal mientras el usuario practica
  // No se persiste en DB (solo sesiones COMPLETADAS se guardan)
  session: {
    active:        false,
    topicId:       null,
    questionIndex: 0,
    answers:       [],           // [{ question, answer, score, feedback }]
    startedAt:     null,
  },

  // Historial de sesiones completadas (cargado desde DB al login)
  history: [],

  // Historial de entrevistas simuladas completadas (cargado desde DB al login)
  interviews: [],

  // Configuración de la app
  config: {
    onboardingDone:  false,
    streakDays:      [],         // ['2025-01-01', ...]
    lastActiveDate:  null,
    theme:           'forge',    // 'forge' | 'dusk' | 'chalk'
    font:            'forge',    // 'forge' | 'clean' | 'terminal'
    language:        'es',       // 'es' | 'en' — idioma de la interfaz
  },
}

// ─── Tipos de acciones ────────────────────────────────────────────────────────
// Constantes para evitar errores de tipeo en strings.
// Si escribís mal el nombre de una acción, el editor te avisa.
export const ACTIONS = {
  SET_USER_FIELD:      'SET_USER_FIELD',
  SET_ONBOARDING_DONE: 'SET_ONBOARDING_DONE',
  SET_CONFIG_FIELD:    'SET_CONFIG_FIELD',
  UPDATE_PROGRESS:     'UPDATE_PROGRESS',
  START_SESSION:       'START_SESSION',
  ADD_ANSWER:          'ADD_ANSWER',
  END_SESSION:         'END_SESSION',
  ADD_STREAK_DAY:      'ADD_STREAK_DAY',
  ADD_INTERVIEW:       'ADD_INTERVIEW',
  LOAD_STATE:          'LOAD_STATE',   // carga datos desde Supabase al hacer login
  RESET:               'RESET',        // limpia el estado al hacer logout
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
// Función pura: recibe el estado actual y una acción, devuelve el nuevo estado.
// "Pura" significa que no tiene efectos secundarios — solo transforma datos.
// Los efectos secundarios (guardar en DB) van en el StoreProvider.
function reducer(state, action) {
  switch (action.type) {

    // Carga masiva de estado desde Supabase al iniciar sesión
    case ACTIONS.LOAD_STATE:
      return { ...state, ...action.payload }

    // Actualiza un campo específico del objeto user
    // Uso: dispatch({ type: ACTIONS.SET_USER_FIELD, key: 'name', value: 'Lucas' })
    case ACTIONS.SET_USER_FIELD:
      return {
        ...state,
        user: { ...state.user, [action.key]: action.value }
      }

    // Actualiza un campo específico del objeto config
    // Uso: dispatch({ type: ACTIONS.SET_CONFIG_FIELD, key: 'theme', value: 'dusk' })
    case ACTIONS.SET_CONFIG_FIELD:
      return {
        ...state,
        config: { ...state.config, [action.key]: action.value }
      }

    // Marca el onboarding como completado
    case ACTIONS.SET_ONBOARDING_DONE:
      return {
        ...state,
        config: { ...state.config, onboardingDone: true }
      }

    // Actualiza el progreso de un topic específico
    // Uso: dispatch({ type: ACTIONS.UPDATE_PROGRESS, topicId: 'python', data: { completed: 3, total: 5, lastScore: 8 } })
    case ACTIONS.UPDATE_PROGRESS: {
      const prev = state.progress[action.topicId] || { completed: 0, total: 0 }
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.topicId]: {
            ...prev,
            ...action.data,
            lastSeen: new Date().toISOString(),
          }
        }
      }
    }

    // Inicia una nueva sesión de práctica
    case ACTIONS.START_SESSION:
      return {
        ...state,
        session: {
          active:        true,
          topicId:       action.topicId,
          questionIndex: 0,
          answers:       [],
          startedAt:     new Date().toISOString(),
        }
      }

    // Agrega una respuesta a la sesión activa y avanza al siguiente índice
    case ACTIONS.ADD_ANSWER:
      return {
        ...state,
        session: {
          ...state.session,
          questionIndex: state.session.questionIndex + 1,
          answers:       [...state.session.answers, action.answer],
        }
      }

    // Termina la sesión activa y la mueve al historial
    // La sesión completada queda al principio del array (más reciente primero)
    case ACTIONS.END_SESSION: {
      const finishedSession = {
        ...state.session,
        active:   false,
        endedAt:  new Date().toISOString(),
      }
      return {
        ...state,
        session: { ...initialState.session },       // resetea la sesión activa
        history: [finishedSession, ...state.history], // agrega al historial local
      }
    }

    // Agrega una entrevista simulada completada al historial
    case ACTIONS.ADD_INTERVIEW:
      return {
        ...state,
        interviews: [action.interview, ...(state.interviews || [])],
      }

    // Agrega el día de hoy al streak si no está ya registrado
    case ACTIONS.ADD_STREAK_DAY: {
      const today   = new Date().toISOString().split('T')[0]
      const already = state.config.streakDays.includes(today)
      return {
        ...state,
        config: {
          ...state.config,
          lastActiveDate: today,
          streakDays:     already
            ? state.config.streakDays
            : [...state.config.streakDays, today],
        }
      }
    }

    // Vuelve al estado inicial — se usa al hacer logout
    case ACTIONS.RESET:
      return initialState

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const StoreContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function StoreProvider({ children }) {
  const [state, dispatch]   = useReducer(reducer, initialState)
  const { user }            = useAuth() // obtenemos el usuario del AuthContext

  // stateRef: referencia mutable al estado actual.
  // Usamos un ref en lugar de leer state directamente dentro de syncDispatch
  // porque los callbacks de useCallback tienen closure sobre el render anterior.
  // stateRef.current siempre apunta al estado del render más reciente.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // ── Carga de datos al login / limpieza al logout ─────────────────────────
  useEffect(() => {
    if (!user) {
      // El usuario cerró sesión → limpiamos el estado local
      // para que el próximo usuario que se loguee vea su propio estado
      dispatch({ type: ACTIONS.RESET })
      return
    }

    // El usuario inició sesión → cargamos sus datos desde Supabase
    async function loadData() {
      const data = await db.loadUserData(user.id)
      if (data) {
        // Hay datos guardados → los cargamos al store
        dispatch({ type: ACTIONS.LOAD_STATE, payload: data })
      }
      // Si data es null → usuario nuevo, el estado inicial se mantiene
      // y el usuario pasará por el onboarding
    }

    loadData()
  }, [user?.id]) // se ejecuta solo cuando el ID del usuario cambia (login/logout)

  // ── Sincronización de perfil y config (con debounce) ────────────────────
  // Cada vez que user o config cambian, esperamos 800ms antes de guardar.
  // Si el usuario sigue escribiendo, cancelamos el timer y esperamos de nuevo.
  // Esto evita hacer un request a Supabase por cada tecla presionada.
  useEffect(() => {
    if (!user) return // no sincronizamos si no hay sesión activa

    const timer = setTimeout(() => {
      db.syncProfile(user.id, state.user, state.config)
    }, 800)

    // La función de limpieza cancela el timer si el efecto se re-ejecuta
    // antes de que pasen los 800ms (el usuario siguió escribiendo)
    return () => clearTimeout(timer)
  }, [user?.id, state.user, state.config])

  // ── Sincronización de progreso (inmediata) ───────────────────────────────
  // El progreso por topic se guarda inmediatamente porque es crítico
  // que no se pierda — es el dato más importante de la app.
  useEffect(() => {
    if (!user) return
    if (Object.keys(state.progress).length === 0) return // sin progreso, no sincronizamos

    db.syncProgress(user.id, state.progress)
  }, [user?.id, state.progress])

  // ── syncDispatch: dispatch con sincronización de sesiones e interviews ───
  // Es un wrapper del dispatch original que intercepta acciones específicas
  // para persistirlas en Supabase inmediatamente.
  //
  // ¿Por qué no usamos useEffect para sessions e interviews?
  // Porque necesitamos capturar el momento EXACTO en que terminan.
  // Un useEffect que observa history.length podría dispararse también
  // cuando cargamos el historial desde Supabase al hacer login,
  // lo que causaría re-guardados innecesarios de sesiones antiguas.
  const syncDispatch = useCallback((action) => {
    // 1. Actualizamos el estado local inmediatamente (experiencia fluida)
    dispatch(action)

    // 2. Si no hay usuario autenticado, no necesitamos sincronizar con la DB
    if (!user) return

    // 3. Para acciones que crean datos nuevos, los persistimos en Supabase
    switch (action.type) {

      case ACTIONS.END_SESSION: {
        // Reconstruimos la sesión terminada igual que lo hace el reducer,
        // usando stateRef.current para leer el estado actual (evita closure viejo)
        const currentSession = stateRef.current.session
        const finishedSession = {
          ...currentSession,
          active:  false,
          endedAt: new Date().toISOString(),
        }
        // Fire and forget: no esperamos la respuesta para no bloquear la UI
        db.saveSession(user.id, finishedSession)
        break
      }

      case ACTIONS.ADD_INTERVIEW: {
        // La entrevista viene directamente en action.interview
        db.saveInterview(user.id, action.interview)
        break
      }

      // El resto de las acciones no necesitan manejo especial acá
      // (se sincronizan a través de los useEffect de arriba)
      default:
        break
    }
  }, [user]) // se recrea solo cuando el usuario cambia (login/logout)

  // ── Valor expuesto al contexto ───────────────────────────────────────────
  // Exportamos syncDispatch como "dispatch" para que ningún componente
  // existente de la app necesite cambiar su forma de usarlo.
  // Todos los componentes siguen llamando dispatch({ type: ... }) como antes.
  return (
    <StoreContext.Provider value={{ state, dispatch: syncDispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

// ─── Hook de acceso ───────────────────────────────────────────────────────────
/**
 * useStore — hook para consumir el estado global desde cualquier componente.
 *
 * Uso:
 *   const { state, dispatch } = useStore()
 *
 * Lanza un error claro si se usa fuera de <StoreProvider>.
 */
export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) {
    throw new Error('[DevForge] useStore() debe usarse dentro de <StoreProvider>. ' +
      'Verificá que <StoreProvider> esté en main.jsx.')
  }
  return ctx
}
