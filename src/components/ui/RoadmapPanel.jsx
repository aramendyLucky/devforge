/**
 * src/components/ui/RoadmapPanel.jsx
 *
 * GENERADOR DE ROADMAP PERSONALIZADO — contenido profundo por tema
 *
 * Estructura de datos generada por IA por cada tema:
 *   - overview:           descripción detallada con analogía
 *   - prerequisites:      prerequisitos con explicación de por qué son necesarios
 *   - keyConcepts:        conceptos clave con explicación + ejemplo de código
 *   - practiceExercises:  3 ejercicios por nivel (básico / intermedio / experto)
 *                         cada uno con: tarea, requerimientos y tips
 *   - milestone:          criterio de dominio por nivel (básico / intermedio / experto)
 */

import { useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import { TOPICS } from '../../data/topics.js'
import { loadOffers } from '../../lib/db.js'
import { supabase } from '../../lib/supabase.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL    = 'llama-3.3-70b-versatile'

const TIER_LABEL = { 1: 'Crítico', 2: 'Importante', 3: 'Diferenciador' }

// ─── generateRoadmapContent ───────────────────────────────────────────────
/**
 * Llama a Groq para generar el roadmap profundo y personalizado.
 * Cada tema tiene: descripción con analogía, prerequisites contextualizados,
 * conceptos clave con ejemplos, 3 ejercicios graduados y milestones por nivel.
 */
async function generateRoadmapContent(userName, topics, progress, extractedTopics) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY

  const topicsSummary = topics.map(t => {
    const p        = progress[t.id]
    const score    = p?.lastScore ?? null
    const sessions = p?.completed ?? 0
    return `- ${t.name} [id:${t.id}] (tier ${t.tier} - ${TIER_LABEL[t.tier]}): ${sessions} sesiones, score ${score ?? 'sin practicar'}`
  }).join('\n')

  // Agregamos temas del onboarding + temas de todas las ofertas guardadas
  // Los deduplicamos para no repetir el mismo topic en el prompt
  const allOfferTopicNames = extractedTopics?.length > 0
    ? [...new Set(extractedTopics)]
    : []

  const extractedSummary = allOfferTopicNames.length > 0
    ? `Temas clave detectados en sus ofertas laborales (priorizar en el roadmap): ${allOfferTopicNames.join(', ')}`
    : 'Sin temas de ofertas laborales cargados.'

  // ── System prompt: define el esquema JSON exacto ──
  const systemPrompt = `Sos un mentor técnico senior especializado en backend development y preparación para entrevistas IT. Generás roadmaps de aprendizaje profundos y personalizados en español.

Respondés ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks, sin markdown.

El JSON debe seguir EXACTAMENTE esta estructura (no omitir ningún campo):
{
  "roadmap": [
    {
      "id": "string — id exacto del topic (ej: django_flask)",
      "name": "string — nombre del tema",
      "tier": 1,
      "order": 1,
      "priority": "Fundamental | Importante | Complementario",
      "estimatedWeeks": 2,
      "currentStatus": "sin_iniciar | en_progreso | dominado",

      "overview": "string — 3-4 oraciones detalladas: qué es, para qué sirve en el mundo real, por qué es crítico para un backend developer. Incluir contexto del mercado laboral argentino/latam si aplica.",

      "analogy": "string — una analogía concreta y memorable para entender el tema. Ej: 'Django es como IKEA: te da todo el mobiliario listo, solo seguís las instrucciones. Flask es como una ferretería: comprás exactamente lo que necesitás y armás todo desde cero.'",

      "prerequisites": [
        {
          "name": "string — nombre del prerequisito",
          "whyNeeded": "string — una oración explicando POR QUÉ necesitás saber esto antes. Sé específico sobre la dependencia técnica."
        }
      ],

      "keyConcepts": [
        {
          "concept": "string — nombre técnico del concepto (ej: 'Django ORM y QuerySets')",
          "explanation": "string — 2-3 oraciones explicando el concepto en profundidad, qué problema resuelve y cuándo usarlo",
          "example": "string — snippet de código corto o comando concreto que ilustre el concepto (máximo 1-2 líneas)"
        }
      ],

      "practiceExercises": [
        {
          "level": "basico",
          "title": "string — título corto del proyecto/ejercicio",
          "task": "string — descripción de la tarea en 1-2 oraciones",
          "requirements": ["string — requerimiento técnico específico y concreto"],
          "tips": ["string — consejo práctico para encarar el ejercicio"]
        },
        {
          "level": "intermedio",
          "title": "string",
          "task": "string",
          "requirements": ["string"],
          "tips": ["string"]
        },
        {
          "level": "experto",
          "title": "string",
          "task": "string",
          "requirements": ["string"],
          "tips": ["string"]
        }
      ],

      "milestone": {
        "basico": "string — cómo saber que superaste el nivel básico: describe una tarea concreta que deberías poder hacer sin ayuda",
        "intermedio": "string — cómo saber que superaste el nivel intermedio: describe una tarea o situación más compleja",
        "experto": "string — cómo saber que dominás el tema a nivel experto: describe el tipo de problema que podés resolver o explicar"
      }
    }
  ]
}

REGLAS CRÍTICAS:
- keyConcepts: incluir entre 5 y 7 conceptos por tema, ordenados de fundamental a avanzado
- practiceExercises.requirements: entre 3 y 5 requerimientos por ejercicio, con detalles técnicos concretos
- practiceExercises.tips: entre 2 y 4 tips por ejercicio
- Los ejercicios deben escalar claramente: básico=1-2 horas, intermedio=4-8 horas, experto=1-2 días
- milestone: deben ser oraciones con verbos de acción ("Podés crear...", "Implementás...", "Diseñás...")
- Incluir TODOS los topics listados en el perfil del usuario`

  // ── User prompt: perfil del usuario ──
  const userPrompt = `Generá el roadmap completo y profundo para ${userName}.

PERFIL Y PROGRESO ACTUAL:
${topicsSummary}

${extractedSummary}

INSTRUCCIONES DE PERSONALIZACIÓN:
- order: de menor a mayor dificultad considerando dependencias entre temas (order 1 = primer tema a aprender)
- currentStatus: "sin_iniciar" si sessions=0, "en_progreso" si score<7, "dominado" si score>=7
- Los temas de ofertas laborales deben tener priority="Fundamental" aunque sean tier 2-3
- La analogía debe ser original, memorable y culturalmente relevante para un developer latinoamericano
- Los ejercicios básicos deben ser alcanzables para alguien que recién aprendió el tema
- Los ejercicios expertos deben representar un desafío real de producción
- El contexto de ${userName} es: desarrollador backend Python buscando nivel senior, trabaja con FastAPI/Django, PostgreSQL, Docker, Redis

Incluí los ${topics.length} temas sin excepción.`

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 16000,   // 8k era insuficiente para 13+ temas con contenido profundo → truncaba el JSON
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Groq error ${response.status}: ${errText}`)
  }

  const data  = await response.json()
  const text  = data.choices?.[0]?.message?.content || ''

  // Limpiar backticks y whitespace residual
  const clean = text.replace(/```json[\s\S]*?```|```/g, '').trim()

  // ── Parseo robusto: maneja JSON truncado por límite de tokens ──
  // Si el modelo corta la respuesta a mitad, JSON.parse falla con
  // "unterminated string literal". En ese caso intentamos recuperar
  // los objetos completos que sí llegaron usando un extractor de arrays.
  let parsed
  try {
    parsed = JSON.parse(clean)
  } catch (parseErr) {
    // Intentar extraer los temas completos del JSON parcial.
    // Buscamos objetos que tengan al menos "id" y "name" cerrados correctamente.
    const recovered = extractCompleteTopics(clean)
    if (recovered.length === 0) {
      throw new Error(
        `La respuesta de la IA quedó incompleta (JSON truncado). ` +
        `Intentá de nuevo — suele ocurrir cuando hay muchos temas con contenido muy largo.`
      )
    }
    console.warn(`[RoadmapPanel] JSON truncado — se recuperaron ${recovered.length} temas de ${topics.length}`)
    return recovered
  }

  return parsed.roadmap || []
}

