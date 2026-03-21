import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },

  // ── Configuración de Vitest ─────────────────────────────────────────────
  // Vitest usa la misma config de Vite, evitando duplicar bundler config.
  // environment: 'jsdom' simula el DOM del browser para poder renderizar
  // componentes React sin un browser real (los tests corren en Node.js).
  // globals: true habilita describe/it/expect sin importarlos en cada test.
  // setupFiles: corre el archivo de setup ANTES de cada archivo de test.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/__tests__/**',
        'src/styles/**',
        'src/i18n/**',
        'src/main.jsx',
      ],
    },
  },
})
