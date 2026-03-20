import { useStore, ACTIONS } from '../store/index.jsx'

export function useSession() {
  const { state, dispatch } = useStore()

  function startSession(topicId) {
    dispatch({ type: ACTIONS.START_SESSION, topicId })
    dispatch({ type: ACTIONS.ADD_STREAK_DAY })
  }

  function submitAnswer(answer) {
    // answer: { question, userAnswer, score, feedback }
    dispatch({ type: ACTIONS.ADD_ANSWER, answer })
  }

  function endSession() {
    dispatch({ type: ACTIONS.END_SESSION })
  }

  // Score promedio de la sesión actual
  const currentScore = state.session.answers.length
    ? Math.round(
        state.session.answers.reduce((acc, a) => acc + (a.score || 0), 0) /
        state.session.answers.length
      )
    : null

  return {
    session:      state.session,
    isActive:     state.session.active,
    currentScore,
    startSession,
    submitAnswer,
    endSession,
  }
}