/**
 * extractCompleteTopics — recupera los objetos de tema completos de un JSON truncado.
 *
 * Cuando Groq corta la respuesta por límite de tokens, el último objeto
 * queda incompleto. Este helper extrae todos los objetos anteriores que sí
 * tienen las llaves { } correctamente cerradas.
 *
 * @param {string} partialJson — texto JSON posiblemente truncado
 * @returns {Array} — array de objetos de tema válidos (puede estar incompleto)
 */
function extractCompleteTopics(partialJson) {
  const results = []

  // Buscar el array "roadmap": [ ... ]
  const arrayStart = partialJson.indexOf('"roadmap"')
  if (arrayStart === -1) return results

  const openBracket = partialJson.indexOf('[', arrayStart)
  if (openBracket === -1) return results

  // Iterar carácter a carácter para encontrar objetos { } completos
  let depth      = 0
  let inString   = false
  let escaped    = false
  let objStart   = -1

  for (let i = openBracket + 1; i < partialJson.length; i++) {
    const ch = partialJson[i]

    if (escaped)            { escaped = false; continue }
    if (ch === '\\')        { escaped = true;  continue }
    if (ch === '"')         { inString = !inString; continue }
    if (inString)           { continue }

    if (ch === '{') {
      if (depth === 0) objStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && objStart !== -1) {
        // Tenemos un objeto completo — intentar parsearlo
        try {
          const obj = JSON.parse(partialJson.slice(objStart, i + 1))
          if (obj.id && obj.name) results.push(obj)
        } catch {
          // Objeto mal formado — ignorar
        }
        objStart = -1
      }
    }
  }

  return results
}

// ─── generatePDF ──────────────────────────────────────────────────────────
/**
 * Genera el PDF completo del roadmap con jsPDF.
 * Cada tema ocupa múltiples páginas con toda la información profunda.
 */
