import { useState } from 'react'
import FilePick from '../ui/FilePick'
import { actions, getDb } from '../lib/store'
import { downloadText, importLegacyWorkbook } from '../lib/excel'
import { buildDemo } from '../lib/demo'
import { DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from '../ui/Icons'

export default function DataPage({ db }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [askClear, setAskClear] = useState(false)
  const [askYear, setAskYear] = useState(null)

  const years = [...new Set(db.periods.map((p) => p.year))]
  const nextYear = () => {
    const last = years[years.length - 1]
    const y = last ? Number(last.slice(0, 4)) + 1 : new Date().getFullYear()
    return `${y}–${y + 1}`
  }
  const filledIn = (year) => {
    const ids = db.periods.filter((p) => p.year === year).map((p) => p.id)
    return db.children.filter((c) => ids.some((id) => Object.keys(db.scores[c.id]?.[id] || {}).length)).length
  }

  const onXls = async (f) => {
    if (!f) return
    setBusy(true)
    try {
      const { part, stats } = await importLegacyWorkbook(f)
      actions.merge(part)
      setStatus({ ok: true, text: `Загружено: «${stats.group}», детей — ${stats.children}, отметок — ${stats.cells}.` })
    } catch (err) {
      setStatus({ ok: false, text: err.message || 'Не удалось прочитать файл Excel.' })
    } finally {
      setBusy(false)
    }
  }
  const onJson = async (f) => {
    if (!f) return
    try {
      const data = JSON.parse(await f.text())
      if (!Array.isArray(data.groups) || !Array.isArray(data.children) || typeof data.scores !== 'object') throw new Error('bad')
      actions.replaceAll(data)
      setStatus({ ok: true, text: `Копия восстановлена: групп — ${data.groups.length}, детей — ${data.children.length}.` })
    } catch {
      setStatus({ ok: false, text: 'Это не резервная копия «Ростка»: выберите файл .json, выгруженный отсюда же.' })
    } finally {
    }
  }

  return (
    <>
      {status && <p className={`status ${status.ok ? 'ok' : 'bad'}`} role="status">{status.text}</p>}

      <section className="card" style={{ borderTop: 0 }}>
        <div className="block-head"><h2>Резервная копия</h2><span className="faint num">групп {db.groups.length} · детей {db.children.length}</span></div>
        <div className="toolbar">
          <button className="btn-primary" onClick={() => downloadText(`Росток — копия ${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(getDb()))}><DownloadIcon /> Выгрузить копию</button>
          <FilePick accept=".json,application/json" onFile={onJson}><UploadIcon /> Восстановить из копии</FilePick>
        </div>
        <p className="faint" style={{ marginTop: 10, maxWidth: 620 }}>Восстановление заменяет все текущие данные содержимым файла.</p>
      </section>

      <section className="card">
        <div className="block-head"><h2>Прежний файл Excel</h2></div>
        <p className="prose" style={{ marginTop: 0 }}>Книга «Динамика речевого развития» (листы «Звук…», «Л.Г.С.…», «Фонетика…») загружается как новая группа: переносятся фамилии и все проставленные баллы. В прежнем файле 3 означало норму — при загрузке шкала переводится в принятую здесь (0 — норма).</p>
        <div className="toolbar">
          <FilePick accept=".xls,.xlsx" disabled={busy} onFile={onXls}><UploadIcon /> {busy ? 'Читаю файл…' : 'Загрузить файл Excel'}</FilePick>
          <button className="btn-ghost" onClick={() => { actions.merge(buildDemo()); setStatus({ ok: true, text: 'Добавлена группа-пример с вымышленными детьми.' }) }}>Добавить группу-пример</button>
        </div>
      </section>

      <section className="card">
        <div className="block-head"><h2>Учебные годы и срезы</h2></div>
        <div className="table-scroll">
          <table className="tbl tbl--narrow">
            <thead><tr><th>Учебный год</th><th>Срезы</th><th className="r">Детей с данными</th><th /></tr></thead>
            <tbody>
              {years.map((y) => (
                <tr key={y}>
                  <td className="name num">{y}</td>
                  <td>НГ — начало года · КГ — конец года</td>
                  <td className="r num">{filledIn(y)}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    {askYear === y ? (
                      <>
                        <button className="text-action danger" onClick={() => { actions.removeYear(y); setAskYear(null) }}><span>удалить год и его баллы</span></button>{' · '}
                        <button className="text-action" onClick={() => setAskYear(null)}><span>отмена</span></button>
                      </>
                    ) : <button className="text-action" onClick={() => setAskYear(y)}><span>удалить</span></button>}
                  </td>
                </tr>
              ))}
              {!years.length && <tr><td colSpan={4} className="faint">пока нет</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="btn-ghost" onClick={() => actions.addYear(nextYear())}><PlusIcon /> Добавить {nextYear()}</button>
        </div>
      </section>

      <section className="card">
        <div className="block-head"><h2>Очистка</h2></div>
        <div className="toolbar">
          {askClear ? (
            <>
              <button className="btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { actions.clear(); setAskClear(false); setStatus({ ok: true, text: 'Все данные удалены из этого браузера.' }) }}><TrashIcon /> Да, удалить все группы, детей и баллы</button>
              <button className="btn-ghost" onClick={() => setAskClear(false)}>Отмена</button>
            </>
          ) : <button className="btn-ghost" onClick={() => setAskClear(true)}><TrashIcon /> Удалить все данные</button>}
        </div>
      </section>
    </>
  )
}
