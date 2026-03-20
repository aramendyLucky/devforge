/**
 * src/lib/db.js
 *
 * CAPA DE ACCESO A DATOS — todas las operaciones de lectura y escritura
 * contra Supabase Database en un solo lugar.
 *
 * ¿Por qué centralizar las queries acá?
 * Si mañana cambia el esquema de la DB o queremos agregar caché,
 * hay UN solo lugar donde tocar, no 10 archivos distintos.
 * El store llama a estas funciones sin saber cómo funciona Supabase internamente.
 * Esto se llama "separación de responsabilidades" o capa de repositorio.
 *
 * Funciones exportadas:
 *   loadUserData(userId)           → carga todo el estado del usuario desde Supabase
 *   syncProfile(userId, user, cfg) → guarda perfil + config en la tabla profiles
 *   syncProgress(userId, progress) → guarda progreso por topic en topic_progress
 *   saveSession(userId, session)   → inserta una sesión completada en sessions
 *   saveInterview(userId, iv)      → inserta una entrevista completada en interviews
 *   loadOffers(userId)             → carga las ofertas guardadas del usuario
 *   saveOffer(userId, offer)       → inserta una oferta analizada con IA
 *   deleteOffer(userId, offerId)   → elimina una oferta guardada
 */

import { supabase } from './supabase'

// ─── loadUserData ────────────────────────────────────────────────────────────
/**
 * Carga todos los datos persistidos de un usuario desde Supabase.
 * Se llama una sola vez al iniciar sesión.
 *
 * Hace 4 queries en paralelo (Promise.all) para minimizar la latencia:
 * en lugar de esperar 4 queries en secuencia (~400ms), las lanza todas
 * a la vez y espera el resultado más lento (~100ms).
 *
 * @param {string} userId — UUID del usuario autenticado (auth.users.id)
 * @returns {Object|null} — objeto con la forma del estado del store,
 *                          o null si el usuario no tiene datos todavía
 *                          (primera vez que entra a la app)
 */
export async function loadUserData(userId) {
  try {
    // Ejecutamos las 4 queries en paralelo para no esperar una por una
    const [profileRes, progressRes, sessionsRes, interviewsRes] = await Promise.all([

      // Perfil del usuario (una sola fila con toda la info de onboarding + config)
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single(), // .single() devuelve el objeto directo, no un array de 1 elemento

      // Progreso por topic (múltiples filas, una por topic practicado)
      supabase
        .from('topic_progress')
        .select('*')
        .eq('user_id', userId),

      // Historial de sesiones (ordenado del más reciente al más antiguo)
      supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('ended_at', { ascending: false }),

      // Historial de entrevistas (ordenado del más reciente al más antiguo)
      supabase
        .from('interviews')
        .select('*')
        .eq('user_id', userId)
        .order('ended_at', { ascending: false }),
    ])

    // Si no existe el perfil todavía (usuario nuevo, primera vez),
    // .single() devuelve error con code PGRST116 ("no rows found").
    // En ese caso devolvemos null → el store usará initialState.
    if (profileRes.error?.code === 'PGRST116') {
      return null // usuario nuevo, sin datos todavía → onboarding
    }

    // Para cualquier otro error, lo propagamos para manejarlo arriba
    if (profileRes.error) throw profileRes.error
    if (progressRes.error) throw progressRes.error
    if (sessionsRes.error) throw sessionsRes.error
    if (interviewsRes.error) throw interviewsRes.error

    const profile    = profileRes.data
    const progressRows = progressRes.data || []
    const sessionRows  = sessionsRes.data || []
    const interviewRows = interviewsRes.data || []

    // ── Reconstruimos el progreso en el formato del store ──────────────
    // La DB guarda una fila por topic: { topic_id, completed, total, ... }
    // El store espera: { topicId: { completed, total, lastScore, lastSeen } }
    // Convertimos de array de filas a objeto indexado por topic_id
    const progress = {}
    for (const row of progressRows) {
      progress[row.topic_id] = {
        completed: row.completed,
        total:     row.total,
        lastScore: row.last_score,
        lastSeen:  row.last_seen,
      }
    }

    // ── Reconstruimos las sesiones en el formato del store ─────────────
    // La DB guarda: { topic_id, answers, started_at, ended_at }
    // El store espera: { topicId, answers, startedAt, endedAt, active }
    const history = sessionRows.map(row => ({
      topicId:   row.topic_id,
      answers:   row.answers,
      startedAt: row.started_at,
      endedAt:   row.ended_at,
      active:    false, // siempre false — solo guardamos sesiones completadas
    }))

    // ── Reconstruimos las entrevistas en el formato del store ──────────
    const interviews = interviewRows.map(row => ({
      type:       row.type,
      topicIds:   row.topic_ids,
      difficulty: row.difficulty,
      duration:   row.duration,
      answers:    row.answers,
      skipped:    row.skipped,
      startedAt:  row.started_at,
      endedAt:    row.ended_at,
    }))

    // ── Retornamos el estado completo en el formato exacto del store ───
    // Este objeto se pasa directamente al action LOAD_STATE del reducer
    return {
      user: {
        name:             profile.name,
        targetDate:       profile.target_date,
        selfAssessment:   profile.self_assessment  || {},
        rawOffers:        profile.raw_offers        || '',
        extractedTopics:  profile.extracted_topics  || [],
      },
      progress,
      history,
      interviews,
      config: {
        onboardingDone:  profile.onboarding_done  || false,
        theme:           profile.theme             || 'forge',
        font:            profile.font              || 'forge',
        language:        profile.language          || 'es',
        streakDays:      profile.streak_days       || [],
        lastActiveDate:  profile.last_active_date  || null,
      },
    }

  } catch (error) {
    // Logueamos el error pero no rompemos la app — el usuario puede
    // seguir usando DevForge con estado local, aunque no se sincronice
    console.error('[DevForge] Error cargando datos del usuario:', error)
    return null
  }
}


