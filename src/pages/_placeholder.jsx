// pages/placeholders.jsx
// Páginas temporales para que el router no rompa mientras construimos cada una.
// Cada archivo va a ser reemplazado en su lote correspondiente.

export function PlaceholderPage({ name }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <span className="font-mono text-forge-subtle text-xs uppercase tracking-widest">
        devforge / {name}
      </span>
      <h1 className="font-display text-3xl font-bold text-forge-amber cursor-blink">
        {name}
      </h1>
      <p className="font-mono text-forge-subtle text-sm">
        — en construcción —
      </p>
    </div>
  )
}
