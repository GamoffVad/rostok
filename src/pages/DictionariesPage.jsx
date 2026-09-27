import { useState } from 'react'
import { actions } from '../lib/store'
import { useUi, setUi } from '../lib/ui'
import { DICTS, DICT_BY_ID, changedCount, defaultList, defaultValue } from '../lib/dicts'
import { ALL_SECTIONS } from '../data/methodology'
import Dropdown from '../ui/Dropdown'
import { Level } from '../ui/Level'
import { PlusIcon, TrashIcon } from '../ui/Icons'

const GROUPS = [...new Set(DICTS.map((d) => d.group))]

export default function DictionariesPage({ db }) {
  const ui = useUi()
  const dict = DICT_BY_ID[ui.dictId] || DICTS[0]
  const overrides = db.dicts || {}
  const [ask, setAsk] = useState(false)
  const changed = changedCount(dict.id, overrides)

  return (
    <div className="split split--300">
      <aside className="panel sticky-side">
        <div className="dict-nav">
          {GROUPS.map((g) => (
            <div key={g}>
              <span className="caps" style={{ display: 'block', padding: '12px 0 6px' }}>{g}</span>
              {DICTS.filter((d) => d.group === g).map((d) => {
                const n = changedCount(d.id, overrides)
                return (
                  <button key={d.id} className={`tree-row${d.id === dict.id ? ' is-active' : ''}`} onClick={() => { setUi({ dictId: d.id }); setAsk(false) }}>
                    <span className="tree-name">{d.title}</span>
                    {n > 0 && <span className="tree-count dict-changed" data-tip="Есть изменения">изм. {d.type === 'list' ? '' : n}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </aside>

      <section className="panel">
        <div className="block-head">
          <h2>{dict.title}</h2>
          <span className="toolbar">
            {changed > 0 && (ask ? (
              <>
                <button className="text-action danger" onClick={() => { actions.resetDict(dict.id); setAsk(false) }}><span>да, вернуть все значения по умолчанию</span></button>
                <button className="text-action" onClick={() => setAsk(false)}><span>отмена</span></button>
              </>
            ) : <button className="text-action" onClick={() => setAsk(true)}><span>вернуть значения по умолчанию</span></button>)}
          </span>
        </div>
        {dict.hint && <p className="faint" style={{ margin: '0 0 12px', maxWidth: 720 }}>{dict.hint}</p>}
        {dict.type === 'list'
          ? <ListEditor key={dict.id} dict={dict} value={Array.isArray(overrides[dict.id]) ? overrides[dict.id] : null} />
          : <TableEditor key={dict.id} dict={dict} overrides={overrides[dict.id] || {}} ui={ui} />}
        <p className="help-note" style={{ marginTop: 20 }}>Правки сохраняются сразу и видны на всех экранах, в отчётах и выгрузках. Очистите поле — вернётся значение по умолчанию (оно показано серым). Словари входят в резервную копию на вкладке «Данные».</p>
      </section>
    </div>
  )
}

function TableEditor({ dict, overrides, ui }) {
  const sections = ALL_SECTIONS
  const sectionId = dict.filterBySection ? (sections.some((s) => s.id === ui.dictSection) ? ui.dictSection : sections[0].id) : null
  const rows = dict.rows().filter((r) => !sectionId || r.section === sectionId)

  return (
    <>
      {dict.filterBySection && (
        <div className="dict-filter">
          <span className="field-label">Раздел</span>
          <Dropdown variant="light" label="Раздел" value={sectionId} onChange={(id) => setUi({ dictSection: id })}
            options={sections.map((s) => ({ value: s.id, label: `${s.blockId === 'neuro' ? 'Нейро · ' : ''}${s.title}` }))} />
        </div>
      )}
      <div className="table-scroll">
        <table className="tbl tbl--free dict-table">
          <thead>
            <tr>
              <th className="dict-lead">Код</th>
              {dict.fields.map((f) => <th key={f.key}>{f.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowOv = overrides[row.key] || {}
              return (
                <tr key={row.key} className={Object.keys(rowOv).length ? 'is-changed' : ''}>
                  <td className="dict-lead">{row.level !== undefined ? <Level value={row.level} /> : null} <span className="num muted">{row.lead}</span></td>
                  {dict.fields.map((f) => {
                    const def = defaultValue(dict.id, row.key, f.key)
                    // короткие знаки — однострочное поле; остальное переносится по ширине, Enter не добавляет строку
                    const short = Boolean(f.max)
                    const value = rowOv[f.key] ?? def
                    const props = {
                      className: `input${f.narrow ? ' dict-narrow' : ''}`,
                      value,
                      placeholder: def,
                      maxLength: f.max,
                      'aria-label': `${f.label}: ${row.key}`,
                      onChange: (e) => actions.setDictValue(dict.id, row.key, f.key, f.multiline ? e.target.value : e.target.value.replace(/\r?\n/g, ' '), def),
                      onKeyDown: (e) => { if (e.key === 'Enter' && !f.multiline) e.preventDefault() },
                    }
                    return (
                      <td key={f.key} className={f.narrow ? 'dict-narrow-cell' : ''} data-label={f.label}>
                        {short ? <input {...props} /> : <textarea rows={1} {...props} />}
                        {rowOv[f.key] !== undefined && rowOv[f.key] !== def && (
                          <span className="dict-default">по умолчанию: {def || '—'}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ListEditor({ dict, value }) {
  const list = value ?? defaultList(dict.id)
  const save = (next) => actions.setDictList(dict.id, next)
  const move = (i, d) => {
    const next = [...list]
    const [x] = next.splice(i, 1)
    next.splice(i + d, 0, x)
    save(next)
  }
  return (
    <div className="dict-list">
      {list.map((item, i) => (
        <div className="dict-list-row" key={i}>
          <span className="num muted dict-list-num">{i + 1}</span>
          <input className="input" value={item} onChange={(e) => save(list.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`${dict.title}: ${i + 1}`} />
          <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Выше" data-tip="Выше">↑</button>
          <button type="button" className="icon-btn" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Ниже" data-tip="Ниже">↓</button>
          <button type="button" className="icon-btn danger" onClick={() => save(list.filter((_, k) => k !== i))} aria-label="Удалить" data-tip="Удалить"><TrashIcon /></button>
        </div>
      ))}
      <button type="button" className="btn-ghost" style={{ justifySelf: 'start' }} onClick={() => save([...list, ''])}><PlusIcon /> Добавить значение</button>
    </div>
  )
}
