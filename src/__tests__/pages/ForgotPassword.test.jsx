/**
 * src/__tests__/pages/ForgotPassword.test.jsx
 *
 * TESTS DE ForgotPassword — formulario de recuperación de contraseña.
 *
 * ¿Qué testear en un formulario de auth?
 *   1. Que el formulario se renderiza correctamente
 *   2. Que el usuario puede escribir en el input de email
 *   3. Validación del formato de email
 *   4. Estado de éxito cuando Supabase confirma el envío
 *   5. Estado de error cuando Supabase falla
 *   6. Que el botón se deshabilita mientras está cargando
 *
 * Estrategia:
 *   Mockeamos supabase.auth.resetPasswordForEmail para controlar
 *   los distintos resultados sin hacer llamadas reales.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '../../pages/ForgotPassword.jsx'

// Mock de supabase para controlar resetPasswordForEmail
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

// Mock del Header para simplificar el test (no testeamos el Header acá)
vi.mock('../../components/ui/Header.jsx', () => ({
  default: () => <header data-testid="header">Header</header>,
}))

import { supabase } from '../../lib/supabase.js'

// ── Helper de render ──────────────────────────────────────────────────────
function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Renderizado ──────────────────────────────────────────────────────────
  describe('Renderizado inicial', () => {
    it('muestra el input de email y el botón de envío', () => {
      renderPage()

      // El input de email debe estar presente y vacío
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      expect(emailInput).toBeInTheDocument()
      expect(emailInput).toHaveValue('')

      // El botón debe estar presente
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('el Header se renderiza', () => {
      renderPage()
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })
  })

  // ── Interacción del usuario ──────────────────────────────────────────────
  describe('Interacción con el formulario', () => {
    it('el usuario puede escribir su email', async () => {
      const user = userEvent.setup()
      renderPage()

      const emailInput = screen.getByRole('textbox', { name: /email/i })
      await user.type(emailInput, 'lucas@devforge.com')

      expect(emailInput).toHaveValue('lucas@devforge.com')
    })
  })

  // ── Estado de éxito ──────────────────────────────────────────────────────
  describe('Estado de éxito', () => {
    it('muestra mensaje de confirmación cuando Supabase envía el email', async () => {
      // Simulamos respuesta exitosa de Supabase
      supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null })

      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox', { name: /email/i }), 'lucas@example.com')
      await user.click(screen.getByRole('button'))

      // El componente usa react-i18next — nuestro mock devuelve la KEY como texto.
      // El éxito muestra 'auth.forgotSuccess' (la key de traducción tal cual).
      // Buscamos la key O cualquier elemento con clase de color verde (éxito).
      await waitFor(() => {
        const hasSuccessKey = screen.queryByText('auth.forgotSuccess')
        const hasGreenEl    = document.querySelector('[class*="forge-green"]')
        expect(hasSuccessKey || hasGreenEl).toBeTruthy()
      })
    })

    it('llama a resetPasswordForEmail con el email y redirectTo correctos', async () => {
      supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null })

      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox', { name: /email/i }), 'test@test.com')
      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'test@test.com',
          expect.objectContaining({
            redirectTo: expect.stringContaining('/reset-password'),
          })
        )
      })
    })
  })

  // ── Estado de error ──────────────────────────────────────────────────────
  describe('Estado de error', () => {
    it('muestra mensaje de error cuando Supabase falla', async () => {
      supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
        error: { message: 'User not found' },
      })

      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox', { name: /email/i }), 'noexiste@test.com')
      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        // Debe haber algún mensaje de error visible
        const errorEl = document.querySelector('[class*="red"]') || screen.queryByText(/error|no se pudo|problema/i)
        expect(errorEl).toBeTruthy()
      })
    })
  })
})
