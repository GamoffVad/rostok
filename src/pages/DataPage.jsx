import { useCallback, useEffect, useState } from 'react'
import FilePick from '../ui/FilePick'
import Dropdown from '../ui/Dropdown'
import { actions, storageActions, useStorage } from '../lib/store'
import { downloadText, importLegacyWorkbook } from '../lib/excel'
import { buildDemo } from '../lib/demo'
import { DownloadIcon, HistoryIcon, LockIcon, PlusIcon, ShieldIcon, TrashIcon, UploadIcon } from '../ui/Icons'

const MIN_PASSWORD = 8
const AUTOLOCK = [5, 15, 30, 60, 0].map((m) => ({ value: m, label: m ? `через ${m} мин без действий` : 'не блокировать' }))
const REASONS = { daily: 'ежедневная', manual: 'вручную', 'before-restore': 'перед восстановлением', 'before-import': 'перед загрузкой Excel' }

const fmtDate = (t) => (t ? new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const fmtSize = (b) => (b == null ? '—' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`)
const isBackup = (d) => d && Array.isArray(d.groups) && Array.isArray(d.children) && typeof d.scores === 'object'

function PasswordField({ label, value, onChange, autoComplete = 'new-password', autoFocus }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="input" type="password" autoComplete={autoComplete} autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export default function DataPage({ db }) {
  const storage = useStorage()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [askClear, setAskClear] = useState(false)
  const [askYear, setAskYear] = useState(null)
  const [info, setInfo] = useState(null)
  const [snaps, setSnaps] = useState([])
  const [askSnap, setAskSnap] = useState(null)
  const [pw, setPw] = useState({ mode: null, old: '', next: '', again: '' })
  const [pending, setPending] = useState(null) // зашифрованный файл копии, ждёт пароль
  const [filePw, setFilePw] = useState('')

  const say = (ok, text) => setStatus({ ok, text })
  const refresh = useCallback(async () => {
    setInfo(await storageActions.info())
    setSnaps(await storageActions.listSnapshots())
  }, [])
  useEffect(() => { refresh() }, [refresh, db])

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

  const run = async (fn, okText) => {
    setBusy(true)
    try { await fn(); if (okText) say(true, okText) } catch (err) { say(false, err.message || 'Не получилось') } finally { setBusy(false); refresh() }
  }

  // ── Резервная копия
  const exportBackup = () => run(async () => {
    const text = await storageActions.exportBackup()
    const day = new Date().toISOString().slice(0, 10)
    downloadText(`Росток — копия ${day}${storage.encrypted ? ' (зашифрована)' : ''}.json`, text)
  }, storage.encrypted ? 'Копия выгружена в зашифрованном виде: открыть её можно только с паролем базы.' : 'Копия выгружена.')

  const restoreData = (data) => run(async () => {
    if (!isBackup(data)) throw new Error('Это не резервная копия «Ростка»: выберите файл .json, выгруженный отсюда же.')
    const kept = await storageActions.restore(data)
    say(true, `Копия восстановлена: групп — ${data.groups.length}, детей — ${data.children.length}.${kept ? ' Прежнее состояние сохранено точкой восстановления.' : ''}`)
  })

  const onJson = async (f) => {
    let obj
    try { obj = JSON.parse(await f.text()) } catch { say(false, 'Файл не читается: выберите копию .json, выгруженную из «Ростка».'); return }
    if (storageActions.isEncryptedBackup(obj)) { setPending(obj); setFilePw(''); setStatus(null); return }
    restoreData(obj)
  }
  const openPending = async () => {
    try {
      const data = await storageActions.readEncryptedBackup(pending, filePw)
      setPending(null)
      restoreData(data)
    } catch {
      say(false, 'Неверный пароль копии — это пароль, который был у базы, когда копию выгружали.')
    }
  }

  // ── Пароль
  const pwValid = pw.next.length >= MIN_PASSWORD && pw.next === pw.again
  const pwHint = pw.next && pw.next.length < MIN_PASSWORD ? `Не короче ${MIN_PASSWORD} символов` : pw.again && pw.next !== pw.again ? 'Пароли не совпадают' : ''
  const closePw = () => setPw({ mode: null, old: '', next: '', again: '' })
  const submitPw = (e) => {
    e.preventDefault()
    if (pw.mode === 'enable') { if (!pwValid) return; run(() => storageActions.enableProtection(pw.next), 'Защита включена: база зашифрована паролем.').then(closePw) }
    if (pw.mode === 'change') { if (!pwValid || !pw.old) return; run(() => storageActions.changePassword(pw.old, pw.next), 'Пароль изменён, база перешифрована.').then(closePw) }
    if (pw.mode === 'disable') { if (!pw.old) return; run(() => storageActions.disableProtection(pw.old), 'Защита снята: база хранится без шифрования.').then(closePw) }
  }

  const backupAge = storage.lastBackupAt ? Math.floor((Date.now() - storage.lastBackupAt) / 86400000) : null

  return (
    <>
      {status && <p className={`status ${status.ok ? 'ok' : 'bad'}`} role="status">{status.text}</p>}

      <section className="card" style={{ borderTop: 0 }}>
        <div className="block-head"><h2>Локальная база данных</h2><span className="faint num">групп {db.groups.length} · детей {db.children.length}</span></div>
        <dl className="facts">
          <div><dt>Где хранятся данные</dt><dd>IndexedDB — встроенная база этого браузера, на этом компьютере. На сервер ничего не отправляется.</dd></div>
          <div><dt>Защита</dt><dd>{storage.encrypted ? <span className="ok"><ShieldIcon width={14} height={14} /> зашифрована паролем (AES-256)</span> : 'без пароля'}</dd></div>
          <div><dt>Занято</dt><dd className="num">{fmtSize(info?.usage)}</dd></div>
          <div><dt>Хранение</dt><dd>{info?.persisted
            ? 'постоянное — браузер не удалит базу сам'
            : <>браузер может очистить базу при нехватке места <button type="button" className="text-action" onClick={async () => { const ok = await storageActions.persist(); say(ok, ok ? 'Браузер разрешил постоянное хранение.' : 'Браузер отказал: так бывает в режиме инкогнито или без частых посещений. Делайте копии.'); refresh() }}><span>запросить постоянное</span></button></>}</dd></div>
          <div><dt>Последняя копия в файл</dt><dd className={backupAge === null || backupAge > 7 ? 'bad' : ''}>{storage.lastBackupAt ? `${fmtDate(storage.lastBackupAt)}${backupAge > 7 ? ` — ${backupAge} дн. назад, пора сделать новую` : ''}` : 'ещё не делалась'}</dd></div>
        </dl>
        {storage.migrated && <p className="help-note">Данные перенесены из прежнего хранилища браузера (localStorage) в локальную базу.</p>}
      </section>

      <section className="card">
        <div className="block-head"><h2>Защита паролем</h2>{storage.encrypted && <button type="button" className="btn-ghost" onClick={() => storageActions.lock()}><LockIcon /> Заблокировать сейчас</button>}</div>
        <p className="prose" style={{ marginTop: 0 }}>
          {storage.encrypted
            ? 'База зашифрована. При открытии приложения и после простоя нужен пароль; без него данные в браузере нечитаемы. Пароль нигде не хранится — если его забыть, помогут только резервные копии.'
            : 'Сейчас база не зашифрована: любой, кто сядет за этот компьютер, увидит данные детей. Включите защиту — данные будут храниться зашифрованными (AES-256), а для входа понадобится пароль.'}
        </p>
        {storage.encrypted && (
          <div className="field" style={{ maxWidth: 320, marginBottom: 12 }}>
            <span className="field-label">Автоблокировка</span>
            <Dropdown variant="light" label="Автоблокировка" value={storage.autoLockMin} options={AUTOLOCK} onChange={(m) => storageActions.setAutoLock(m)} />
          </div>
        )}
        {!pw.mode && (
          <div className="toolbar">
            {!storage.encrypted && (storageActions.cryptoAvailable()
              ? <button type="button" className="btn-primary" onClick={() => setPw({ ...pw, mode: 'enable' })}><ShieldIcon /> Включить защиту</button>
              : <p className="status bad" style={{ margin: 0 }}>Шифрование недоступно: приложение открыто по незащищённому адресу. Откройте его по адресу, начинающемуся с https://.</p>)}
            {storage.encrypted && <button type="button" className="btn-ghost" onClick={() => setPw({ ...pw, mode: 'change' })}>Сменить пароль</button>}
            {storage.encrypted && <button type="button" className="btn-ghost" onClick={() => setPw({ ...pw, mode: 'disable' })}>Снять защиту</button>}
          </div>
        )}
        {pw.mode && (
          <form noValidate className="form pw-form" onSubmit={submitPw}>
            {pw.mode !== 'enable' && <PasswordField label="Текущий пароль" value={pw.old} onChange={(old) => setPw({ ...pw, old })} autoComplete="current-password" autoFocus />}
            {pw.mode !== 'disable' && (
              <>
                <PasswordField label={`Новый пароль — не короче ${MIN_PASSWORD} символов`} value={pw.next} onChange={(next) => setPw({ ...pw, next })} autoFocus={pw.mode === 'enable'} />
                <PasswordField label="Повторите пароль" value={pw.again} onChange={(again) => setPw({ ...pw, again })} />
                {pwHint && <p className="status bad" style={{ margin: 0 }}>{pwHint}</p>}
                {pw.mode === 'enable' && <p className="help-note amber" style={{ margin: 0 }}>Запишите пароль и храните отдельно. Восстановить его нельзя: забытый пароль означает потерю данных, если нет резервной копии.</p>}
              </>
            )}
            <div className="form-actions">
              <button className="btn-primary" type="submit" disabled={busy || (pw.mode !== 'disable' && !pwValid) || (pw.mode !== 'enable' && !pw.old)}>
                {busy ? 'Шифрую…' : { enable: 'Зашифровать базу', change: 'Сменить пароль', disable: 'Снять защиту' }[pw.mode]}
              </button>
              <button className="btn-ghost" type="button" onClick={closePw}>Отмена</button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <div className="block-head"><h2>Резервная копия в файл</h2></div>
        <p className="prose" style={{ marginTop: 0 }}>Копия защищает от поломки компьютера и очистки браузера и переносит данные на другой компьютер. {storage.encrypted ? 'Копия шифруется паролем базы.' : 'Без защиты паролем копия не зашифрована — храните её как закрытый документ.'} Делайте копию раз в неделю.</p>
        <div className="toolbar">
          <button type="button" className="btn-primary" disabled={busy} onClick={exportBackup}><DownloadIcon /> Выгрузить копию</button>
          <FilePick accept=".json,application/json" onFile={onJson}><UploadIcon /> Восстановить из копии</FilePick>
        </div>
        {pending && (
          <form noValidate className="form pw-form" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); if (filePw) openPending() }}>
            <p style={{ margin: 0 }}>Копия зашифрована. Введите пароль, который был у базы, когда копию выгружали.</p>
            <PasswordField label="Пароль копии" value={filePw} onChange={setFilePw} autoComplete="current-password" autoFocus />
            <div className="form-actions">
              <button className="btn-primary" type="submit" disabled={!filePw || busy}>Расшифровать и восстановить</button>
              <button className="btn-ghost" type="button" onClick={() => setPending(null)}>Отмена</button>
            </div>
          </form>
        )}
        <p className="faint" style={{ marginTop: 10, maxWidth: 620 }}>Восстановление заменяет все текущие данные содержимым файла; прежнее состояние сохраняется точкой восстановления.</p>
      </section>

      <section className="card">
        <div className="block-head">
          <h2>Точки восстановления</h2>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(() => storageActions.snapshotNow(), 'Точка восстановления создана.')}><HistoryIcon /> Создать сейчас</button>
        </div>
        <p className="faint" style={{ margin: '0 0 10px', maxWidth: 680 }}>Копии базы внутри браузера: раз в день перед первой правкой, а также перед восстановлением и загрузкой Excel. Хранятся 14 последних. Помогают откатить ошибку, но не заменяют копию в файл.</p>
        <div className="table-scroll">
          <table className="tbl tbl--narrow">
            <thead><tr><th>Когда</th><th>Почему</th><th className="r">Групп</th><th className="r">Детей</th><th /></tr></thead>
            <tbody>
              {snaps.map((s) => (
                <tr key={s.id}>
                  <td className="num">{fmtDate(s.at)}</td>
                  <td>{REASONS[s.reason] || s.reason}</td>
                  <td className="r num">{s.groups}</td>
                  <td className="r num">{s.children}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    {askSnap === s.id ? (
                      <>
                        <button type="button" className="text-action danger" onClick={() => { setAskSnap(null); run(() => storageActions.restoreSnapshot(s.id), `Данные возвращены к состоянию на ${fmtDate(s.at)}.`) }}><span>вернуть эти данные</span></button>{' · '}
                        <button type="button" className="text-action" onClick={() => setAskSnap(null)}><span>отмена</span></button>
                      </>
                    ) : <button type="button" className="text-action" onClick={() => setAskSnap(s.id)}><span>восстановить</span></button>}
                  </td>
                </tr>
              ))}
              {!snaps.length && <tr><td colSpan={5} className="faint">пока нет — первая появится при первой правке сегодня</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="block-head"><h2>Прежний файл Excel</h2></div>
        <p className="prose" style={{ marginTop: 0 }}>Книга «Динамика речевого развития» (листы «Звук…», «Л.Г.С.…», «Фонетика…») загружается как новая группа: переносятся фамилии и все проставленные баллы. В прежнем файле 3 означало норму — при загрузке шкала переводится в принятую здесь (0 — норма).</p>
        <div className="toolbar">
          <FilePick accept=".xls,.xlsx" disabled={busy} onFile={(f) => run(async () => {
            const { part, stats } = await importLegacyWorkbook(f)
            actions.merge(part)
            say(true, `Загружено: «${stats.group}», детей — ${stats.children}, отметок — ${stats.cells}.`)
          })}><UploadIcon /> {busy ? 'Читаю файл…' : 'Загрузить файл Excel'}</FilePick>
          <button type="button" className="btn-ghost" onClick={() => { actions.merge(buildDemo()); say(true, 'Добавлена группа-пример с вымышленными детьми.') }}>Добавить группу-пример</button>
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
                        <button type="button" className="text-action danger" onClick={() => { actions.removeYear(y); setAskYear(null) }}><span>удалить год и его баллы</span></button>{' · '}
                        <button type="button" className="text-action" onClick={() => setAskYear(null)}><span>отмена</span></button>
                      </>
                    ) : <button type="button" className="text-action" onClick={() => setAskYear(y)}><span>удалить</span></button>}
                  </td>
                </tr>
              ))}
              {!years.length && <tr><td colSpan={4} className="faint">пока нет</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button type="button" className="btn-ghost" onClick={() => actions.addYear(nextYear())}><PlusIcon /> Добавить {nextYear()}</button>
        </div>
      </section>

      <section className="card">
        <div className="block-head"><h2>Очистка</h2></div>
        <p className="faint" style={{ margin: '0 0 10px' }}>Удаляет из этого браузера все группы, детей, баллы и точки восстановления. Настройки защиты паролем остаются.</p>
        <div className="toolbar">
          {askClear ? (
            <>
              <button type="button" className="btn-ghost lock-danger" onClick={() => { setAskClear(false); run(() => storageActions.wipe(), 'Все данные удалены из этого браузера.') }}><TrashIcon /> Да, удалить все данные</button>
              <button type="button" className="btn-ghost" onClick={() => setAskClear(false)}>Отмена</button>
            </>
          ) : <button type="button" className="btn-ghost" onClick={() => setAskClear(true)}><TrashIcon /> Удалить все данные</button>}
        </div>
      </section>
    </>
  )
}
