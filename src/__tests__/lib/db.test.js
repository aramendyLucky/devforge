/**
 * src/__tests__/lib/db.test.js
 *
 * TESTS DE LA CAPA DE ACCESO A DATOS — valida que db.js interactúa
 * correctamente con Supabase y transforma los datos al formato del store.
 *
 * ¿Qué testear en una capa de datos?
 *   1. Que se llaman las funciones correctas de Supabase (from, select, eq, upsert, etc.)
 *   2. Que el mapeo de snake_case (DB) a camelCase (store) es correcto
 *   3. Que los errores se manejan silenciosamente (log + return null/[])
 *   4. Que los edge cases se manejan (usuario nuevo, progreso vacío, etc.)
 *
 * Estrategia de mock:
 *   Mockeamos el módulo completo de supabase (../lib/supabase) para que
 *   db.js use nuestros fakes en vez del cliente real.
 *
 *   El builder de Supabase es una cadena fluida (from().select().eq().single())
 *   que es un "thenable" (implementa .then()). Implementamos una clase
 *   MockBuilder que simula este comportamiento.
 */

import * as db from '../../lib/db.js'

// Limpiamos todos los mocks antes de CADA test para evitar que llamadas
// acumuladas de tests anteriores contaminen las aserciones de tests siguientes.
// (ej: loadUserData llama 4 veces a supabase.from → sin limpiar, syncProgress
// ve esas 4 llamadas previas y falla el expect "not.toHaveBeenCalled")
beforeEach(() => vi.clearAllMocks())

