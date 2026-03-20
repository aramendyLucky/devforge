-- ═══════════════════════════════════════════════════════════════════
-- DevForge — Schema de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════


-- ─── TABLA: profiles ────────────────────────────────────────────────
-- Guarda el perfil completo del usuario:
--   onboarding, preferencias de UI, ofertas laborales y self-assessment.
-- Una fila por usuario. Se crea la primera vez que el usuario entra
-- y se actualiza en cada cambio de configuración.
--
-- user_id referencia a auth.users (la tabla interna de Supabase Auth).
-- ON DELETE CASCADE: si el usuario elimina su cuenta, su perfil se borra.
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT,
  target_date      TEXT,                         -- ISO string: '2025-06-01'
  raw_offers       TEXT        DEFAULT '',        -- texto pegado de las ofertas
  extracted_topics JSONB       DEFAULT '[]',      -- ['Python', 'AWS', ...]
  self_assessment  JSONB       DEFAULT '{}',      -- { topicId: 1-5 }
  onboarding_done  BOOLEAN     DEFAULT FALSE,
  theme            TEXT        DEFAULT 'forge',   -- 'forge' | 'dusk' | 'chalk'
  font             TEXT        DEFAULT 'forge',   -- 'forge' | 'clean' | 'terminal'
  streak_days      JSONB       DEFAULT '[]',      -- ['2025-01-01', ...]
  last_active_date TEXT,                          -- 'YYYY-MM-DD'
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ─── TABLA: topic_progress ──────────────────────────────────────────
-- Guarda el progreso de cada usuario en cada topic.
-- Una fila por (usuario, topic). Se actualiza cada vez que
-- el usuario completa preguntas de ese topic.
--
-- UNIQUE(user_id, topic_id): garantiza que no existan filas duplicadas
-- para la misma combinación. Usamos esto con ON CONFLICT para hacer
-- upsert (insert si no existe, update si ya existe).
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE public.topic_progress (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id   TEXT        NOT NULL,               -- 'python', 'aws', etc.
  completed  INTEGER     DEFAULT 0,
  total      INTEGER     DEFAULT 0,
  last_score NUMERIC,                            -- 0-10
  last_seen  TIMESTAMPTZ,
  UNIQUE(user_id, topic_id)                      -- evita duplicados
);


-- ─── TABLA: sessions ────────────────────────────────────────────────
-- Guarda el historial de sesiones de práctica completadas.
-- Una fila por sesión. Se inserta cuando el usuario termina una sesión.
-- Las respuestas se guardan como JSONB:
-- [{ question, answer, score, feedback }, ...]
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE public.sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id   TEXT        NOT NULL,
  answers    JSONB       DEFAULT '[]',
  started_at TIMESTAMPTZ,
  ended_at   TIMESTAMPTZ
);


-- ─── TABLA: saved_offers ────────────────────────────────────────────
-- Guarda las ofertas laborales que el usuario analizó con IA.
-- Una fila por oferta guardada. El usuario puede tener N ofertas.
-- topics es JSONB: [{ id, name, tier, category }, ...]
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE public.saved_offers (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name     TEXT        NOT NULL,
  summary  TEXT        DEFAULT '',
  topics   JSONB       DEFAULT '[]',
  saved_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── TABLA: interviews ──────────────────────────────────────────────
-- Guarda el historial de entrevistas simuladas completadas.
-- Incluye toda la configuración de la entrevista y las respuestas.
-- topic_ids y answers se guardan como JSONB porque son arrays.
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE public.interviews (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT,                               -- 'oferta1' | 'oferta2' | 'custom'
  topic_ids  JSONB       DEFAULT '[]',           -- ['python', 'aws', ...]
  difficulty TEXT,                               -- 'basic' | 'mid' | 'senior'
  duration   INTEGER,                            -- minutos: 20, 45, 60
  answers    JSONB       DEFAULT '[]',
  skipped    JSONB       DEFAULT '[]',
  started_at TIMESTAMPTZ,
  ended_at   TIMESTAMPTZ
);


-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════
-- RLS es el sistema de seguridad a nivel de fila de PostgreSQL.
-- Sin RLS activo, cualquier usuario autenticado podría leer/escribir
-- los datos de cualquier otro usuario usando la anon key.
--
-- Con RLS + policies, Supabase filtra automáticamente cada query
-- para que cada usuario solo vea y modifique sus propias filas.
-- auth.uid() devuelve el UUID del usuario autenticado en la sesión actual.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_offers    ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede ver y modificar su propio perfil
CREATE POLICY "Usuarios gestionan su propio perfil"
  ON public.profiles FOR ALL
  USING (auth.uid() = user_id);

-- Cada usuario solo puede ver y modificar su propio progreso
CREATE POLICY "Usuarios gestionan su propio progreso"
  ON public.topic_progress FOR ALL
  USING (auth.uid() = user_id);

-- Cada usuario solo puede ver y modificar sus propias sesiones
CREATE POLICY "Usuarios gestionan sus propias sesiones"
  ON public.sessions FOR ALL
  USING (auth.uid() = user_id);

-- Cada usuario solo puede ver y modificar sus propias entrevistas
CREATE POLICY "Usuarios gestionan sus propias entrevistas"
  ON public.interviews FOR ALL
  USING (auth.uid() = user_id);

-- Cada usuario solo puede ver y modificar sus propias ofertas guardadas
CREATE POLICY "Usuarios gestionan sus propias ofertas"
  ON public.saved_offers FOR ALL
  USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════
-- FUNCIÓN: actualizar updated_at automáticamente
-- ═══════════════════════════════════════════════════════════════════
-- Esta función se ejecuta como trigger antes de cada UPDATE en profiles.
-- Actualiza automáticamente el campo updated_at sin que el frontend
-- tenga que enviarlo en cada request.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