// ─── syncProfile ─────────────────────────────────────────────────────────────
/**
 * Guarda el perfil del usuario y su configuración en la tabla profiles.
 * Usa UPSERT: si la fila no existe la inserta, si ya existe la actualiza.
 *
 * Se llama con un delay (debounce de 800ms) para no hacer un request
 * a Supabase en cada tecla que escribe el usuario.
 *
 * @param {string} userId — UUID del usuario
 * @param {Object} user   — { name, targetDate, selfAssessment, rawOffers, extractedTopics }
 * @param {Object} config — { onboardingDone, theme, font, streakDays, lastActiveDate }
 */
export async function syncProfile(userId, user, config) {
  // Convertimos los nombres camelCase del store a snake_case de la DB
  // porque PostgreSQL usa snake_case por convención.
  //
  // IMPORTANTE: los campos opcionales (como language) los enviamos por separado
  // para que un campo faltante en la DB no rompa el guardado de los campos críticos.
  // El campo más importante es onboarding_done — si ese no se guarda, el usuario
  // tiene que hacer el onboarding de nuevo cada vez que se loguea.
  const { error } = await supabase
    .from('profiles')
    .upsert({
      user_id:          userId,
      name:             user.name,
      target_date:      user.targetDate,
      raw_offers:       user.rawOffers,
      extracted_topics: user.extractedTopics,
      self_assessment:  user.selfAssessment,
      onboarding_done:  config.onboardingDone,
      theme:            config.theme,
      font:             config.font,
      streak_days:      config.streakDays,
      last_active_date: config.lastActiveDate,
      // updated_at lo maneja automáticamente el trigger de Supabase
    }, {
      onConflict: 'user_id', // si ya existe fila con este user_id, hace UPDATE
    })

  if (error) {
    console.error('[DevForge] Error guardando perfil:', error)
    return // salimos para no intentar el campo opcional si el principal falló
  }

  // ── LECCIÓN APRENDIDA: columnas opcionales SIEMPRE en llamadas separadas ──
  //
  // PROBLEMA ORIGINAL (bug de persistencia — detectado Mar 2026):
  //   Teníamos `language` dentro del mismo upsert principal. Cuando la columna
  //   `language` aún no existía en la DB (ALTER TABLE pendiente), Supabase
  //   devolvía un error que ROMPÍA el upsert ENTERO, incluyendo `onboarding_done`.
  //   El error se capturaba silenciosamente en el catch del llamador, así que
  //   el perfil nunca se guardaba. Cada vez que el usuario se relogueaba, el store
  //   veía onboarding_done=false → mandaba al onboarding de nuevo.
  //
  // SÍNTOMA: El usuario completaba el onboarding, cerraba sesión, volvía a entrar
  //   y tenía que hacer el onboarding de vuelta — aunque los datos estaban "guardados".
  //
  // SOLUCIÓN: Separar columnas opcionales en llamadas independientes.
  //   Si la llamada opcional falla, solo falla ESA parte — el perfil principal
  //   ya fue guardado con éxito. Nunca un campo opcional debe bloquear uno crítico.
  //
  // REGLA GENERAL: Si una columna puede no existir (fase de migración) o es
  //   opcional, ponerla en un update/upsert SEPARADO con su propio manejo de error.
  if (config.language) {
    const { error: langError } = await supabase
      .from('profiles')
      .update({ language: config.language })
      .eq('user_id', userId)

    if (langError) {
      // Error esperado si el ALTER TABLE aún no fue ejecutado — no es crítico
      console.warn('[DevForge] No se pudo guardar idioma (¿falta correr el ALTER TABLE?):', langError.message)
    }
  }
}


// ─── syncProgress ────────────────────────────────────────────────────────────
/**
 * Guarda el progreso de todos los topics del usuario.
 * Usa UPSERT con onConflict para manejar insert/update automáticamente.
 *
 * El progreso tiene UNIQUE(user_id, topic_id) en la DB, así que si el
 * usuario ya practicó Python antes, este upsert actualiza esa fila
 * en lugar de crear una duplicada.
 *
 * @param {string} userId   — UUID del usuario
 * @param {Object} progress — { topicId: { completed, total, lastScore, lastSeen } }
 */
