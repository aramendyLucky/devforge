/**
 * src/lib/fileParser.js
 *
 * UTILIDAD DE PARSEO DE ARCHIVOS — extrae texto plano de distintos formatos
 * para alimentar el análisis de IA en el onboarding de DevForge.
 *
 * ── ¿Por qué este módulo existe? ─────────────────────────────────────────
 * El usuario puede tener sus ofertas laborales guardadas en distintos formatos:
 * PDF (el más común), Word (.docx), o texto plano. Sin este módulo, la única
 * opción era copiar y pegar manualmente, lo cual es fricción innecesaria.
 *
 * ── Formatos soportados ───────────────────────────────────────────────────
 *   .txt / .md  → FileReader nativo del browser (zero dependencies)
 *   .pdf        → pdfjs-dist (Mozilla PDF.js) — import dinámico
 *   .docx       → mammoth.js — import dinámico
 *
 * ── ¿Por qué imports dinámicos para PDF y DOCX? ─────────────────────────
 * pdfjs-dist pesa ~3MB y mammoth pesa ~1.5MB. Si los importamos estáticamente
 * (import en la parte superior del archivo), se incluyen en el bundle SIEMPRE,
 * aunque el usuario nunca suba un archivo.
 *
 * Con `import()` dinámico, Vite crea chunks separados que solo se descargan
 * cuando el usuario efectivamente sube un PDF o un DOCX. Si solo pega texto,
 * NUNCA descarga esas librerías. Esto es code-splitting en la práctica.
 *
 * ── Función pública ───────────────────────────────────────────────────────
 *   extractTextFromFile(file)  → Promise<string>  — texto plano extraído
 *
 * ── Funciones auxiliares ──────────────────────────────────────────────────
 *   isFileSupported(file)   → boolean — ¿el formato es soportado?
 *   getSupportedExtensions() → string[] — lista de extensiones aceptadas
 */

// ─── Extensiones soportadas ───────────────────────────────────────────────
const SUPPORTED = ['txt', 'md', 'csv', 'pdf', 'docx']

// ─── Sitios que bloquean scraping automático ──────────────────────────────
/**
 * Mapa de sitios conocidos que bloquean el acceso automático.
 * Cada entrada tiene:
 *   name     — nombre para mostrar al usuario
 *   reason   — por qué no funciona el proxy
 *   steps    — instrucciones específicas para copiar manualmente
 *
 * ¿Por qué estos sitios no funcionan con el proxy?
 *   - LinkedIn: SPA React + requiere auth, el proxy obtiene el HTML vacío
 *   - Indeed: bloquea IPs de proxies conocidos (CloudFlare protection)
 *   - Glassdoor: requiere login para ver la descripción completa
 *   - Infojobs/Bumeran: protección anti-scraping activa
 *
 * Exportamos este mapa para que el UI pueda mostrar las instrucciones.
 */
export const BLOCKED_SITES_INFO = {
  'linkedin.com': {
    name: 'LinkedIn',
    reason: 'LinkedIn carga el contenido dinámicamente y requiere login.',
    steps: [
      'Abrí la oferta en LinkedIn',
      'Hacé scroll hasta la descripción del puesto',
      'Clic en "Ver más" si la descripción está cortada',
      'Seleccioná y copiá todo el texto de la descripción',
      'Volvé a DevForge y pegalo en el tab "Texto"',
    ],
  },
  'indeed.com': {
    name: 'Indeed',
    reason: 'Indeed bloquea el acceso automático a sus páginas.',
    steps: [
      'Abrí la oferta en Indeed',
      'Copiá la descripción completa del puesto',
      'Pegala en el tab "Texto" de DevForge',
    ],
  },
  'glassdoor.com': {
    name: 'Glassdoor',
    reason: 'Glassdoor requiere login para ver las descripciones completas.',
    steps: [
      'Iniciá sesión en Glassdoor y abrí la oferta',
      'Expandí la descripción completa haciendo clic en "Show more"',
      'Copiá el texto y pegalo en el tab "Texto"',
    ],
  },
  'infojobs.net': {
    name: 'InfoJobs',
    reason: 'InfoJobs tiene protección anti-scraping activa.',
    steps: [
      'Abrí la oferta en InfoJobs',
      'Copiá la descripción del puesto',
      'Pegala en el tab "Texto" de DevForge',
    ],
  },
  'bumeran.com': {
    name: 'Bumeran',
    reason: 'Bumeran bloquea el acceso automático a sus páginas.',
    steps: [
      'Abrí la oferta en Bumeran',
      'Copiá la descripción completa',
      'Pegala en el tab "Texto" de DevForge',
    ],
  },
  'zonajobs.com': {
    name: 'ZonaJobs',
    reason: 'ZonaJobs tiene protección contra scrapers automáticos.',
    steps: [
      'Abrí la oferta en ZonaJobs',
      'Copiá la descripción del puesto',
      'Pegala en el tab "Texto" de DevForge',
    ],
  },
}