function generatePDF(userName, roadmap) {
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = 210
  const marginL  = 18
  const marginR  = 18
  const maxW     = W - marginL - marginR
  const today    = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Helpers tipográficos ──
  const mono    = (sz, st = 'normal') => { doc.setFont('courier', st); doc.setFontSize(sz) }
  const display = (sz, st = 'bold')   => { doc.setFont('helvetica', st); doc.setFontSize(sz) }
  const cAmber  = () => doc.setTextColor(214, 136, 23)
  const cBlack  = () => doc.setTextColor(18, 18, 18)
  const cGray   = () => doc.setTextColor(105, 105, 105)
  const cWhite  = () => doc.setTextColor(240, 240, 240)
  const cRed    = () => doc.setTextColor(195, 70, 60)
  const cGreen  = () => doc.setTextColor(80, 155, 90)

  // ── Helper: página nueva con header estándar ──
  function pageHeader(leftLabel, rightLabel, accentRGB) {
    const [r, g, b] = accentRGB || [214, 136, 23]
    doc.setFillColor(248, 248, 248)
    doc.rect(0, 0, W, 18, 'F')
    doc.setFillColor(r, g, b)
    doc.rect(0, 0, 3.5, 18, 'F')
    doc.setTextColor(r, g, b)
    mono(7, 'bold')
    doc.text('DEVFORGE', 10, 8)
    mono(6.5)
    doc.setTextColor(r, g, b)
    doc.text(leftLabel || '', 10, 13)
    cGray()
    mono(6.5)
    doc.text(rightLabel || '', W - marginR, 11, { align: 'right' })
  }

  // ── Helper: section title ──
  function sectionTitle(label, y, color) {
    const [r, g, b] = color
    doc.setTextColor(r, g, b)
    mono(7, 'bold')
    doc.text(label.toUpperCase(), marginL, y)
    doc.setDrawColor(r, g, b)
    doc.setLineWidth(0.2)
    doc.line(marginL, y + 1.5, marginL + doc.getTextWidth(label.toUpperCase()), y + 1.5)
    return y + 7
  }

  // ── Helper: safe addPage con header ──
  function newPage(leftLabel, rightLabel, accentRGB) {
    doc.addPage()
    pageHeader(leftLabel, rightLabel, accentRGB)
    return 26
  }

  // ── Helper: check y-space, add page si es necesario ──
  function checkY(y, needed, leftLabel, rightLabel, accentRGB) {
    if (y + needed > 278) return newPage(leftLabel, rightLabel, accentRGB)
    return y
  }

  // ────────────────────────────────────────────────────────────────────────
  // PORTADA
  // ────────────────────────────────────────────────────────────────────────
  doc.setFillColor(12, 12, 12)
  doc.rect(0, 0, W, 297, 'F')
  doc.setFillColor(214, 136, 23)
  doc.rect(0, 0, W, 3.5, 'F')

  // Logo
  cAmber(); mono(8.5, 'bold')
  doc.text('DEVFORGE', marginL, 20)
  doc.setDrawColor(214, 136, 23); doc.setLineWidth(0.3)
  doc.line(marginL, 23.5, marginL + 28, 23.5)

  // Título
  cWhite(); display(30, 'bold')
  doc.text('Roadmap de', marginL, 58)
  doc.text('Aprendizaje', marginL, 74)
  cAmber(); display(30, 'bold')
  doc.text('Personalizado', marginL, 90)

  // Divider
  doc.setDrawColor(50, 50, 50); doc.setLineWidth(0.4)
  doc.line(marginL, 102, W - marginR, 102)

  // Datos del usuario
  doc.setTextColor(160, 160, 160); mono(7.5)
  doc.text('PREPARADO PARA', marginL, 116)
  cWhite(); display(15, 'bold')
  doc.text(userName || 'Desarrollador', marginL, 126)
  doc.setTextColor(120, 120, 120); mono(7.5)
  doc.text(today.toUpperCase(), marginL, 134)

  // Stats de portada
  const total     = roadmap.length
  const dominados = roadmap.filter(r => r.currentStatus === 'dominado').length
  const enCurso   = roadmap.filter(r => r.currentStatus === 'en_progreso').length
  const sinInic   = roadmap.filter(r => r.currentStatus === 'sin_iniciar').length
  const semanas   = roadmap.reduce((s, r) => s + (r.estimatedWeeks || 0), 0)

  const statsData = [
    { v: total,     l: 'TEMAS' },
    { v: dominados, l: 'DOMINADOS' },
    { v: enCurso,   l: 'EN CURSO' },
    { v: sinInic,   l: 'PENDIENTES' },
    { v: semanas,   l: 'SEMANAS' },
  ]
  const cw = maxW / statsData.length
  statsData.forEach((s, i) => {
    const x = marginL + i * cw + cw / 2
    cAmber(); display(16, 'bold')
    doc.text(String(s.v), x, 166, { align: 'center' })
    doc.setTextColor(110, 110, 110); mono(6.5)
    doc.text(s.l, x, 172, { align: 'center' })
  })

  doc.setDrawColor(45, 45, 45); doc.setLineWidth(0.3)
  doc.line(marginL, 180, W - marginR, 180)

  doc.setTextColor(70, 70, 70); mono(7)
  doc.text('Generado con IA (Groq · llama-3.3-70b) · DevForge — Preparación técnica para entrevistas IT', marginL, 190)

  doc.setFillColor(214, 136, 23)
  doc.rect(0, 293.5, W, 3.5, 'F')

  // ────────────────────────────────────────────────────────────────────────
  // ÍNDICE
  // ────────────────────────────────────────────────────────────────────────
  doc.addPage()
  pageHeader('ROADMAP DE APRENDIZAJE', `${total} temas · ${semanas} semanas estimadas`, [214, 136, 23])

  cBlack(); display(17, 'bold')
  doc.text('Índice de Contenidos', marginL, 34)

  cGray(); mono(8)
  doc.text(`${total} temas ordenados por progresión de aprendizaje`, marginL, 42)

  doc.setDrawColor(214, 136, 23); doc.setLineWidth(0.8)
  doc.line(marginL, 47, marginL + 45, 47)

  const tierColors = {
    1: [195, 70, 60],
    2: [200, 128, 20],
    3: [75, 148, 85],
  }
  // Usar solo caracteres ASCII puro — jsPDF/Courier no soporta unicode fuera de Latin-1
  const statusIcon = { dominado: '[OK]', en_progreso: '[>>]', sin_iniciar: '[  ]' }

  let iy = 56
  roadmap.forEach((section, idx) => {
    if (iy > 268) { doc.addPage(); pageHeader('ÍNDICE', '', [214, 136, 23]); iy = 26 }

    const [r, g, b] = tierColors[section.tier] || [130, 130, 130]

    doc.setTextColor(r, g, b); mono(7.5, 'bold')
    doc.text(`${String(idx + 1).padStart(2, '0')}.`, marginL, iy)

    cBlack(); display(9, 'bold')
    doc.text(section.name, marginL + 13, iy)

    const statusTxt = section.currentStatus === 'dominado'    ? 'Dominado'
                    : section.currentStatus === 'en_progreso' ? 'En progreso'
                    : 'Sin iniciar'
    doc.setTextColor(r, g, b); mono(6.5)
    doc.text(
      `${statusIcon[section.currentStatus]} ${statusTxt} · ${section.estimatedWeeks || 1} sem.`,
      W - marginR, iy, { align: 'right' }
    )

    cGray(); mono(6)
    doc.text(TIER_LABEL[section.tier] || '', marginL + 13, iy + 4)

    doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.15)
    doc.line(marginL, iy + 7, W - marginR, iy + 7)
    iy += 12
  })

  // ────────────────────────────────────────────────────────────────────────
  // SECCIONES POR TEMA
  // ────────────────────────────────────────────────────────────────────────
  roadmap.forEach((section, idx) => {
    const [tr, tg, tb] = tierColors[section.tier] || [130, 130, 130]
    const pgLeft  = `TEMA ${String(idx + 1).padStart(2, '0')} / ${total} — ${section.name}`
    const pgRight = `DevForge · Roadmap de ${userName}`

    // ── Página de portada del tema ──
    doc.addPage()
    pageHeader(pgLeft, pgRight, [tr, tg, tb])

    // Número grande decorativo
    doc.setTextColor(235, 235, 235); display(52, 'bold')
    doc.text(String(idx + 1).padStart(2, '0'), W - marginR, 55, { align: 'right' })

    // Tier badge
    doc.setFillColor(tr, tg, tb)
    doc.rect(marginL, 24, 30, 6.5, 'F')
    doc.setTextColor(255, 255, 255); mono(6, 'bold')
    doc.text(TIER_LABEL[section.tier]?.toUpperCase() || '', marginL + 15, 28.8, { align: 'center' })

    // Título
    cBlack(); display(22, 'bold')
    doc.text(section.name, marginL, 52)

    cGray(); mono(8)
    doc.text(
      `${section.priority || ''}  ·  ${section.estimatedWeeks || 1} semana${(section.estimatedWeeks || 1) !== 1 ? 's' : ''} estimadas`,
      marginL, 60
    )

    doc.setDrawColor(tr, tg, tb); doc.setLineWidth(0.5)
    doc.line(marginL, 65, W - marginR, 65)

    let y = 74

    // ── DESCRIPCIÓN ──
    if (section.overview) {
      y = sectionTitle('Descripción', y, [tr, tg, tb])
      cBlack(); mono(8.5)
      const overviewLines = doc.splitTextToSize(section.overview, maxW)
      overviewLines.forEach(line => {
        if (y > 272) { doc.addPage(); pageHeader(pgLeft, pgRight, [tr, tg, tb]); y = 26 }
        doc.text(line, marginL, y)
        y += 5
      })
      y += 4
    }

    // ── ANALOGÍA ──
    if (section.analogy) {
      y = checkY(y, 22, pgLeft, pgRight, [tr, tg, tb])

      // Caja de analogía
      const analogyLines = doc.splitTextToSize(`"${section.analogy}"`, maxW - 12)
      const boxH = analogyLines.length * 5 + 14
      doc.setFillColor(252, 249, 240)
      doc.rect(marginL, y, maxW, boxH, 'F')
      doc.setDrawColor(tr, tg, tb); doc.setLineWidth(1.5)
      doc.line(marginL, y, marginL, y + boxH)

      doc.setTextColor(tr, tg, tb); mono(6.5, 'bold')
      doc.text('ANALOGÍA', marginL + 5, y + 6)

      doc.setTextColor(60, 60, 60); mono(8.5, 'normal')
      doc.text(analogyLines, marginL + 5, y + 12)
      y += boxH + 8
    }

    // ── PREREQUISITES ──
    if (section.prerequisites?.length > 0) {
      y = checkY(y, 18 + section.prerequisites.length * 14, pgLeft, pgRight, [tr, tg, tb])
      y = sectionTitle('Prerequisitos', y, [tr, tg, tb])

      section.prerequisites.forEach(pre => {
        y = checkY(y, 12, pgLeft, pgRight, [tr, tg, tb])

        doc.setFillColor(tr, tg, tb)
        doc.circle(marginL + 1.5, y - 1.5, 1.2, 'F')
        cBlack(); mono(8.5, 'bold')
        doc.text(pre.name || '', marginL + 6, y)
        y += 5

        if (pre.whyNeeded) {
          cGray(); mono(8)
          const whyLines = doc.splitTextToSize(pre.whyNeeded, maxW - 10)
          doc.text(whyLines, marginL + 6, y)
          y += whyLines.length * 4.5 + 4
        }
      })
      y += 4
    }

    // ── CONCEPTOS CLAVE ──
    if (section.keyConcepts?.length > 0) {
      y = checkY(y, 24, pgLeft, pgRight, [tr, tg, tb])
      y = sectionTitle('Conceptos Clave', y, [tr, tg, tb])

      section.keyConcepts.forEach((kc, ci) => {
        y = checkY(y, 28, pgLeft, pgRight, [tr, tg, tb])

        // Número del concepto
        doc.setTextColor(tr, tg, tb); mono(7.5, 'bold')
        doc.text(`${ci + 1}.`, marginL, y)

        cBlack(); mono(8.5, 'bold')
        doc.text(kc.concept || '', marginL + 7, y)
        y += 5

        if (kc.explanation) {
          cGray(); mono(8)
          const expLines = doc.splitTextToSize(kc.explanation, maxW - 7)
          doc.text(expLines, marginL + 7, y)
          y += expLines.length * 4.5 + 3
        }

        if (kc.example) {
          y = checkY(y, 10, pgLeft, pgRight, [tr, tg, tb])
          const exampleLines = doc.splitTextToSize(kc.example, maxW - 14)
          const codeH = exampleLines.length * 5 + 8
          doc.setFillColor(240, 240, 240)
          doc.rect(marginL + 7, y - 4, maxW - 7, codeH, 'F')
          doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2)
          doc.rect(marginL + 7, y - 4, maxW - 7, codeH)
          doc.setTextColor(50, 50, 50); mono(7.5)
          doc.text(exampleLines, marginL + 10, y + 1)
          y += codeH + 4
        }

        if (ci < section.keyConcepts.length - 1) {
          doc.setDrawColor(235, 235, 235); doc.setLineWidth(0.1)
          doc.line(marginL + 7, y, W - marginR, y)
          y += 4
        }
      })
      y += 6
    }

    // ── EJERCICIOS POR NIVEL ──
    const exercises = section.practiceExercises || []
    if (exercises.length > 0) {
      // Sin emoji — solo texto + formas gráficas de jsPDF
      const levelConfig = {
        basico:     { label: 'Básico',     color: [75, 148, 85],  bg: [240, 252, 242] },
        intermedio: { label: 'Intermedio', color: [195, 140, 20], bg: [252, 249, 235] },
        experto:    { label: 'Experto',    color: [185, 60, 55],  bg: [252, 240, 240] },
      }

      y = checkY(y, 20, pgLeft, pgRight, [tr, tg, tb])
      y = sectionTitle('Qué Practicar', y, [tr, tg, tb])

      exercises.forEach(ex => {
        const cfg = levelConfig[ex.level] || levelConfig.basico
        const [lr, lg, lb] = cfg.color

        // Calcular altura total del ejercicio para ver si entra
        const reqLines  = (ex.requirements || []).reduce((acc, r) => acc + doc.splitTextToSize(r, maxW - 20).length, 0)
        const tipLines  = (ex.tips || []).reduce((acc, t) => acc + doc.splitTextToSize(t, maxW - 20).length, 0)
        const taskLines = doc.splitTextToSize(ex.task || '', maxW - 10).length
        const estHeight = 14 + taskLines * 5 + reqLines * 4.5 + tipLines * 4.5 + 28

        y = checkY(y, Math.min(estHeight, 60), pgLeft, pgRight, [tr, tg, tb])

        // Header del nivel — círculo de color + texto puro (sin emoji)
        doc.setFillColor(lr, lg, lb)
        doc.rect(marginL, y - 3, maxW, 8, 'F')
        // Círculo indicador de nivel dibujado con jsPDF (reemplaza el emoji)
        doc.setFillColor(255, 255, 255)
        doc.circle(marginL + 4, y + 0.5, 2, 'F')
        doc.setTextColor(255, 255, 255); mono(7, 'bold')
        doc.text(`NIVEL ${cfg.label.toUpperCase()}`, marginL + 9, y + 2)

        if (ex.title) {
          doc.setTextColor(255, 255, 255); mono(7)
          doc.text(ex.title, W - marginR - 3, y + 2, { align: 'right' })
        }
        y += 10

        // Tarea
        if (ex.task) {
          cBlack(); mono(8.5, 'bold')
          doc.text('Tarea:', marginL, y)
          y += 5
          mono(8.5, 'normal')
          const taskLines_ = doc.splitTextToSize(ex.task, maxW)
          doc.text(taskLines_, marginL, y)
          y += taskLines_.length * 5 + 4
        }

        // Requerimientos
        if (ex.requirements?.length > 0) {
          y = checkY(y, 12, pgLeft, pgRight, [tr, tg, tb])
          doc.setTextColor(lr, lg, lb); mono(7, 'bold')
          doc.text('REQUERIMIENTOS', marginL, y)
          y += 5
          ex.requirements.forEach(req => {
            y = checkY(y, 8, pgLeft, pgRight, [tr, tg, tb])
            doc.setFillColor(lr, lg, lb)
            doc.rect(marginL, y - 2.5, 3, 3, 'F')
            cBlack(); mono(8)
            const rLines = doc.splitTextToSize(req, maxW - 8)
            doc.text(rLines, marginL + 6, y)
            y += rLines.length * 4.5 + 2
          })
          y += 3
        }

        // Tips
        if (ex.tips?.length > 0) {
          y = checkY(y, 12, pgLeft, pgRight, [tr, tg, tb])
          doc.setTextColor(lr, lg, lb); mono(7, 'bold')
          doc.text('TIPS', marginL, y)
          y += 5
          ex.tips.forEach(tip => {
            y = checkY(y, 8, pgLeft, pgRight, [tr, tg, tb])
            // Draw a small colored arrow using lines instead of → (not Latin-1 safe)
            doc.setDrawColor(lr, lg, lb); doc.setLineWidth(0.6)
            doc.line(marginL, y - 1, marginL + 3.5, y - 1)
            doc.line(marginL + 3.5, y - 1, marginL + 2, y - 2.5)
            doc.line(marginL + 3.5, y - 1, marginL + 2, y + 0.5)
            cGray(); mono(8)
            const tLines = doc.splitTextToSize(tip, maxW - 8)
            doc.text(tLines, marginL + 6, y)
            y += tLines.length * 4.5 + 2
          })
        }
        y += 8
      })
    }

    // ── MILESTONES ──
    const ms = section.milestone
    if (ms) {
      y = checkY(y, 50, pgLeft, pgRight, [tr, tg, tb])
      y = sectionTitle('Milestones — ¿Cuándo sé que lo dominé?', y, [tr, tg, tb])

      const msConfig = [
        { key: 'basico',     label: 'Basico',      color: [75, 148, 85],  bg: [240, 252, 242] },
        { key: 'intermedio', label: 'Intermedio',  color: [195, 140, 20], bg: [252, 249, 235] },
        { key: 'experto',    label: 'Experto',     color: [185, 60, 55],  bg: [252, 240, 240] },
      ]

      msConfig.forEach(({ key, label, color, bg }) => {
        const text = ms[key]
        if (!text) return
        const [mr, mg, mb] = color
        const [br, bg_, bb] = bg
        const msLines = doc.splitTextToSize(text, maxW - 18)
        const boxH    = msLines.length * 5 + 16

        y = checkY(y, boxH + 4, pgLeft, pgRight, [tr, tg, tb])

        doc.setFillColor(br, bg_, bb)
        doc.rect(marginL, y, maxW, boxH, 'F')
        doc.setDrawColor(mr, mg, mb); doc.setLineWidth(1.2)
        doc.line(marginL, y, marginL, y + boxH)

        // Colored circle indicator instead of emoji
        doc.setFillColor(mr, mg, mb)
        doc.circle(marginL + 7, y + 6.5, 2.5, 'F')

        doc.setTextColor(mr, mg, mb); mono(7, 'bold')
        doc.text(label, marginL + 13, y + 7)

        cBlack(); mono(8.5)
        doc.text(msLines, marginL + 13, y + 13)

        y += boxH + 5
      })
    }

    // ── Footer de página ──
    cGray(); mono(6.5)
    doc.text(
      `DevForge · Roadmap personalizado · ${userName} · ${today}`,
      W / 2, 289, { align: 'center' }
    )
  })

  // ────────────────────────────────────────────────────────────────────────
  // PÁGINA FINAL
  // ────────────────────────────────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(12, 12, 12)
  doc.rect(0, 0, W, 297, 'F')
  doc.setFillColor(214, 136, 23)
  doc.rect(0, 0, W, 3.5, 'F')
  doc.rect(0, 293.5, W, 3.5, 'F')

  cAmber(); display(22, 'bold')
  doc.text('¡A estudiar!', W / 2, 96, { align: 'center' })

  cWhite(); mono(9)
  doc.text('Este roadmap fue generado específicamente para vos.', W / 2, 110, { align: 'center' })
  doc.text('La constancia diaria supera al talento natural.', W / 2, 120, { align: 'center' })

  doc.setTextColor(130, 130, 130); mono(7.5)
  doc.text('DEVFORGE — Preparación técnica para entrevistas IT', W / 2, 155, { align: 'center' })
  doc.text('Generado con IA · Groq + llama-3.3-70b-versatile', W / 2, 163, { align: 'center' })

  // Devolver doc + nombre para que el caller decida save vs preview
  const safeName = (userName || 'usuario').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const fileName = `roadmap-devforge-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`
  return { doc, fileName }
}

