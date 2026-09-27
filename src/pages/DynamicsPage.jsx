import { useState } from 'react'
import { childrenOf, periodLabel, periodShort, scoresOf } from '../lib/store'
import { useSelection, useUi, setUi } from '../lib/ui'
import { href } from '../lib/router'
import { BLOCKS, isScored } from '../data/methodology'
import { OUTCOMES, blockMean, fmt, levelDistribution, levelOf, outcome, sectionStats } from '../lib/calc'
import { exportSheets } from '../lib/excel'
import Dropdown from '../ui/Dropdown'
import FilterCard from '../ui/FilterCard'
import { GroupFilter } from '../components/Selectors'
import { Delta, DistBar, Level, LevelLegend } from '../ui/Level'
import { Donut, Dumbbell, LevelColumns, Radar } from '../ui/Charts'
import { DownloadIcon } from '../ui/Icons'

// Палитра итогов проверена на различимость: зелёный, ежевика, синий, жёлтый, красный.
const OUTCOME_COLORS = { norm: '#3A9466', major: '#6B3A78', minor: '#3F7FB5', none: '#D1AE1E', worse: '#B23A48' }

// Срезы по умолчанию: первый и последний, где у группы есть данные.
function defaultRange(db, kids) {
  const withData = db.periods.filter((p) => kids.some((k) => Object.keys(scoresOf(db, k.id, p.id)).length))
  // сначала ищем последний учебный год, где заполнены и начало, и конец
  const years = [...new Set(withData.map((p) => p.year))].reverse()
  for (const year of years) {
    const pair = withData.filter((p) => p.year === year)
    if (pair.length === 2) return { start: pair[0], end: pair[1] }
  }
  const start = withData[0] || db.periods[0]
  const end = withData.length > 1 ? withData[withData.length - 1] : db.periods[Math.min(1, db.periods.length - 1)]
  return { start, end }
}

