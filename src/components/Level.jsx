import { LEVEL } from '../theme'
import { fmtDelta } from '../lib/calc'

export function Level({ value, title }) {
  if (value === null || value === undefined) return <span className="lvl lvl-none" title="нет данных">·</span>
  return <span className={`lvl lvl-${value}`} title={title || LEVEL[value].name}>{value}</span>
}

// Дельта среднего балла: балл снизился — улучшение (зелёная), вырос — ухудшение (красная).
export function Delta({ from, to }) {
  if (from === null || to === null || from === undefined || to === undefined) return null
  const d = to - from
  if (Math.abs(d) < 0.005) return <span className="delta muted">0,00</span>
  return <span className={`delta ${d < 0 ? 'ok' : 'bad'}`}>{fmtDelta(d)}</span>
}

export function LevelLegend() {
  return (
    <ul className="legend">
      {LEVEL.map((l, i) => (
        <li key={l.name}><Level value={i} /> {l.name}</li>
      ))}
    </ul>
  )
}

// Полоса распределения детей по уровням 0–3.
export function DistBar({ dist, n }) {
  return (
    <div className="dist" role="img" aria-label={`уровни 0–3: ${dist.join(', ')} из ${n}`}>
      {dist.map((v, i) => (v ? <span key={i} className={`d${i}`} style={{ flexGrow: v }} /> : null))}
    </div>
  )
}
