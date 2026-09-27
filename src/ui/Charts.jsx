import { useEffect, useRef, useState } from 'react'
import { fmt } from '../lib/calc'
import { LEVEL } from '../theme'

// Графики нарисованы вручную в SVG: одна ось 0–3, тонкие штрихи, подписи — чернилами, цвет — только у меток.
export const CHART = {
  levels: ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)'],
  start: 'var(--s-start)',
  end: 'var(--s-end)',
}

function useTip() {
  const box = useRef(null)
  const [tip, setTip] = useState(null)
  const [width, setWidth] = useState(520)
  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const show = (e, content) => {
    const r = box.current.getBoundingClientRect()
    const x = Math.min(Math.max(e.clientX - r.left, 70), r.width - 70)
    setTip({ x, y: e.clientY - r.top, content })
  }
  const bind = (content) => ({
    onMouseMove: (e) => show(e, content),
    onMouseLeave: () => setTip(null),
    onClick: (e) => show(e, content),
  })
  const node = tip && <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div>
  return { box, bind, node, width }
}

export function Legend({ items }) {
  return (
    <ul className="chart-legend">
      {items.map((i) => (
        <li key={i.label}><span className={`swatch${i.line ? ' line' : ''}`} style={{ background: i.color }} />{i.label}</li>
      ))}
    </ul>
  )
}

const SERIES_LEGEND = (a, b) => [{ label: a, color: CHART.start }, { label: b, color: CHART.end }]

