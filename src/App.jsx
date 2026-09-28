import { useEffect, useState } from 'react'
import { actions, storageActions, useDb, useStorage, hasSaveError } from './lib/store'
import { buildDemo } from './lib/demo'
import { useRoute, href } from './lib/router'
import { GearIcon, HelpIcon, LockIcon } from './ui/Icons'
import LockScreen from './pages/LockScreen'
import TooltipLayer from './ui/Tooltip'
import ChildrenPage from './pages/ChildrenPage'
import ChildPage from './pages/ChildPage'
import ExamPage from './pages/ExamPage'
import ProtocolPage from './pages/ProtocolPage'
import DynamicsPage from './pages/DynamicsPage'
import AdminPage from './pages/AdminPage'
import HelpPage from './pages/HelpPage'
import Welcome from './pages/Welcome'
import LibraryPage from './pages/LibraryPage'
import ParentReport from './pages/ParentReport'

const NAV = [
  { path: '/', label: 'Дети', match: ['', 'child'] },
  { path: '/exam', label: 'Обследование', match: ['exam'] },
  { path: '/protocol', label: 'Протокол группы', match: ['protocol'] },
  { path: '/dynamics', label: 'Динамика', match: ['dynamics'] },
  { path: '/library', label: 'Упражнения', match: ['library'] },
]

// При самом первом открытии загружаем группу-пример: ссылку можно показать сразу, данные остаются в браузере.
const SEED_KEY = 'rostok.seeded'

const BACKUP_REMIND_DAYS = 7

// Автоблокировка: при включённой защите база закрывается после простоя
function useAutoLock(storage) {
  useEffect(() => {
    if (storage.status !== 'ready' || !storage.encrypted || !storage.autoLockMin) return undefined
    let timer
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => storageActions.lock(), storage.autoLockMin * 60000) }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    arm()
    return () => { clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, arm)) }
  }, [storage.status, storage.encrypted, storage.autoLockMin])
}

export default function App() {
  const storage = useStorage()
  useAutoLock(storage)
  if (storage.status === 'loading') return <div className="app-shell"><p className="faint boot">Открываю локальную базу…</p></div>
  if (storage.status === 'locked') return <><LockScreen /><TooltipLayer /></>
  if (storage.status === 'error') {
    return (
      <div className="app-shell">
        <div className="empty boot">
          <h1>Не удалось открыть базу</h1>
          <p className="subtitle">{storage.error}. Локальная база не работает в режиме инкогнито некоторых браузеров и при запрете хранения данных сайтов — откройте приложение в обычном окне.</p>
        </div>
      </div>
    )
  }
  return <Workspace storage={storage} />
}

function Workspace({ storage }) {
  const db = useDb()
  const route = useRoute()
  const section = route.parts[0] || ''
  const empty = !db.groups.length
  const [hideRemind, setHideRemind] = useState(false)

  useEffect(() => {
    let seeded = false
    try { seeded = localStorage.getItem(SEED_KEY) === '1' } catch { seeded = true }
    if (empty && !seeded) {
      actions.merge(buildDemo())
      try { localStorage.setItem(SEED_KEY, '1') } catch { /* без отметки */ }
    }
  }, [empty])

  const days = storage.lastBackupAt ? Math.floor((Date.now() - storage.lastBackupAt) / 86400000) : null
  const remind = !hideRemind && db.children.length > 0 && (days === null || days >= BACKUP_REMIND_DAYS) && section !== 'admin'

  let page
  if (section === 'help') page = <HelpPage />
  else if (section === 'admin' || section === 'data') page = <AdminPage db={db} tab={section === 'data' ? 'data' : route.parts[1]} />
  else if (section === 'library') page = <LibraryPage db={db} />
  else if (empty) page = <Welcome />
  else if (section === 'child') page = <ChildPage db={db} childId={route.parts[1]} tab={route.params.tab} />
  else if (section === 'exam') page = <ExamPage db={db} childId={route.params.child} />
  else if (section === 'protocol') page = <ProtocolPage db={db} />
  else if (section === 'dynamics') page = <DynamicsPage db={db} />
  else page = <ChildrenPage db={db} />

  // Режим показа родителям: без навигации, чтобы не было видно других детей.
  if (section === 'parent' && !empty) {
    return (
      <div className="app-shell">
        <div className="app-card"><main><ParentReport key={`${route.parts[1]}:${route.params.period || ''}:${route.params.only || ''}`} db={db} childId={route.parts[1]} params={route.params} /></main></div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-card">
        <header className="topbar">
          <a className="brand" href={href('/')}>
            <img src="./logo.png" alt="" width="40" height="40" />
            <span>
              <span className="brand-name">Росток</span>
              <br />
              <span className="brand-ctx">динамика развития ребёнка</span>
            </span>
          </a>
          <nav className="topnav" aria-label="Разделы">
            {NAV.map((n) => (
              <a key={n.path} href={href(n.path)} aria-current={n.match.includes(section) ? 'page' : undefined}>{n.label}</a>
            ))}
          </nav>
          <div className="topbar-tools">
            <a className="round-btn" href={href('/admin/data')} data-tip="Администрирование: данные и словари" aria-label="Администрирование" aria-current={section === 'admin' || section === 'data' ? 'page' : undefined}><GearIcon /></a>
            <a className="round-btn" href={href('/help')} data-tip="Справка по методике" aria-label="Справка" aria-current={section === 'help' ? 'page' : undefined}><HelpIcon /></a>
            {storage.encrypted && <button type="button" className="round-btn" onClick={() => storageActions.lock()} data-tip="Заблокировать базу" aria-label="Заблокировать базу"><LockIcon /></button>}
          </div>
        </header>
        {hasSaveError() && <p className="status bad">Не удалось сохранить изменения в локальную базу: место в браузере закончилось или доступ к хранилищу запрещён. Выгрузите резервную копию в «Администрирование → Данные».</p>}
        {remind && (
          <p className="remind" role="status">
            {days === null ? 'Резервной копии данных ещё нет.' : `Последняя резервная копия — ${days} дн. назад.`} Данные хранятся только в этом браузере: сделайте копию в файл.
            <a className="text-action" href={href('/admin/data')}><span>сделать копию</span></a>
            <button type="button" className="text-action" onClick={() => setHideRemind(true)}><span>позже</span></button>
          </p>
        )}
        <main>{page}</main>
      </div>
      <Footer />
      <TooltipLayer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span><span className="footer-long">Росток — динамика развития ребёнка · данные хранятся только в этом браузере</span><span className="footer-short">Росток · данные в этом браузере</span></span>
        <span className="app-version" data-tip={`Сборка от ${__BUILD_DATE__}`}>v{__APP_VERSION__}</span>
      </div>
    </footer>
  )
}
