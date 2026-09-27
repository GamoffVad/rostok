import { useEffect } from 'react'
import { actions, useDb, hasSaveError } from './lib/store'
import { buildDemo } from './lib/demo'
import { useRoute, href } from './lib/router'
import { DatabaseIcon, HelpIcon } from './components/Icons'
import ChildrenPage from './pages/ChildrenPage'
import ChildPage from './pages/ChildPage'
import ExamPage from './pages/ExamPage'
import ProtocolPage from './pages/ProtocolPage'
import DynamicsPage from './pages/DynamicsPage'
import DataPage from './pages/DataPage'
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

export default function App() {
  const db = useDb()
  const route = useRoute()
  const section = route.parts[0] || ''
  const empty = !db.groups.length

  useEffect(() => {
    let seeded = false
    try { seeded = localStorage.getItem(SEED_KEY) === '1' } catch { seeded = true }
    if (empty && !seeded) {
      actions.merge(buildDemo())
      try { localStorage.setItem(SEED_KEY, '1') } catch { /* без отметки */ }
    }
  }, [empty])

  let page
  if (section === 'help') page = <HelpPage />
  else if (section === 'data') page = <DataPage db={db} />
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
            <a className="round-btn" href={href('/data')} title="Данные: импорт, выгрузка, учебные годы" aria-label="Данные" aria-current={section === 'data' ? 'page' : undefined}><DatabaseIcon /></a>
            <a className="round-btn" href={href('/help')} title="Справка по методике" aria-label="Справка" aria-current={section === 'help' ? 'page' : undefined}><HelpIcon /></a>
          </div>
        </header>
        {hasSaveError() && <p className="status bad">Не удалось сохранить изменения: хранилище браузера переполнено или недоступно. Выгрузите резервную копию в разделе «Данные».</p>}
        <main>{page}</main>
      </div>
      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span><span className="footer-long">Росток — динамика развития ребёнка · данные хранятся только в этом браузере</span><span className="footer-short">Росток · данные в этом браузере</span></span>
        <span className="app-version" title={`Сборка от ${__BUILD_DATE__}`}>v{__APP_VERSION__}</span>
      </div>
    </footer>
  )
}