// ─── Mock del módulo supabase ─────────────────────────────────────────────
// vi.mock hoista automáticamente antes de los imports, así que este mock
// está disponible cuando db.js importa '../lib/supabase'.
vi.mock('../../lib/supabase.js', () => {
  /**
   * MockBuilder — simula la API fluida del query builder de Supabase.
   *
   * Cada método devuelve `this` para permitir el encadenamiento.
   * Implementa `then()` para que pueda ser usado con `await` directamente
   * (thenable), igual que el builder real de Supabase.
   *
   * El valor resuelto se configura en el constructor y puede ser
   * sobreescrito por `.single()`, `.upsert()`, etc.
   */
  class MockBuilder {
    constructor(resolved) {
      this._resolved = resolved
      this.select = vi.fn().mockReturnValue(this)
      this.eq     = vi.fn().mockReturnValue(this)
      this.order  = vi.fn().mockReturnValue(this)
      this.single = vi.fn().mockResolvedValue(resolved)
      this.upsert = vi.fn().mockResolvedValue(resolved)
      this.insert = vi.fn().mockResolvedValue(resolved)
      this.update = vi.fn().mockReturnValue(this)
      this.delete = vi.fn().mockReturnValue(this)
    }

    // Hace que el builder sea awaitable directamente:
    // `await supabase.from('x').select().eq()` resuelve a this._resolved
    then(resolve, reject) {
      return Promise.resolve(this._resolved).then(resolve, reject)
    }

    catch(fn) { return Promise.resolve(this._resolved).catch(fn) }
    finally(fn) { return Promise.resolve(this._resolved).finally(fn) }
  }

  // Instancia global del builder con valores por defecto
  // Cada test puede sobreescribir mockSupabase.from para retornar builders específicos
  const mockSupabase = {
    from: vi.fn(),
    auth: {
      getSession:          vi.fn(),
      onAuthStateChange:   vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword:  vi.fn(),
      signUp:              vi.fn(),
      signOut:             vi.fn(),
      updateUser:          vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  }

  // Exportamos tanto el mock como MockBuilder para que los tests puedan configurarlos
  return { supabase: mockSupabase, _MockBuilder: MockBuilder }
})

// Importamos el mock YA configurado para poder usarlo en los tests
import { supabase, _MockBuilder } from '../../lib/supabase.js'

const MockBuilder = _MockBuilder

// ─── Datos de prueba ──────────────────────────────────────────────────────

const MOCK_PROFILE = {
  user_id:          'user-123',
  name:             'Lucas',
  target_date:      '2026-06-01',
  raw_offers:       'Python developer offer...',
  extracted_topics: ['python', 'fastapi'],
  self_assessment:  { python: 4 },
  onboarding_done:  true,
  theme:            'dusk',
  font:             'clean',
  language:         'en',
  streak_days:      ['2026-03-20', '2026-03-21'],
  last_active_date: '2026-03-21',
}

const MOCK_PROGRESS_ROWS = [
  { topic_id: 'python', completed: 4, total: 5, last_score: 8, last_seen: '2026-03-20' },
  { topic_id: 'sql',    completed: 2, total: 3, last_score: 6, last_seen: '2026-03-15' },
]

const MOCK_SESSIONS = [
  { topic_id: 'python', answers: [{ score: 8 }], started_at: '2026-03-20T10:00', ended_at: '2026-03-20T10:30' },
]

const MOCK_INTERVIEWS = [
  { type: 'custom', topic_ids: ['python'], difficulty: 'mid', duration: 30, answers: [], skipped: [], started_at: '2026-03-21T11:00', ended_at: '2026-03-21T11:30' },
]

describe('db.loadUserData', () => {

  it('retorna null para usuario nuevo (perfil no encontrado → PGRST116)', async () => {
    // ¿Por qué PGRST116? Es el código que Supabase devuelve cuando .single()
    // no encuentra ninguna fila (0 rows). Para usuarios nuevos esto significa
    // "aún no hicieron el onboarding".
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return new MockBuilder({ data: null, error: { code: 'PGRST116' } })
      }
      return new MockBuilder({ data: [], error: null })
    })

    const result = await db.loadUserData('nuevo-user-id')
    expect(result).toBeNull()
  })

  it('mapea el perfil de DB (snake_case) al formato del store (camelCase)', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles')   return new MockBuilder({ data: MOCK_PROFILE, error: null })
      if (table === 'topic_progress') return new MockBuilder({ data: [], error: null })
      if (table === 'sessions')   return new MockBuilder({ data: [], error: null })
      if (table === 'interviews') return new MockBuilder({ data: [], error: null })
      return new MockBuilder({ data: null, error: null })
    })

    const result = await db.loadUserData('user-123')

    // El mapeado crítico: snake_case → camelCase
    expect(result.user.name).toBe('Lucas')
    expect(result.user.targetDate).toBe('2026-06-01')       // target_date → targetDate
    expect(result.user.rawOffers).toBe('Python developer offer...')  // raw_offers → rawOffers
    expect(result.user.extractedTopics).toEqual(['python', 'fastapi'])
    expect(result.user.selfAssessment).toEqual({ python: 4 })

    expect(result.config.onboardingDone).toBe(true)         // onboarding_done → onboardingDone
    expect(result.config.theme).toBe('dusk')
    expect(result.config.streakDays).toEqual(['2026-03-20', '2026-03-21'])  // streak_days
  })

  it('mapea las filas de topic_progress al objeto indexado del store', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles')   return new MockBuilder({ data: MOCK_PROFILE, error: null })
      if (table === 'topic_progress') return new MockBuilder({ data: MOCK_PROGRESS_ROWS, error: null })
      if (table === 'sessions')   return new MockBuilder({ data: [], error: null })
      if (table === 'interviews') return new MockBuilder({ data: [], error: null })
      return new MockBuilder({ data: null, error: null })
    })

    const result = await db.loadUserData('user-123')

    // La DB guarda ARRAY de filas; el store espera OBJETO indexado por topicId
    expect(result.progress.python.completed).toBe(4)
    expect(result.progress.python.lastScore).toBe(8)    // last_score → lastScore
    expect(result.progress.python.lastSeen).toBe('2026-03-20')  // last_seen → lastSeen
    expect(result.progress.sql.completed).toBe(2)
  })

  it('mapea las sesiones al formato del store (snake_case → camelCase)', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles')   return new MockBuilder({ data: MOCK_PROFILE, error: null })
      if (table === 'topic_progress') return new MockBuilder({ data: [], error: null })
      if (table === 'sessions')   return new MockBuilder({ data: MOCK_SESSIONS, error: null })
      if (table === 'interviews') return new MockBuilder({ data: [], error: null })
      return new MockBuilder({ data: null, error: null })
    })

    const result = await db.loadUserData('user-123')

    expect(result.history).toHaveLength(1)
    expect(result.history[0].topicId).toBe('python')        // topic_id → topicId
    expect(result.history[0].startedAt).toBe('2026-03-20T10:00')  // started_at → startedAt
    expect(result.history[0].active).toBe(false)           // siempre false en historial
  })

  it('retorna null si hay un error de Supabase (y no rompe la app)', async () => {
    // ¿Por qué null y no lanzar? La app puede funcionar sin datos de DB
    // usando el estado inicial — degradación elegante en vez de crash.
    supabase.from.mockImplementation(() => {
      return new MockBuilder({ data: null, error: { message: 'Connection refused', code: '08000' } })
    })

    const result = await db.loadUserData('user-123')
    expect(result).toBeNull()  // retorna null, no lanza error
  })
})

