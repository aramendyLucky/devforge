import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { StoreProvider } from './store/index.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App.jsx'
import './styles/globals.css'
import './i18n/index.js'

/**
 * Árbol de providers — orden importante:
 *
 *  BrowserRouter     → habilita el sistema de rutas (react-router-dom)
 *    AuthProvider    → maneja la sesión del usuario (Supabase)
 *      StoreProvider → maneja el estado de progreso/configuración de la app
 *        App         → el árbol de componentes y páginas
 *
 * ¿Por qué AuthProvider envuelve a StoreProvider y no al revés?
 * Porque en el futuro StoreProvider puede necesitar saber quién es el usuario
 * (por ejemplo, para cargar el progreso desde Supabase DB en lugar de
 * localStorage). Si StoreProvider está adentro, puede consumir useAuth()
 * sin problemas. Al revés generaría una dependencia circular.
 *
 * ¿Por qué BrowserRouter está afuera de todo?
 * Porque AuthContext usa useNavigate() y useLocation() de react-router-dom,
 * que requieren estar dentro del contexto del Router.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
