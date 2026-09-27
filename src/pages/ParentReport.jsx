import { useEffect, useRef, useState } from 'react'
import { libraryOf, periodLabel, periodShort, POINT_NAMES, programOf, scoresOf } from '../lib/store'
import { href } from '../lib/router'
import { ALL_SECTIONS, BLOCKS, NEURO_SCORED, SPEECH_SECTIONS, isScored, optionsFor, sectionItems } from '../data/methodology'
import { ageText, blockMean, fmt, itemScore, levelOf, outcome, sectionStats } from '../lib/calc'
import { buildProgram, exerciseLines } from '../lib/program'
import { downloadText, exportSheets } from '../lib/excel'
import { LEVEL } from '../theme'
import Dropdown from '../components/Dropdown'
import FilterCard from '../components/FilterCard'
import { Delta, Level } from '../components/Level'
import { Dumbbell, Radar, TrendLine } from '../components/Charts'
import { ArrowIcon, DownloadIcon, PrintIcon } from '../components/Icons'
import { addressesText, emailsText, phonesText } from '../components/RelativesEditor'

// Понятные родителям формулировки уровней.
const PARENT_LEVEL = [
  'соответствует возрасту',
  'формируется — нужны регулярные занятия',
  'отстаёт от возрастной нормы — нужна коррекционная работа',
  'значительно отстаёт — нужна систематическая коррекционная работа',
]

const PARTS = [
  { key: 'speech', label: 'Речевое развитие' },
  { key: 'neuro', label: 'Нейродиагностика' },
  { key: 'details', label: 'Результаты по пробам' },
  { key: 'program', label: 'Программа коррекции' },
  { key: 'recs', label: 'Рекомендации' },
]

function valueText(section, value) {
  if (value === undefined || value === null) return null
  const o = optionsFor(section).find((x) => x.value === value)
  return o ? o : null
}

function Cell({ section, value }) {
  const o = valueText(section, value)
  if (!o) return <span className="faint">—</span>
  if (section.kind === 'scale' || section.kind === 'sound') {
    const s = itemScore(section, value)
    return <span className={`lvl lvl-${s}`} title={o.label}>{o.mark}</span>
  }
  return <span>{o.label}</span>
}

