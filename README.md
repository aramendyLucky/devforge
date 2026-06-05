# DevForge

> **Plataforma de preparación técnica para entrevistas IT, potenciada por IA.**
> Practicá por tema, simulá entrevistas reales, analizá tu CV contra ofertas laborales y generá tu roadmap de aprendizaje personalizado en PDF.

![Deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Supabase%20%2B%20Groq-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Producción:** [devforge-sandy.vercel.app](https://devforge-sandy.vercel.app)

---

## ¿Qué hace?

| Feature | Descripción |
|---|---|
| 🎯 **Práctica por tema** | Preguntas generadas por IA con feedback y puntaje (1-10) |
| 🎤 **Entrevista simulada** | Wizard 3 pasos: perfil → sesión → resumen. Smart defaults por oferta |
| ⚡ **CV Matcher** | Score ATS de compatibilidad CV vs oferta. Gaps, proyectos, quick wins |
| 📋 **Gestión de ofertas** | Dashboard con búsqueda, estado, pins, renombrado inline |
| 📖 **Roadmap PDF** | Plan 0→100 generado por IA con ejercicios, analogías y milestones |
| 🌐 **ES / EN** | Toggle de idioma en el header. La IA también responde en el idioma activo |

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + CSS custom variables |
| Auth + DB | Supabase (PostgreSQL + RLS + Auth) |
| IA | Groq API — llama-3.3-70b-versatile |
| Proxy IA | Vercel Serverless Function (`api/groq.js`) |
| i18n | react-i18next (ES / EN) |
| PDF | jsPDF (client-side, sin servidor) |
| Parsing | pdfjs-dist + mammoth (PDF y DOCX) |
| Deploy | Vercel (CI/CD automático desde GitHub) |

---

## Arquitectura de seguridad

La API key de Groq nunca llega al browser. Todas las llamadas pasan por un proxy serverless:

```
Browser  ──→  /api/groq (sin credenciales)
                   │
              Vercel Function
              api/groq.js
                   │  GROQ_API_KEY (server-side)
                   ↓
              api.groq.com
```

Las variables `VITE_SUPABASE_*` son públicas por diseño — la seguridad real está en las RLS policies de PostgreSQL.

---

## Setup desde cero

### Prerequisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (plan free)
- API key de [Groq](https://console.groq.com) (plan free)
- Vercel CLI: `npm install -g vercel`

### 1. Clonar e instalar

```bash
git clone git@github.com:aramendyLucky/devforge.git
cd devforge
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Editá `.env` con tus valores:

```env
# Groq — server-side únicamente (sin prefijo VITE_)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx

# Supabase — públicas, van al browser
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

> **¿Dónde conseguirlas?**
> - Groq key: [console.groq.com](https://console.groq.com) → API Keys
> - Supabase: Dashboard → Settings → API

### 3. Base de datos

En [Supabase Dashboard](https://supabase.com) → SQL Editor → New query:
→ Pegá el contenido de `supabase/schema.sql` → **Run**

### 4. Correr en local

```bash
# CON funciones de IA (recomendado)
npm run dev:full
# → http://localhost:3000

# Solo UI, sin IA
npm run dev
# → http://localhost:5174
```

> `dev:full` usa Vercel CLI y replica exactamente el entorno de producción,
> incluyendo las serverless functions. Requiere `vercel login` la primera vez.

### 5. Deploy en Vercel

```bash
git push origin master
# → Vercel hace deploy automático
```

Antes del primer deploy, agregar en **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Valor | Entornos |
|---|---|---|
| `GROQ_API_KEY` | tu key de Groq | Production + Preview + Development |
| `VITE_SUPABASE_URL` | tu URL de Supabase | Production + Preview + Development |
| `VITE_SUPABASE_ANON_KEY` | tu anon key de Supabase | Production + Preview + Development |

Después de guardarlas: **Deployments → Production → Redeploy**.

---

## Estructura del proyecto

```
devforge/
├── api/
│   └── groq.js                # Proxy serverless — Groq key vive aquí
├── src/
│   ├── App.jsx                # Router principal
│   ├── main.jsx               # Entry point
│   ├── components/ui/
│   │   ├── CVMatcherPanel.jsx # Análisis ATS de CV vs oferta
│   │   ├── ResourcePanel.jsx  # Recursos de estudio + acceso al Roadmap
│   │   ├── RoadmapPanel.jsx   # Generador de roadmap PDF
│   │   ├── Header.jsx         # Nav global con toggles
│   │   └── PrivateRoute.jsx   # Guard de rutas autenticadas
│   ├── pages/
│   │   ├── Dashboard.jsx      # Hub principal con métricas
│   │   ├── Topic.jsx          # Práctica por tema
│   │   ├── InterviewSetup.jsx # Wizard 3 pasos
│   │   ├── Interview.jsx      # Entrevista en progreso
│   │   ├── InterviewResults.jsx
│   │   └── ...                # Login, Register, Onboarding, etc.
│   ├── hooks/
│   │   └── useAI.js           # Hook de IA (llama a /api/groq)
│   ├── lib/
│   │   ├── supabase.js        # Cliente Supabase (singleton)
│   │   ├── db.js              # Capa de datos — todas las queries
│   │   └── fileParser.js      # Extracción de texto: PDF, DOCX, TXT
│   ├── context/
│   │   └── AuthContext.jsx    # Sesión, login, logout
│   ├── store/
│   │   └── index.jsx          # Estado global (useReducer)
│   ├── i18n/
│   │   └── locales/
│   │       ├── es.json        # Español (default)
│   │       └── en.json        # Inglés
│   └── data/
│       ├── topics.js          # Catálogo de temas técnicos
│       └── questions.js       # Banco de preguntas (fallback)
├── supabase/
│   └── schema.sql             # Schema completo — ejecutar en Supabase
├── .env.example               # Plantilla de variables (copiar a .env)
├── vercel.json                # Config de deploy
└── package.json
```

---

## Uso paso a paso

### 1. Crear cuenta y onboarding

1. Abrí la app → **Empezar gratis** → **Registrate**
2. Primera vez: onboarding de 4 pasos
   - Tu nombre
   - Fecha objetivo de entrevista
   - Pegá 1-3 ofertas laborales → la IA extrae los temas automáticamente
   - Self-assessment (1-5) por tema

### 2. Practicar por tema

Dashboard → click en cualquier tema → la IA genera 5 preguntas.
Respondé en texto libre → feedback inmediato con score y qué mejorar.

### 3. Simular una entrevista

**"Simular entrevista"** → wizard 3 pasos:
1. **Perfil**: preset rápido / oferta guardada / nueva oferta / personalizado
2. **Sesión**: duración (20/45/60 min) + dificultad (el sistema sugiere según la oferta)
3. **Resumen** → iniciar

### 4. Analizar tu CV

Header → **⚡ CV Match** → subí tu CV (PDF/DOCX/TXT) → elegí una oferta → **Analizar**.

Resultado en 5 tabs:
- **Hoy** — 3 acciones concretas para mejorar el CV hoy
- **Matches** — skills que ya tenés
- **Gaps** — skills que faltan con urgencia y semanas estimadas
- **Proyectos** — proyectos para cerrar los gaps
- **ATS** — keywords exactas y tips de formato

### 5. Generar Roadmap PDF

Header → **Recursos** → **Generar mi roadmap** → esperar ~30s → ver en pantalla o descargar PDF.

---

## Base de datos

Cinco tablas en Supabase con RLS activado en todas:

```
auth.users (Supabase interno)
    │
    ├── profiles          — nombre, config, onboarding, idioma, self-assessment
    ├── topic_progress    — score y sesiones por tema (UNIQUE user+topic)
    ├── sessions          — historial de práctica con respuestas y feedback
    ├── interviews        — historial de entrevistas simuladas
    └── saved_offers      — ofertas laborales analizadas (name + summary + topics[])
```

**RLS:** cada tabla tiene `USING (auth.uid() = user_id)` — sin esto, cualquier usuario podría leer datos de otro aunque consiga la anon key.

---

## Decisiones de arquitectura

**Proxy serverless para Groq** — `api/groq.js` actúa como intermediario transparente. El browser llama a `/api/groq` sin credenciales; la función agrega la key server-side y reenvía. Esto evita que la key quede expuesta en el bundle JS público.

**React Context + useReducer en vez de Redux/Zustand** — para el alcance actual, useReducer nativo da el mismo resultado sin dependencias. Migrar a Zustand sería el siguiente paso natural si la app escala.

**Supabase en vez de FastAPI propio** — permite iterar rápido. Auth + PostgreSQL + RLS en un servicio. Migrar a backend propio cuando el producto lo justifique.

**jsPDF en vez de PDF server-side** — genera el PDF 100% en el browser, sin latencia de red. Limitación: solo fonts Latin-1 (sin emoji). Solución: `doc.circle()` y `doc.line()` como indicadores visuales.

**Estado de ofertas (status, pins) en localStorage** — son preferencias del dispositivo, no datos de negocio. No necesitan sincronizarse entre dispositivos ni backup.

---

## Historial de fases

| Fase | Fecha | Descripción |
|---|---|---|
| **FASE 1** | Feb 2026 | Práctica por tema, onboarding, dashboard, Auth completo |
| **FASE 2** | Mar 2026 | CV Matcher con scoring ATS, gaps, proyectos y quick wins |
| **FASE 3** | Mar 2026 | Dashboard de gestión de ofertas: búsqueda, estado, pins, renombrado |
| **FASE 4** | Mar 2026 | Wizard 3 pasos con StepBar animado y smart defaults de dificultad |
| **SEGURIDAD** | Jun 2026 | Auditoría completa + API key de Groq movida a proxy serverless |

---

## Roadmap

- [ ] Revisar UX del flujo `/interview` con la nueva configuración del wizard
- [ ] Plan free / premium con Stripe
- [ ] Dashboard v2 con gráficos de evolución de score por tema
- [ ] Tests E2E con Playwright
- [ ] Sistema de logros y badges
- [x] ~~Mover llamadas a Groq al backend~~ — resuelto con proxy serverless (Jun 2026)

---

## Autor

**Lucas Yatay Aramendy**
Analista de Sistemas | Backend Engineer

- GitHub: [@aramendyLucky](https://github.com/aramendyLucky)
- Stack principal: Python · FastAPI · PostgreSQL · React · Supabase · IA

---

*Última actualización: junio 2026*
