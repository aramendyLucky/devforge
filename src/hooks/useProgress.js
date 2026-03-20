import { useStore, ACTIONS } from '../store/index.jsx'

export function useProgress() {
  const { state, dispatch } = useStore()

  // Progreso de un tema específico
  function getTopicProgress(topicId) {
    return state.progress[topicId] || { completed: 0, total: 0, lastScore: null, lastSeen: null }
  }

  // Porcentaje global sobre todos los temas
  function getOverallPercent(topicIds = []) {
    if (!topicIds.length) return 0
    const total = topicIds.reduce((acc, id) => {
      const p = state.progress[id]
      return acc + (p ? (p.completed / (p.total || 1)) : 0)
    }, 0)
    return Math.round((total / topicIds.length) * 100)
  }

  // Temas débiles: completados < 50%
  function getWeakTopics(topicIds = []) {
    return topicIds.filter(id => {
      const p = state.progress[id]
      if (!p || !p.total) return true
      return (p.completed / p.total) < 0.5
    })
  }

  function updateProgress(topicId, data) {
    dispatch({ type: ACTIONS.UPDATE_PROGRESS, topicId, data })
  }

  return {
    progress: state.progress,
    getTopicProgress,
    getOverallPercent,
    getWeakTopics,
    updateProgress,
  }
}
