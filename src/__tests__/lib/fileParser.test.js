/**
 * src/__tests__/lib/fileParser.test.js
 *
 * TESTS DEL PARSER DE ARCHIVOS Y URLs — valida la entrada de datos externos.
 *
 * ¿Qué testear?
 *   1. isFileSupported / getSupportedExtensions — funciones puras, sin efectos
 *   2. fetchTextFromUrl — validación de URL, detección de sitios bloqueados,
 *      manejo de respuestas del proxy, limpieza de HTML
 *   3. extractTextFromFile — dispatch al parser correcto según extensión,
 *      manejo de formato no soportado
 *
 * No testeamos extractFromPDF / extractFromDOCX directamente porque
 * usan imports dinámicos de librerías pesadas (pdfjs-dist, mammoth) que
 * requieren un entorno de browser real. Esos casos se cubren con tests E2E.
 *
 * El test de fetchTextFromUrl mockea global.fetch para simular respuestas
 * del proxy allorigins.win sin hacer llamadas reales a internet.
 */

import {
  isFileSupported,
  getSupportedExtensions,
  fetchTextFromUrl,
  extractTextFromFile,
  BLOCKED_SITES_INFO,
} from '../../lib/fileParser.js'

// ── Helper: crea un objeto File mock con el nombre dado ───────────────────
function makeFile(filename, content = 'contenido de test') {
  return new File([content], filename, { type: 'text/plain' })
}

// ── Helper: crea una respuesta de fetch mockeada ──────────────────────────
function mockProxyResponse({ contents, http_code = 200, ok = true } = {}) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: vi.fn().mockResolvedValueOnce({
      contents,
      status: { http_code },
    }),
  })
}

describe('isFileSupported', () => {
  it('retorna true para extensiones soportadas', () => {
    // Extensiones que el usuario puede subir para analizar con IA
    expect(isFileSupported(makeFile('oferta.pdf'))).toBe(true)
    expect(isFileSupported(makeFile('oferta.txt'))).toBe(true)
    expect(isFileSupported(makeFile('oferta.md'))).toBe(true)
    expect(isFileSupported(makeFile('datos.csv'))).toBe(true)
    expect(isFileSupported(makeFile('oferta.docx'))).toBe(true)
  })

  it('retorna false para extensiones no soportadas', () => {
    // Formatos que el usuario podría intentar subir pero que no funcionan
    expect(isFileSupported(makeFile('oferta.doc'))).toBe(false)   // Word antiguo
    expect(isFileSupported(makeFile('oferta.rtf'))).toBe(false)   // Rich Text
    expect(isFileSupported(makeFile('oferta.odt'))).toBe(false)   // OpenDocument
    expect(isFileSupported(makeFile('imagen.png'))).toBe(false)
    expect(isFileSupported(makeFile('ejecutable.exe'))).toBe(false)
  })

  it('es case-insensitive (maneja extensiones en mayúsculas)', () => {
    // El .toLowerCase() en la implementación maneja 'PDF' como 'pdf'
    expect(isFileSupported(makeFile('OFERTA.PDF'))).toBe(true)
    expect(isFileSupported(makeFile('OFERTA.TXT'))).toBe(true)
  })
})

describe('getSupportedExtensions', () => {
  it('retorna un string con las extensiones separadas por coma', () => {
    const result = getSupportedExtensions()

    expect(typeof result).toBe('string')
    expect(result).toContain('.pdf')
    expect(result).toContain('.txt')
    expect(result).toContain('.docx')
    expect(result).toContain('.md')
    expect(result).toContain('.csv')
  })

  it('el formato es compatible con el atributo accept del input[type=file]', () => {
    // El formato requerido es ".ext1,.ext2,...pdf" (con puntos, separados por coma)
    const result = getSupportedExtensions()
    const parts  = result.split(',')

    parts.forEach(part => {
      expect(part).toMatch(/^\.[a-z]+$/)  // cada parte empieza con punto
    })
  })
})

