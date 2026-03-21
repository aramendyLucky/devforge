/**
 * src/__tests__/data/topics.test.js
 *
 * TESTS DEL CATÁLOGO DE TEMAS — valida la integridad de los datos estáticos.
 *
 * ¿Por qué testear datos estáticos?
 *   El catálogo de topics.js es el corazón del producto: alimenta el dashboard,
 *   el algoritmo de recomendación, las sesiones de práctica y las entrevistas.
 *   Si alguien agrega un topic con un campo faltante o un ID duplicado,
 *   estos tests fallan inmediatamente, antes de que el bug llegue a producción.
 *
 *   Ejemplo de bug que esto previene:
 *   - Nuevo developer agrega { id: 'python', name: 'Python Avanzado', ... }
 *     → duplicate ID → el algoritmo de recomendación devuelve el topic equivocado
 *   - Alguien olvida el campo `tier` → el componente Dashboard explota al hacer `.filter(t => t.tier === 1)`
 */

import {
  TOPICS,
  getTopicById,
  getTopicsByTier,
  ALL_TOPIC_IDS,
} from '../../data/topics.js'

describe('TOPICS — catálogo de temas técnicos', () => {

  // ── Integridad del catálogo ──────────────────────────────────────────────
  describe('Integridad del catálogo', () => {
    it('tiene al menos 1 tema definido', () => {
      // Verificamos que el archivo no esté vacío
      expect(TOPICS.length).toBeGreaterThan(0)
    })

    it('todos los temas tienen los campos obligatorios', () => {
      // ¿Por qué estos campos? Son los que usa el resto de la app:
      // - id → clave de progreso en el store
      // - name → label en el UI
      // - tier → filtro en Dashboard y algoritmo de recomendación
      // - category → SkillRadar chart y filtros
      // - icon → emojis en el UI
      // - description → card de detalle
      const requiredFields = ['id', 'name', 'tier', 'category', 'icon', 'description']

      TOPICS.forEach(topic => {
        requiredFields.forEach(field => {
          expect(topic[field], `Topic '${topic.id}' le falta el campo '${field}'`).toBeDefined()
          expect(topic[field], `Topic '${topic.id}' tiene '${field}' vacío`).not.toBe('')
        })
      })
    })

    it('todos los valores de tier son 1, 2 o 3', () => {
      // El sistema asume exactamente 3 tiers. Un tier inválido rompería el Dashboard
      // y el algoritmo de recomendación (TIER_WEIGHT solo tiene keys 1, 2, 3).
      const validTiers = [1, 2, 3]
      TOPICS.forEach(topic => {
        expect(
          validTiers.includes(topic.tier),
          `Topic '${topic.id}' tiene tier=${topic.tier} (inválido, debe ser 1, 2 o 3)`
        ).toBe(true)
      })
    })

    it('no hay IDs duplicados', () => {
      // Un ID duplicado causaría que el progreso de un topic sobreescriba al otro
      // en el store (ambos comparten la misma key del objeto progress).
      const ids = TOPICS.map(t => t.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })

    it('todos los IDs son strings en snake_case sin espacios ni mayúsculas', () => {
      // Los IDs se usan como keys en objetos JS y como valores en URLs.
      // Un ID con espacios o mayúsculas causaría inconsistencias en el store.
      const snakeCaseRegex = /^[a-z][a-z0-9_]*$/

      TOPICS.forEach(topic => {
        expect(
          snakeCaseRegex.test(topic.id),
          `Topic id '${topic.id}' no es snake_case válido`
        ).toBe(true)
      })
    })

    it('las categorías son valores del conjunto válido', () => {
      // El SkillRadar y los filtros esperan estas categorías específicas.
      const validCategories = ['backend', 'frontend', 'cloud', 'database', 'devops', 'ai', 'methodology']

      TOPICS.forEach(topic => {
        expect(
          validCategories.includes(topic.category),
          `Topic '${topic.id}' tiene category='${topic.category}' (no es una categoría válida)`
        ).toBe(true)
      })
    })

    it('hay temas en los 3 tiers', () => {
      // Verificamos que ningún tier esté vacío — el Dashboard muestra secciones
      // separadas por tier. Si alguno está vacío, la sección quedaría vacía.
      const tiers = TOPICS.map(t => t.tier)
      expect(tiers).toContain(1)
      expect(tiers).toContain(2)
      expect(tiers).toContain(3)
    })
  })

  // ── getTopicById ─────────────────────────────────────────────────────────
  describe('getTopicById', () => {
    it('retorna el topic correcto para un ID existente', () => {
      const topic = getTopicById('python')

      expect(topic).not.toBeNull()
      expect(topic.id).toBe('python')
      expect(topic.name).toBe('Python Core')
      expect(topic.tier).toBe(1)
    })

    it('retorna null para un ID que no existe', () => {
      // ¿Por qué testear el caso null? Porque el resto del código hace
      // `const topic = getTopicById(id); if (!topic) return null`
      // Si esta función lanzara un error en vez de null, rompería esos flujos.
      const topic = getTopicById('tecnologia_inventada')
      expect(topic).toBeNull()
    })

    it('retorna null para undefined', () => {
      expect(getTopicById(undefined)).toBeNull()
    })

    it('retorna null para string vacío', () => {
      expect(getTopicById('')).toBeNull()
    })
  })

  // ── getTopicsByTier ──────────────────────────────────────────────────────
  describe('getTopicsByTier', () => {
    it('filtra correctamente por tier 1', () => {
      const tier1 = getTopicsByTier(1)

      expect(tier1.length).toBeGreaterThan(0)
      tier1.forEach(t => expect(t.tier).toBe(1))
    })

    it('filtra correctamente por tier 2', () => {
      const tier2 = getTopicsByTier(2)

      expect(tier2.length).toBeGreaterThan(0)
      tier2.forEach(t => expect(t.tier).toBe(2))
    })

    it('filtra correctamente por tier 3', () => {
      const tier3 = getTopicsByTier(3)

      expect(tier3.length).toBeGreaterThan(0)
      tier3.forEach(t => expect(t.tier).toBe(3))
    })

    it('devuelve array vacío para un tier que no existe', () => {
      const result = getTopicsByTier(99)
      expect(result).toEqual([])
    })

    it('los 3 tiers cubren todos los topics del catálogo', () => {
      // La suma de topics por tier debe ser igual al total
      const total = TOPICS.length
      const t1 = getTopicsByTier(1).length
      const t2 = getTopicsByTier(2).length
      const t3 = getTopicsByTier(3).length

      expect(t1 + t2 + t3).toBe(total)
    })
  })

  // ── ALL_TOPIC_IDS ─────────────────────────────────────────────────────────
  describe('ALL_TOPIC_IDS', () => {
    it('contiene todos los IDs del catálogo', () => {
      expect(ALL_TOPIC_IDS.length).toBe(TOPICS.length)
    })

    it('cada ID en ALL_TOPIC_IDS existe en TOPICS', () => {
      ALL_TOPIC_IDS.forEach(id => {
        const found = TOPICS.find(t => t.id === id)
        expect(found, `ID '${id}' en ALL_TOPIC_IDS no existe en TOPICS`).toBeDefined()
      })
    })
  })
})