export default function DynamicsPage({ db }) {
  const { group } = useSelection(db)
  const ui = useUi()
  const [blockId, setBlockId] = useState('speech')
  const kids = group ? childrenOf(db, group.id) : []
  const def = defaultRange(db, kids)
  const start = db.periods.find((p) => p.id === ui.startId) || def.start
  const end = db.periods.find((p) => p.id === ui.endId) || def.end
  const block = BLOCKS.find((b) => b.id === blockId)
  const sections = block.sections.filter(isScored)
  const periodOptions = db.periods.map((p) => ({ value: p.id, label: periodLabel(p) }))

  if (!start || !end) return <div className="empty" style={{ marginTop: 24 }}><p>Нет срезов. Добавьте учебный год в разделе «Данные».</p></div>

  const rows = kids.map((k) => {
    const a = scoresOf(db, k.id, start.id)
    const b = scoresOf(db, k.id, end.id)
    const mA = blockMean(sections, a)
    const mB = blockMean(sections, b)
    return { child: k, a, b, mA, mB, res: outcome(mA, mB) }
  })
  const measured = rows.filter((r) => r.res)
  const avg = (key) => (measured.length ? measured.reduce((s, r) => s + r[key], 0) / measured.length : null)
  const improved = measured.filter((r) => ['norm', 'major', 'minor'].includes(r.res.id)).length

  const overall = (key) => {
    const dist = [0, 0, 0, 0]
    rows.forEach((r) => { const l = levelOf(r[key]); if (l !== null) dist[l] += 1 })
    return dist
  }
  const sectionMeans = sections.map((s) => {
    const mean = (pid) => {
      const v = kids.map((k) => sectionStats(s, scoresOf(db, k.id, pid)).mean).filter((m) => m !== null)
      return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null
    }
    return { label: s.short, full: s.title, start: mean(start.id), end: mean(end.id) }
  })
  const sLabel = periodLabel(start)
  const eLabel = periodLabel(end)
  const sameYear = start.year === end.year
  const sShort = sameYear ? start.point : periodShort(start)
  const eShort = sameYear ? end.point : periodShort(end)

  const exportXlsx = () => {
    const head1 = ['№', 'Ребёнок', ...sections.flatMap((s) => [s.short, '']), 'Средний балл', '', 'Итог']
    const head2 = ['', '', ...sections.flatMap(() => [start.point, end.point]), start.point, end.point, '']
    const body = rows.map((r, i) => [
      i + 1, r.child.name,
      ...sections.flatMap((s) => [sectionStats(s, r.a).level, sectionStats(s, r.b).level]),
      r.mA === null ? null : Number(r.mA.toFixed(2)), r.mB === null ? null : Number(r.mB.toFixed(2)), r.res?.label || '',
    ])
    const distRows = [0, 1, 2, 3].map((lvl) => [
      '', `Детей на уровне ${lvl}`,
      ...sections.flatMap((s) => [start, end].map((p) => levelDistribution(s, kids.map((k) => k.id), (id) => scoresOf(db, id, p.id)).dist[lvl])),
    ])
    exportSheets(`Динамика — ${group.name}.xlsx`, [{
      name: block.title,
      rows: [[`Динамика: ${block.title}. ${group.name}. ${sLabel} → ${eLabel}`], head1, head2, ...body, [], ...distRows],
      widths: [4, 26, ...sections.flatMap(() => [7, 7]), 8, 8, 26],
    }])
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Динамика</h1>
          <p className="subtitle">Сравнение двух срезов по группе: уровни по разделам, сдвиг среднего балла и итог коррекционной работы. Балл снижается — значит, ребёнок приближается к норме.</p>
        </div>
        <div className="page-actions">
          <button className="btn-ghost" onClick={exportXlsx} disabled={!kids.length}><DownloadIcon /> Выгрузить в Excel</button>
        </div>
      </div>

      <div className="filters">
        <GroupFilter db={db} group={group} />
        <FilterCard label="Начало"><Dropdown label="Начало" value={start.id} options={periodOptions} onChange={(startId) => setUi({ startId })} /></FilterCard>
        <FilterCard label="Конец"><Dropdown label="Конец" value={end.id} options={periodOptions} onChange={(endId) => setUi({ endId })} /></FilterCard>
      </div>

      <div className="subtabs" role="tablist" aria-label="Блок методики">
        {BLOCKS.map((b) => <button key={b.id} role="tab" aria-selected={b.id === blockId} onClick={() => setBlockId(b.id)}>{b.title}</button>)}
      </div>

      {!measured.length ? (
        <div className="empty" style={{ marginTop: 20 }}><p>Нет детей, обследованных на обоих срезах. Выберите другие срезы или заполните протоколы.</p></div>
      ) : (
        <>
          <section className="card" style={{ borderTop: 0, paddingTop: 22 }}>
            <div className="stats">
              <div className="stat"><span className="caps">Обследовано на обоих срезах</span><div className="stat-value">{measured.length}<span className="stat-note">из {kids.length} детей</span></div></div>
              <div className="stat"><span className="caps">Средний балл группы</span><div className="stat-value">{fmt(avg('mB'))}<Delta from={avg('mA')} to={avg('mB')} /></div><span className="stat-note">было {fmt(avg('mA'))} · шкала 0–3, 0 — норма</span></div>
              <div className="stat"><span className="caps">Положительная динамика</span><div className="stat-value">{Math.round((improved / measured.length) * 100)}%</div><span className="stat-note">{improved} из {measured.length}: улучшение или норма</span></div>
            </div>
          </section>

          <section className="card">
            <div className="chart-grid">
              <div>
                <p className="chart-title">Итог коррекционной работы</p>
                <Donut centerValue={measured.length} centerLabel="детей"
                  segments={OUTCOMES.map((o) => ({ label: o.label, value: measured.filter((r) => r.res.id === o.id).length, color: OUTCOME_COLORS[o.id] }))} />
              </div>
              <div>
                <p className="chart-title">Дети по общему уровню: {sShort} и {eShort}</p>
                <LevelColumns start={overall('mA')} end={overall('mB')} startLabel={sLabel} endLabel={eLabel} />
              </div>
              <div>
                <p className="chart-title">Сдвиг среднего балла по разделам</p>
                <Dumbbell rows={sectionMeans} startLabel={sLabel} endLabel={eLabel} />
              </div>
              <div>
                <p className="chart-title">Профиль группы</p>
                <div style={{ maxWidth: 460, margin: '0 auto' }}><Radar axes={sectionMeans} startLabel={sLabel} endLabel={eLabel} /></div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="block-head"><h2>Распределение детей по уровням</h2><LevelLegend /></div>
            <div className={`dist-grid${sections.length > 4 ? ' dist-grid--3' : ''}`}>
              {sections.map((s) => (
                <div key={s.id}>
                  <p className="chart-title">{s.title}</p>
                  {[start, end].map((p) => {
                    const { dist, n } = levelDistribution(s, kids.map((k) => k.id), (id) => scoresOf(db, id, p.id))
                    return (
                      <div className="dist-row" key={p.id} style={{ marginBottom: 8 }}>
                        <span className="caps">{p === start ? sShort : eShort}</span>
                        <DistBar dist={dist} n={n} />
                        <span className="dist-nums">{dist.map((v, i) => <span key={i}>{i}: <b style={{ color: 'var(--ink)' }}>{v}</b></span>)}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="block-head"><h2>Сводная: {block.title.toLowerCase()}</h2><span className="faint">{sLabel} → {eLabel}</span></div>
            <div className="table-scroll">
              <table className="tbl tbl--wide heat">
                <thead>
                  <tr>
                    <th rowSpan={2}>Ребёнок</th>
                    {sections.map((s) => <th key={s.id} colSpan={2} className="grp" data-tip={s.title}>{s.short}</th>)}
                    <th colSpan={3} className="grp">Средний балл</th>
                    <th rowSpan={2} className="sep">Итог</th>
                  </tr>
                  <tr>
                    {sections.map((s) => [<th key={`${s.id}a`} className="c sep">{sameYear ? start.point : 'нач.'}</th>, <th key={`${s.id}b`} className="c">{sameYear ? end.point : 'кон.'}</th>])}
                    <th className="r sep">{sameYear ? start.point : 'нач.'}</th><th className="r">{sameYear ? end.point : 'кон.'}</th><th className="r">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.child.id}>
                      <td style={{ padding: '8px 10px' }}><a className="name" href={href(`/child/${r.child.id}`)}>{r.child.name}</a></td>
                      {sections.map((s) => [
                        <td key={`${s.id}a`} className="c sep"><Level value={sectionStats(s, r.a).level} /></td>,
                        <td key={`${s.id}b`} className="c"><Level value={sectionStats(s, r.b).level} /></td>,
                      ])}
                      <td className="r num sep" style={{ padding: '8px 10px' }}>{fmt(r.mA)}</td>
                      <td className="r num" style={{ padding: '8px 10px' }}>{fmt(r.mB)}</td>
                      <td className="r" style={{ padding: '8px 10px' }}><Delta from={r.mA} to={r.mB} /></td>
                      <td className="sep" style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.res ? r.res.label : <span className="faint">нет данных</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