describe('BLOCKED_SITES_INFO', () => {
  it('incluye LinkedIn, Indeed, Glassdoor, InfoJobs y Bumeran', () => {
    // Estos son los sitios que el usuario más probablemente intentará usar
    expect(BLOCKED_SITES_INFO['linkedin.com']).toBeDefined()
    expect(BLOCKED_SITES_INFO['indeed.com']).toBeDefined()
    expect(BLOCKED_SITES_INFO['glassdoor.com']).toBeDefined()
    expect(BLOCKED_SITES_INFO['infojobs.net']).toBeDefined()
    expect(BLOCKED_SITES_INFO['bumeran.com']).toBeDefined()
  })

  it('cada entrada tiene name, reason y steps', () => {
    // El UI usa estas propiedades para mostrar instrucciones al usuario
    Object.values(BLOCKED_SITES_INFO).forEach(site => {
      expect(site.name).toBeTruthy()
      expect(site.reason).toBeTruthy()
      expect(Array.isArray(site.steps)).toBe(true)
      expect(site.steps.length).toBeGreaterThan(0)
    })
  })
})

describe('fetchTextFromUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Validación de URL ────────────────────────────────────────────────────
  describe('Validación de URL', () => {
    it('lanza error descriptivo para URLs inválidas', async () => {
      await expect(fetchTextFromUrl('no-es-una-url')).rejects.toThrow('URL inválida')
    })

    it('lanza error descriptivo para URLs sin protocolo', async () => {
      await expect(fetchTextFromUrl('www.ejemplo.com/oferta')).rejects.toThrow('URL inválida')
    })

    it('lanza error para protocolos no permitidos (ftp, file, etc.)', async () => {
      await expect(fetchTextFromUrl('ftp://servidor/archivo.txt')).rejects.toThrow(
        'Solo se permiten URLs http:// o https://'
      )
    })

    it('acepta URLs con http://', async () => {
      // Mocked para que no falle por fetch
      mockProxyResponse({ contents: 'A'.repeat(200) })
      await expect(fetchTextFromUrl('http://www.ejemplo.com/oferta')).resolves.toBeDefined()
    })

    it('acepta URLs con https://', async () => {
      mockProxyResponse({ contents: 'B'.repeat(200) })
      await expect(fetchTextFromUrl('https://www.ejemplo.com/oferta')).resolves.toBeDefined()
    })
  })

  // ── Detección de sitios bloqueados ───────────────────────────────────────
  describe('Detección de sitios bloqueados', () => {
    it('lanza error tipo BLOCKED_SITE para LinkedIn', async () => {
      const error = await fetchTextFromUrl('https://www.linkedin.com/jobs/view/123').catch(e => e)

      expect(error.type).toBe('BLOCKED_SITE')
      expect(error.blockedSite).toBeDefined()
      expect(error.blockedSite.name).toBe('LinkedIn')
      expect(error.blockedSite.steps).toBeDefined()
    })

    it('lanza error tipo BLOCKED_SITE para Indeed', async () => {
      const error = await fetchTextFromUrl('https://indeed.com/jobs/view/123').catch(e => e)

      expect(error.type).toBe('BLOCKED_SITE')
      expect(error.blockedSite.name).toBe('Indeed')
    })

    it('lanza error tipo BLOCKED_SITE para Glassdoor', async () => {
      const error = await fetchTextFromUrl('https://www.glassdoor.com/job/123').catch(e => e)

      expect(error.type).toBe('BLOCKED_SITE')
      expect(error.blockedSite.name).toBe('Glassdoor')
    })

    it('lanza error tipo BLOCKED_SITE para Bumeran', async () => {
      const error = await fetchTextFromUrl('https://www.bumeran.com/empleos/123').catch(e => e)

      expect(error.type).toBe('BLOCKED_SITE')
    })

    it('NO lanza error para sitios no bloqueados (Computrabajo, etc.)', async () => {
      // Sites no conocidos pasan la validación → van al proxy
      mockProxyResponse({ contents: 'C'.repeat(300) })

      await expect(fetchTextFromUrl('https://computrabajo.com.ar/oferta/123')).resolves.toBeDefined()
    })
  })

  // ── Manejo de respuestas del proxy ───────────────────────────────────────
  describe('Respuestas del proxy', () => {
    it('lanza error cuando el proxy responde sin contents', async () => {
      mockProxyResponse({ contents: null })

      await expect(fetchTextFromUrl('https://ejemplo.com/oferta')).rejects.toThrow(
        'La página no devolvió contenido'
      )
    })

    it('lanza error cuando el sitio responde con HTTP 404', async () => {
      mockProxyResponse({ contents: 'Not found', http_code: 404 })

      await expect(fetchTextFromUrl('https://ejemplo.com/oferta-eliminada')).rejects.toThrow('404')
    })

    it('lanza error cuando el texto extraído es muy corto (< 150 chars)', async () => {
      // Texto muy corto → la página probablemente está en blanco o requiere login
      mockProxyResponse({ contents: '<html><body>Short</body></html>' })

      await expect(fetchTextFromUrl('https://ejemplo.com/oferta')).rejects.toThrow(
        'suficiente texto'
      )
    })

    it('limpia etiquetas HTML del contenido y retorna texto plano', async () => {
      const html = '<html><body><h1>Senior Python Developer</h1>' +
                   '<p>Buscamos un experto en FastAPI y PostgreSQL con 3 años de experiencia.</p>' +
                   '<script>analytics()</script>' +
                   '<style>.btn { color: red; }</style>' +
                   'Más requisitos: Docker, AWS, testing.</body></html>'

      // Repetimos para superar el umbral de 150 chars
      mockProxyResponse({ contents: html.repeat(3) })

      const result = await fetchTextFromUrl('https://ejemplo.com/oferta')

      // No debe haber etiquetas HTML en el resultado
      expect(result).not.toContain('<html>')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('<style>')
      // El texto útil debe estar presente
      expect(result).toContain('Python Developer')
    })

    it('lanza error cuando fetch falla por timeout', async () => {
      // AbortSignal.timeout dispara un TimeoutError
      global.fetch = vi.fn().mockRejectedValueOnce(
        Object.assign(new Error('Timeout'), { name: 'TimeoutError' })
      )

      await expect(fetchTextFromUrl('https://ejemplo.com/oferta')).rejects.toThrow(
        'tardó demasiado'
      )
    })
  })
})

