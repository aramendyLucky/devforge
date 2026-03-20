# DevForge — Plataforma de Preparación Técnica para Entrevistas IT

> **Prepará tu próxima entrevista técnica con IA personalizada.**
> Practicá por tema, simulá entrevistas reales con ofertas laborales reales, y generá tu roadmap de aprendizaje 0→100 en PDF.

---

## Índice

1. [¿Qué es DevForge?](#1-qué-es-devforge)
2. [Motivación y objetivo](#2-motivación-y-objetivo)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura del sistema](#4-arquitectura-del-sistema)
5. [Base de datos — Supabase / PostgreSQL](#5-base-de-datos--supabase--postgresql)
6. [Estructura del proyecto](#6-estructura-del-proyecto)
7. [Flujo de datos completo](#7-flujo-de-datos-completo)
8. [Instalación y configuración local](#8-instalación-y-configuración-local)
9. [Variables de entorno](#9-variables-de-entorno)
10. [Tutorial de uso](#10-tutorial-de-uso)
11. [Capturas de pantalla](#11-capturas-de-pantalla)
12. [Decisiones de arquitectura](#12-decisiones-de-arquitectura)
13. [Lecciones aprendidas y bugs documentados](#13-lecciones-aprendidas-y-bugs-documentados)
14. [Roadmap — próximas funcionalidades](#14-roadmap--próximas-funcionalidades)

---

## 1. ¿Qué es DevForge?

DevForge es una **SaaS de preparación técnica para entrevistas IT** construida con React + Supabase + IA (Groq/llama-3.3-70b).

El usuario puede:

- **Practicar por tema**: elegir un tema técnico (Python, AWS, Docker, etc.) y responder preguntas generadas por IA con feedback inmediato y puntaje.
- **Simular entrevistas reales**: pegar el texto de una oferta laboral de LinkedIn, dejar que la IA extraiga las habilidades requeridas, y hacer una entrevista simulada con preguntas específicas para ese puesto.
- **Ver su progreso**: dashboard con racha de estudio, historial de sesiones, scores por tema y semanas estimadas.
- **Generar su roadmap personalizado**: PDF exportable con plan de aprendizaje 0→100 generado por IA, con descripción, analogías, conceptos clave, ejercicios por nivel y milestones — todo basado en su perfil real y ofertas guardadas.
- **Acceder a recursos de estudio**: artículos, documentación y recursos curados por IA para cada tema.

---

## 2. Motivación y objetivo

### El problema

Prepararse para entrevistas técnicas en Argentina/Latam es difícil porque:

- Los recursos están en inglés y no aplican a los stacks locales.
- No existe una forma sistemática de saber qué temas priorizar para una oferta específica.
- La práctica es genérica — no está adaptada al nivel real del candidato.

### La solución

DevForge conecta **el perfil real del candidato** (sus temas, su nivel de self-assessment, sus ofertas guardadas) con **IA generativa** para producir contenido 100% personalizado.

El corazón de la app es el ciclo:

```
Oferta laboral → Extracción de temas con IA → Práctica personalizada → Roadmap PDF
```

### Objetivo del proyecto

1. Ser una herramienta real que el developer use semanalmente para preparar entrevistas.
2. Demostrar dominio de un stack moderno (React, Supabase, IA) en un proyecto de producción.
3. Ser un SaaS monetizable con plan free/premium en versiones futuras.

---

## 3. Stack tecnológico

| Capa | Tecnología | Por qué |
|---|---|---|
| **Frontend** | React 18 + Vite | SPA rápida, hot reload, build optimizado |
| **Routing** | React Router v6 | Rutas públicas y privadas con `<PrivateRoute>` |
| **Estado global** | React Context + useReducer | Sin dependencias externas, patrón Redux-like nativo |
| **Estilos** | Tailwind CSS + CSS custom | Design system propio con 3 temas (forge/dusk/chalk) |
| **Backend / DB** | Supabase (PostgreSQL) | Auth + DB + RLS en un solo servicio, sin servidor propio |
| **Auth** | Supabase Auth | Email/password + OAuth Google + reset de contraseña |
| **IA — práctica** | Groq API (llama-3.3-70b-versatile) | Generación de preguntas, evaluación de respuestas |
| **IA — roadmap** | Groq API (llama-3.3-70b-versatile) | Roadmap profundo con max_tokens: 16000 |
| **Exportación PDF** | jsPDF | PDF client-side sin servidor, con preview en nueva pestaña |
| **Parsing docs** | pdfjs-dist + mammoth | Extracción de texto de PDF y .docx para ofertas laborales |
| **Deploy** | Vercel (frontend) | CI/CD automático desde GitHub, edge network |

---

## 4. Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React SPA)                      │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  AuthContext  │    │    Store     │    │     Pages /      │  │
│  │              │    │  (useReducer)│    │   Components     │  │
│  │  - user      │◄───│              │◄───│                  │  │
│  │  - session   │    │  - user {}   │    │  Dashboard       │  │
│  │  - loading   │    │  - progress{}│    │  Topic           │  │
│  │              │    │  - history[] │    │  Interview       │  │
│  │  signIn()    │    │  - config {} │    │  Resources       │  │
│  │  signOut()   │    │              │    │  RoadmapPanel    │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                  │                      │             │
│         └──────────────────┼──────────────────────┘            │
│                            │                                    │
│                     ┌──────▼───────┐                           │
│                     │   lib/db.js  │                           │
│                     │  (data layer)│                           │
│                     └──────┬───────┘                           │
└────────────────────────────┼────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐  ┌────▼────┐  ┌─────▼──────────┐
    │   Supabase DB  │  │ Groq AI │  │  Supabase Auth │
    │  (PostgreSQL)  │  │  API    │  │  (JWT tokens)  │
    │                │  │         │  │                │
    │  profiles      │  │ llama-  │  │  auth.users    │
    │  topic_progress│  │ 3.3-70b │  │  sessions      │
    │  sessions      │  │         │  │  (Supabase     │
    │  interviews    │  └─────────┘  │   internal)    │
    │  saved_offers  │               └────────────────┘
    └────────────────┘
```

### Capas de la arquitectura

#### `AuthContext` — Identidad
Maneja **quién es el usuario**: sesión activa, tokens JWT, funciones de login/logout/registro. Se monta una sola vez en `main.jsx` y envuelve toda la app. Escucha `onAuthStateChange` de Supabase para actualizar el estado en tiempo real ante cualquier cambio de sesión.

#### `Store (StoreProvider)` — Estado de dominio
Maneja **qué hizo el usuario**: progreso, historial, configuración. Usa el patrón `useReducer` (similar a Redux pero sin dependencias). Su `syncDispatch` es un wrapper del dispatch original que intercepta acciones clave (`END_SESSION`, `ADD_INTERVIEW`) para persistirlas en Supabase inmediatamente.

#### `lib/db.js` — Capa de datos
**Único punto de contacto** con Supabase Database. Todos los componentes que necesitan leer/escribir datos lo hacen a través de este módulo. Nunca hacen queries directas. Esto permite cambiar el backend sin tocar ningún componente de UI.

#### `Pages + Components` — UI
Consumen el store y el auth context mediante los hooks `useStore()` y `useAuth()`. Llaman a funciones de `db.js` para operaciones puntuales que no necesitan pasar por el reducer (ej: cargar ofertas para el Roadmap).

---

## 5. Base de datos — Supabase / PostgreSQL

El schema completo está en `supabase/schema.sql`. Cinco tablas:

```
auth.users (Supabase interno)
    │
    ├── profiles          — perfil del usuario, config, onboarding
    ├── topic_progress    — progreso por tema (UNIQUE user+topic)
    ├── sessions          — historial de sesiones de práctica
    ├── interviews        — historial de entrevistas simuladas
    └── saved_offers      — ofertas laborales analizadas con IA
```

### Row Level Security (RLS)

**Cada tabla tiene RLS activado.** Esto significa que aunque alguien consiga la `anon key` de Supabase, solo puede acceder a sus propios datos. La policy dice:

```sql
USING (auth.uid() = user_id)
```

PostgreSQL evalúa esta condición en cada query. Sin esto, cualquier usuario podría leer el historial de cualquier otro.

### Campos JSONB

Los arrays complejos se guardan como JSONB en PostgreSQL:

| Tabla | Campo JSONB | Estructura |
|---|---|---|
| `profiles` | `extracted_topics` | `["Python", "AWS", "Docker"]` |
| `profiles` | `self_assessment` | `{ "python": 4, "aws": 2 }` |
| `sessions` | `answers` | `[{ question, answer, score, feedback }]` |
| `interviews` | `answers` | `[{ question, answer, score, feedback }]` |
| `saved_offers` | `topics` | `[{ id, name, tier, category }]` |

---

## 6. Estructura del proyecto

```
devforge/
│
├── public/                    # Assets estáticos (favicon, etc.)
├── supabase/
│   └── schema.sql             # Schema completo de la DB — ejecutar en Supabase SQL Editor
│
├── src/
│   ├── main.jsx               # Entry point — monta AuthProvider + StoreProvider
│   ├── App.jsx                # Router principal — define todas las rutas
│   │
│   ├── context/
│   │   └── AuthContext.jsx    # Contexto de autenticación (Supabase Auth)
│   │
│   ├── store/
│   │   └── index.jsx          # Estado global (useReducer) + sincronización Supabase
│   │
│   ├── lib/
│   │   ├── supabase.js        # Cliente de Supabase (singleton)
│   │   └── db.js              # Capa de acceso a datos — todas las queries
│   │
│   ├── data/
│   │   ├── topics.js          # Catálogo de 30+ temas técnicos con tier y categoría
│   │   └── roadmap.js         # Estructura de semanas sugeridas del roadmap
│   │
│   ├── pages/
│   │   ├── Landing.jsx        # / — página de bienvenida y marketing
│   │   ├── Login.jsx          # /login — formulario de inicio de sesión
│   │   ├── Register.jsx       # /register — formulario de registro
│   │   ├── ForgotPassword.jsx # /forgot-password — solicitar reset
│   │   ├── ResetPassword.jsx  # /reset-password — ingresar nueva contraseña
│   │   ├── Onboarding.jsx     # /onboarding — setup inicial del perfil
│   │   ├── Dashboard.jsx      # /dashboard — hub principal con métricas
│   │   ├── Topic.jsx          # /topic/:id — práctica de un tema específico
│   │   ├── Session.jsx        # /session — resultados de la sesión activa
│   │   ├── History.jsx        # /history — historial de sesiones
│   │   ├── QuickReview.jsx    # /quick-review — revisión rápida de 5 preguntas
│   │   ├── InterviewSetup.jsx # /interview-setup — configurar entrevista simulada
│   │   ├── Interview.jsx      # /interview — entrevista en progreso
│   │   ├── InterviewResults.jsx # /interview-results — análisis post-entrevista
│   │   └── InterviewHistory.jsx # /interview-history — historial de entrevistas
│   │
│   └── components/
│       └── ui/
│           ├── Header.jsx         # Barra de navegación con menú y temas
│           ├── PrivateRoute.jsx   # Guard de rutas — redirige a /login si no hay sesión
│           ├── ThemeSwitcher.jsx  # Selector de tema (forge/dusk/chalk)
│           ├── ResourcePanel.jsx  # Panel de recursos de estudio por tema
│           └── RoadmapPanel.jsx   # Generador de roadmap PDF con IA
│
├── docs/
│   └── screenshots/           # Capturas de pantalla de la app (ver sección 11)
│
├── .env                       # Variables de entorno (NO commitear — ver .env.example)
├── .env.example               # Plantilla de variables de entorno
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

---

## 7. Flujo de datos completo

### Al iniciar la app (primera vez)

```
1. main.jsx monta <AuthProvider> → <StoreProvider> → <App>
2. AuthProvider llama supabase.auth.getSession()
   → Si hay sesión guardada en localStorage: user = { id, email, ... }
   → Si no hay sesión: user = null
3. StoreProvider detecta el user → llama db.loadUserData(user.id)
   → Si hay datos: dispatch(LOAD_STATE) carga todo al store
   → Si no hay datos (usuario nuevo): store queda en initialState
4. App renderiza las rutas. PrivateRoute verifica AuthContext.
```

### Al hacer login

```
1. Login.jsx llama signIn(email, password)
2. Supabase Auth autentica → devuelve { user, error }
3. onAuthStateChange dispara → AuthContext actualiza user
4. StoreProvider detecta el nuevo user.id → llama loadUserData()
5. Login.jsx consulta directamente supabase profiles (no espera el store)
   → Si onboarding_done=true → navigate('/dashboard')
   → Si onboarding_done=false → navigate('/onboarding')
```

> **¿Por qué Login.jsx no usa el store para decidir la navegación?**
> Race condition: el store carga datos de forma asíncrona. En el momento
> en que navigate() se ejecuta, loadUserData() aún no terminó y
> onboardingDone sigue siendo false. La solución es hacer una query
> directa a Supabase para ese dato crítico. Ver comentario en Login.jsx.

### Al terminar una sesión de práctica

```
1. Session.jsx llama dispatch({ type: ACTIONS.END_SESSION })
2. syncDispatch (el wrapper del store) intercepta la acción
3. Llama db.saveSession(user.id, session) → INSERT en Supabase
4. El reducer mueve la sesión del estado activo al historial local
5. La UI se actualiza instantáneamente (sin esperar la DB)
```

### Al guardar una oferta laboral

```
1. InterviewSetup.jsx extrae el texto de la oferta (manual o por PDF/DOCX)
2. Llama a Groq API → devuelve { name, summary, topics[] }
3. db.saveOffer(userId, offer) → INSERT en saved_offers
4. La UI actualiza la lista local
5. La próxima vez que RoadmapPanel cargue, incluirá los temas de esta oferta
```

---

## 8. Instalación y configuración local

### Prerequisitos

- Node.js 18+
- npm 9+
- Una cuenta en [Supabase](https://supabase.com) (plan free funciona)
- Una API key de [Groq](https://console.groq.com) (plan free funciona)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/TU_USUARIO/devforge.git
cd devforge

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus claves (ver sección 9)

# 4. Crear el schema en Supabase
# → Ir a Supabase Dashboard → SQL Editor → New query
# → Pegar el contenido de supabase/schema.sql → Run

# 5. Iniciar el servidor de desarrollo
npm run dev
# La app estará en http://localhost:5174
```

---

## 9. Variables de entorno

Crear un archivo `.env` en la raíz del proyecto con:

```env
# ── Supabase ────────────────────────────────────────────────────
# Encontrás estos valores en: Supabase Dashboard → Settings → API
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# ── Groq AI ─────────────────────────────────────────────────────
# Encontrás tu API key en: https://console.groq.com/keys
VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

> **Importante:** El prefijo `VITE_` es obligatorio en Vite para exponer
> variables al cliente. Nunca usar `VITE_` para claves secretas de servidor.
> La `anon key` de Supabase es segura en el cliente porque RLS protege los datos.

---

## 10. Tutorial de uso

### Paso 1 — Crear tu cuenta

1. Abrí la app en `http://localhost:5174` (o el dominio de producción).
2. Hacé click en **"Empezar gratis"** o en **"Registrate gratis"** en el login.
3. Ingresá tu email y contraseña. Si está activada la confirmación de email en Supabase, vas a recibir un email para confirmar.
4. Una vez confirmado, iniciá sesión.

> **Olvidaste tu contraseña?** Hacé click en "¿Olvidaste tu contraseña?" en el login,
> ingresá tu email y vas a recibir un link de reset en minutos.

---

### Paso 2 — Completar el onboarding

La primera vez que entrás, la app te lleva al **onboarding** para conocerte:

1. **Tu nombre** — cómo la app te va a llamar en el roadmap y sesiones.
2. **Fecha objetivo** — ¿cuándo es tu entrevista? La app prioriza los temas según el tiempo disponible.
3. **Ofertas laborales** — pegá el texto de 1 a 3 ofertas de LinkedIn (o subí el PDF/DOCX). La IA extrae automáticamente los temas técnicos requeridos.
4. **Self-assessment** — evaluate del 1 al 5 en cada tema. Esto personaliza las recomendaciones del dashboard.

Al hacer click en "Completar configuración", tu perfil queda guardado en Supabase y nunca más tenés que repetir este proceso.

---

### Paso 3 — Practicar desde el Dashboard

El **Dashboard** es tu hub central. Muestra:

- **Racha de estudio** — cuántos días consecutivos practicaste.
- **Sesiones realizadas** — total histórico.
- **Score promedio** — puntaje promedio en todas tus sesiones.
- **Días para la entrevista** — cuenta regresiva desde tu fecha objetivo.
- **Semana actual del roadmap** — qué temas practicar esta semana.
- **Temas recomendados** — basados en tu progreso y self-assessment.

Para practicar un tema:
1. Hacé click en una **tarjeta de tema** en el dashboard.
2. Vas a `/topic/:id` donde podés ver la descripción del tema y empezar una sesión.
3. La IA genera 5 preguntas. Respondé cada una en el campo de texto.
4. Al terminar, ves tu **score (1-10)** y **feedback** de la IA para cada respuesta.
5. Tu progreso se guarda automáticamente.

**Quick Review** — en el header hay un botón de revisión rápida. Genera 5 preguntas de distintos temas para mantener los conocimientos frescos.

---

### Paso 4 — Simular una entrevista real

1. Ir a **"Simular entrevista"** desde el header o el dashboard.
2. En `/interview-setup`:
   - Pegá el texto de una oferta laboral (o subí PDF/DOCX).
   - Hacé click en **"Analizar con IA"** — la IA extrae los temas y los guarda.
   - Seleccioná dificultad (básico/mid/senior) y duración (20/45/60 min).
3. La entrevista comienza en `/interview`:
   - La IA genera preguntas específicas para los temas de la oferta.
   - Respondé cada pregunta. Podés saltear si no sabés.
   - Al terminar, vas a `/interview-results` con análisis completo.
4. Tu historial de entrevistas está en `/interview-history`.

---

### Paso 5 — Explorar Recursos

En el **panel de Recursos** (botón en el header):

1. **Por tema** — elegí cualquier tema del catálogo y la IA genera recursos: artículos, docs oficiales, videos recomendados.
2. **Generar Roadmap PDF** — hacé click en este banner para generar tu roadmap personalizado completo.

---

### Paso 6 — Generar tu Roadmap PDF

1. En el panel de Recursos, hacé click en **"Generar Mi Roadmap PDF"**.
2. La app muestra un resumen de tu perfil: temas del onboarding + temas de tus ofertas guardadas.
3. Hacé click en **"Generar Roadmap"**.
4. La IA procesa ~15-30 segundos y genera el roadmap completo.
5. Podés **explorar el roadmap en pantalla** — cada tarjeta de tema se expande mostrando descripción, analogía, prerequisitos, conceptos clave, ejercicios y milestones.
6. Botones en la parte superior:
   - **"Ver PDF"** — abre el PDF en nueva pestaña para previsualizar antes de guardar.
   - **"↓ Descargar"** — descarga el archivo `roadmap-devforge-tu-nombre-fecha.pdf`.

---

### Paso 7 — Personalizar la app

En el **header** hay un botón de configuración (ícono de engranaje o tu nombre):

- **Tema visual**: `forge` (oscuro), `dusk` (medio), `chalk` (claro).
- **Fuente**: `forge` (Syne), `clean` (Inter), `terminal` (Space Mono).
- **Idioma**: español / inglés (en desarrollo).

Los cambios se guardan automáticamente en Supabase.

---

## 11. Capturas de pantalla

Las capturas están en `docs/screenshots/`. Para agregarlas:

```
docs/screenshots/
├── 01-landing.png           # Página principal
├── 02-register.png          # Formulario de registro
├── 03-login.png             # Formulario de login
├── 04-onboarding.png        # Proceso de setup inicial
├── 05-dashboard.png         # Dashboard principal
├── 06-topic.png             # Página de práctica por tema
├── 07-session-results.png   # Resultados de una sesión
├── 08-interview-setup.png   # Configuración de entrevista
├── 09-interview.png         # Entrevista en progreso
├── 10-interview-results.png # Resultados de entrevista
├── 11-resources.png         # Panel de recursos
└── 12-roadmap-pdf.png       # Roadmap generado y PDF preview
```

> **Cómo sacar las capturas**: Con la app corriendo en `http://localhost:5174`,
> navegá a cada sección y usá `Ctrl+Shift+S` (Windows) o la DevTools de Chrome
> para capturar la página completa.

---

## 12. Decisiones de arquitectura

### ¿Por qué React Context + useReducer en vez de Redux o Zustand?

Para el alcance actual de DevForge, Redux agrega complejidad innecesaria (boilerplate, middlewares, toolkit). Zustand es una opción limpia, pero useReducer nativo da el mismo resultado sin dependencias. Si la app escala a 10+ features con estado compartido complejo, migrar a Zustand sería el siguiente paso natural.

### ¿Por qué Supabase y no un backend FastAPI propio?

DevForge está construido para iterar rápido. Supabase provee Auth + PostgreSQL + RLS + Realtime en un solo servicio. Un FastAPI propio significaría 2-3 semanas extra de trabajo antes de tener el primer feature funcionando. La estrategia correcta es: **validar el producto con Supabase, migrar a backend propio cuando el producto lo justifique**.

### ¿Por qué Groq y no OpenAI o Claude?

Groq con llama-3.3-70b ofrece latencia muy baja (tokens por segundo muy altos) y un tier free generoso para desarrollo. El roadmap soporta hasta `max_tokens: 16000` por request. Para producción con escala, se evaluará Claude API (Anthropic) por su superior razonamiento y contexto largo.

### ¿Por qué el cliente Groq llama directamente desde el browser?

En el estado actual (MVP, usuario individual), la API key está en `.env`. Para producción multi-usuario, esto debe moverse a un backend que haga las llamadas a Groq en nombre del usuario, protegiéndose de abusos. Es deuda técnica conocida y documentada.

### ¿Por qué jsPDF para el PDF y no react-pdf o una librería de servidor?

jsPDF permite generar el PDF 100% en el browser sin necesidad de un servidor. Para el roadmap personalizado, esto significa que el usuario ve su PDF en segundos sin latencia de red. La limitación principal (solo fonts Latin-1) se resolvió usando `doc.circle()` y `doc.line()` de jsPDF como indicadores visuales en lugar de emoji Unicode.

---

## 13. Lecciones aprendidas y bugs documentados

### Race condition entre Auth y Store al hacer login (Mar 2026)

**Problema**: Después del signIn(), `onboardingDone` era siempre `false` aunque el usuario ya hubiera completado el onboarding. El usuario tenía que repetirlo en cada login.

**Causa**: La lógica de navegación leía `state.config.onboardingDone` del store. Pero el store carga datos de Supabase de forma asíncrona con `loadUserData()`. En el momento en que `navigate()` se ejecutaba, la carga no había terminado y `onboardingDone` seguía siendo `false` (el valor inicial).

**Fix**: En `Login.jsx`, después del signIn(), hacer una query directa a Supabase (`profiles.select('onboarding_done')`) en lugar de leer el store. El store puede estar vacío; Supabase siempre tiene el valor real.

**Regla general**: Nunca usar el store para decisiones de navegación inmediatamente después del login. Consultá Supabase directamente si necesitás un dato crítico en ese momento.

---

### Campo opcional rompía persistencia del onboarding (Mar 2026)

**Problema**: El campo `language` estaba incluido en el mismo upsert que `onboarding_done` en `syncProfile()`. Cuando la columna `language` aún no existía en la DB (ALTER TABLE pendiente), Supabase fallaba el upsert entero — incluyendo `onboarding_done`. El error se silenciaba en el catch.

**Fix**: Separar columnas opcionales en llamadas independientes. Si la llamada opcional falla, el perfil principal ya fue guardado con éxito.

**Regla general**: Nunca mezclar columnas críticas con columnas opcionales en el mismo upsert. Un campo que puede no existir nunca debe bloquear el guardado de un campo crítico.

---

### JSON truncado en generación del roadmap (Mar 2026)

**Problema**: Con 13+ temas, el roadmap generado por Groq se cortaba a mitad del JSON con `JSON.parse: unterminated string literal at line 713`.

**Causa**: `max_tokens: 8000` era insuficiente para el contenido profundo con descripción, prerequisitos, conceptos clave, 3 ejercicios por nivel y milestones por tema.

**Fix capa 1**: Elevar `max_tokens` de 8000 a 16000 (el modelo soporta hasta 32k de output).

**Fix capa 2**: Función `extractCompleteTopics(partialJson)` — parser char-level que extrae todos los objetos `{ }` completamente cerrados de un JSON truncado. Se usa como fallback cuando `JSON.parse` falla.

---

### Emoji en PDF mostraba caracteres basura (Mar 2026)

**Problema**: Los emoji (🟢🟡🔴) y flechas (`→`) en el PDF aparecían como `Ø=ßâ B á s i c o`.

**Causa**: jsPDF usa fonts Latin-1 (Helvetica/Courier). Los caracteres Unicode > U+00FF (emoji, flechas especiales) no son encodables en Latin-1 y producen bytes basura que además corrompían el spacing del texto adyacente.

**Fix**: Reemplazar todos los caracteres no-Latin-1 en `doc.text()` con primitivas de dibujo de jsPDF: `doc.circle()` para indicadores de color y `doc.line()` para flechas.

---

## 14. Roadmap — próximas funcionalidades

Este es el estado del proyecto al **marzo 2026** y las ideas documentadas para las próximas iteraciones:

### Prioridad alta

- [ ] **Plan free vs. premium con Stripe** — limitar entrevistas/sesiones para free tier, desbloquear con suscripción mensual. Esto convierte DevForge en un SaaS monetizable.
- [ ] **Dashboard v2 con gráficos** — evolución del score por tema en el tiempo con recharts o chart.js. Actualmente el dashboard muestra estadísticas estáticas del estado actual.
- [ ] **Mover llamadas a Groq al backend** — actualmente la API key de Groq está expuesta en el cliente (`.env` + Vite). En producción con usuarios reales, esto debe moverse a un backend (FastAPI o Edge Functions de Supabase) para proteger la key y controlar el uso.

### Prioridad media

- [ ] **Sistema de logros/badges** — completar X sesiones, mantener racha de 7 días, dominar un tema. Aumenta retención y engagement.
- [ ] **Preguntas guardadas** — poder marcar preguntas difíciles de una sesión para repasar más tarde, similar a un "flashcard deck" personalizado.
- [ ] **Modo voz para entrevistas** — speech-to-text para responder preguntas hablando, simulando más fielmente una entrevista real de video.
- [ ] **Compartir roadmap como URL pública** — generar un link para compartir el roadmap sin necesidad de descargar el PDF.

### Prioridad baja / futura

- [ ] **Notificaciones / recordatorios por email** — "Hace 3 días que no practicás, tu racha se rompe mañana." Vía Supabase Edge Functions + servicios de email.
- [ ] **Migración a backend FastAPI** — cuando la escala lo justifique, mover la lógica de negocio a un backend Python con FastAPI + PostgreSQL + Redis para mayor control.
- [ ] **Tests E2E con Playwright** — cobertura automatizada de los flujos críticos (registro, onboarding, sesión, entrevista).
- [ ] **App móvil con React Native + Expo** — mismo backend Supabase, nueva UI adaptada para practicar desde el celular.
- [ ] **Analytics de uso** — entender qué temas se practican más, dónde abandonan los usuarios, para mejorar el producto con datos reales.

---

## Autor

**Lucas Yatay Aramendy**
Analista de Sistemas | Backend Engineer — Instituto Sábato / CNEA

- GitHub: [@lucasaramendy](https://github.com/lucasaramendy)
- Stack principal: Python · FastAPI · PostgreSQL · React · Supabase

---

*DevForge — Preparación técnica para entrevistas IT · Powered by Claude + Groq AI*
