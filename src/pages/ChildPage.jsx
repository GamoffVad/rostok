import { useEffect, useState } from 'react'
import { actions, periodLabel, periodShort, scoresOf } from '../lib/store'
import { go, href } from '../lib/router'
import { BLOCKS, NEURO_SCORED, SPEECH_SECTIONS, isScored } from '../data/methodology'
import { ageText, blockMean, fmt, levelOf, outcome, sectionStats, totalProgress } from '../lib/calc'
import { birthMin, todayIso } from '../lib/dates'
import { buildReport } from '../lib/report'
import Dropdown from '../ui/Dropdown'
import FilterCard from '../ui/FilterCard'
import DatePicker from '../ui/DatePicker'
import { Delta, Level } from '../ui/Level'
import { Dumbbell, Radar, TrendLine } from '../ui/Charts'
import { CheckIcon, CopyIcon, PrintIcon } from '../ui/Icons'
import ProgramTab from './ProgramTab'
import RelativesEditor, { cleanRelatives, relativesOf } from '../components/RelativesEditor'

export default function ChildPage({ db, childId, tab = 'profile' }) {
  const child = db.children.find((c) => c.id === childId)
  if (!child) return <div className="empty" style={{ marginTop: 24 }}><p>Ребёнок не найден: возможно, запись удалена.</p><a className="btn-ghost" href={href('/')}>К списку детей</a></div>
  const group = db.groups.find((g) => g.id === child.groupId)
  const filled = db.periods.filter((p) => Object.keys(scoresOf(db, child.id, p.id)).length)

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{child.name}</h1>
          <p className="subtitle">{[group?.name, ageText(child.birthDate), child.tpmpk && `ТПМПК: ${child.tpmpk}`].filter(Boolean).join(' · ') || 'Карта ребёнка'}</p>
        </div>
        <div className="page-actions">
          <a className="btn-primary" href={href('/exam', { child: child.id })}>Обследовать</a>
          <a className="btn-ghost" href={href(`/parent/${child.id}`)}><PrintIcon /> Отчёт для родителей</a>
        </div>
      </div>
      <div className="subtabs" role="tablist">
        <button role="tab" aria-selected={tab !== 'report' && tab !== 'program'} onClick={() => go(`/child/${child.id}`)}>Профиль и динамика</button>
        <button role="tab" aria-selected={tab === 'program'} onClick={() => go(`/child/${child.id}`, { tab: 'program' })}>Программа коррекции</button>
        <button role="tab" aria-selected={tab === 'report'} onClick={() => go(`/child/${child.id}`, { tab: 'report' })}>Заключение</button>
      </div>
      {tab === 'report' && <Report db={db} child={child} group={group} filled={filled} />}
      {tab === 'program' && <ProgramTab key={child.id} db={db} child={child} filled={filled} />}
      {tab !== 'report' && tab !== 'program' && <Profile db={db} child={child} filled={filled} />}
    </>
  )
}