export async function syncProgress(userId, progress) {
  // Si no hay progreso todavía (objeto vacío), no hacemos nada
  const topicIds = Object.keys(progress)
  if (topicIds.length === 0) return

  // Convertimos el objeto de progreso en un array de filas para el upsert
  // { python: { completed: 3, ... } } → [{ user_id, topic_id: 'python', completed: 3, ... }]
  const rows = topicIds.map(topicId => ({
    user_id:    userId,
    topic_id:   topicId,
    completed:  progress[topicId].completed,
    total:      progress[topicId].total,
    last_score: progress[topicId].lastScore,
    last_seen:  progress[topicId].lastSeen,
  }))

  const { error } = await supabase
    .from('topic_progress')
    .upsert(rows, {
      onConflict: 'user_id,topic_id', // clave compuesta única para el upsert
    })

  if (error) {
    console.error('[DevForge] Error guardando progreso:', error)
  }
}


// ─── saveSession ─────────────────────────────────────────────────────────────
/**
 * Inserta una sesión de práctica completada en la DB.
 * Se llama UNA SOLA VEZ cuando el usuario termina una sesión (END_SESSION).
 * No usa upsert porque cada sesión es única e irrepetible.
 *
 * @param {string} userId  — UUID del usuario
 * @param {Object} session — { topicId, answers, startedAt, endedAt }
 */
export async function saveSession(userId, session) {
  const { error } = await supabase
    .from('sessions')
    .insert({
      user_id:    userId,
      topic_id:   session.topicId,
      answers:    session.answers,   // JSONB: [{ question, answer, score, feedback }]
      started_at: session.startedAt,
      ended_at:   session.endedAt,
    })

  if (error) {
    console.error('[DevForge] Error guardando sesión:', error)
  }
}


// ─── saveInterview ────────────────────────────────────────────────────────────
/**
 * Inserta una entrevista simulada completada en la DB.
 * Se llama UNA SOLA VEZ cuando el usuario termina la entrevista (ADD_INTERVIEW).
 *
 * @param {string} userId     — UUID del usuario
 * @param {Object} interview  — { type, topicIds, difficulty, duration, answers, skipped, startedAt, endedAt }
 */
export async function saveInterview(userId, interview) {
  const { error } = await supabase
    .from('interviews')
    .insert({
      user_id:    userId,
      type:       interview.type,
      topic_ids:  interview.topicIds,   // JSONB: ['python', 'aws', ...]
      difficulty: interview.difficulty,
      duration:   interview.duration,
      answers:    interview.answers,    // JSONB: [{ question, answer, ... }]
      skipped:    interview.skipped,    // JSONB: [{ question, ... }]
      started_at: interview.startedAt,
      ended_at:   interview.endedAt,
    })

  if (error) {
    console.error('[DevForge] Error guardando entrevista:', error)
  }
}


// ─── loadOffers ───────────────────────────────────────────────────────────────
/**
 * Carga las ofertas laborales guardadas por el usuario.
 * Ordenadas de la más reciente a la más antigua.
 *
 * @param {string} userId — UUID del usuario
 * @returns {Promise<Array>} — [{ id, name, summary, topics, savedAt }]
 */
export async function loadOffers(userId) {
  const { data, error } = await supabase
    .from('saved_offers')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })

  if (error) {
    console.error('[DevForge] Error cargando ofertas:', error)
    return []
  }

  return (data || []).map(row => ({
    id:      row.id,
    name:    row.name,
    summary: row.summary,
    topics:  row.topics,
    savedAt: row.saved_at,
  }))
}


// ─── saveOffer ────────────────────────────────────────────────────────────────
/**
 * Inserta una oferta analizada con IA en la DB.
 * Devuelve la oferta guardada con su ID real (UUID de Supabase).
 *
 * @param {string} userId — UUID del usuario
 * @param {Object} offer  — { name, summary, topics }
 * @returns {Promise<Object|null>} — oferta guardada con id y savedAt, o null si falló
 */
export async function saveOffer(userId, offer) {
  const { data, error } = await supabase
    .from('saved_offers')
    .insert({
      user_id: userId,
      name:    offer.name,
      summary: offer.summary || '',
      topics:  offer.topics  || [],
    })
    .select()
    .single()

  if (error) {
    console.error('[DevForge] Error guardando oferta:', error)
    return null
  }

  return {
    id:      data.id,
    name:    data.name,
    summary: data.summary,
    topics:  data.topics,
    savedAt: data.saved_at,
  }
}


// ─── deleteOffer ──────────────────────────────────────────────────────────────
/**
 * Elimina una oferta guardada del usuario.
 * El filtro por user_id es una segunda capa de seguridad (la primera es RLS).
 *
 * @param {string} userId   — UUID del usuario
 * @param {string} offerId  — UUID de la oferta a eliminar
 */
export async function deleteOffer(userId, offerId) {
  const { error } = await supabase
    .from('saved_offers')
    .delete()
    .eq('id',      offerId)
    .eq('user_id', userId)

  if (error) {
    console.error('[DevForge] Error eliminando oferta:', error)
  }
}