export default function ParentReport({ db, childId, params }) {
  const child = db.children.find((c) => c.id === childId)
  const filled = child ? db.periods.filter((p) => Object.keys(scoresOf(db, child.id, p.id)).length) : []
  const [periodId, setPeriodId] = useState(params.period && filled.some((p) => p.id === params.period) ? params.period : filled[filled.length - 1]?.id)
  const idx = filled.findIndex((p) => p.id === periodId)
  const [compareId, setCompareId] = useState(idx > 0 ? filled[idx - 1].id : '')
  const [parts, setParts] = useState(() => params.only === 'program'
    ? { speech: false, neuro: false, details: false, program: true, recs: true }
    : { speech: true, neuro: true, details: true, program: true, recs: true })
  const docRef = useRef(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!child) return undefined
    const prev = document.title
    document.title = `${child.name} — результаты диагностики`
    return () => { document.title = prev }
  }, [child])

  if (!child) return <div className="empty" style={{ marginTop: 24 }}><p>Ребёнок не найден.</p><a className="btn-ghost" href={href('/')}>К списку детей</a></div>
  const back = <a className="btn-ghost" href={href(`/child/${child.id}`)}><ArrowIcon style={{ transform: 'rotate(180deg)' }} /> К карте ребёнка</a>
  if (!filled.length) return <div className="empty" style={{ marginTop: 24 }}><p>У ребёнка нет обследований — отчёт пока не из чего собрать.</p>{back}</div>

  const group = db.groups.find((g) => g.id === child.groupId)
  const period = db.periods.find((p) => p.id === periodId)
  const compare = db.periods.find((p) => p.id === compareId) || null
  const cur = scoresOf(db, child.id, period.id)
  const prev = compare ? scoresOf(db, child.id, compare.id) : null
  const saved = programOf(db, child.id, period.id)
  const program = buildProgram(cur, saved)
  const library = libraryOf(db)
  const res = prev ? outcome(blockMean(SPEECH_SECTIONS, prev), blockMean(SPEECH_SECTIONS, cur)) : null
  const shownBlocks = BLOCKS.filter((b) => parts[b.id])
  const cLabel = compare ? periodLabel(compare) : ''
  const pLabel = periodLabel(period)

  const axes = (sections) => sections.map((s) => ({
    label: s.short, full: s.title,
    start: prev ? sectionStats(s, prev).mean : null,
    end: sectionStats(s, cur).mean,
  }))

  const print = () => window.print()

  const downloadHtml = async () => {
    setBusy(true)
    try {
      const clone = docRef.current.cloneNode(true)
      clone.querySelectorAll('.no-print, .chart-tip').forEach((e) => e.remove())
      const img = clone.querySelector('img.doc-logo')
      if (img) {
        const blob = await (await fetch(img.getAttribute('src'))).blob()
        img.src = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
      }
      const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\n') } catch { return '' } }).join('\n')
      const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${child.name} — результаты диагностики</title>`
        + '<link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">'
        + `<style>${css}</style></head><body><div class="app-shell"><div class="app-card">${clone.outerHTML}</div></div></body></html>`
      downloadText(`${child.name} — результаты диагностики, ${pLabel}.html`, html, 'text/html;charset=utf-8')
    } finally {
      setBusy(false)
    }
  }

  const downloadXlsx = () => {
    const summary = [['Раздел', ...filled.map((p) => periodLabel(p))]]
    for (const b of BLOCKS) {
      summary.push([b.title.toUpperCase()])
      for (const s of b.sections.filter(isScored)) {
        summary.push([s.title, ...filled.map((p) => { const st = sectionStats(s, scoresOf(db, child.id, p.id)); return st.level === null ? null : `${st.level} (ср. ${fmt(st.mean)})` })])
      }
    }
    const probes = [['Раздел', 'Проба', ...filled.map((p) => periodLabel(p))]]
    for (const s of ALL_SECTIONS) {
      for (const item of sectionItems(s)) {
        probes.push([s.title, item.label, ...filled.map((p) => {
          const v = scoresOf(db, child.id, p.id)[item.id]
          if (v === undefined) return null
          return s.kind === 'scale' ? v : valueText(s, v)?.label ?? null
        })])
      }
    }
    const prog = [['Раздел', 'Проба', 'Отметка', 'Упражнения', 'Дополнение специалиста']]
    for (const { sections } of program.blocks) {
      for (const { section, items } of sections) {
        for (const { item, mark, off } of items) {
          if (!off) prog.push([section.title, item.label, mark?.label ?? '', exerciseLines(library[item.id]).join('\n'), saved.notes?.[item.id] || ''])
        }
      }
    }
    prog.push([], ['Рекомендации специалиста', saved.recs || ''], ['Рекомендации родителям', saved.home || ''])
    const head = [`${child.name}${child.birthDate ? `, ${ageText(child.birthDate)}` : ''} · ${group?.name || ''}`]
    const contacts = [['Кем приходится', 'ФИО', 'Телефоны', 'Эл. почта', 'Адреса', 'Законный представитель', 'Примечание'], ...(child.relatives || []).map((r) => [r.role, r.name, phonesText(r), emailsText(r), addressesText(r), r.legal ? 'да' : 'нет', r.note])]
    exportSheets(`${child.name} — диагностика.xlsx`, [
      { name: 'Уровни', rows: [head, [], ...summary], widths: [44, ...filled.map(() => 18)] },
      { name: 'Пробы', rows: [head, [], ...probes], widths: [30, 52, ...filled.map(() => 18)] },
      { name: 'Родители', rows: [head, [], ...contacts], widths: [18, 34, 36, 28, 50, 12, 40] },
      { name: `Программа ${period.point} ${period.year.slice(2, 4)}-${period.year.slice(-2)}`, rows: [head, [], ...prog], widths: [30, 44, 22, 80, 40] },
    ])
  }

  return (
    <>
      <div className="parent-bar no-print">
        {back}
        <span className="faint">Режим показа: на странице только данные этого ребёнка.</span>
      </div>

      <div className="no-print">
        <div className="filters">
          <FilterCard label="Срез">
            <Dropdown label="Срез" value={period.id} options={filled.map((p) => ({ value: p.id, label: periodLabel(p) }))} onChange={(id) => { setPeriodId(id); const i = filled.findIndex((p) => p.id === id); setCompareId(i > 0 ? filled[i - 1].id : '') }} />
          </FilterCard>
          <FilterCard label="Сравнить с">
            <Dropdown label="Сравнить с" value={compareId} options={[{ value: '', label: 'без сравнения' }, ...filled.filter((p) => p.id !== period.id).map((p) => ({ value: p.id, label: periodLabel(p) }))]} onChange={setCompareId} />
          </FilterCard>
        </div>
        <div className="checks" role="group" aria-label="Что включить в отчёт">
          {PARTS.map((p) => (
            <label key={p.key} className="check">
              <input type="checkbox" checked={parts[p.key]} onChange={() => setParts({ ...parts, [p.key]: !parts[p.key] })} /> {p.label}
            </label>
          ))}
        </div>
        <div className="toolbar" style={{ margin: '4px 0 22px' }}>
          <button className="btn-primary" onClick={print}><PrintIcon /> Печать / PDF</button>
          <button className="btn-ghost" onClick={downloadHtml} disabled={busy}><DownloadIcon /> {busy ? 'Готовлю файл…' : 'Файл для родителей (.html)'}</button>
          <button className="btn-ghost" onClick={downloadXlsx}><DownloadIcon /> Excel по ребёнку</button>
        </div>
      </div>

      <article className="doc" ref={docRef}>
        <header className="doc-head">
          <div className="doc-brand"><img className="doc-logo" src="./favicon.png" alt="" width="28" height="28" /> Росток · результаты диагностики</div>
          <h1>{child.name}</h1>
          <dl className="doc-meta">
            {child.birthDate && <div><dt>Дата рождения</dt><dd>{new Date(child.birthDate).toLocaleDateString('ru-RU')} ({ageText(child.birthDate)})</dd></div>}
            {group && <div><dt>Группа</dt><dd>{group.name}</dd></div>}
            <div><dt>Обследование</dt><dd>{period.year}, {POINT_NAMES[period.point]}</dd></div>
            {compare && <div><dt>Сравнение с</dt><dd>{compare.year}, {POINT_NAMES[compare.point]}</dd></div>}
            {child.relatives?.some((r) => r.legal) && <div><dt>Законные представители</dt><dd>{child.relatives.filter((r) => r.legal).map((r) => [r.role, r.name].filter(Boolean).join(' ')).join('; ')}</dd></div>}
          </dl>
        </header>

        {(parts.speech || parts.neuro || parts.details) && (
          <section className="doc-section">
            <h2>Как читать результаты</h2>
            <ul className="doc-legend">
              {LEVEL.map((l, i) => <li key={i}><Level value={i} /> {PARENT_LEVEL[i]}</li>)}
            </ul>
            {res && <p className="doc-outcome">Итог по речевому развитию за период: <b>{res.label}</b> (средний балл {fmt(blockMean(SPEECH_SECTIONS, prev))} → {fmt(blockMean(SPEECH_SECTIONS, cur))}; меньше — ближе к норме).</p>}
          </section>
        )}

        {shownBlocks.map((b) => {
          const sections = b.sections.filter(isScored)
          const mA = prev ? blockMean(b.sections, prev) : null
          const mB = blockMean(b.sections, cur)
          return (
            <section className="doc-section" key={b.id}>
              <div className="block-head"><h2>{b.title}</h2><span className="doc-score">{fmt(mB)} <Level value={levelOf(mB)} /> {prev && <Delta from={mA} to={mB} />}</span></div>
              <div className="table-scroll">
                <table className="tbl tbl--free doc-table">
                  <thead><tr><th>Раздел</th>{compare && <th className="c">{periodShort(compare)}</th>}<th className="c">{periodShort(period)}</th><th className="doc-mean">Что это значит</th></tr></thead>
                  <tbody>
                    {sections.map((s) => {
                      const now = sectionStats(s, cur)
                      return (
                        <tr key={s.id}>
                          <td className="name">{s.title}{now.level !== null && <span className="doc-mean-inline">{PARENT_LEVEL[now.level]}</span>}</td>
                          {compare && <td className="c"><Level value={sectionStats(s, prev).level} /></td>}
                          <td className="c"><Level value={now.level} /></td>
                          <td className="doc-mean">{now.level === null ? <span className="faint">не обследовалось</span> : PARENT_LEVEL[now.level]}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="chart-grid doc-charts">
                {b.id === 'speech' ? (
                  <>
                    <div>
                      <p className="chart-title">Речевой профиль: чем ближе к центру, тем ближе к норме</p>
                      <div style={{ maxWidth: 420, margin: '0 auto' }}><Radar axes={axes(SPEECH_SECTIONS)} startLabel={cLabel || '—'} endLabel={pLabel} /></div>
                    </div>
                    <div>
                      <p className="chart-title">Средний балл по речи на каждом обследовании</p>
                      <TrendLine points={filled.map((p) => ({ label: periodShort(p), value: blockMean(SPEECH_SECTIONS, scoresOf(db, child.id, p.id)) }))} />
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p className="chart-title">Средний балл по сферам</p>
                    <Dumbbell rows={axes(NEURO_SCORED)} startLabel={cLabel || '—'} endLabel={pLabel} />
                  </div>
                )}
              </div>
            </section>
          )
        })}

        {parts.details && (
          <section className="doc-section">
            <h2>Результаты по пробам</h2>
            {ALL_SECTIONS.filter((s) => parts[s.blockId] || (!parts.speech && !parts.neuro)).map((s) => {
              const items = sectionItems(s).filter((i) => cur[i.id] !== undefined || prev?.[i.id] !== undefined)
              if (!items.length) return null
              return (
                <div className="doc-probes" key={s.id}>
                  <h3 className="h3">{s.title}</h3>
                  <table className="tbl tbl--free doc-table">
                    <thead><tr><th>Проба</th>{compare && <th className="c">{periodShort(compare)}</th>}<th className="c">{periodShort(period)}</th></tr></thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i.id}>
                          <td>{s.kind === 'sound' ? `Звук [${i.label}]` : i.label}</td>
                          {compare && <td className="c"><Cell section={s} value={prev[i.id]} /></td>}
                          <td className="c"><Cell section={s} value={cur[i.id]} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </section>
        )}

        {parts.program && (
          <section className="doc-section">
            <h2>Программа коррекции</h2>
            {!program.active ? <p className="faint">По результатам обследования коррекционных упражнений не требуется.</p> : program.blocks.map(({ block, sections }) => (
              <div key={block.id}>
                {sections.map(({ section, items, direction }) => {
                  const on = items.filter((i) => !i.off)
                  if (!on.length) return null
                  return (
                    <div className="program-section" key={section.id}>
                      <div className="program-head"><b>{section.title}</b></div>
                      {direction && <p className="program-direction">Направление работы: {direction}.</p>}
                      {on.map(({ item }) => {
                        const lines = exerciseLines(library[item.id])
                        const note = saved.notes?.[item.id]
                        return (
                          <div className="program-item" key={item.id}>
                            <p className="program-label" style={{ margin: '0 0 4px' }}>{section.kind === 'sound' ? <>Звук <b className="num">[{item.label}]</b></> : item.label}</p>
                            {(lines.length > 0 || note) && (
                              <ol className="exercise-list">
                                {lines.map((l, k) => <li key={k}>{l}</li>)}
                                {note && exerciseLines(note).map((l, k) => <li key={`n${k}`}>{l}</li>)}
                              </ol>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </section>
        )}

        {parts.recs && (saved.recs || saved.home) && (
          <section className="doc-section">
            <h2>Рекомендации</h2>
            {saved.recs && <><h3 className="h3">Рекомендации специалиста</h3><p className="doc-text">{saved.recs}</p></>}
            {saved.home && <><h3 className="h3">Занятия дома</h3><p className="doc-text">{saved.home}</p></>}
          </section>
        )}

        <footer className="doc-foot">
          <span>Дата: {new Date().toLocaleDateString('ru-RU')}</span>
          <span>Специалист: ______________________</span>
        </footer>
      </article>
    </>
  )
}
