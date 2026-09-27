import { useEffect, useRef, useState } from 'react'
import { actions, childrenOf, periodLabel, scoresOf } from '../lib/store'
import { useSelection, setUi } from '../lib/ui'
import { ALL_SECTIONS, BLOCKS, SECTION_BY_ID, isScored, optionsFor, sectionItems } from '../data/methodology'
import { fmt, itemScore, levelDistribution, sectionStats } from '../lib/calc'
import { exportSheets } from '../lib/excel'
import Dropdown from '../ui/Dropdown'
import FilterCard from '../ui/FilterCard'
import { GroupFilter, PeriodFilter } from '../components/Selectors'
import { DistBar, Level } from '../ui/Level'
import { DownloadIcon } from '../ui/Icons'

export default function ProtocolPage({ db }) {
  const { group, period, sectionId } = useSelection(db)
  const section = SECTION_BY_ID[sectionId] || ALL_SECTIONS[0]
  const kids = group ? childrenOf(db, group.id) : []
  const items = sectionItems(section)
  const options = optionsFor(section)
  const [active, setActive] = useState({ r: 0, c: 0 })
  const table = useRef(null)
  const scored = isScored(section)

  const markOf = (value, activeRow) => {
    if (value === undefined) return activeRow ? '·' : ''
    return options.find((o) => o.value === value)?.mark ?? '·'
  }
  const clsOf = (value) => {
    const s = itemScore(section, value)
    return s === null ? '' : ` lvl-${s}`
  }
  const cycle = (child, item) => {
    const cur = scoresOf(db, child.id, period.id)[item.id]
    const i = options.findIndex((o) => o.value === cur)
    const next = i === options.length - 1 ? null : options[i + 1].value
    actions.setScore(child.id, period.id, item.id, next)
  }

  useEffect(() => {
    table.current?.querySelector(`[data-cell="${active.r}:${active.c}"]`)?.focus({ preventScroll: false })
  }, [active])

  const onKey = (e, r, c) => {
    const move = (dr, dc) => {
      e.preventDefault()
      setActive({ r: Math.max(0, Math.min(kids.length - 1, r + dr)), c: Math.max(0, Math.min(items.length - 1, c + dc)) })
    }
    if (e.key === 'ArrowRight') return move(0, 1)
    if (e.key === 'ArrowLeft') return move(0, -1)
    if (e.key === 'ArrowDown') return move(1, 0)
    if (e.key === 'ArrowUp') return move(-1, 0)
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); return cycle(kids[r], items[c]) }
    if (e.key === 'Backspace' || e.key === 'Delete') { actions.setScore(kids[r].id, period.id, items[c].id, null); return undefined }
    if (/^\d$/.test(e.key)) {
      const n = Number(e.key)
      const opt = section.kind === 'scale' ? options[n] : options[n - 1]
      if (!opt) return undefined
      actions.setScore(kids[r].id, period.id, items[c].id, opt.value)
      // как в Excel: после ввода — вправо, в конце строки — на следующего ребёнка
      if (c < items.length - 1) move(0, 1)
      else if (r < kids.length - 1) { e.preventDefault(); setActive({ r: r + 1, c: 0 }) }
    }
    return undefined
  }

  const exportXlsx = () => {
    const sheets = ALL_SECTIONS.map((s) => {
      const its = sectionItems(s)
      const opts = optionsFor(s)
      const head = ['№', 'Ребёнок', ...its.map((i) => i.label), ...(isScored(s) ? ['Сумма', 'Среднее', 'Уровень'] : [])]
      const rows = kids.map((k, i) => {
        const sc = scoresOf(db, k.id, period.id)
        const st = sectionStats(s, sc)
        const cells = its.map((it) => {
          const v = sc[it.id]
          if (v === undefined) return null
          return s.kind === 'scale' ? v : opts.find((o) => o.value === v)?.label ?? null
        })
        return [i + 1, k.name, ...cells, ...(isScored(s) ? [st.counted ? st.sum : null, st.mean === null ? null : Number(st.mean.toFixed(2)), st.level] : [])]
      })
      return { name: s.short, rows: [[`${s.title} · ${group.name} · ${periodLabel(period)}`], head, ...rows], widths: [4, 26, ...its.map(() => 12), 8, 9, 9] }
    })
    exportSheets(`Протоколы — ${group.name} — ${periodLabel(period)}.xlsx`, sheets)
  }

  const { dist, n } = scored && period ? levelDistribution(section, kids.map((k) => k.id), (id) => scoresOf(db, id, period.id)) : { dist: [0, 0, 0, 0], n: 0 }
  const counts = options.map((o) => kids.reduce((a, k) => a + items.filter((i) => scoresOf(db, k.id, period?.id)[i.id] === o.value).length, 0))
  let col = -1

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Протокол группы</h1>
          <p className="subtitle">Таблица как в Excel: дети по строкам, пробы по столбцам. Нажатие по ячейке перебирает отметки; с клавиатуры — цифры, стрелки, Backspace. Сумма, среднее и уровень считаются сами.</p>
        </div>
        <div className="page-actions">
          <button className="btn-ghost" onClick={exportXlsx} disabled={!kids.length}><DownloadIcon /> Выгрузить протоколы в Excel</button>
        </div>
      </div>

      <div className="filters">
        <GroupFilter db={db} group={group} />
        <PeriodFilter db={db} period={period} />
        <FilterCard label="Раздел" wide>
          <Dropdown label="Раздел" value={section.id} onChange={(id) => { setUi({ sectionId: id }); setActive({ r: 0, c: 0 }) }}
            options={ALL_SECTIONS.map((s) => ({ value: s.id, label: `${s.blockId === 'neuro' ? 'Нейро · ' : ''}${s.title}` }))} />
        </FilterCard>
      </div>

      {!kids.length ? (
        <div className="empty"><p>В группе нет детей: протокол появится после добавления списка.</p></div>
      ) : (
        <section className="card" style={{ borderTop: 0, paddingTop: 18 }}>
          <div className="table-scroll">
            <table className="matrix-table" ref={table}>
              <thead>
                {section.groups.length > 1 && (
                  <tr>
                    <th className="rowhead" style={{ borderBottom: 0 }} />
                    {section.groups.map((gr) => <th key={gr.title} className="grp" colSpan={gr.items.length}>{gr.title}</th>)}
                    {scored && <th colSpan={3} style={{ borderBottom: 0 }} />}
                    <th className="filler" style={{ borderBottom: 0 }} />
                  </tr>
                )}
                <tr>
                  <th className="rowhead">Ребёнок</th>
                  {section.groups.map((gr) => gr.items.map((item, i) => {
                    col += 1
                    return section.kind === 'sound'
                      ? <th key={item.id} className={`hsound${i === 0 ? ' first-in-grp' : ''}`} data-tip={item.label}>{item.short}</th>
                      : <th key={item.id} className={i === 0 ? 'first-in-grp' : ''} data-tip={item.label}><div className={`vhead${col === active.c ? ' is-col' : ''}`}>{item.short}</div></th>
                  }))}
                  {scored && <><th className="sum first-in-grp">Σ</th><th className="sum">ср.</th><th className="sum">ур.</th></>}
                  <th className="filler" />
                </tr>
              </thead>
              <tbody>
                {kids.map((k, r) => {
                  const sc = scoresOf(db, k.id, period.id)
                  const st = sectionStats(section, sc)
                  let c = -1
                  return (
                    <tr key={k.id} className={r === active.r ? 'is-row' : ''}>
                      <th className="rowhead" scope="row">{k.name}</th>
                      {section.groups.map((gr) => gr.items.map((item, i) => {
                        c += 1
                        const cc = c
                        const v = sc[item.id]
                        return (
                          <td key={item.id} className={i === 0 ? 'first-in-grp' : ''}>
                            <div role="button" tabIndex={r === active.r && cc === active.c ? 0 : -1} data-cell={`${r}:${cc}`}
                              aria-label={`${k.name}, ${item.label}: ${v === undefined ? 'пусто' : options.find((o) => o.value === v)?.label}`}
                              className={`mcell${v === undefined ? ' is-empty' : ''}${clsOf(v)}`}
                              onClick={() => { setActive({ r, c: cc }); cycle(k, item) }}
                              onFocus={() => (active.r !== r || active.c !== cc) && setActive({ r, c: cc })}
                              onKeyDown={(e) => onKey(e, r, cc)}>
                              {markOf(v, r === active.r)}
                            </div>
                          </td>
                        )
                      }))}
                      {scored && <><td className="sum first-in-grp">{st.counted ? st.sum : '—'}</td><td className="sum">{fmt(st.mean)}</td><td className="sum"><Level value={st.level} /></td></>}
                      <td className="filler" />
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {options.map((o, oi) => (
                  <tr key={o.value}>
                    <th className="rowhead" scope="row"><span className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{o.mark}</span> — {o.label.split(',')[0].split(':')[0]}</th>
                    {items.map((item) => <td key={item.id} className="num muted">{kids.filter((k) => scoresOf(db, k.id, period.id)[item.id] === o.value).length || ''}</td>)}
                    {scored && <td colSpan={3} className="sum" style={{ textAlign: 'right' }}>{counts[oi]}</td>}
                    <td className="filler" />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>

          {scored && (
            <div style={{ maxWidth: 520, marginTop: 22 }}>
              <span className="caps">Дети по уровням раздела · {n} из {kids.length}</span>
              <div style={{ margin: '8px 0 6px' }}><DistBar dist={dist} n={n} /></div>
              <div className="dist-nums" style={{ display: 'flex' }}>{dist.map((v, i) => <span key={i}><Level value={i} /> {v}</span>)}</div>
            </div>
          )}
        </section>
      )}
    </>
  )
}
