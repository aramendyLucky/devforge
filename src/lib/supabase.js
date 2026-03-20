/**
 * src/lib/supabase.js
 *
 * CLIENTE SUPABASE — instancia única para toda la app (patrón Singleton).
 *
 * ¿Por qué un archivo separado para esto?
 * Porque Supabase mantiene internamente el estado de la sesión del usuario
 * (tokens JWT, refresh automático, etc.). Si creáramos múltiples instancias
 * del cliente en distintos archivos, cada una tendría su propio estado y
 * podrían desincronizarse. Un solo cliente, importado desde acá, garantiza
 * que toda la app habla con Supabase desde el mismo punto.
 *
 * ¿Qué hace createClient?
 * Inicializa la conexión con tu proyecto Supabase usando:
 *   - SUPABASE_URL: la dirección de tu proyecto (ej: https://xyz.supabase.co)
 *   - SUPABASE_ANON_KEY: clave pública que identifica tu app (no es secreta,
 *     puede estar en el frontend — las reglas de seguridad real están en las
 *     RLS policies del lado del servidor de Supabase)
 *
 * Las variables de entorno vienen del archivo .env en la raíz del proyecto.
 * Vite las expone al frontend con el prefijo VITE_ (requerido por Vite).
 */
import { createClient } from '@supabase/supabase-js'

// URL del proyecto Supabase (Panel → Settings → API → Project URL)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

// Clave anónima pública (Panel → Settings → API → anon public)
// Es seguro tenerla en el frontend — NO es la service_role key
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validación temprana: si faltan las variables, el error aparece en consola
// con un mensaje claro en lugar de un crash críptico más adelante
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[DevForge] Faltan variables de entorno de Supabase.\n' +
    'Asegurate de tener en tu .env:\n' +
    '  VITE_SUPABASE_URL=...\n' +
    '  VITE_SUPABASE_ANON_KEY=...'
  )
}

/**
 * supabase — cliente único exportado.
 *
 * Desde cualquier archivo de la app lo importás así:
 *   import { supabase } from '../lib/supabase'
 *
 * Y usás sus métodos:
 *   supabase.auth.signIn(...)
 *   supabase.from('tabla').select(...)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
