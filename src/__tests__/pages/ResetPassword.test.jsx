/**
 * src/__tests__/pages/ResetPassword.test.jsx
 *
 * TESTS DE ResetPassword — formulario para establecer la nueva contraseña.
 *
 * ¿Qué testear?
 *   1. Estado inicial: spinner "Verificando link..." (checking=true)
 *   2. Después de 4s sin evento: muestra "link inválido" (checking=false, tokenOk=false)
 *   3. Cuando llega PASSWORD_RECOVERY: muestra el formulario (tokenOk=true)
 *   4. Validación: contraseña < 8 chars → error
 *   5. Validación: contraseñas no coinciden → error
 *   6. Éxito: muestra confirmación y redirige
 *
 * Nota de timers:
 *   Los tests del timeout usan vi.useFakeTimers() de forma AISLADA (scoped al test).
 *   Los tests de formulario usan timers reales para que userEvent funcione sin
 *   conflictos de timing. Mezclar vi.useFakeTimers() global con userEvent.setup()
 *   causa timeouts porque el debounce de userEvent también se congela.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from '../../pages/ResetPassword.jsx'

// ── Referencia global al callback de onAuthStateChange ────────────────────
// La guardamos fuera del mock para poder dispararla en los tests.
let capturedAuthCallback = null

vi.mock('../../lib/supabase.js', () => {
  const supabaseMock = {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        // Capturamos el callback que el componente registra
        capturedAuthCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } }
      }),
      updateUser: vi.fn(),
    },
  }
  return { supabase: supabaseMock }
})

vi.mock('../../components/ui/Header.jsx', () => ({
  default: () => <header>Header</header>,
}))

import { supabase } from '../../lib/supabase.js'

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>
  )
}

// Simula el evento PASSWORD_RECOVERY dentro de act() para que
// React procese el cambio de estado correctamente
async function triggerPasswordRecovery() {
  await act(async () => {
    if (capturedAuthCallback) {
      capturedAuthCallback('PASSWORD_RECOVERY', null)
    }
  })
}

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedAuthCallback = null
  })

  // ── Estado inicial: spinner de verificación ──────────────────────────────
  describe('Estado inicial (checking=true)', () => {
    it('muestra el spinner "Verificando link" al cargar la página', () => {
      // Bug original corregido: antes mostraba "link inválido" inmediatamente.
      // Ahora muestra un spinner mientras Supabase procesa el token del hash.
      renderPage()

      expect(screen.getByText(/Verificando link/i)).toBeInTheDocument()
      // El formulario NO debe estar visible todavía
      expect(screen.queryByRole('form')).not.toBeInTheDocument()
      // El mensaje de error tampoco
      expect(screen.queryByText(/invalido|expiró/i)).not.toBeInTheDocument()
    })
  })

  // ── Timeout: link inválido (test aislado con fake timers) ─────────────────
  describe('Después del timeout de 4 segundos', () => {
    it('muestra mensaje de link inválido si no llega PASSWORD_RECOVERY en 4s', async () => {
      // Scoped fake timers — solo este test los usa
      vi.useFakeTimers()

      renderPage()

      // Avanzamos más de 4 segundos sin disparar el evento
      await act(async () => {
        vi.advanceTimersByTime(4500)
      })

      // Ahora debe mostrar error de link inválido
      const errorEl = screen.queryByText(/invalido|expiró/i)
      expect(errorEl).toBeInTheDocument()
      // El spinner desapareció
      expect(screen.queryByText(/Verificando link/i)).not.toBeInTheDocument()

      vi.useRealTimers()  // restauramos timers reales al terminar
    })

    it('el mensaje de link inválido tiene un botón para solicitar nuevo link', async () => {
      vi.useFakeTimers()

      renderPage()

      await act(async () => {
        vi.advanceTimersByTime(4500)
      })

      expect(screen.getByRole('button', { name: /nuevo link/i })).toBeInTheDocument()

      vi.useRealTimers()
    })
  })

  // ── Token válido: formulario ─────────────────────────────────────────────
  describe('Cuando llega el evento PASSWORD_RECOVERY', () => {
    it('muestra el formulario de nueva contraseña', async () => {
      renderPage()

      // Verificamos que el spinner está activo
      expect(screen.getByText(/Verificando link/i)).toBeInTheDocument()

      // Disparamos el evento PASSWORD_RECOVERY
      await triggerPasswordRecovery()

      // El formulario aparece
      expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument()
      // El spinner desapareció
      expect(screen.queryByText(/Verificando link/i)).not.toBeInTheDocument()
    })

    it('el botón de guardar está inicialmente deshabilitado (inputs vacíos)', async () => {
      renderPage()
      await triggerPasswordRecovery()

      // disabled={!password || !confirm}
      const btn = screen.getByRole('button', { name: /Guardar/i })
      expect(btn).toBeDisabled()
    })
  })

  // ── Validación del formulario ────────────────────────────────────────────
  describe('Validación del formulario', () => {
    it('muestra error si la contraseña tiene menos de 8 caracteres', async () => {
      const user = userEvent.setup()
      renderPage()
      await triggerPasswordRecovery()

      await user.type(screen.getByLabelText(/Nueva contraseña/i), 'corto')
      await user.type(screen.getByLabelText(/Confirma/i), 'corto')
      await user.click(screen.getByRole('button', { name: /Guardar/i }))

      expect(screen.getByText(/al menos 8 caracteres/i)).toBeInTheDocument()
    })

    it('muestra error si las contraseñas no coinciden', async () => {
      const user = userEvent.setup()
      renderPage()
      await triggerPasswordRecovery()

      await user.type(screen.getByLabelText(/Nueva contraseña/i), 'contraseña123')
      await user.type(screen.getByLabelText(/Confirma/i), 'otraContraseña456')
      await user.click(screen.getByRole('button', { name: /Guardar/i }))

      expect(screen.getByText(/no coinciden/i)).toBeInTheDocument()
    })

    it('llama a updateUser con la nueva contraseña cuando el formulario es válido', async () => {
      supabase.auth.updateUser.mockResolvedValueOnce({ error: null })

      const user = userEvent.setup()
      renderPage()
      await triggerPasswordRecovery()

      await user.type(screen.getByLabelText(/Nueva contraseña/i), 'nuevaContraseña123')
      await user.type(screen.getByLabelText(/Confirma/i), 'nuevaContraseña123')
      await user.click(screen.getByRole('button', { name: /Guardar/i }))

      await waitFor(() => {
        expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nuevaContraseña123' })
      })
    })

    it('muestra confirmación de éxito después de actualizar la contraseña', async () => {
      supabase.auth.updateUser.mockResolvedValueOnce({ error: null })

      const user = userEvent.setup()
      renderPage()
      await triggerPasswordRecovery()

      await user.type(screen.getByLabelText(/Nueva contraseña/i), 'nuevaContraseña123')
      await user.type(screen.getByLabelText(/Confirma/i), 'nuevaContraseña123')
      await user.click(screen.getByRole('button', { name: /Guardar/i }))

      // La página usa i18n → el mock devuelve la key como texto
      await waitFor(() => {
        const hasKey    = screen.queryByText('Contrasena actualizada correctamente.')
        const hasGreen  = document.querySelector('[class*="forge-green"]')
        expect(hasKey || hasGreen).toBeTruthy()
      })
    })

    it('muestra error cuando la sesión de recovery expiró antes del submit', async () => {
      // Caso: el usuario abrió el link, dejó la pestaña 1h, y al enviar
      // la sesión ya no es válida → getSession retorna null
      supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } })

      const user = userEvent.setup()
      renderPage()
      await triggerPasswordRecovery()

      await user.type(screen.getByLabelText(/Nueva contraseña/i), 'nuevaContraseña123')
      await user.type(screen.getByLabelText(/Confirma/i), 'nuevaContraseña123')
      await user.click(screen.getByRole('button', { name: /Guardar/i }))

      await waitFor(() => {
        expect(screen.getByText(/expiró/i)).toBeInTheDocument()
      })
      // No debe haber llamado a updateUser si la sesión no es válida
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })
  })
})