describe('db.syncProgress', () => {
  it('no hace nada si el objeto de progreso está vacío', async () => {
    // ¿Por qué? Un upsert vacío causaría un error en Supabase.
    // Evitar la llamada cuando no hay datos es más eficiente.
    await db.syncProgress('user-123', {})

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('convierte el objeto de progreso en filas de DB con upsert', async () => {
    const builder = new MockBuilder({ error: null })
    supabase.from.mockReturnValue(builder)

    const progress = {
      python: { completed: 4, total: 5, lastScore: 8, lastSeen: '2026-03-20' },
    }

    await db.syncProgress('user-123', progress)

    expect(supabase.from).toHaveBeenCalledWith('topic_progress')
    expect(builder.upsert).toHaveBeenCalledWith(
      [{ user_id: 'user-123', topic_id: 'python', completed: 4, total: 5, last_score: 8, last_seen: '2026-03-20' }],
      { onConflict: 'user_id,topic_id' }
    )
  })
})

describe('db.saveSession', () => {
  it('inserta la sesión con los campos mapeados al esquema de la DB', async () => {
    const builder = new MockBuilder({ error: null })
    supabase.from.mockReturnValue(builder)

    const session = {
      topicId:   'python',
      answers:   [{ score: 8 }],
      startedAt: '2026-03-21T10:00:00Z',
      endedAt:   '2026-03-21T10:30:00Z',
    }

    await db.saveSession('user-123', session)

    expect(supabase.from).toHaveBeenCalledWith('sessions')
    expect(builder.insert).toHaveBeenCalledWith({
      user_id:    'user-123',
      topic_id:   'python',     // topicId → topic_id
      answers:    [{ score: 8 }],
      started_at: '2026-03-21T10:00:00Z',   // startedAt → started_at
      ended_at:   '2026-03-21T10:30:00Z',   // endedAt → ended_at
    })
  })
})

describe('db.saveInterview', () => {
  it('inserta la entrevista con todos los campos mapeados', async () => {
    const builder = new MockBuilder({ error: null })
    supabase.from.mockReturnValue(builder)

    const interview = {
      type:       'custom',
      topicIds:   ['python', 'sql'],
      difficulty: 'mid',
      duration:   30,
      answers:    [],
      skipped:    [],
      startedAt:  '2026-03-21T11:00Z',
      endedAt:    '2026-03-21T11:30Z',
    }

    await db.saveInterview('user-123', interview)

    expect(supabase.from).toHaveBeenCalledWith('interviews')
    expect(builder.insert).toHaveBeenCalledWith({
      user_id:    'user-123',
      type:       'custom',
      topic_ids:  ['python', 'sql'],     // topicIds → topic_ids
      difficulty: 'mid',
      duration:   30,
      answers:    [],
      skipped:    [],
      started_at: '2026-03-21T11:00Z',
      ended_at:   '2026-03-21T11:30Z',
    })
  })
})

describe('db.loadOffers', () => {
  it('retorna las ofertas mapeadas al formato del store', async () => {
    const dbRows = [
      { id: 'offer-1', name: 'Senior Python Developer', summary: 'Buscan experto', topics: ['python'], saved_at: '2026-03-21' }
    ]
    const builder = new MockBuilder({ data: dbRows, error: null })
    supabase.from.mockReturnValue(builder)

    const result = await db.loadOffers('user-123')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('offer-1')
    expect(result[0].savedAt).toBe('2026-03-21')   // saved_at → savedAt
    expect(result[0].name).toBe('Senior Python Developer')
  })

  it('retorna array vacío cuando hay error', async () => {
    const builder = new MockBuilder({ data: null, error: { message: 'Error' } })
    supabase.from.mockReturnValue(builder)

    const result = await db.loadOffers('user-123')
    expect(result).toEqual([])
  })
})

describe('db.deleteOffer', () => {
  it('llama a delete con filtros de id Y user_id (seguridad doble)', async () => {
    // ¿Por qué filtrar también por user_id si hay RLS?
    // Es una capa extra de seguridad: si la RLS falla, el user_id
    // evita que un usuario borre ofertas de otro.
    const builder = new MockBuilder({ error: null })
    supabase.from.mockReturnValue(builder)

    await db.deleteOffer('user-123', 'offer-abc')

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'offer-abc')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })
})
