# DevForge — Plataforma de Preparación Técnica para Entrevistas IT

> **Prepará tu próxima entrevista técnica con IA personalizada.**
> Practicá por tema, simulá entrevistas reales con ofertas laborales reales, analizá tu CV contra una oferta laboral, y generá tu roadmap de aprendizaje 0→100 en PDF.

**Stack:** React 18 + Vite · Supabase (PostgreSQL + Auth) · Groq AI (llama-3.3-70b) · jsPDF · react-i18next

**Deploy:** Vercel (CI/CD automático desde GitHub `master`)

---

## Índice

1. [¿Qué es DevForge?](#1-qué-es-devforge)
2. [Motivación y objetivo](#2-motivación-y-objetivo)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura del sistema](#4-arquitectura-del-sistema)
5. [Base de datos — Supabase / PostgreSQL](#5-base-de-datos--supabase--postgresql)
6. [Estructura del proyecto](#6-estructura-del-proyecto)
7. [Flujo de datos completo](#7-flujo-de-datos-completo)
8. [Funcionalidades principales](#8-funcionalidades-principales)
   - 8.1 [Práctica por tema](#81-práctica-por-tema)
   - 8.2 [Entrevista simulada — wizard 3 pasos](#82-entrevista-simulada--wizard-3-pasos)
   - 8.3 [CV Matcher — compatibilidad con oferta laboral](#83-cv-matcher--compatibilidad-con-oferta-laboral)
   - 8.4 [Gestión de ofertas guardadas](#84-gestión-de-ofertas-guardadas)
   - 8.5 [Roadmap PDF personalizado](#85-roadmap-pdf-personalizado)
   - 8.6 [Internacionalización (ES/EN)](#86-internacionalización-esen)
9. [Instalación y configuración local](#9-instalación-y-configuración-local)
10. [Variables de entorno](#10-variables-de-entorno)
11. [Tutorial de uso paso a paso](#11-tutorial-de-uso-paso-a-paso)
12. [Decisiones de arquitectura](#12-decisiones-de-arquitectura)
13. [Lecciones aprendidas y bugs documentados](#13-lecciones-aprendidas-y-bugs-documentados)
14. [Historial de fases de desarrollo](#14-historial-de-fases-de-desarrollo)
15. [Roadmap — próximas funcionalidades](#15-roadmap--próximas-funcionalidades)

---

## 1. ¿Qué es DevForge?

DevForge es una **SaaS de preparación técnica para entrevistas IT** construida con React + Supabase + IA (Groq/llama-3.3-70b).

El usuario puede:

- **Practicar por tema**: elegir un tema técnico (Python, AWS, Docker, FastAPI, etc.) y responder preguntas generadas por IA con feedback inmediato y puntaje.
- **Simular entrevistas reales**: un wizard de 3 pasos que guía al usuario desde elegir el perfil técnico hasta lanzar la entrevista. Soporta presets rápidos, ofertas laborales analizadas con IA, y modo personalizado.
- **Analizar su CV con IA**: el CV Matcher compara el CV del usuario contra una oferta laboral usando un algoritmo de scoring ATS (40% skills técnicas / 25% seniority / 20% dominio / 15% keywords). Devuelve score, gaps, proyectos para cerrar gaps y quick wins.
- **Gestionar ofertas guardadas**: dashboard de ofertas con búsqueda, ordenamiento, filtrado por estado (activa/aplicada/en proceso/descartada), pins, uso en entrevistas, y renombrado inline.
- **Ver su progreso**: dashboard con racha de estudio, historial de sesiones, scores por tema y semanas estimadas.
- **Generar su roadmap personalizado**: PDF exportable con plan de aprendizaje 0→100 generado por IA, con descripción, analogías, conceptos clave, ejercicios por nivel y milestones — todo basado en su perfil real y ofertas guardadas.
- **Todo en español o inglés**: toggle de idioma en el header que cambia la UI y también el idioma de respuesta de la IA.

---

## 2. Motivación y objetivo

### El problema

Prepararse para entrevistas técnicas en Argentina/Latam es difícil porque:

- Los recursos están en inglés y no aplican a los stacks locales.
- No existe una forma sistemática de saber qué temas priorizar para una oferta específica.
- La práctica es genérica — no está adaptada al nivel real del candidato.
- No hay una herramienta que diga "tu CV califica para esta oferta en un 67%, te faltan estas 3 cosas".

### La solución

DevForge conecta **el perfil real del candidato** (sus temas, su nivel de self-assessment, sus ofertas guardadas, su CV) con **IA generativa** para producir contenido 100% personalizado.

El corazón de la app es el ciclo:

```
Oferta laboral → Extracción de temas con IA → Práctica personalizada → CV Matcher → Roadmap PDF
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
| **Estilos** | CSS custom variables | Design system propio con 3 temas (forge/dusk/chalk) |
| **Backend / DB** | Supabase (PostgreSQL) | Auth + DB + RLS en un solo servicio, sin servidor propio |
| **Auth** | Supabase Auth | Email/password + OAuth Google + reset de contraseña |
| **IA — práctica** | Groq API (llama-3.3-70b-versatile) | Generación de preguntas, evaluación de respuestas |
| **IA — roadmap** | Groq API (llama-3.3-70b-versatile) | Roadmap profundo con max_tokens: 16000 |
| **IA — CV Matcher** | Groq API (llama-3.3-70b-versatile) | Análisis ATS, scoring, gaps y quick wins (max_tokens: 2500) |
| **i18n** | react-i18next | Locales ES/EN, toggle en header, IA también responde en el idioma activo |
| **Exportación PDF** | jsPDF | PDF client-side sin servidor, con preview en nueva pestaña |
| **Parsing docs** | pdfjs-dist + mammoth | Extracción de texto de PDF y .docx para CVs y ofertas laborales |
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
│  │              │    │  - history[] │    │  InterviewSetup  │  │
│  │  signIn()    │    │  - config {} │    │  Interview       │  │
│  │  signOut()   │    │  - language  │    │  CVMatcherPanel  │  │
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
Maneja **qué hizo el usuario**: progreso, historial, configuración, idioma activo. Usa el patrón `useReducer` (similar a Redux pero sin dependencias). Su `syncDispatch` es un wrapper del dispatch original que intercepta acciones clave (`END_SESSION`, `ADD_INTERVIEW`) para persistirlas en Supabase inmediatamente.

#### `lib/db.js` — Capa de datos
**Único punto de contacto** con Supabase Database. Todos los componentes que necesitan leer/escribir datos lo hacen a través de este módulo. Nunca hacen queries directas. Esto permite cambiar el backend sin tocar ningún componente de UI.

Funciones disponibles:
- `loadUserData(userId)` — carga todo el perfil del usuario al iniciar la app
- `syncProfile(userId, data)` — actualiza configuración del perfil
- `saveSession(userId, session)` — guarda una sesión de práctica
- `saveInterview(userId, interview)` — guarda una entrevista simulada
- `loadOffers(userId)` — carga las ofertas guardadas desde Supabase
- `saveOffer(userId, offer)` — guarda una oferta analizada con IA
- `deleteOffer(userId, offerId)` — elimina una oferta
- `updateOfferName(userId, offerId, newName)` — renombra una oferta

#### `Pages + Components` — UI
Consumen el store y el auth context mediante los hooks `useStore()` y `useAuth()`. Llaman a funciones de `db.js` para operaciones puntuales que no necesitan pasar por el reducer.

#### `localStorage` — Metadatos de UI (no de negocio)
Estado y pins de ofertas (`devforge_offer_status`, `devforge_offer_pins`) viven en localStorage porque son preferencias del dispositivo, no datos de negocio. Ver decisión arquitectónica completa en sección 12.

---

## 5. Base de datos — Supabase / PostgreSQL

El schema completo está en `supabase/schema.sql`. Cinco tablas:

```
auth.users (Supabase interno)
    │
    ├── profiles          — perfil del usuario, config, onboarding, idioma
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

### `saved_offers` — estructura importante

La tabla guarda `name`, `summary` y `topics` extraídos por la IA — **no el texto crudo de la oferta**. Cuando el CV Matcher necesita el texto del JD, lo **reconstruye** a partir de estos datos estructurados (función `buildJobText` en `CVMatcherPanel.jsx`). Esto reduce el storage significativamente.

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
│   │   └── index.jsx          # Estado global (useReducer) + syncDispatch + idioma
│   │
│   ├── lib/
│   │   ├── supabase.js        # Cliente de Supabase (singleton)
│   │   ├── db.js              # Capa de acceso a datos — todas las queries
│   │   └── fileParser.js      # Extracción de texto: PDF (pdfjs), DOCX (mammoth), URL fetch
│   │
│   ├── hooks/
│   │   └── useAI.js           # Hook de llamadas a Groq API (preguntas + evaluación)
│   │
│   ├── data/
│   │   ├── topics.js          # Catálogo de 30+ temas técnicos con tier y categoría
│   │   ├── questions.js       # Banco de preguntas por topic (fallback si la IA falla)
│   │   └── roadmap.js         # Estructura de semanas sugeridas del roadmap
│   │
│   ├── i18n/
│   │   ├── index.js           # Configuración de i18next + persistencia en localStorage
│   │   └── locales/
│   │       ├── es.json        # Traducciones en español (idioma por defecto)
│   │       └── en.json        # Traducciones en inglés (mirror de es.json)
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
│   │   ├── InterviewSetup.jsx # /interview-setup — wizard 3 pasos para configurar entrevista
│   │   ├── Interview.jsx      # /interview — entrevista en progreso
│   │   ├── InterviewResults.jsx # /interview-results — análisis post-entrevista
│   │   └── InterviewHistory.jsx # /interview-history — historial de entrevistas
│   │
│   ├── components/
│   │   └── ui/
│   │       ├── Header.jsx         # Barra de navegación: temas, fuente, idioma, CV Matcher, Recursos
│   │       ├── PrivateRoute.jsx   # Guard de rutas — redirige a /login si no hay sesión
│   │       ├── ThemeSwitcher.jsx  # Selector de tema visual (forge/dusk/chalk)
│   │       ├── ResourcePanel.jsx  # Panel lateral: recursos de estudio por tema + Roadmap
│   │       ├── RoadmapPanel.jsx   # Generador de roadmap PDF con IA (dentro de ResourcePanel)
│   │       └── CVMatcherPanel.jsx # Panel lateral: análisis ATS de CV vs oferta laboral
│   │
│   └── styles/
│       └── globals.css        # Variables CSS de temas, tipografías, z-index stack
│
├── docs/
│   └── screenshots/           # Capturas de pantalla de la app
│
├── .env                       # Variables de entorno (NO commitear)
├── .env.example               # Plantilla de variables de entorno
├── package.json
└── vite.config.js
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
> directa a Supabase para ese dato crítico.

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
1. InterviewSetup.jsx extrae el texto de la oferta (manual, PDF, DOCX o URL)
2. Llama a Groq API → devuelve { name, summary, topics[] }
3. db.saveOffer(userId, offer) → INSERT en saved_offers con UUID real
4. La UI actualiza la lista local con la oferta devuelta por la DB (incluye el UUID)
5. La próxima vez que CVMatcherPanel o RoadmapPanel cargue, incluirá esta oferta
```

### Al analizar el CV con CV Matcher

```
1. Usuario sube su CV (PDF/DOCX/TXT/MD) o lo pega como texto
2. Usuario selecciona una oferta guardada o pega el JD manualmente
3. CVMatcherPanel llama a Groq con:
   - System prompt: experto en ATS + instrucción de idioma (ES o EN)
   - User message: CV (truncado a 4000 chars) + JD (truncado a 3000 chars)
4. Groq devuelve JSON con: score, breakdown 4 ejes, verdict, matches, gaps,
   proyectos sugeridos, optimización ATS, análisis de seniority, quick wins
5. El panel renderiza las tabs con los resultados
   → Tab por defecto: Quick Wins (lo más accionable)
```

---

## 8. Funcionalidades principales

### 8.1 Práctica por tema

Cada tema del catálogo (`data/topics.js`) tiene una página `/topic/:id` donde la IA genera 5 preguntas específicas para ese tema. El usuario responde en texto libre, y la IA evalúa cada respuesta con un puntaje (1-10) y feedback detallado.

El progreso se guarda en `topic_progress` (Supabase) y se refleja en el dashboard con el puntaje promedio por tema.

**Quick Review** (header) genera 5 preguntas de distintos temas para mantener conocimientos frescos, sin abrir una sesión completa.

---

### 8.2 Entrevista simulada — wizard 3 pasos

`/interview-setup` implementa un wizard guiado de 3 pasos con:

**StepBar** — barra de progreso visual con:
- Círculos numerados que se convierten en ✓ al completar el paso
- Líneas conectoras que se llenan con `var(--primary)` al avanzar
- Transiciones CSS de 0.25s para color/background
- Labels traducidos debajo de cada círculo

**Paso 1 — Perfil:**
- **Presets rápidos**: Python/AWS, Full Stack, Agentic AI — selección inmediata
- **Mis ofertas guardadas**: lista completa con dashboard de gestión (ver 8.4)
- **Nueva oferta**: pegar URL, subir PDF/DOCX, o pegar texto → análisis con IA → guarda automáticamente
- **Personalizado**: topic picker manual para elegir temas exactos

**Paso 2 — Sesión:**
- Selección de duración: 20 min (práctica rápida) / 45 min (estándar) / 60 min (intensiva)
- Selección de dificultad: Junior / Mid / Senior con colores semáforo
- **Smart default de dificultad**: si el usuario selecciona una oferta guardada, el sistema cuenta sus topics tier-1 y sugiere automáticamente: ≥5 → Senior, 3-4 → Mid, <3 → Junior. Muestra badge ⚡ explicando el ajuste automático. Se limpia si el usuario cambia manualmente.
- **SkillsBreakdown**: desglose de las skills del perfil seleccionado por tier (Crítico / Importante / Diferenciador) con indicador de cobertura en DevForge

**Paso 3 — Resumen:**
- Card resumen con perfil, duración, nivel y estimación de preguntas
- Botón "Iniciar entrevista →" prominente (18px, fontWeight 800)
- Recordatorio de reglas de la entrevista

**Animación entre pasos:** `@keyframes stepIn` con fade + translateX(10px→0) en cada transición.

---

### 8.3 CV Matcher — compatibilidad con oferta laboral

Panel lateral derecho (mismo patrón que ResourcePanel: overlay + 420px fijo a la derecha). Se abre desde el botón ⚡ CV Match en el header.

**Qué analiza:**
1. Compatibilidad técnica entre el CV y una oferta laboral
2. Score global 0-100 con breakdown en 4 ejes (formula 40/25/20/15)
3. Skills que matchean (con indicador ★★★ de prioridad)
4. Skills que faltan (con urgencia: crítica / importante / nice-to-have)
5. Proyectos concretos para cerrar los gaps (2-3, con stack, días estimados y keywords de GitHub)
6. Optimización ATS: keywords exactas a agregar + placement sugerido + tips de formato
7. Análisis de seniority: lo que pide el JD vs lo que demuestra el CV
8. Quick Wins: 3 acciones para hacer HOY en menos de 30 minutos

**Tabs de resultados:**
- **Hoy** (default) — Quick wins + análisis de seniority
- **Matches** — skills que el CV ya cubre
- **Gaps** — skills que faltan con tiempo estimado de aprendizaje
- **Proyectos** — proyectos sugeridos para cerrar gaps
- **ATS** — score ATS específico + keywords + tips de formato

**Cómo usa las ofertas guardadas:**
El picker de ofertas carga las ofertas del usuario desde Supabase. Al seleccionar una, `buildJobText()` reconstruye el texto del JD a partir de los datos estructurados (name + summary + topics por tier). El texto queda editable en el textarea antes de analizar.

**Idioma adaptativo:**
- La UI responde al toggle ES/EN del header via react-i18next
- El prompt a Groq incluye instrucción explícita de idioma → la IA responde en el idioma activo
- Sin instrucción explícita, Groq puede mezclar idiomas en el JSON

---

### 8.4 Gestión de ofertas guardadas

`InterviewSetup.jsx` (paso 1) incluye un dashboard completo de gestión de ofertas:

**Búsqueda y ordenamiento:**
- Campo de búsqueda que filtra por nombre en tiempo real
- Ordenamiento: más reciente / más antiguo / más usada / A-Z
- Contadores de uso (cuántas entrevistas se hicieron con cada oferta)

**Estado de oferta:**
- Botón de estado con 4 opciones: Activa / En proceso / Aplicada / Descartada
- Cada estado tiene un color semáforo: verde / amarillo / azul / gris
- El estado se persiste en `localStorage` (no en Supabase — ver sección 12 para el razonamiento)

**Pins:**
- Las ofertas fijadas flotan al tope de la lista
- Pin toggle con icono 📌 / ☆
- El pin se persiste en `localStorage`

**Renombrado inline:**
- Click en el nombre de la oferta lo convierte en un input editable
- Al presionar Enter o perder el foco, se guarda en Supabase con actualización optimista
- Actualización optimista: el nombre cambia en la UI inmediatamente y se revierte si Supabase falla

**Migración automática:**
Al montar `useSavedOffers`, si hay ofertas en `localStorage` (versión anterior de la app), se migran automáticamente a Supabase y se limpia el storage.

---

### 8.5 Roadmap PDF personalizado

Desde el panel de Recursos (botón en el header) el usuario puede generar un roadmap de aprendizaje personalizado basado en su perfil + ofertas guardadas.

La IA genera contenido profundo para cada tema:
- Descripción y analogía
- Pre-requisitos
- Conceptos clave
- 3 ejercicios por nivel (básico / medio / avanzado)
- Milestones de progreso

El resultado se puede explorar en pantalla (tarjetas expandibles) y descargar como PDF con preview previo.

**Limitación de jsPDF:** los caracteres Unicode (emoji, flechas especiales) se renderizan como bytes basura en Helvetica/Courier (Latin-1 only). Solución: usar `doc.circle()` y `doc.line()` de jsPDF como primitivas visuales en lugar de emoji.

---

### 8.6 Internacionalización (ES/EN)

La app está completamente traducida al español e inglés usando **react-i18next**.

**Configuración** (`src/i18n/index.js`):
- Idioma por defecto: `es` (detectado desde el store, con fallback a `es`)
- Persistencia: triple capa — store (`state.config.language`) + Supabase profiles + localStorage
- `fallbackLng: 'es'` — si una key falta en EN, muestra la española

**Estructura de locales:**
- `es.json` y `en.json` tienen estructura idéntica (mirror exacto de keys)
- Namespaces: `common`, `interview`, `cvmatcher`, `resources`, `dashboard`, `topic`, `history`
- Pluralización: algunos keys usan `_one` / `_other` para manejar singular/plural

**Regla de desarrollo:** ningún string de UI puede estar hardcodeado en los componentes. Todo pasa por `t('key.subkey')`. Si encontrás un string hardcodeado, es un bug.

**Idioma de la IA:** todos los prompts a Groq incluyen una instrucción explícita del tipo `"Respondé completamente en español"` o `"Respond entirely in English"` basada en `state.config.language`. Sin esto, el modelo puede mezclar idiomas.

---

## 9. Instalación y configuración local

### Prerequisitos

- Node.js 18+
- npm 9+
- Una cuenta en [Supabase](https://supabase.com) (plan free funciona)
- Una API key de [Groq](https://console.groq.com) (plan free funciona)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/aramendyLucky/devforge.git
cd devforge

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus claves (ver sección 10)

# 4. Crear el schema en Supabase
# → Ir a Supabase Dashboard → SQL Editor → New query
# → Pegar el contenido de supabase/schema.sql → Run

# 5. Iniciar el servidor de desarrollo
npm run dev
# La app estará en http://localhost:5174

# Para verificar el build de producción:
npm run build
```

---

## 10. Variables de entorno

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
> variables al cliente. La `anon key` de Supabase es segura en el cliente
> porque RLS protege los datos a nivel de PostgreSQL.
>
> **Deuda técnica conocida:** La API key de Groq está expuesta en el cliente.
> En producción multi-usuario, debe moverse a un backend que haga las
> llamadas a Groq en nombre del usuario (FastAPI + Supabase Edge Functions).

---

## 11. Tutorial de uso paso a paso

### Paso 1 — Crear tu cuenta

1. Abrí la app (localhost o producción).
2. Hacé click en **"Empezar gratis"** → **"Registrate gratis"**.
3. Ingresá tu email y contraseña.
4. Iniciá sesión.

> **Olvidaste tu contraseña?** Click en "¿Olvidaste tu contraseña?" → recibís un link de reset por email.

---

### Paso 2 — Completar el onboarding

La primera vez que entrás, la app te lleva al **onboarding**:

1. **Tu nombre** — cómo la app te va a llamar en el roadmap y sesiones.
2. **Fecha objetivo** — ¿cuándo es tu entrevista? La app prioriza los temas según el tiempo disponible.
3. **Ofertas laborales** — pegá el texto de 1 a 3 ofertas de LinkedIn (o subí el PDF/DOCX). La IA extrae automáticamente los temas técnicos.
4. **Self-assessment** — evaluate del 1 al 5 en cada tema.

Al hacer click en "Completar configuración", tu perfil queda guardado en Supabase.

---

### Paso 3 — Practicar desde el Dashboard

El **Dashboard** muestra: racha de estudio, sesiones realizadas, score promedio, días para la entrevista, semana actual del roadmap, y temas recomendados.

Para practicar:
1. Click en una **tarjeta de tema** → vas a `/topic/:id`.
2. La IA genera 5 preguntas. Respondé cada una en texto libre.
3. Al terminar, ves tu score (1-10) y feedback de la IA para cada respuesta.

**Quick Review** (header) — genera 5 preguntas de distintos temas para mantener conocimientos frescos.

---

### Paso 4 — Simular una entrevista real (wizard 3 pasos)

1. Ir a **"Simular entrevista"** desde el dashboard o el header.
2. **Paso 1 — Perfil:**
   - Elegí un preset rápido, una oferta guardada, o analizá una nueva oferta
   - Para nueva oferta: pegá URL de LinkedIn (puede estar bloqueada — en ese caso pegá el texto manualmente), subí PDF/DOCX, o pegá el texto directo → click **"Analizar con IA"** → se extrae el stack y se guarda
   - O usá el modo personalizado para elegir temas exactos
3. **Paso 2 — Sesión:** elegí duración y dificultad. Si seleccionaste una oferta guardada, el nivel se sugiere automáticamente según su complejidad.
4. **Paso 3 — Resumen:** revisá la configuración → **"Iniciar entrevista →"**
5. La entrevista corre en `/interview`. Al terminar, `/interview-results` muestra el análisis completo.

---

### Paso 5 — Analizar tu CV con CV Matcher

1. Click en **⚡ CV Match** en el header (disponible en cualquier página).
2. Subí tu CV (PDF, DOCX, TXT, MD) o pegá el texto.
3. Elegí una oferta guardada de tu lista o pegá el JD manualmente.
4. Click **"Analizar compatibilidad"** — Groq procesa en ~5-10 segundos.
5. Explorá los tabs:
   - **Hoy** — 3 acciones concretas para mejorar tu CV hoy
   - **Matches** — skills que ya tenés del JD
   - **Gaps** — skills que te faltan con urgencia y tiempo estimado de aprendizaje
   - **Proyectos** — proyectos para cerrar los gaps
   - **ATS** — keywords exactas a agregar y tips de formato

---

### Paso 6 — Generar tu Roadmap PDF

1. Click en **Recursos** en el header → **"Generar Mi Roadmap PDF"**.
2. La app muestra tu perfil (temas del onboarding + ofertas guardadas).
3. Click **"Generar Roadmap"** — la IA procesa ~15-30 segundos.
4. Explorá en pantalla (cada tarjeta se expande) o:
   - **"Ver PDF"** — preview en nueva pestaña
   - **"↓ Descargar"** — descarga el PDF

---

### Paso 7 — Personalizar la app

Botón de configuración en el header:
- **Tema visual**: `forge` (oscuro) · `dusk` (medio) · `chalk` (claro)
- **Fuente**: `forge` (Syne) · `clean` (Inter) · `terminal` (Space Mono)
- **Idioma**: español (por defecto) / inglés — cambia toda la UI Y el idioma de respuesta de la IA

---

## 12. Decisiones de arquitectura

### ¿Por qué React Context + useReducer en vez de Redux o Zustand?

Para el alcance actual de DevForge, Redux agrega complejidad innecesaria (boilerplate, middlewares, toolkit). Zustand es una opción limpia, pero useReducer nativo da el mismo resultado sin dependencias. Si la app escala a 10+ features con estado compartido complejo, migrar a Zustand sería el siguiente paso natural.

### ¿Por qué Supabase y no un backend FastAPI propio?

DevForge está construido para iterar rápido. Supabase provee Auth + PostgreSQL + RLS + Realtime en un solo servicio. Un FastAPI propio significaría 2-3 semanas extra de trabajo antes de tener el primer feature funcionando. La estrategia correcta es: **validar el producto con Supabase, migrar a backend propio cuando el producto lo justifique**.

### ¿Por qué Groq y no OpenAI o Claude?

Groq con llama-3.3-70b ofrece latencia muy baja y un tier free generoso para desarrollo. El roadmap soporta hasta `max_tokens: 16000` por request. El CV Matcher necesita `max_tokens: 2500` para que el JSON completo no se corte.

Para producción con escala, se evaluará Claude API (Anthropic) por su superior razonamiento, contexto largo y mejor seguimiento de instrucciones de formato JSON.

### ¿Por qué el estado de ofertas (status, pins) va en localStorage y no en Supabase?

Status y pins son preferencias personales del dispositivo, no datos de negocio. Criterios:
1. No afectan ninguna lógica de negocio (no cambian qué preguntas genera la IA)
2. No necesitan sincronizarse entre dispositivos
3. No requieren backup ni auditoría
4. Agregar columnas a `saved_offers` requeriría una migración de DB

Si el usuario cambia de dispositivo, empieza limpio — lo cual es aceptable para datos de UI. Si en el futuro se necesita sincronización, se puede agregar una columna `metadata` JSONB a `saved_offers` sin breaking changes.

### ¿Por qué dos localStorage keys separadas (status y pins)?

Modelos independientes: un pin no tiene relación con el estado de la oferta. Permite limpiar uno sin afectar el otro (ej: "borrar todos los pins" sin tocar los estados). También facilita el testing y el debugging.

### ¿Por qué actualización optimista en el renombrado de ofertas?

Al renombrar una oferta inline, el nombre cambia en la UI inmediatamente (sin esperar a Supabase). Si Supabase falla (raro), el nombre revierte al anterior — señal clara de error sin necesidad de un toast de error. Esto hace la UX más fluida. El mismo patrón se usa en Twitter/X, Notion, Linear, etc.

### ¿Por qué buildJobText() reconstruye el JD y no guarda el texto crudo?

La tabla `saved_offers` almacena nombre + resumen + topics extraídos por IA (no el texto crudo original de la oferta). Esto reduce el storage 10-20x. La reconstrucción es suficientemente rica para que Groq pueda hacer un análisis ATS preciso — el modelo entiende el formato estructurado.

### ¿Por qué jsPDF para el PDF y no react-pdf o una librería de servidor?

jsPDF permite generar el PDF 100% en el browser sin necesidad de un servidor. Para el roadmap personalizado, esto significa que el usuario ve su PDF en segundos sin latencia de red. La limitación principal (solo fonts Latin-1) se resolvió usando `doc.circle()` y `doc.line()` como indicadores visuales en lugar de emoji Unicode.

---

## 13. Lecciones aprendidas y bugs documentados

### Race condition entre Auth y Store al hacer login (Mar 2026)

**Problema**: Después del signIn(), `onboardingDone` era siempre `false` aunque el usuario ya hubiera completado el onboarding. El usuario tenía que repetirlo en cada login.

**Causa**: La lógica de navegación leía `state.config.onboardingDone` del store. Pero el store carga datos de Supabase de forma asíncrona con `loadUserData()`. En el momento en que `navigate()` se ejecutaba, la carga no había terminado.

**Fix**: En `Login.jsx`, hacer una query directa a Supabase (`profiles.select('onboarding_done')`) en lugar de leer el store.

**Regla general**: Nunca usar el store para decisiones de navegación inmediatamente después del login. Consultá Supabase directamente para datos críticos en ese momento.

---

### Campo opcional rompía persistencia del onboarding (Mar 2026)

**Problema**: El campo `language` estaba en el mismo upsert que `onboarding_done` en `syncProfile()`. Cuando la columna no existía en la DB, Supabase fallaba el upsert entero y silenciaba el error.

**Fix**: Separar columnas opcionales en llamadas independientes.

**Regla general**: Nunca mezclar columnas críticas con columnas opcionales en el mismo upsert.

---

### JSON truncado en generación del roadmap (Mar 2026)

**Problema**: Con 13+ temas, el roadmap se cortaba con `JSON.parse: unterminated string literal`.

**Causa**: `max_tokens: 8000` insuficiente para el contenido profundo.

**Fix capa 1**: Elevar `max_tokens` de 8000 a 16000.

**Fix capa 2**: Función `extractCompleteTopics(partialJson)` — parser char-level que extrae todos los objetos `{ }` completamente cerrados. Se usa como fallback cuando `JSON.parse` falla.

---

### Emoji en PDF mostraba caracteres basura (Mar 2026)

**Problema**: Los emoji y flechas especiales aparecían como `Ø=ßâ B á s i c o`.

**Causa**: jsPDF usa fonts Latin-1. Los caracteres Unicode > U+00FF no son encodables y producen bytes basura que además corrompían el spacing.

**Fix**: Reemplazar todos los caracteres no-Latin-1 con primitivas de jsPDF: `doc.circle()` para indicadores de color y `doc.line()` para flechas.

---

### Toggle de idioma bloqueado por overlay del panel (Mar 2026)

**Problema**: Con CVMatcherPanel o ResourcePanel abierto, el toggle de idioma del header dejaba de responder a clicks.

**Causa**: El overlay del panel (posición fixed, inset 0) capturaba todos los eventos de mouse, incluyendo los del header. El overlay tenía `z-index` mayor que el header.

**Fix**: Z-index stack explícito en `globals.css`:
- Header: `z-index: 45`
- Overlay de panel: `z-index: 35` (DEBAJO del header)
- Panel lateral: `z-index: 50` (sobre el overlay pero el header queda encima porque el overlay no lo cubre)

**Regla general**: Siempre definir el z-index stack en un lugar central (globals.css) antes de agregar overlays.

---

## 14. Historial de fases de desarrollo

| Fase | Fecha | Descripción |
|---|---|---|
| **FASE 1** | Feb 2026 | Release inicial: práctica por tema, onboarding, dashboard, Auth completo |
| **FASE 2** | Mar 2026 | CV Matcher con análisis ATS, score breakdown, gaps, proyectos y quick wins |
| **FASE 3** | Mar 2026 | Dashboard de gestión de ofertas: búsqueda, sort, estado, pins, uso, renombrado inline |
| **FASE 4** | Mar 2026 | Wizard 3 pasos para entrevista simulada: StepBar animado, smart defaults de dificultad |

### Commits importantes por fase

```bash
# FASE 1
git log --oneline --grep="initial release"
# → 2fa4282 feat: initial release of DevForge

# i18n completa
git log --oneline --grep="bilingual"
# → fec7559 feat: complete bilingual i18n across all DevForge pages

# FASE 2 — CV Matcher
git log --oneline --grep="CV Matcher\|cv.matcher\|cvmatcher" --regexp-ignore-case

# FASE 3 — Gestión de ofertas
git log --oneline --grep="fase3\|saved offer" --regexp-ignore-case
# → 195bc75 feat(fase3): complete offer management dashboard

# FASE 4 — Wizard
git log --oneline --grep="fase4\|wizard\|stepbar" --regexp-ignore-case
# → d7f4f81 feat(fase4): multi-step interview setup wizard with StepBar and smart defaults
```

---

## 15. Roadmap — próximas funcionalidades

### Prioridad alta

- [ ] **La entrevista en sí** — revisar la UX del flujo `/interview` con la nueva configuración del wizard. Las preguntas deben adaptarse mejor al tier de cada skill.
- [ ] **Plan free vs. premium con Stripe** — limitar entrevistas/sesiones para free tier, desbloquear con suscripción mensual.
- [ ] **Mover llamadas a Groq al backend** — actualmente la API key de Groq está en el cliente. En producción multi-usuario, esto debe moverse a un backend (FastAPI o Edge Functions de Supabase).
- [ ] **Dashboard v2 con gráficos** — evolución del score por tema en el tiempo con recharts o chart.js.

### Prioridad media

- [ ] **Tests E2E con Playwright** — cobertura de flujos críticos (registro, onboarding, sesión, entrevista, CV Matcher).
- [ ] **Sistema de logros/badges** — completar X sesiones, mantener racha de 7 días, dominar un tema.
- [ ] **Preguntas guardadas** — marcar preguntas difíciles de una sesión para repasar más tarde.
- [ ] **ResourcePanel i18n completo** — quedan ~26 strings hardcodeados en ResourcePanel.jsx.

### Prioridad baja / futura

- [ ] **App móvil con React Native + Expo** — mismo backend Supabase, nueva UI adaptada.
- [ ] **Notificaciones / recordatorios por email** — vía Supabase Edge Functions.
- [ ] **Migración a backend FastAPI** — cuando la escala lo justifique.
- [ ] **Compartir roadmap como URL pública** — link para compartir sin descargar el PDF.
- [ ] **Modo voz para entrevistas** — speech-to-text para simular entrevistas de video.

---

## Autor

**Lucas Yatay Aramendy**
Analista de Sistemas | Backend Engineer — Instituto Sábato / CNEA (UNSAM)

- GitHub: [@aramendyLucky](https://github.com/aramendyLucky)
- Stack principal: Python · FastAPI · PostgreSQL · React · Supabase · IA (Groq / Claude)

---

*Última actualización: marzo 2026 — FASE 4 completa*
