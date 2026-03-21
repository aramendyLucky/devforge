/**
 * src/__tests__/setup.js
 *
 * SETUP GLOBAL DE TESTS — se ejecuta ANTES de cada archivo de test.
 *
 * ¿Por qué existe este archivo?
 *   Vitest necesita que importemos los matchers de @testing-library/jest-dom
 *   para poder usar expects como `.toBeInTheDocument()`, `.toHaveValue()`, etc.
 *   En vez de importarlo en cada archivo, lo centralizamos acá y Vitest
 *   lo ejecuta automáticamente antes de cada suite.
 *
 * ¿Qué hace @testing-library/jest-dom?
 *   Extiende el expect() estándar con matchers específicos del DOM:
 *   - toBeInTheDocument()   → el elemento existe en el DOM
 *   - toHaveValue('...')    → un input tiene ese value
 *   - toBeDisabled()        → el elemento tiene el atributo disabled
 *   - toHaveTextContent()   → el elemento contiene ese texto
 *   Estos hacen los tests mucho más legibles que chequear el DOM manualmente.
 */

import '@testing-library/jest-dom'

/**
 * Mock global de react-i18next.
 *
 * La mayoría de los componentes de DevForge usan useTranslation().
 * En tests, no queremos cargar el sistema de i18n completo con sus locale files.
 * El mock devuelve la KEY de traducción tal cual, lo que permite verificar
 * que se llama a t('interview.title') sin necesitar el string en español/inglés.
 *
 * Patrón: t(key) → key (ej: t('interview.title') → 'interview.title')
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      // Si la traducción tiene interpolación de variables (ej: t('key', {count: 3})),
      // las incluimos en el resultado para que los tests puedan verificar el valor.
      if (opts && typeof opts === 'object') {
        return Object.entries(opts).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, v),
          key
        )
      }
      return key
    },
    i18n: {
      language: 'es',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
  }),
  // initReactI18next es un plugin de i18next — mock minimal para que el import no falle
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  Trans: ({ children }) => children,
}))

/**
 * Mock global de react-router-dom (useNavigate, useLocation).
 *
 * Las páginas usan useNavigate() para redirigir al usuario.
 * En tests, no queremos que eso ocurra de verdad — solo verificar
 * que navigate() fue llamado con los argumentos correctos.
 *
 * Nota: este mock se puede sobrescribir a nivel de test si necesitamos
 * probar comportamientos específicos de routing.
 */
vi.mock('react-router-dom', async () => {
  // importamos el módulo real para no perder Navigate, MemoryRouter, etc.
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', state: null, search: '', hash: '' }),
  }
})