// ─── Componentes de UI del preview ───────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    dominado:    { label: 'Dominado',     color: '#5aa060' },
    en_progreso: { label: 'En progreso',  color: 'var(--primary)' },
    sin_iniciar: { label: 'Sin iniciar',  color: 'var(--muted)' },
  }
  const { label, color } = map[status] || map.sin_iniciar
  return (
    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, padding: '2px 6px', border: `1px solid ${color}`, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </span>
  )
}

function LevelBadge({ level }) {
  const map = {
    basico:     { label: '🟢 Básico',     color: '#4a9055' },
    intermedio: { label: '🟡 Intermedio', color: '#c08c14' },
    experto:    { label: '🔴 Experto',    color: '#b93c37' },
  }
  const { label, color } = map[level] || map.basico
  return (
    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, padding: '2px 7px', background: `${color}22`, border: `1px solid ${color}`, color, fontWeight: 700 }}>
      {label}
    </span>
  )
}

// ─── RoadmapSectionCard ───────────────────────────────────────────────────
function RoadmapSectionCard({ section, index }) {
  const [expanded,      setExpanded]      = useState(false)
  const [activeExLevel, setActiveExLevel] = useState('basico')

  const tierColors = { 1: '#c34641', 2: '#d08818', 3: '#4a9055' }
  const color      = tierColors[section.tier] || 'var(--subtle)'

  const exercises = section.practiceExercises || []
  const activeEx  = exercises.find(e => e.level === activeExLevel)

  return (
    <div style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${color}`, background: 'var(--surface)', marginBottom: 8 }}>

      {/* ── Header (siempre visible) ── */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}
      >
        <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 11, color, flexShrink: 0, minWidth: 24 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
            {section.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--muted)' }}>
              {section.estimatedWeeks || 1} sem.
            </span>
            <StatusBadge status={section.currentStatus} />
          </div>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 10, flexShrink: 0, marginTop: 2 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* ── Cuerpo expandido ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>

          {/* Descripción */}
          {section.overview && (
            <div style={{ padding: '12px 14px 0 14px' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                Descripción
              </div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', lineHeight: 1.7, margin: 0 }}>
                {section.overview}
              </p>
            </div>
          )}

          {/* Analogía */}
          {section.analogy && (
            <div style={{ margin: '10px 14px 0', padding: '10px 12px', background: 'var(--card)', borderLeft: `2px solid ${color}` }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
                Analogía
              </div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--text)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                "{section.analogy}"
              </p>
            </div>
          )}

          {/* Prerequisites */}
          {section.prerequisites?.length > 0 && (
            <div style={{ padding: '12px 14px 0' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                Prerequisitos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.prerequisites.map((pre, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color, flexShrink: 0, fontSize: 10, marginTop: 1 }}>◆</span>
                    <div>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--text)', fontWeight: 700, marginBottom: 2 }}>
                        {pre.name}
                      </div>
                      {pre.whyNeeded && (
                        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--muted)', lineHeight: 1.5 }}>
                          {pre.whyNeeded}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conceptos clave */}
          {section.keyConcepts?.length > 0 && (
            <div style={{ padding: '12px 14px 0' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                Conceptos Clave
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {section.keyConcepts.map((kc, i) => (
                  <div key={i} style={{ background: 'var(--card)', padding: '8px 10px', borderLeft: `2px solid ${color}33` }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color, marginRight: 6 }}>{i + 1}.</span>
                      {kc.concept}
                    </div>
                    {kc.explanation && (
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8.5, color: 'var(--subtle)', lineHeight: 1.6, margin: '0 0 6px' }}>
                        {kc.explanation}
                      </p>
                    )}
                    {kc.example && (
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '5px 8px', fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--text)', lineHeight: 1.5, borderRadius: 0 }}>
                        {kc.example}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ejercicios por nivel */}
          {exercises.length > 0 && (
            <div style={{ padding: '12px 14px 0' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                Qué Practicar
              </div>

              {/* Tabs de nivel */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {['basico', 'intermedio', 'experto'].map(lvl => {
                  const hasEx  = exercises.some(e => e.level === lvl)
                  const active = activeExLevel === lvl
                  const lvlColor = { basico: '#4a9055', intermedio: '#c08c14', experto: '#b93c37' }[lvl]
                  return (
                    <button
                      key={lvl}
                      onClick={() => setActiveExLevel(lvl)}
                      disabled={!hasEx}
                      style={{
                        flex: 1, padding: '5px 4px',
                        background: active ? lvlColor : 'var(--card)',
                        border: `1px solid ${active ? lvlColor : 'var(--border)'}`,
                        color: active ? '#fff' : hasEx ? lvlColor : 'var(--muted)',
                        cursor: hasEx ? 'pointer' : 'default',
                        fontFamily: 'Space Mono, monospace', fontSize: 8, fontWeight: 700,
                        textTransform: 'capitalize', transition: 'all 0.12s',
                      }}
                    >
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </button>
                  )
                })}
              </div>

              {/* Ejercicio activo */}
              {activeEx && (() => {
                const lvlColor = { basico: '#4a9055', intermedio: '#c08c14', experto: '#b93c37' }[activeEx.level]
                return (
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    {/* Title bar */}
                    <div style={{ padding: '8px 10px', background: lvlColor + '18', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--text)' }}>
                        {activeEx.title}
                      </div>
                    </div>

                    <div style={{ padding: '10px' }}>
                      {activeEx.task && (
                        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8.5, color: 'var(--text)', lineHeight: 1.6, margin: '0 0 10px' }}>
                          {activeEx.task}
                        </p>
                      )}

                      {activeEx.requirements?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: lvlColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                            Requerimientos
                          </div>
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {activeEx.requirements.map((req, ri) => (
                              <li key={ri} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)', display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5 }}>
                                <span style={{ color: lvlColor, flexShrink: 0, marginTop: 1 }}>■</span>
                                {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {activeEx.tips?.length > 0 && (
                        <div>
                          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: lvlColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                            Tips
                          </div>
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {activeEx.tips.map((tip, ti) => (
                              <li key={ti} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)', display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5 }}>
                                <span style={{ color: lvlColor, flexShrink: 0 }}>→</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Milestones */}
          {section.milestone && (
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                Milestones
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { key: 'basico',     label: '🟢 Básico',     lColor: '#4a9055' },
                  { key: 'intermedio', label: '🟡 Intermedio', lColor: '#c08c14' },
                  { key: 'experto',    label: '🔴 Experto',    lColor: '#b93c37' },
                ].map(({ key, label, lColor }) => {
                  const text = section.milestone[key]
                  if (!text) return null
                  return (
                    <div key={key} style={{ padding: '8px 10px', background: lColor + '12', border: `1px solid ${lColor}33`, borderLeft: `3px solid ${lColor}` }}>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color: lColor, fontWeight: 700, marginBottom: 4 }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8.5, color: 'var(--text)', lineHeight: 1.6 }}>
                        {text}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── RoadmapPanelWithStore ────────────────────────────────────────────────
/**
 * Vista completa del generador de roadmap, recibe el state del store como prop.
 * Exportado con nombre para ser usado en ResourcePanel.
 *
 * @param {Object}   state  — state global del store (user, progress)
 * @param {Function} onBack — callback para volver al picker
 */
export function RoadmapPanelWithStore({ state, onBack }) {
  const [genStatus,    setGenStatus]    = useState('idle')
  const [roadmap,      setRoadmap]      = useState([])
  const [error,        setError]        = useState(null)
  const [pdfBusy,      setPdfBusy]      = useState(false)
  // Topics consolidados de todas las fuentes (onboarding + saved_offers)
  const [allTopicNames, setAllTopicNames] = useState(null)   // null = cargando

  const userName        = state?.user?.name || 'Desarrollador'
  const progress        = state?.progress || {}
  // Topics del onboarding (pueden estar vacíos si el usuario nunca los completó)
  const onboardingTopics = state?.user?.extractedTopics || []

  const totalTopics    = TOPICS.length
  const practicedCount = TOPICS.filter(t => progress[t.id]?.completed > 0).length
  const dominatedCount = TOPICS.filter(t => (progress[t.id]?.lastScore || 0) >= 7).length

  // ── Al montar: cargar las ofertas guardadas de Supabase ──────────────────
  // Así el roadmap siempre refleja las últimas ofertas del usuario,
  // incluyendo las que agregó en /interview-setup después del onboarding.
  useEffect(() => {
    async function loadSavedOfferTopics() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setAllTopicNames(onboardingTopics); return }

        const offers = await loadOffers(user.id)

        // Extraer todos los nombres de topics de todas las ofertas guardadas
        const offerTopicNames = offers.flatMap(offer =>
          (offer.topics || []).map(t => t.name).filter(Boolean)
        )

        // Unir con los topics del onboarding y deduplicar
        const combined = [...new Set([...onboardingTopics, ...offerTopicNames])]
        setAllTopicNames(combined)
      } catch {
        // Si falla la carga, usamos solo los del onboarding
        setAllTopicNames(onboardingTopics)
      }
    }
    loadSavedOfferTopics()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // offersCount: cuántas ofertas tienen topics (para mostrar en el perfil)
  const offersTopicsCount = allTopicNames !== null
    ? allTopicNames.length - onboardingTopics.length
    : 0

  async function handleGenerate() {
    setGenStatus('loading')
    setError(null)
    try {
      // allTopicNames puede ser null si la carga aún no terminó, usamos onboarding como fallback
      const topicsForPrompt = allTopicNames ?? onboardingTopics
      const result = await generateRoadmapContent(userName, TOPICS, progress, topicsForPrompt)
      setRoadmap(result)
      setGenStatus('done')
    } catch (err) {
      console.error('[RoadmapPanel] Error:', err)
      setError(err.message || 'No se pudo generar el roadmap.')
      setGenStatus('error')
    }
  }

  function handlePDF(mode) {
    setPdfBusy(true)
    try {
      const { doc, fileName } = generatePDF(userName, roadmap)
      if (mode === 'preview') {
        const url = doc.output('bloburl')
        window.open(url, '_blank')
      } else {
        doc.save(fileName)
      }
    } finally {
      setPdfBusy(false)
    }
  }

  // ── idle ──────────────────────────────────────────────────────────────
  if (genStatus === 'idle') {
    // Topics de todas las fuentes (para mostrar el conteo en el perfil)
    const totalOfferTopics = allTopicNames !== null ? allTopicNames.length : null

    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
            Tu roadmap personalizado
          </div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', lineHeight: 1.7, margin: 0 }}>
            La IA generará un roadmap 0→100 con contenido profundo por cada tema:
            descripción detallada, analogías, conceptos con ejemplos de código,
            3 ejercicios graduados (básico · intermedio · experto) y milestones por nivel.
          </p>
        </div>

        {/* Perfil detectado */}
        <div style={{ marginBottom: 18, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Perfil detectado
          </div>
          {[
            { label: 'Nombre',        value: userName },
            { label: 'Temas totales', value: `${totalTopics} en el catálogo` },
            { label: 'Practicados',   value: `${practicedCount} de ${totalTopics}` },
            { label: 'Dominados',     value: `${dominatedCount} (score ≥ 7)` },
            {
              label: 'Temas de ofertas',
              // Mostramos un spinner mientras carga, y el conteo real cuando está listo
              value: allTopicNames === null
                ? '⟳ Cargando ofertas...'
                : totalOfferTopics > 0
                  ? `${totalOfferTopics} detectados (onboarding + guardadas)`
                  : 'Sin ofertas cargadas',
              highlight: allTopicNames !== null && totalOfferTopics > 0,
            },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--muted)', flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: row.highlight ? 'var(--primary)' : 'var(--text)', textAlign: 'right' }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* El PDF incluye */}
        <div style={{ marginBottom: 18, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7.5, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
            El PDF incluye
          </div>
          {[
            '📄 Portada con tus estadísticas actuales',
            '📋 Índice de todos los temas ordenados',
            `📚 ${totalTopics} secciones con contenido profundo`,
            '🔍 Conceptos clave con ejemplos de código',
            '🟢🟡🔴 Ejercicios básico / intermedio / experto',
            '🎯 Milestones por nivel para cada tema',
          ].map((item, i) => (
            <div key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8.5, color: 'var(--subtle)', lineHeight: 2 }}>{item}</div>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          style={{ width: '100%', padding: '12px 16px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Generar mi roadmap →
        </button>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--muted)', textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
          ~30-45 segundos · Contenido profundo por cada tema
        </p>
      </div>
    )
  }

  // ── loading ───────────────────────────────────────────────────────────
  if (genStatus === 'loading') {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>
            Generando tu roadmap...
          </div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--subtle)', lineHeight: 1.7, margin: 0 }}>
            Analizando tu perfil y generando<br />
            contenido profundo para {totalTopics} temas.<br />
            Ejercicios, conceptos y milestones.
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── error ─────────────────────────────────────────────────────────────
  if (genStatus === 'error') {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ padding: '14px 16px', border: '1px solid var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 6 }}>
            Error al generar el roadmap
          </div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8.5, color: 'var(--subtle)', lineHeight: 1.6, margin: 0 }}>{error}</p>
        </div>
        <button
          onClick={handleGenerate}
          style={{ width: '100%', padding: '10px 16px', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 10 }}
        >
          Reintentar →
        </button>
      </div>
    )
  }

  // ── done ──────────────────────────────────────────────────────────────
  const totalSemanas = roadmap.reduce((s, r) => s + (r.estimatedWeeks || 0), 0)

  return (
    <div>
      {/* Header sticky */}
      <div style={{ padding: '12px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>
              Roadmap generado ✓
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'var(--subtle)', marginTop: 2 }}>
              {roadmap.length} temas · ~{totalSemanas} semanas estimadas
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handlePDF('preview')}
              disabled={pdfBusy}
              style={{ padding: '8px 10px', background: 'none', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: pdfBusy ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9, opacity: pdfBusy ? 0.6 : 1 }}
            >
              Ver PDF
            </button>
            <button
              onClick={() => handlePDF('save')}
              disabled={pdfBusy}
              style={{ padding: '8px 12px', background: 'var(--primary)', border: 'none', color: '#000', cursor: pdfBusy ? 'not-allowed' : 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9, fontWeight: 700, opacity: pdfBusy ? 0.6 : 1 }}
            >
              ↓ {pdfBusy ? 'Generando...' : 'Descargar'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: 'Dominados',   value: roadmap.filter(r => r.currentStatus === 'dominado').length,    color: '#4a9055' },
            { label: 'En progreso', value: roadmap.filter(r => r.currentStatus === 'en_progreso').length, color: 'var(--primary)' },
            { label: 'Pendientes',  value: roadmap.filter(r => r.currentStatus === 'sin_iniciar').length, color: 'var(--muted)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, padding: '5px 6px', background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: s.color }}>{s.value}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 6.5, color: 'var(--muted)', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de temas */}
      <div style={{ padding: '10px 12px' }}>
        {roadmap.map((section, idx) => (
          <RoadmapSectionCard key={section.id || idx} section={section} index={idx} />
        ))}
      </div>

      {/* Regenerar */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => { setGenStatus('idle'); setRoadmap([]) }}
          style={{ width: '100%', padding: '8px 14px', background: 'none', border: '1px solid var(--border)', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9 }}
        >
          ← Regenerar roadmap
        </button>
      </div>
    </div>
  )
}
