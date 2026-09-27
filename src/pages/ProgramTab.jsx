import { useState } from 'react'
import { actions, libraryOf, periodLabel, programOf, scoresOf } from '../lib/store'
import { href } from '../lib/router'
import { THRESHOLDS, buildProgram, exerciseLines } from '../lib/program'
import { fmt } from '../lib/calc'
import Dropdown from '../ui/Dropdown'
import FilterCard from '../ui/FilterCard'
import { Level } from '../ui/Level'
import { PrintIcon } from '../ui/Icons'
import Checkbox from '../ui/Checkbox'
import { setUi } from '../lib/ui'

export default function ProgramTab({ db, child, filled }) {
  const [periodId, setPeriodId] = useState(filled[filled.length - 1]?.id)
  const [editing, setEditing] = useState(null)
  const period = db.periods.find((p) => p.id === periodId)
  if (!period) return <div className="empty" style={{ marginTop: 20 }}><p>Программа собирается по результатам обследования. Сначала заполните хотя бы один срез.</p></div>

  const saved = programOf(db, child.id, period.id)
  const program = buildProgram(scoresOf(db, child.id, period.id), saved)
  const library = libraryOf(db)
  const set = (patch) => actions.setProgram(child.id, period.id, patch)
  const toggle = (id) => {
    const off = new Set(saved.off || [])
    if (off.has(id)) off.delete(id)
    else off.add(id)
    set({ off: [...off] })
  }
  const setNote = (id, text) => set({ notes: { ...(saved.notes || {}), [id]: text } })

  return (
    <>
      <div className="filters filters--fit" style={{ borderTop: 0 }}>
        <FilterCard label="Срез обследования">
          <Dropdown label="Срез" value={period.id} options={filled.map((p) => ({ value: p.id, label: periodLabel(p) }))} onChange={setPeriodId} />
        </FilterCard>
        <FilterCard label="Что считать дефицитом" wide>
          <Dropdown label="Порог" value={program.threshold} options={THRESHOLDS} onChange={(threshold) => set({ threshold })} />
        </FilterCard>
        <FilterCard label="В программе"><div className="dd-btn num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{program.active} из {program.total} проб</div></FilterCard>
      </div>

      <div className="toolbar no-print" style={{ margin: '18px 0 6px' }}>
        <a className="btn-primary" href={href(`/parent/${child.id}`, { period: period.id, only: 'program' })}><PrintIcon /> Печать программы</a>
        <a className="btn-ghost" href={href(`/parent/${child.id}`, { period: period.id })}>Отчёт для родителей</a>
      </div>
      <p className="faint" style={{ maxWidth: 680 }}>Программа строится по пробам с дефицитом: звуки — все, кроме нормы; остальные пробы — по выбранному порогу. Снимите отметку, чтобы исключить пробу; допишите свои упражнения к пробе или общие рекомендации внизу — всё сохраняется сразу.</p>

      {!program.total ? (
        <div className="empty"><p>На этом срезе дефицитов по выбранному порогу нет. Можно выбрать порог «уровень 1–3» или записать рекомендации ниже.</p></div>
      ) : program.blocks.map(({ block, sections }) => (
        <section className="card" key={block.id}>
          <div className="block-head"><h2>{block.title}</h2></div>
          {sections.map(({ section, items, level, mean, direction }) => (
            <div className="program-section" key={section.id}>
              <div className="program-head">
                <b>{section.title}</b>
                {level !== null && <span className="num muted" style={{ fontSize: 12 }}>ср. {fmt(mean)} <Level value={level} /></span>}
              </div>
              {direction && <p className="program-direction">Направление работы: {direction}.</p>}
              {items.map(({ item, mark, score, off }) => {
                const lines = exerciseLines(library[item.id])
                return (
                  <div key={item.id} className={`program-item${off ? ' is-off' : ''}`}>
                    <Checkbox className="program-check" checked={!off} onChange={() => toggle(item.id)}>
                      <span className="program-label">{section.kind === 'sound' ? <>Звук <b className="num">[{item.label}]</b></> : item.label}</span>
                      <span className={`lvl${score !== null ? ` lvl-${score}` : ' lvl-none'}`} data-tip={mark?.label}>{mark?.mark ?? '·'}</span>
                    </Checkbox>
                    {!off && (
                      <div className="program-body">
                        {lines.length ? (
                          <ol className="exercise-list">{lines.map((l, i) => <li key={i}>{l}</li>)}</ol>
                        ) : (
                          <p className="faint" style={{ margin: '0 0 8px' }}>
                            Упражнения для этой пробы ещё не заданы. <a href={href('/library')} onClick={() => setUi({ librarySection: section.id })}>Добавить в библиотеку</a>
                          </p>
                        )}
                        {saved.notes?.[item.id] || editing === item.id ? (
                          <textarea className="input" rows={2} autoFocus={editing === item.id} value={saved.notes?.[item.id] || ''}
                            onChange={(e) => setNote(item.id, e.target.value)} onBlur={() => setEditing(null)}
                            placeholder="Своё упражнение для этого ребёнка, дозировка, материал — каждое с новой строки" />
                        ) : (
                          <button className="text-action" onClick={() => setEditing(item.id)}><span>+ дополнить для этого ребёнка</span></button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </section>
      ))}

      <section className="card">
        <div className="block-head"><h2>Свои рекомендации</h2></div>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Рекомендации специалиста</span>
            <textarea className="input" rows={5} value={saved.recs || ''} onChange={(e) => set({ recs: e.target.value })}
              placeholder="Направления работы, формы и частота занятий, консультации смежных специалистов…" />
          </label>
          <label className="field">
            <span className="field-label">Рекомендации родителям (занятия дома)</span>
            <textarea className="input" rows={5} value={saved.home || ''} onChange={(e) => set({ home: e.target.value })}
              placeholder="Что делать дома: игры, упражнения, как часто, на что обратить внимание…" />
          </label>
        </div>
      </section>
    </>
  )
}
