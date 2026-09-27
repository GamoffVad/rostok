import { go } from '../lib/router'
import DataPage from './DataPage'
import DictionariesPage from './DictionariesPage'
import ComponentsPage from './ComponentsPage'

const TABS = [
  { id: 'data', label: 'Данные', subtitle: 'Резервная копия, загрузка прежнего файла Excel, учебные годы. Сведения о детях хранятся только в этом браузере и никуда не отправляются — раз в неделю выгружайте резервную копию.' },
  { id: 'dicts', label: 'Словари', subtitle: 'Все словарные значения приложения: названия уровней и этапов, разделов и проб, итогов, направлений работы, подсказки для контактов родителей.' },
  { id: 'ui', label: 'Компоненты', subtitle: 'Библиотека компонентов «Росток»: из неё собраны все экраны. Каждый элемент — вживую и во всех состояниях.' },
]

export default function AdminPage({ db, tab }) {
  const current = TABS.find((t) => t.id === tab) || TABS[0]
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Администрирование</h1>
          <p className="subtitle">{current.subtitle}</p>
        </div>
      </div>
      <div className="subtabs" role="tablist" aria-label="Администрирование" style={{ marginTop: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === current.id} onClick={() => go(`/admin/${t.id}`)}>{t.label}</button>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        {current.id === 'dicts' && <DictionariesPage db={db} />}
        {current.id === 'ui' && <ComponentsPage />}
        {current.id === 'data' && <DataPage db={db} />}
      </div>
    </>
  )
}
