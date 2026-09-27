import { useRef, useState } from 'react'
import { actions } from '../lib/store'
import { buildDemo } from '../lib/demo'
import { importLegacyWorkbook } from '../lib/excel'
import { PlusIcon, UploadIcon } from '../components/Icons'

export default function Welcome() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const file = useRef(null)

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    setError('')
    try {
      const { part } = await importLegacyWorkbook(f)
      actions.merge(part)
    } catch (err) {
      setError(err.message || 'Не удалось прочитать файл.')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>С чего начать</h1>
          <p className="subtitle">«Росток» заменяет таблицу Excel: вы отмечаете баллы, а суммы, уровни, сводная динамика, графики и черновик заключения считаются сами. Данные хранятся только в этом браузере.</p>
        </div>
      </div>

      <ol className="steps">
        <li><div><b>Создайте группу и список детей</b><span>Фамилии можно вставить списком из Excel или Word — по одной на строку.</span></div></li>
        <li><div><b>Проведите обследование</b><span>По одному ребёнку — на экране «Обследование», или всей группой в таблице — «Протокол группы». Клавиши 0–3 ставят балл и переходят к следующей пробе.</span></div></li>
        <li><div><b>Смотрите динамику</b><span>Сравнение начала и конца года по каждому ребёнку и группе, итог коррекционной работы, выгрузка в Excel.</span></div></li>
        <li><div><b>Распечатайте заключение</b><span>Черновик собирается из баллов: остаётся поправить формулировки.</span></div></li>
      </ol>

      <form className="form" style={{ maxWidth: 620 }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) actions.addGroup(name) }}>
        <label className="field">
          <span className="field-label">Название группы</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Группа № 11, логопедическая" />
        </label>
        <div className="form-actions">
          <button className="btn-primary" type="submit" disabled={!name.trim()}><PlusIcon /> Создать группу</button>
          <button className="btn-ghost" type="button" disabled={busy} onClick={() => file.current.click()}><UploadIcon /> {busy ? 'Читаю файл…' : 'Загрузить прежний файл Excel'}</button>
          <button className="btn-ghost" type="button" onClick={() => actions.merge(buildDemo())}>Открыть пример</button>
        </div>
        <input ref={file} type="file" accept=".xls,.xlsx" hidden onChange={onFile} />
        {error && <p className="status bad">{error}</p>}
      </form>
      <p className="faint" style={{ maxWidth: 620 }}>Прежний файл — это книга «Динамика речевого развития» с листами «Звук…», «Л.Г.С.…», «Фонетика…». Из неё переносятся дети и все проставленные баллы; шкала переводится автоматически.</p>
    </>
  )
}