// ── Радар: профиль по разделам, два среза. Чем ближе к центру, тем ближе к норме.
export function Radar({ axes, startLabel, endLabel }) {
  const { box, bind, node } = useTip()
  // поле шире круга: подписи осей слева и справа не обрезаются на телефоне
  const width = 440
  const size = 320
  const cx = width / 2
  const c = size / 2
  const R = 100
  const n = axes.length
  const pt = (i, v) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    const r = (R * v) / 3
    return [cx + r * Math.cos(a), c + r * Math.sin(a)]
  }
  const poly = (key) => axes.map((ax, i) => pt(i, ax[key] ?? 0).join(',')).join(' ')
  const has = (key) => axes.some((ax) => ax[key] !== null && ax[key] !== undefined)

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${width} ${size}`} role="img" aria-label="Профиль по разделам: средний балл на начало и конец">
        {[1, 2, 3].map((v) => (
          <polygon key={v} className={v === 3 ? 'grid' : 'grid-dash'} points={axes.map((_, i) => pt(i, v).join(',')).join(' ')} />
        ))}
        {axes.map((ax, i) => {
          const [x, y] = pt(i, 3)
          const [lx, ly] = pt(i, 3.45)
          return (
            <g key={ax.label}>
              <line className="grid" x1={cx} y1={c} x2={x} y2={y} />
              <text x={lx} y={ly} textAnchor={Math.abs(lx - cx) < 12 ? 'middle' : lx > cx ? 'start' : 'end'} dominantBaseline="middle">{ax.label}</text>
            </g>
          )
        })}
        {[1, 2, 3].map((v) => <text key={v} className="axis" x={cx + 4} y={c - (R * v) / 3 + 3}>{v}</text>)}
        {has('start') && <polygon points={poly('start')} fill={CHART.start} fillOpacity="0.14" stroke={CHART.start} strokeWidth="2" strokeLinejoin="round" />}
        {has('end') && <polygon points={poly('end')} fill={CHART.end} fillOpacity="0.16" stroke={CHART.end} strokeWidth="2" strokeLinejoin="round" />}
        {axes.map((ax, i) => (
          <g key={ax.label}>
            {ax.start != null && <circle cx={pt(i, ax.start)[0]} cy={pt(i, ax.start)[1]} r="4" fill={CHART.start} stroke="var(--paper)" strokeWidth="2" />}
            {ax.end != null && <circle cx={pt(i, ax.end)[0]} cy={pt(i, ax.end)[1]} r="4" fill={CHART.end} stroke="var(--paper)" strokeWidth="2" />}
            <circle className="hit" cx={pt(i, 1.8)[0]} cy={pt(i, 1.8)[1]} r="34"
              {...bind(<>{ax.full || ax.label}<br />{startLabel}: <b>{fmt(ax.start)}</b> · {endLabel}: <b>{fmt(ax.end)}</b></>)} />
          </g>
        ))}
      </svg>
      {node}
      <Legend items={SERIES_LEGEND(startLabel, endLabel)} />
    </div>
  )
}

// ── «Гантели»: сдвиг среднего балла от начала к концу по каждому разделу.
export function Dumbbell({ rows, startLabel, endLabel }) {
  const { box, bind, node, width: W } = useTip()
  const left = W < 420 ? 112 : 132
  const right = 44
  const rowH = 30
  const top = 22
  const H = top + rows.length * rowH + 8
  const x = (v) => left + ((W - left - right) * v) / 3

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Сдвиг среднего балла по разделам">
        {[0, 1, 2, 3].map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'grid' : 'grid-dash'} x1={x(v)} y1={top - 6} x2={x(v)} y2={H - 6} />
            <text className="axis" x={x(v)} y={10} textAnchor="middle">{v}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = top + i * rowH + rowH / 2
          const both = r.start != null && r.end != null
          const better = both && r.end < r.start
          return (
            <g key={r.label}>
              <text x={left - 12} y={y} textAnchor="end" dominantBaseline="middle">{r.label}</text>
              {both && <line x1={x(r.start)} y1={y} x2={x(r.end)} y2={y} stroke="var(--ink-3)" strokeWidth="2" strokeOpacity="0.45" />}
              {r.start != null && <circle cx={x(r.start)} cy={y} r="5" fill={CHART.start} stroke="var(--paper)" strokeWidth="2" />}
              {r.end != null && <circle cx={x(r.end)} cy={y} r="5" fill={CHART.end} stroke="var(--paper)" strokeWidth="2" />}
              {both && <text className="val" x={W - right + 8} y={y} dominantBaseline="middle" style={{ fill: better ? 'var(--ok)' : r.end > r.start ? 'var(--danger)' : 'var(--ink-3)' }}>{r.end === r.start ? '0,0' : `${better ? '−' : '+'}${fmt(Math.abs(r.end - r.start), 1)}`}</text>}
              <rect className="hit" x={0} y={y - rowH / 2} width={W} height={rowH}
                {...bind(<>{r.full || r.label}<br />{startLabel}: <b>{fmt(r.start)}</b> → {endLabel}: <b>{fmt(r.end)}</b></>)} />
            </g>
          )
        })}
      </svg>
      {node}
      <Legend items={SERIES_LEGEND(startLabel, endLabel)} />
    </div>
  )
}

// ── Кольцо: доли итогов коррекционной работы.
export function Donut({ segments, centerValue, centerLabel }) {
  const { box, bind, node } = useTip()
  const total = segments.reduce((a, s) => a + s.value, 0)
  const R = 62
  const circ = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="chart" ref={box}>
      <svg viewBox="0 0 180 180" style={{ maxWidth: 220, margin: '0 auto' }} role="img" aria-label="Итоги коррекционной работы">
        <circle cx="90" cy="90" r={R} fill="none" stroke="var(--line)" strokeWidth="16" />
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
          const len = (circ * s.value) / total
          const gap = total === s.value ? 0 : 2
          const el = (
            <circle key={s.label} cx="90" cy="90" r={R} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${circ - Math.max(len - gap, 0.5)}`} strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
              {...bind(<>{s.label}: <b>{s.value}</b> из {total} · <b>{Math.round((s.value / total) * 100)}%</b></>)} />
          )
          offset += len
          return el
        })}
        <text className="val" x="90" y="88" textAnchor="middle" style={{ fontSize: 26, fontWeight: 700 }}>{centerValue}</text>
        <text x="90" y="106" textAnchor="middle">{centerLabel}</text>
      </svg>
      {node}
      <Legend items={segments.map((s) => ({ label: `${s.label} — ${s.value}`, color: s.color }))} />
    </div>
  )
}