// ─── fetchTextFromUrl (función pública) ──────────────────────────────────
/**
 * fetchTextFromUrl — obtiene texto de una página web a través de un proxy CORS.
 *
 * ── ¿Por qué hace falta un proxy? ───────────────────────────────────────
 * Los browsers bloquean fetch() hacia dominios externos que no tienen el
 * header `Access-Control-Allow-Origin`. La mayoría de portales de empleo
 * (LinkedIn, Indeed, Bumeran, Computrabajo, etc.) no lo tienen → CORS error.
 *
 * Solución: enviamos el request a api.allorigins.win, que actúa de proxy.
 * El proxy hace el fetch desde su servidor (sin restricción de browser),
 * y nos devuelve el HTML en JSON.
 *
 * ── Limitaciones conocidas ──────────────────────────────────────────────
 *   - Algunos sitios detectan el proxy y responden 403 o CAPTCHA.
 *   - No funciona con SPAs que cargan contenido dinámico (React/Angular apps).
 *     LinkedIn, por ejemplo, requiere auth para ver el contenido real.
 *   - El proxy público tiene latencia variable (~1-3 seg).
 *   - Para esos casos, el usuario puede pegar el texto manualmente (tab "Texto").
 *
 * ── Flujo ───────────────────────────────────────────────────────────────
 *   1. Validar que la URL tenga formato correcto (new URL() lanza si no)
 *   2. Hacer fetch al proxy con la URL encodeada
 *   3. Parsear la respuesta JSON → extraer `contents` (el HTML crudo)
 *   4. Limpiar el HTML: eliminar <script>, <style> y todas las etiquetas
 *   5. Devolver texto plano listo para enviar a la IA
 *
 * @param {string} rawUrl — URL de la oferta laboral ingresada por el usuario
 * @returns {Promise<string>} — texto plano extraído de la página
 * @throws {Error} — con mensaje en español para mostrar al usuario
 */