describe('extractTextFromFile', () => {
  it('lanza error descriptivo para formatos no soportados', async () => {
    const docFile = makeFile('curriculum.doc')

    await expect(extractTextFromFile(docFile)).rejects.toThrow('no soportado')
    await expect(extractTextFromFile(docFile)).rejects.toThrow('.doc')
  })

  it('el mensaje de error menciona los formatos aceptados', async () => {
    const rtfFile = makeFile('oferta.rtf')

    const error = await extractTextFromFile(rtfFile).catch(e => e)
    expect(error.message).toContain('PDF')
    expect(error.message).toContain('.txt')
  })

  it('procesa archivos .txt con FileReader nativo', async () => {
    // FileReader está disponible en jsdom
    const txtFile = makeFile('oferta.txt', 'Python developer con experiencia en FastAPI')

    const result = await extractTextFromFile(txtFile)
    expect(result).toBe('Python developer con experiencia en FastAPI')
  })

  it('procesa archivos .md como texto plano', async () => {
    const mdFile = makeFile('notas.md', '# Senior Developer\n\nRequisitos: Python, Docker')

    const result = await extractTextFromFile(mdFile)
    expect(result).toContain('Senior Developer')
    expect(result).toContain('Python')
  })

  it('procesa archivos .csv como texto plano', async () => {
    const csvFile = makeFile('tecnologias.csv', 'Python,FastAPI,Docker,PostgreSQL')

    const result = await extractTextFromFile(csvFile)
    expect(result).toContain('Python')
    expect(result).toContain('FastAPI')
  })
})