function Profile({ db, child, filled }) {
  const first = filled[0]
  const last = filled[filled.length - 1]
  const a = first ? scoresOf(db, child.id, first.id) : {}
  const b = last ? scoresOf(db, child.id, last.id) : {}
  const axes = (sections) => sections.map((s) => ({
    label: s.short, full: s.title,
    start: sectionStats(s, a).mean,
    end: first === last ? null : sectionStats(s, b).mean,
  }))
  const res = first && last && first !== last ? outcome(blockMean(SPEECH_SECTIONS, a), blockMean(SPEECH_SECTIONS, b)) : null
  const labelA = first ? periodLabel(first) : ''
  const labelB = last && last !== first ? periodLabel(last) : '—'

  return (
    <>
      <section className="card" style={{ borderTop: 0, paddingTop: 22 }}>
        <ChildForm key={child.id} child={child} />
      </section>

      {!filled.length ? (
        <div className="empty"><p>Обследований пока нет. Нажмите «Обследовать», чтобы заполнить первый срез.</p></div>
      ) : (
        <>
          <section className="card">
            <div className="stats">
              {BLOCKS.map((bl) => {
                const mA = blockMean(bl.sections, a)
                const mB = blockMean(bl.sections, b)
                return (
                  <div className="stat" key={bl.id}>
                    <span className="caps">{bl.title}</span>
                    <div className="stat-value">{fmt(mB)} <Level value={levelOf(mB)} /> {first !== last && <Delta from={mA} to={mB} />}</div>
                    <span className="stat-note">{first !== last ? `было ${fmt(mA)} · ${labelA}` : labelA}</span>
                  </div>
                )
              })}
              <div className="stat">
                <span className="caps">Итог по речи</span>
                <div className="stat-value" style={{ fontFamily: 'inherit', fontSize: 17 }}>{res ? res.label : 'нужен второй срез'}</div>
                <span className="stat-note">срезов с данными: {filled.length}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="chart-grid">
              <div>
                <p className="chart-title">Речевой профиль: чем ближе к центру, тем ближе к норме</p>
                <div style={{ maxWidth: 460, margin: '0 auto' }}><Radar axes={axes(SPEECH_SECTIONS)} startLabel={labelA} endLabel={labelB} /></div>
              </div>
              <div>
                <p className="chart-title">Средний балл по речи от среза к срезу</p>
                <TrendLine points={db.periods.map((p) => ({ label: periodShort(p), value: blockMean(SPEECH_SECTIONS, scoresOf(db, child.id, p.id)) }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p className="chart-title">Нейродиагностика: сдвиг по сферам</p>
                <Dumbbell rows={axes(NEURO_SCORED)} startLabel={labelA} endLabel={labelB} />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="block-head"><h2>Уровни по всем срезам</h2></div>
            <div className="table-scroll">
              <table className="tbl heat">
                <thead>
                  <tr><th>Раздел</th>{db.periods.map((p) => <th key={p.id} className="c">{p.year}<br />{p.point}</th>)}</tr>
                </thead>
                <tbody>
                  {BLOCKS.map((bl) => bl.sections.filter(isScored).map((s) => (
                    <tr key={s.id}>
                      <td style={{ padding: '8px 10px' }}>{s.title}</td>
                      {db.periods.map((p) => {
                        const st = sectionStats(s, scoresOf(db, child.id, p.id))
                        return <td key={p.id} className="c"><Level value={st.level} title={st.mean === null ? undefined : `средний балл ${fmt(st.mean)}`} /></td>
                      })}
                    </tr>
                  )))}
                  <tr className="total">
                    <td style={{ padding: '10px' }}>Заполнено проб</td>
                    {db.periods.map((p) => { const pr = totalProgress(scoresOf(db, child.id, p.id)); return <td key={p.id} className="c num" style={{ padding: '10px 3px' }}>{pr.filled}/{pr.total}</td> })}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}

function ChildForm({ child }) {
  const initial = { name: child.name, birthDate: child.birthDate, tpmpk: child.tpmpk, note: child.note, relatives: relativesOf(child) }
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(false)
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setSaved(false) }
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const save = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const relatives = cleanRelatives(form.relatives)
    actions.updateChild(child.id, { ...form, name: form.name.trim(), relatives })
    setForm({ ...form, name: form.name.trim(), relatives })
    setSaved(true)
  }
  return (
    <form noValidate onSubmit={save}>
      <div className="child-fields">
        <label className="field"><span className="field-label">Фамилия и имя</span><input className="input" value={form.name} onChange={set('name')} /></label>
        <div className="field"><span className="field-label">Дата рождения</span><DatePicker label="Дата рождения" value={form.birthDate} onChange={(birthDate) => { setForm({ ...form, birthDate }); setSaved(false) }} min={birthMin()} max={todayIso()} /></div>
        <label className="field"><span className="field-label">Заключение ТПМПК</span><input className="input" value={form.tpmpk} onChange={set('tpmpk')} placeholder="ТНР, ОНР III уровня…" /></label>
        <label className="field child-note"><span className="field-label">Заметки</span><textarea className="input" rows={2} value={form.note} onChange={set('note')} placeholder="Анамнез, особенности, договорённости с родителями" /></label>
      </div>
      <h3 className="h3 rel-title">Родители и родственники</h3>
      <RelativesEditor value={form.relatives} onChange={(relatives) => { setForm({ ...form, relatives }); setSaved(false) }} />
      <div className="form-actions" style={{ marginTop: 12, alignItems: 'center' }}>
        <button className="btn-ghost" type="submit" disabled={!dirty || !form.name.trim()}>Сохранить сведения</button>
        {saved && !dirty && <span className="status ok" style={{ margin: 0 }}>Сохранено</span>}
      </div>
    </form>
  )
}

function Report({ db, child, group, filled }) {
  const [periodId, setPeriodId] = useState(filled[filled.length - 1]?.id)
  const period = db.periods.find((p) => p.id === periodId)
  const idx = filled.findIndex((p) => p.id === periodId)
  const prevPeriod = idx > 0 ? filled[idx - 1] : null
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const generate = () => period && setText(buildReport({
    child, group, period, prevPeriod,
    scores: scoresOf(db, child.id, period.id),
    prevScores: prevPeriod ? scoresOf(db, child.id, prevPeriod.id) : null,
    note: db.notes[child.id]?.[period.id],
  }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(generate, [periodId, child.id])

  if (!filled.length) return <div className="empty" style={{ marginTop: 20 }}><p>Заключение собирается из баллов обследования. Сначала заполните хотя бы один срез.</p></div>

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }

  return (
    <>
      <div className="filters filters--fit" style={{ borderTop: 0 }}>
        <FilterCard label="Срез">
          <Dropdown label="Срез" value={periodId} options={filled.map((p) => ({ value: p.id, label: periodLabel(p) }))} onChange={setPeriodId} />
        </FilterCard>
        <FilterCard label="Сравнение"><div className="dd-btn" style={{ fontSize: 14 }}>{prevPeriod ? `с ${periodLabel(prevPeriod)}` : 'первый срез — без сравнения'}</div></FilterCard>
      </div>
      <section className="card" style={{ borderTop: 0 }}>
        <div className="toolbar no-print" style={{ marginBottom: 14 }}>
          <button className="btn-primary" onClick={() => window.print()}><PrintIcon /> Печать</button>
          <button className="btn-ghost" onClick={copy}>{copied ? <><CheckIcon /> Скопировано</> : <><CopyIcon /> Копировать текст</>}</button>
          <button className="btn-ghost" onClick={generate}>Собрать заново из баллов</button>
        </div>
        <p className="faint no-print" style={{ margin: '0 0 12px', maxWidth: 620 }}>Это черновик: текст можно править прямо здесь. Правки не сохраняются — скопируйте или распечатайте готовый вариант.</p>
        <div className="report" contentEditable suppressContentEditableWarning spellCheck onBlur={(e) => setText(e.currentTarget.innerText)}>{text}</div>
      </section>
    </>
  )
}
