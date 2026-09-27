import { useState } from 'react'
import FilePick from '../ui/FilePick'
import { actions, libraryOf } from '../lib/store'
import { useUi, setUi } from '../lib/ui'
import { ALL_SECTIONS, BLOCKS, SECTION_BY_ID, sectionItems } from '../data/methodology'
import { EXAMPLE_LIBRARY } from '../data/exercises'
import { exerciseLines } from '../lib/program'
import { exportLibraryTemplate, importLibraryTemplate } from '../lib/excel'
import { DownloadIcon, UploadIcon } from '../ui/Icons'

const ALL_IDS = new Set(ALL_SECTIONS.flatMap((s) => sectionItems(s).map((i) => i.id)))
// Разделы без балльной оценки в программу не попадают — упражнения к ним не нужны.
// Высота поля по тексту — для браузеров без field-sizing.
const rowsFor = (text) => Math.max(2, (text || '').split(/\r?\n/).reduce((n, l) => n + Math.ceil((l.length || 1) / 80), 0))
const WITH_EXERCISES = (s) => s.kind !== 'yesno' && s.kind !== 'side'

export default function LibraryPage({ db }) {
  const ui = useUi()
  const library = libraryOf(db)
  const sections = ALL_SECTIONS.filter(WITH_EXERCISES)
  const section = SECTION_BY_ID[ui.librarySection] && WITH_EXERCISES(SECTION_BY_ID[ui.librarySection]) ? SECTION_BY_ID[ui.librarySection] : sections[0]
  const [status, setStatus] = useState(null)
  const [ask, setAsk] = useState(null)

  const filledIn = (s) => sectionItems(s).filter((i) => exerciseLines(library[i.id]).length).length
  const totalFilled = sections.reduce((a, s) => a + filledIn(s), 0)
  const totalItems = sections.reduce((a, s) => a + sectionItems(s).length, 0)

  const onFile = async (f) => {
    if (!f) return
    try {
      const patch = await importLibraryTemplate(f, ALL_IDS)
      actions.setLibrary({ ...library, ...patch })
      setStatus({ ok: true, text: `Загружено упражнений для проб: ${Object.keys(patch).length}. Пустые ячейки шаблона ничего не стёрли.` })
    } catch (err) {
      setStatus({ ok: false, text: err.message || 'Не удалось прочитать файл.' })
    } finally {
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Упражнения</h1>
          <p className="subtitle">Библиотека: к каждой диагностической пробе — свой блок упражнений. Из неё собирается программа коррекции ребёнка по выявленным дефицитам. Одна строка — одно упражнение; изменения сохраняются сразу.</p>
        </div>
        <div className="page-actions">
          <button className="btn-ghost" onClick={() => exportLibraryTemplate(BLOCKS, library)}><DownloadIcon /> Шаблон Excel</button>
          <FilePick accept=".xls,.xlsx" onFile={onFile}><UploadIcon /> Загрузить из Excel</FilePick>
        </div>
      </div>
      {status && <p className={`status ${status.ok ? 'ok' : 'bad'}`} role="status">{status.text}</p>}
      <p className="help-note" style={{ marginTop: 0 }}>
        Сейчас заполнено <b className="num">{totalFilled}</b> из <span className="num">{totalItems}</span> проб. {db.library === undefined && 'Это образцы: замените их своими или очистите библиотеку. '}
        Удобно заполнять в Excel: выгрузите шаблон, впишите упражнения в последнюю колонку (новая строка в ячейке — Alt+Enter) и загрузите файл обратно.
      </p>

      <div className="split split--300">
        <aside className="panel sticky-side">
          <div className="employee-list">
            {BLOCKS.map((b) => (
              <div key={b.id}>
                <span className="caps" style={{ display: 'block', padding: '12px 0 6px' }}>{b.title}</span>
                {b.sections.filter(WITH_EXERCISES).map((s) => {
                  const n = filledIn(s)
                  const all = sectionItems(s).length
                  return (
                    <button key={s.id} className={`tree-row${s.id === section.id ? ' is-active' : ''}`} onClick={() => setUi({ librarySection: s.id })}>
                      <span className="tree-name">{s.short}</span>
                      <span className={`tree-count${n === all ? ' full' : ''}`}>{n}/{all}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="toolbar" style={{ marginTop: 16 }}>
            {ask === 'clear' ? (
              <>
                <button className="text-action danger" onClick={() => { actions.setLibrary({}); setAsk(null) }}><span>да, очистить все упражнения</span></button>
                <button className="text-action" onClick={() => setAsk(null)}><span>отмена</span></button>
              </>
            ) : ask === 'reset' ? (
              <>
                <button className="text-action danger" onClick={() => { actions.setLibrary({ ...EXAMPLE_LIBRARY }); setAsk(null) }}><span>да, заменить образцами</span></button>
                <button className="text-action" onClick={() => setAsk(null)}><span>отмена</span></button>
              </>
            ) : (
              <>
                <button className="text-action" onClick={() => setAsk('reset')}><span>вернуть образцы</span></button>
                <button className="text-action danger" onClick={() => setAsk('clear')}><span>очистить всё</span></button>
              </>
            )}
          </div>
        </aside>

        <section className="panel">
          <div className="block-head"><h2>{section.title}</h2><span className="faint num">{filledIn(section)}/{sectionItems(section).length}</span></div>
          {section.groups.map((gr) => (
            <div className="probe-group" key={gr.title}>
              <span className="caps">{gr.title}</span>
              {gr.items.map((item) => (
                <label key={item.id} className="lib-row">
                  <span className="lib-label">{section.kind === 'sound' ? <>Звук <b className="num">[{item.label}]</b></> : item.label}</span>
                  <textarea className="input" rows={rowsFor(library[item.id])} value={library[item.id] || ''}
                    placeholder="Упражнения для этой пробы — каждое с новой строки"
                    onChange={(e) => actions.setExercise(item.id, e.target.value)} />
                </label>
              ))}
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
