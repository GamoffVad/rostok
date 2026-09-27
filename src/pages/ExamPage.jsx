import { useEffect, useMemo, useState } from 'react'
import { actions, childrenOf, periodLabel, scoresOf } from '../lib/store'
import { useSelection, setUi } from '../lib/ui'
import { go, href } from '../lib/router'
import { ALL_SECTIONS, BLOCKS, SECTION_BY_ID, isScored, optionsFor, sectionItems } from '../data/methodology'
import { fmt, sectionStats, totalProgress } from '../lib/calc'
import Dropdown from '../ui/Dropdown'
import FilterCard from '../ui/FilterCard'
import { GroupFilter, PeriodFilter } from '../components/Selectors'
import { Level } from '../ui/Level'
import { ArrowIcon } from '../ui/Icons'

export default function ExamPage({ db, childId }) {
  const { group, period, sectionId } = useSelection(db)
  const kids = group ? childrenOf(db, group.id) : []
  const child = kids.find((c) => c.id === childId) || kids[0] || null
  const section = SECTION_BY_ID[sectionId] || ALL_SECTIONS[0]
  const block = BLOCKS.find((b) => b.id === section.blockId)
  const [cursor, setCursor] = useState(0)

  const scores = child && period ? scoresOf(db, child.id, period.id) : {}
  const periodIndex = db.periods.findIndex((p) => p.id === period?.id)
  const prevPeriod = periodIndex > 0 ? db.periods[periodIndex - 1] : null
  const prevScores = child && prevPeriod ? scoresOf(db, child.id, prevPeriod.id) : null
  const items = useMemo(() => sectionItems(section), [section])
  const options = optionsFor(section)
  const stats = sectionStats(section, scores)

  useEffect(() => { setCursor(0) }, [section.id, child?.id])

  const setValue = (item, value) => {
    actions.setScore(child.id, period.id, item.id, scores[item.id] === value ? null : value)
  }

  // Клавиатура: цифра ставит отметку и переводит к следующей пробе.
  useEffect(() => {
    if (!child || !period) return undefined
    const onKey = (e) => {
      if (e.target.closest('input, textarea, [role="listbox"], .dd')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(items.length - 1, c + 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); return }
      if (e.key === 'Backspace' || e.key === 'Delete') { actions.setScore(child.id, period.id, items[cursor].id, null); return }
      if (!/^\d$/.test(e.key)) return
      const n = Number(e.key)
      const opt = section.kind === 'scale' ? options[n] : options[n - 1]
      if (!opt) return
      actions.setScore(child.id, period.id, items[cursor].id, opt.value)
      setCursor((c) => Math.min(items.length - 1, c + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [child, period, items, cursor, section, options])

  if (!child) {
    return <div className="empty" style={{ marginTop: 24 }}><p>В группе нет детей. Добавьте их на экране «Дети».</p><a className="btn-ghost" href={href('/')}>Перейти к списку</a></div>
  }

  const idx = kids.indexOf(child)
  const fillAll = (value) => actions.setMany(child.id, period.id, Object.fromEntries(items.map((i) => [i.id, value])))
  const copyPrev = () => {
    const patch = {}
    items.forEach((i) => { if (prevScores[i.id] !== undefined) patch[i.id] = prevScores[i.id] })
    actions.setMany(child.id, period.id, patch)
  }
  const progress = totalProgress(scores)
  const normValue = section.kind === 'scale' ? 0 : section.kind === 'sound' ? 'norm' : section.kind === 'yesno' ? 'no' : null
  const prevHasData = prevScores && items.some((i) => prevScores[i.id] !== undefined)
  let cursorBase = 0

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Обследование</h1>
          <p className="subtitle">Отмечайте балл нажатием или с клавиатуры: цифра ставит отметку и переходит к следующей пробе, стрелки ↑ ↓ — перемещение, Backspace — очистить. Всё сохраняется сразу.</p>
        </div>
        <div className="page-actions">
          <button className="btn-ghost" disabled={idx <= 0} onClick={() => go('/exam', { child: kids[idx - 1].id })}><ArrowIcon style={{ transform: 'rotate(180deg)' }} /> Предыдущий</button>
          <button className="btn-ghost" disabled={idx >= kids.length - 1} onClick={() => go('/exam', { child: kids[idx + 1].id })}>Следующий <ArrowIcon /></button>
        </div>
      </div>

      <div className="filters">
        <GroupFilter db={db} group={group} />
        <FilterCard label={`Ребёнок · ${idx + 1} из ${kids.length}`} wide>
          <Dropdown label="Ребёнок" value={child.id} options={kids.map((c) => ({ value: c.id, label: c.name }))} onChange={(id) => go('/exam', { child: id })} />
        </FilterCard>
        <PeriodFilter db={db} period={period} />
      </div>

      <div className="subtabs" role="tablist" aria-label="Блок методики">
        {BLOCKS.map((b) => (
          <button key={b.id} role="tab" aria-selected={b.id === block.id} onClick={() => setUi({ sectionId: b.sections[0].id })}>{b.title}</button>
        ))}
      </div>

      <div className="split split--main" style={{ marginTop: 0 }}>

        <section className="panel">
          <div className="type-tabs" role="tablist" aria-label="Раздел">
            {block.sections.map((s) => {
              const st = sectionStats(s, scores)
              return (
                <button key={s.id} role="tab" aria-selected={s.id === section.id} onClick={() => setUi({ sectionId: s.id })}>
                  {s.short} <span className={`count${st.filled === st.total ? ' full' : ''}`}>{st.filled}/{st.total}</span>
                </button>
              )
            })}
          </div>

          <div className="block-head" style={{ marginTop: 18 }}>
            <h2>{section.title}{isScored(section) && stats.mean !== null && <span className="num muted" style={{ fontWeight: 500, marginLeft: 10 }}>ср. {fmt(stats.mean)} <Level value={stats.level} /></span>}</h2>
            <span className="toolbar">
              {normValue !== null && <button className="text-action" onClick={() => fillAll(normValue)}><span>{section.kind === 'yesno' ? 'везде «нет»' : 'всё в норме'}</span></button>}
              {prevHasData && <button className="text-action" onClick={copyPrev}><span>как на срезе {periodLabel(prevPeriod)}</span></button>}
              {stats.filled > 0 && <button className="text-action danger" onClick={() => fillAll(null)}><span>очистить раздел</span></button>}
            </span>
          </div>
          {section.hint && <p className="faint" style={{ margin: '0 0 4px' }}>{section.hint}</p>}

          {section.groups.map((gr) => {
            const base = cursorBase
            cursorBase += gr.items.length
            return (
              <div className="probe-group" key={gr.title}>
                <span className="caps">{gr.title}</span>
                {gr.items.map((item, i) => {
                  const v = scores[item.id]
                  const prev = prevScores?.[item.id]
                  const prevOpt = prev !== undefined ? options.find((o) => o.value === prev) : null
                  const wide = section.kind === 'choice'
                  const pair = section.kind === 'side' || section.kind === 'yesno'
                  return (
                    <div key={item.id} className={`probe${v !== undefined ? ' is-done' : ''}${base + i === cursor ? ' is-current' : ''}`} onClick={() => setCursor(base + i)}>
                      <span className="probe-label">
                        {section.kind === 'sound' ? <b className="num" style={{ fontSize: 16 }}>{item.label}</b> : item.label}
                        {prevOpt && <span className="probe-prev"> · было: {section.kind === 'scale' ? prevOpt.mark : prevOpt.label}</span>}
                      </span>
                      <span className={`marks${wide ? ' marks--stack' : ''}`} role="group" aria-label={item.label}>
                        {options.map((o) => (
                          <button key={o.value} type="button" data-tip={o.label} aria-pressed={v === o.value}
                            className={`mark${wide ? ' mark--wide is-accent' : ''}${pair ? ' mark--wide mark--half is-accent' : ''}${section.kind === 'scale' && v === o.value ? ` lvl-${o.value}` : ''}${section.kind === 'sound' && v === o.value ? ` lvl-${o.score}` : ''}`}
                            onClick={() => setValue(item, o.value)}>
                            {section.kind === 'scale' || section.kind === 'sound' ? o.mark : o.label}
                          </button>
                        ))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          <ul className="legend">
            {(section.kind === 'scale' || section.kind === 'sound') && options.map((o) => (
              <li key={o.value}><span className="num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{o.mark}</span> {o.label}</li>
            ))}
          </ul>
        </section>

        <aside className="panel sticky-side">
          <div className="card" style={{ borderTop: 0, paddingTop: 20 }}>
            <div className="block-head"><h2>Сводка: {child.name}</h2><span className={`num ${progress.filled === progress.total ? 'ok' : 'muted'}`} style={{ fontSize: 12 }}>{progress.filled}/{progress.total}</span></div>
            {block.sections.map((s) => {
              const st = sectionStats(s, scores)
              return (
                <button key={s.id} className={`tree-row${s.id === section.id ? ' is-active' : ''}`} onClick={() => setUi({ sectionId: s.id })}>
                  <span className="tree-name">{s.short}</span>
                  {isScored(s) ? <><span className="num muted" style={{ fontSize: 12 }}>{fmt(st.mean)}</span><Level value={st.level} /></> : <span className="tree-count">{s.kind === 'yesno' && st.filled ? `есть: ${st.yes}` : ''}</span>}
                  <span className={`tree-count${st.filled === st.total ? ' full' : ''}`}>{st.filled}/{st.total}</span>
                </button>
              )
            })}
            <label className="field" style={{ marginTop: 16 }}>
              <span className="field-label">Наблюдения на срезе</span>
              <textarea className="input" rows={4} value={db.notes[child.id]?.[period.id] || ''} onChange={(e) => actions.setNote(child.id, period.id, e.target.value)} placeholder="Поведение на обследовании, контакт, утомляемость…" />
            </label>
            <a className="text-action" href={href(`/child/${child.id}`, { tab: 'report' })}><span>открыть заключение</span></a>
          </div>
        </aside>
      </div>
    </>
  )
}