// ── Линия: средний балл по срезам (один ряд — без легенды).
export function TrendLine({ points, label = 'Средний балл' }) {
  const { box, bind, node, width: W } = useTip()
  const H = 190
  const pad = { l: 34, r: 34, t: 22, b: 34 }
  const valid = points.filter((p) => p.value != null)
  const x = (i) => (points.length === 1 ? (W + pad.l - pad.r) / 2 : pad.l + ((W - pad.l - pad.r) * i) / (points.length - 1))
  const y = (v) => pad.t + ((H - pad.t - pad.b) * (3 - v)) / 3
  const path = points.map((p, i) => (p.value == null ? null : `${x(i)},${y(p.value)}`)).filter(Boolean).join(' ')

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} по срезам`}>
        {[0, 1, 2, 3].map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'grid' : 'grid-dash'} x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} />
            <text className="axis" x={pad.l - 8} y={y(v) + 3} textAnchor="end">{v}</text>
          </g>
        ))}
        {valid.length > 1 && <polyline points={path} fill="none" stroke={CHART.end} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          <g key={p.label}>
            <text x={x(i)} y={H - 12} textAnchor="middle">{p.label}</text>
            {p.value != null && (
              <>
                <circle cx={x(i)} cy={y(p.value)} r="5" fill={CHART.end} stroke="var(--paper)" strokeWidth="2" />
                <text className="val" x={x(i)} y={y(p.value) - 11} textAnchor="middle">{fmt(p.value)}</text>
              </>
            )}
            <rect className="hit" x={x(i) - 30} y={0} width={60} height={H}
              {...bind(<>{p.label}<br />{label}: <b>{fmt(p.value)}</b></>)} />
          </g>
        ))}
      </svg>
      {node}
    </div>
  )
}

// ── Столбцы по уровням: сколько детей на каждом уровне в начале и в конце (аналог диаграмм Excel).
export function LevelColumns({ start, end, startLabel, endLabel }) {
  const { box, bind, node, width: W } = useTip()
  const H = 200
  const pad = { l: 28, r: 8, t: 18, b: 40 }
  const max = Math.max(1, ...start, ...end)
  const band = (W - pad.l - pad.r) / 4
  const bw = Math.min(34, band / 2 - 8)
  const h = (v) => ((H - pad.t - pad.b) * v) / max
  const base = H - pad.b
  const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Число детей по уровням в начале и в конце">
        {ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'grid' : 'grid-dash'} x1={pad.l} y1={base - h(v)} x2={W - pad.r} y2={base - h(v)} />
            <text className="axis" x={pad.l - 6} y={base - h(v) + 3} textAnchor="end">{v}</text>
          </g>
        ))}
        {[0, 1, 2, 3].map((lvl) => {
          const cx = pad.l + band * lvl + band / 2
          return (
            <g key={lvl}>
              {[{ v: start[lvl], c: CHART.start, dx: -bw - 1, name: startLabel }, { v: end[lvl], c: CHART.end, dx: 1, name: endLabel }].map((s) => (
                <g key={s.name}>
                  <path d={barPath(cx + s.dx, base, bw, h(s.v))} fill={s.c} />
                  {s.v > 0 && <text className="val" x={cx + s.dx + bw / 2} y={base - h(s.v) - 5} textAnchor="middle">{s.v}</text>}
                </g>
              ))}
              <text x={cx} y={H - 22} textAnchor="middle" className="val">{lvl}</text>
              <text x={cx} y={H - 8} textAnchor="middle" style={{ fontSize: 10 }}>{W < 440 ? LEVEL_SHORT[lvl] : LEVEL[lvl].name}</text>
              <rect className="hit" x={cx - band / 2} y={0} width={band} height={H}
                {...bind(<>Уровень {lvl} — {LEVEL[lvl].name}<br />{startLabel}: <b>{start[lvl]}</b> · {endLabel}: <b>{end[lvl]}</b></>)} />
            </g>
          )
        })}
      </svg>
      {node}
      <Legend items={SERIES_LEGEND(startLabel, endLabel)} />
    </div>
  )
}

const LEVEL_SHORT = ['норма', 'формир.', 'коррекция', 'выраж.']

// Столбец со скруглением 3px только у верхнего края: основание стоит на оси.
function barPath(x, base, w, height) {
  if (height <= 0) return ''
  const r = Math.min(3, height)
  const top = base - height
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`
}