export async function fetchTextFromUrl(rawUrl) {
  // Paso 1: validar formato de URL
  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl.trim())
  } catch {
    throw new Error(
      'URL inválida. Asegurate de incluir el protocolo: https://www.ejemplo.com/oferta'
    )
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Solo se permiten URLs http:// o https://')
  }

  // Paso 2: detectar sitios conocidos que bloquean scraping ANTES de intentar el fetch.
  // Esto ahorra tiempo al usuario — le damos la guía de copia inmediatamente en lugar
  // de esperar 15 segundos para recibir un error genérico.
  const hostname = parsedUrl.hostname.replace(/^www\./, '')
  const blockedEntry = Object.entries(BLOCKED_SITES_INFO).find(
    ([domain]) => hostname.includes(domain)
  )
  if (blockedEntry) {
    // Creamos un error con propiedad `blockedSite` para que el UI muestre
    // la guía específica en lugar de un mensaje genérico de error.
    const err = new Error(`${blockedEntry[1].name} no permite acceso automático`)
    err.type        = 'BLOCKED_SITE'
    err.blockedSite = blockedEntry[1]
    throw err
  }

  // Paso 3: fetch a través del proxy CORS
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(parsedUrl.href)}`

  let data
  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`El proxy respondió con error ${res.status}`)
    data = await res.json()
  } catch (err) {
    if (err.type === 'BLOCKED_SITE') throw err  // re-lanzar sin modificar
    if (err.name === 'TimeoutError') {
      throw new Error('La solicitud tardó demasiado. Probá pegar el texto manualmente.')
    }
    throw new Error(`No se pudo acceder a la URL: ${err.message}`)
  }

  if (!data.contents) {
    throw new Error(
      'La página no devolvió contenido. ' +
      'El sitio puede requerir login o bloquear scrapers. ' +
      'Probá pegar el texto de la oferta manualmente.'
    )
  }

  const httpCode = data.status?.http_code
  if (httpCode && httpCode >= 400) {
    throw new Error(
      `El sitio respondió con error ${httpCode}. ` +
      'Probá pegar el texto de la oferta manualmente.'
    )
  }

  // Paso 4: limpiar HTML → texto plano
  const text = data.contents
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length < 150) {
    throw new Error(
      'No se encontró suficiente texto en la página. ' +
      'El sitio probablemente bloquea scrapers. ' +
      'Copiá el texto de la oferta y pegalo en el tab "Texto".'
    )
  }

  return text
}

/**
 * isFileSupported — verifica si el archivo puede ser procesado.
 *
 * Se usa para validar antes de intentar el parseo y para mostrar
 * mensajes de error claros al usuario si intenta subir un formato
 * no soportado (ej: .doc antiguo, .rtf, .odt).
 *
 * @param {File} file — archivo del browser
 * @returns {boolean}
 */
export function isFileSupported(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return SUPPORTED.includes(ext)
}

/**
 * getSupportedExtensions — lista de extensiones aceptadas para el input[type=file].
 * Usado en el atributo `accept` del input para filtrar el explorador de archivos.
 *
 * @returns {string} — ej: ".txt,.md,.csv,.pdf,.docx"
 */
export function getSupportedExtensions() {
  return SUPPORTED.map(e => `.${e}`).join(',')
}

// ─── Parsers internos ────────────────────────────────────────────────────

/**
 * extractFromText — lee archivos de texto plano usando la API nativa del browser.
 *
 * FileReader es parte del Web API estándar, disponible en todos los browsers
 * modernos. No necesita ninguna dependencia externa — zero cost.
 *
 * Wrapper en Promise para poder usar async/await en el llamador.
 *
 * @param {File} file — .txt, .md, o .csv
 * @returns {Promise<string>}
 */
function extractFromText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result || '')
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de texto.'))
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * extractFromPDF — extrae texto de un PDF usando Mozilla PDF.js.
 *
 * PDF.js es la librería de referencia para parseo de PDFs en el browser.
 * La usamos con import() dinámico para que solo se descargue cuando el
 * usuario efectivamente sube un PDF.
 *
 * Flujo:
 *   1. Cargamos pdfjs-dist con import() dinámico
 *   2. Configuramos el Worker (PDF.js procesa PDFs en un Web Worker
 *      para no bloquear el hilo principal)
 *   3. Leemos el archivo como ArrayBuffer (binario)
 *   4. Iteramos página por página extrayendo los text items
 *   5. Juntamos todo el texto con saltos de línea entre páginas
 *
 * ¿Qué es un TextItem de PDF.js?
 *   Cada elemento de texto en un PDF es un "text item" con `.str` (el string)
 *   y información de posición. Los concatenamos para reconstruir el texto legible.
 *
 * @param {File} file — archivo .pdf
 * @returns {Promise<string>}
 */
async function extractFromPDF(file) {
  // Import dinámico — solo se descarga si el usuario sube un PDF
  const pdfjsLib = await import('pdfjs-dist')

  // PDF.js necesita un Worker para procesar documentos sin bloquear la UI.
  // `new URL(..., import.meta.url)` es la forma Vite-compatible de referenciar
  // assets — Vite lo convierte en un hash correcto para producción.
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href

  // Leemos el archivo como ArrayBuffer (formato binario requerido por PDF.js)
  const arrayBuffer = await file.arrayBuffer()

  // getDocument() parsea el PDF completo y devuelve un objeto proxy
  // promise.promise porque la API de PDF.js usa un objeto con .promise
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''

  // Iteramos cada página (PDF.js es 1-indexed, no 0-indexed)
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page    = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Unimos los text items de la página con espacio
    // Algunos PDFs tienen words como text items separados, otros como bloques
    const pageText = content.items
      .map(item => item.str)
      .filter(str => str.trim())  // eliminamos strings vacíos
      .join(' ')

    fullText += pageText + '\n\n'  // doble salto entre páginas
  }

  const result = fullText.trim()
  if (!result) {
    // Algunos PDFs son "imagen" (scaneados sin OCR) — no tienen texto extraíble
    throw new Error(
      'Este PDF no contiene texto extraíble (puede ser un PDF escaneado). ' +
      'Intentá copiar y pegar el texto manualmente.'
    )
  }

  return result
}

/**
 * extractFromDOCX — extrae texto de un archivo Word (.docx) usando mammoth.js.
 *
 * mammoth.js está especializado en convertir documentos DOCX a texto plano
 * (o HTML). Usamos `extractRawText` porque solo nos interesa el contenido
 * textual, no el formato.
 *
 * Import dinámico igual que pdfjs — solo se descarga si el usuario sube un DOCX.
 *
 * ¿Por qué no soportamos .doc (Word antiguo)?
 *   El formato .doc (anterior a 2007) es un formato binario propietario de Microsoft
 *   sin especificación pública. mammoth solo soporta .docx (formato OpenXML).
 *   En ese caso, mostramos un mensaje pidiendo que lo guarden como .docx o PDF.
 *
 * @param {File} file — archivo .docx
 * @returns {Promise<string>}
 */
async function extractFromDOCX(file) {
  // Import dinámico — solo se descarga si el usuario sube un DOCX
  const mod     = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()

  // mammoth es un módulo CommonJS. Cuando Vite lo importa dinámicamente, puede
  // exponer la API en mod.default (ESM wrapper) o directamente en mod.
  // Usamos la forma defensiva para que funcione en ambos casos.
  const mammoth = mod.default || mod

  // extractRawText devuelve { value: string, messages: [] }
  // `value` es el texto plano sin formato; `messages` son advertencias (ignoradas)
  const result = await mammoth.extractRawText({ arrayBuffer })

  if (!result.value?.trim()) {
    throw new Error('El documento Word parece estar vacío o no contiene texto.')
  }

  return result.value
}

// ─── extractTextFromFile (función pública principal) ─────────────────────
/**
 * extractTextFromFile — punto de entrada público del módulo.
 *
 * Detecta el formato del archivo por su extensión y delega al parser correcto.
 * Devuelve siempre una Promise<string> con el texto extraído.
 *
 * Errores:
 *   - Formato no soportado → Error con mensaje descriptivo para el usuario
 *   - PDF escaneado → Error explicando que no hay texto extraíble
 *   - Archivo corrupto → Error del parser correspondiente
 *
 * @param {File} file — archivo del browser (del input[type=file] o dataTransfer)
 * @returns {Promise<string>} — texto plano listo para mandar a la IA
 * @throws {Error} — con mensaje en español para mostrar al usuario
 */
export async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'txt':
    case 'md':
    case 'csv':
      return extractFromText(file)

    case 'pdf':
      return extractFromPDF(file)

    case 'docx':
      return extractFromDOCX(file)

    default:
      throw new Error(
        `Formato .${ext} no soportado. ` +
        'Subí un PDF, un Word (.docx) o un archivo de texto (.txt).'
      )
  }
}
