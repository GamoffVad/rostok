import { useState } from 'react'
import { actions, childrenOf, scoresOf } from '../lib/store'
import { useSelection, setUi } from '../lib/ui'
import { href } from '../lib/router'
import { ageText, blockMean, fmt, levelOf, totalProgress } from '../lib/calc'
import { birthMin, todayIso } from '../lib/dates'
import { BLOCKS } from '../data/methodology'
import { GroupFilter, PeriodFilter } from '../components/Selectors'
import FilterCard from '../ui/FilterCard'
import DatePicker from '../ui/DatePicker'
import { Level } from '../ui/Level'
import { PlusIcon, TrashIcon } from '../ui/Icons'
import RelativesEditor, { cleanRelatives, newRelative, phonesText } from '../components/RelativesEditor'

export default function ChildrenPage({ db }) {
  const { group, period } = useSelection(db)
  const [mode, setMode] = useState(null) // child | group
  const [names, setNames] = useState('')
  const [addMode, setAddMode] = useState('one') // one | list
  const [one, setOne] = useState(() => ({ name: '', birthDate: '', tpmpk: '', relatives: [newRelative('мама')] }))
  const [groupName, setGroupName] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const kids = group ? childrenOf(db, group.id) : []

  const addChildren = (e) => {
    e.preventDefault()
    const list = names.split(/\r?\n/).map((s) => s.replace(/^\s*\d+[.)]?\s*/, '').trim()).filter(Boolean)
    if (!list.length) return
    actions.addChildren(group.id, list)
    setNames('')
    setMode(null)
  }
  const addOne = (e) => {
    e.preventDefault()
    if (!one.name.trim()) return
    actions.addChild({ groupId: group.id, name: one.name.trim(), birthDate: one.birthDate, tpmpk: one.tpmpk.trim(), relatives: cleanRelatives(one.relatives) })
    setOne({ name: '', birthDate: '', tpmpk: '', relatives: [newRelative('мама')] })
    setMode(null)
  }
  const addGroup = (e) => {
    e.preventDefault()
    if (!groupName.trim()) return
    const g = actions.addGroup(groupName)
    setUi({ groupId: g.id })
    setGroupName('')
    setMode(null)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Дети</h1>
          <p className="subtitle">Список группы и состояние обследования на выбранном срезе. Нажмите на фамилию, чтобы открыть карту ребёнка.</p>
        </div>
        <div className="page-actions">
          <button className="btn-primary" onClick={() => setMode(mode === 'child' ? null : 'child')}><PlusIcon /> Добавить детей</button>
          <button className="btn-ghost" onClick={() => setMode(mode === 'group' ? null : 'group')}>Новая группа</button>
        </div>
      </div>

      {mode === 'child' && (
        <div className="form">
          <div className="type-tabs" role="tablist" aria-label="Способ добавления">
            <button type="button" role="tab" aria-selected={addMode === 'one'} onClick={() => setAddMode('one')}>Один ребёнок с родителями</button>
            <button type="button" role="tab" aria-selected={addMode === 'list'} onClick={() => setAddMode('list')}>Списком фамилий</button>
          </div>
          {addMode === 'one' ? (
            <form noValidate onSubmit={addOne} style={{ display: 'grid', gap: 12 }}>
              <div className="child-fields">
                <label className="field"><span className="field-label">Фамилия и имя ребёнка</span><input className="input" autoFocus value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} /></label>
                <div className="field"><span className="field-label">Дата рождения</span><DatePicker label="Дата рождения" value={one.birthDate} onChange={(birthDate) => setOne({ ...one, birthDate })} min={birthMin()} max={todayIso()} /></div>
                <label className="field"><span className="field-label">Заключение ТПМПК</span><input className="input" value={one.tpmpk} onChange={(e) => setOne({ ...one, tpmpk: e.target.value })} placeholder="необязательно" /></label>
              </div>
              <h3 className="h3 rel-title">Родители и родственники</h3>
              <RelativesEditor value={one.relatives} onChange={(relatives) => setOne({ ...one, relatives })} />
              <div className="form-actions">
                <button className="btn-primary" type="submit" disabled={!one.name.trim()}>Добавить в «{group.name}»</button>
                <button className="btn-ghost" type="button" onClick={() => setMode(null)}>Отмена</button>
              </div>
            </form>
          ) : (
            <form noValidate onSubmit={addChildren} style={{ display: 'grid', gap: 12 }}>
              <label className="field">
                <span className="field-label">Фамилия и имя — по одному ребёнку на строку</span>
                <textarea className="input" rows={5} autoFocus value={names} onChange={(e) => setNames(e.target.value)} placeholder={'Белкина Соня\nВоронов Лев'} />
              </label>
              <p className="faint" style={{ margin: 0 }}>Родителей и родственников можно добавить потом — в карте ребёнка.</p>
              <div className="form-actions">
                <button className="btn-primary" type="submit">Добавить в «{group.name}»</button>
                <button className="btn-ghost" type="button" onClick={() => setMode(null)}>Отмена</button>
              </div>
            </form>
          )}
        </div>
      )}
      {mode === 'group' && (
        <form noValidate className="form" onSubmit={addGroup}>
          <label className="field">
            <span className="field-label">Название группы</span>
            <input className="input" autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Группа № 7, старшая" />
          </label>
          <div className="form-actions">
            <button className="btn-primary" type="submit">Создать</button>
            <button className="btn-ghost" type="button" onClick={() => setMode(null)}>Отмена</button>
          </div>
        </form>
      )}

      <div className="filters filters--fit">
        <GroupFilter db={db} group={group} />
        <PeriodFilter db={db} period={period} />
        <FilterCard label="Детей в группе"><div className="dd-btn num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{kids.length}</div></FilterCard>
      </div>

      {!kids.length ? (
        <div className="empty"><p>В группе пока нет детей. Добавьте фамилии списком — можно вставить колонку из Excel.</p></div>
      ) : (
        <div className="table-scroll card" style={{ borderTop: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}>№</th>
                <th>Ребёнок</th>
                <th>Возраст</th>
                <th>Родители</th>
                <th className="r">Заполнено</th>
                {BLOCKS.map((b) => <th key={b.id} className="c">{b.title}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {kids.map((c, i) => {
                const s = period ? scoresOf(db, c.id, period.id) : {}
                const pr = totalProgress(s)
                return (
                  <tr key={c.id}>
                    <td className="num muted">{i + 1}</td>
                    <td><a className="name" href={href(`/child/${c.id}`)}>{c.name}</a></td>
                    <td>{ageText(c.birthDate) || <span className="faint">не указан</span>}</td>
                    <td>{c.relatives?.length ? <span data-tip={c.relatives.map((r) => `${r.role}: ${r.name} ${phonesText(r)}`).join('\n')}>{c.relatives.map((r) => r.role || 'контакт').join(', ')}</span> : <a className="text-action" href={href(`/child/${c.id}`)}><span>добавить</span></a>}</td>
                    <td className={`r num ${pr.filled === pr.total ? 'ok' : ''}`}>{pr.filled}/{pr.total}</td>
                    {BLOCKS.map((b) => {
                      const m = blockMean(b.sections, s)
                      return <td key={b.id} className="c"><Level value={levelOf(m)} /> <span className="num muted" style={{ marginLeft: 6 }}>{fmt(m)}</span></td>
                    })}
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {confirmId === c.id ? (
                        <>
                          <button className="text-action danger" onClick={() => { actions.removeChild(c.id); setConfirmId(null) }}><span>удалить с баллами</span></button>
                          {' · '}
                          <button className="text-action" onClick={() => setConfirmId(null)}><span>отмена</span></button>
                        </>
                      ) : (
                        <>
                          <a className="text-action" href={href('/exam', { child: c.id })}><span>обследовать</span></a>
                          {' · '}
                          <button className="text-action" onClick={() => setConfirmId(c.id)} aria-label={`Удалить: ${c.name}`}><span>удалить</span></button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {group && <GroupSettings key={group.id} group={group} count={kids.length} />}
    </>
  )
}

function GroupSettings({ group, count }) {
  const [name, setName] = useState(group.name)
  const [ask, setAsk] = useState(false)
  return (
    <section className="card">
      <div className="block-head"><h2>Настройки группы</h2></div>
      <div className="toolbar" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 260px', maxWidth: 420 }}>
          <span className="field-label">Название</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn-ghost" disabled={!name.trim() || name === group.name} onClick={() => actions.renameGroup(group.id, name)}>Сохранить название</button>
        {ask ? (
          <>
            <button className="btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => actions.removeGroup(group.id)}><TrashIcon /> Удалить группу и {count} детей</button>
            <button className="btn-ghost" onClick={() => setAsk(false)}>Отмена</button>
          </>
        ) : (
          <button className="btn-ghost" onClick={() => setAsk(true)}><TrashIcon /> Удалить группу</button>
        )}
      </div>
    </section>
  )
}
