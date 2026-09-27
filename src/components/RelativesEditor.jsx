import { uid } from '../lib/store'
import Dropdown from './Dropdown'
import { PlusIcon, TrashIcon } from './Icons'
// Кем приходится, виды телефонов и адресов — словари («Администрирование → Словари»).
import { ADDRESS_KINDS, PHONE_KINDS, ROLES } from '../data/dictionaries'

const entry = (kind = '') => ({ id: uid(), kind, value: '' })

export const newRelative = (role = ROLES[0] || '') => ({
  id: uid(), role, name: '', legal: role === 'мама' || role === 'папа', note: '',
  phones: [entry(PHONE_KINDS[0] || '')], emails: [], addresses: [],
})

// Записи из версии 1.1 хранили один телефон и одну почту строкой — переводим в списки.
export function normalizeRelative(r) {
  const phones = r.phones || (r.phone ? [{ id: uid(), kind: PHONE_KINDS[0] || '', value: r.phone }] : [])
  const emails = r.emails || (r.email ? [{ id: uid(), kind: '', value: r.email }] : [])
  const { phone, email, ...rest } = r
  return { ...rest, phones, emails, addresses: r.addresses || [] }
}
export const relativesOf = (child) => (child.relatives || []).map(normalizeRelative)

const filled = (list) => list.map((x) => ({ ...x, kind: x.kind.trim(), value: x.value.trim() })).filter((x) => x.value)

// Пустые телефоны, адреса и почты не сохраняются; контакт без ФИО и без телефона — тоже.
export const cleanRelatives = (list = []) => list
  .map(normalizeRelative)
  .map((r) => ({ ...r, role: r.role.trim(), name: r.name.trim(), note: r.note.trim(), phones: filled(r.phones), emails: filled(r.emails), addresses: filled(r.addresses) }))
  .filter((r) => r.name || r.phones.length)

export const phonesText = (r) => normalizeRelative(r).phones.map((p) => (p.kind ? `${p.value} (${p.kind})` : p.value)).join(', ')
export const emailsText = (r) => normalizeRelative(r).emails.map((e) => e.value).join(', ')
export const addressesText = (r) => normalizeRelative(r).addresses.map((a) => (a.kind ? `${a.kind}: ${a.value}` : a.value)).join('; ')

// Варианты из словаря; значение не из словаря (старая запись или удалённый вариант) остаётся выбранным.
const dictOptions = (list, current) => [...list, ...(current && !list.includes(current) ? [current] : [])].map((v) => ({ value: v, label: v }))

// Одна сетка на всю карточку: вид | значение | действие.
// Вид — выпадающий список из словаря или неизменяемая подпись («эл. почта», «примечание»).
function Line({ kind, children, action, head }) {
  return (
    <div className={`rel-line${head ? ' rel-line--head' : ''}`}>
      <div className="rel-kind">{kind}</div>
      <div className="rel-value">{children}</div>
      <div className="rel-act">{action}</div>
    </div>
  )
}

const DeleteBtn = ({ label, onClick }) => (
  <button type="button" className="icon-btn danger" onClick={onClick} aria-label={label} title={label}><TrashIcon /></button>
)

export default function RelativesEditor({ value = [], onChange }) {
  const list = value.map(normalizeRelative)
  const set = (id, patch) => onChange(list.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const nextRole = () => {
    const used = new Set(list.map((r) => r.role))
    return ROLES.find((r) => !used.has(r)) || ROLES[0] || ''
  }

  return (
    <div className="relatives">
      {list.map((r, i) => {
        const setItem = (key, id, patch) => set(r.id, { [key]: r[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) })
        const drop = (key, id) => set(r.id, { [key]: r[key].filter((x) => x.id !== id) })
        const add = (key, kinds) => set(r.id, { [key]: [...r[key], entry(kinds ? kinds[r[key].length % kinds.length] || '' : '')] })
        const kindSelect = (key, x, kinds, title) => (
          <Dropdown variant="light" label={`${title}: вид`} value={x.kind} placeholder="вид" options={dictOptions(kinds, x.kind)} onChange={(kind) => setItem(key, x.id, { kind })} />
        )
        return (
          <fieldset className="relative" key={r.id}>
            <legend className="sr-only">Контакт {i + 1}</legend>

            <Line head
              kind={<><span className="field-label">Кем приходится</span>
                <Dropdown variant="light" label="Кем приходится" value={r.role} placeholder="выберите" options={dictOptions(ROLES, r.role)} onChange={(role) => set(r.id, { role })} /></>}
              action={<DeleteBtn label={`Удалить контакт ${i + 1}`} onClick={() => onChange(list.filter((x) => x.id !== r.id))} />}>
              <label className="field"><span className="field-label">ФИО</span>
                <input className="input" value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} placeholder="Фамилия Имя Отчество" autoComplete="off" /></label>
            </Line>

            {r.phones.map((x) => (
              <Line key={x.id} kind={kindSelect('phones', x, PHONE_KINDS, 'Телефон')} action={<DeleteBtn label="Удалить телефон" onClick={() => drop('phones', x.id)} />}>
                <input className="input" type="tel" inputMode="tel" autoComplete="off" value={x.value} onChange={(e) => setItem('phones', x.id, { value: e.target.value })} placeholder="+7 …" aria-label="Телефон" />
              </Line>
            ))}
            {r.emails.map((x) => (
              <Line key={x.id} kind={<span className="rel-tag">эл. почта</span>} action={<DeleteBtn label="Удалить почту" onClick={() => drop('emails', x.id)} />}>
                <input className="input" type="email" inputMode="email" autoComplete="off" value={x.value} onChange={(e) => setItem('emails', x.id, { value: e.target.value })} placeholder="name@example.ru" aria-label="Эл. почта" />
              </Line>
            ))}
            {r.addresses.map((x) => (
              <Line key={x.id} kind={kindSelect('addresses', x, ADDRESS_KINDS, 'Адрес')} action={<DeleteBtn label="Удалить адрес" onClick={() => drop('addresses', x.id)} />}>
                <textarea className="input" rows={1} value={x.value} onChange={(e) => setItem('addresses', x.id, { value: e.target.value })} placeholder="Город, улица, дом, квартира" aria-label="Адрес" />
              </Line>
            ))}
            <Line kind={<span className="rel-tag">примечание</span>}>
              <input className="input" value={r.note} onChange={(e) => set(r.id, { note: e.target.value })} placeholder="Удобное время для связи, кто забирает ребёнка…" aria-label="Примечание" />
            </Line>

            <div className="rel-foot">
              <label className="check"><input type="checkbox" checked={r.legal} onChange={() => set(r.id, { legal: !r.legal })} /> Законный представитель</label>
              <span className="rel-adds">
                <button type="button" className="text-action" onClick={() => add('phones', PHONE_KINDS)}><span>+ телефон</span></button>
                <button type="button" className="text-action" onClick={() => add('emails')}><span>+ почта</span></button>
                <button type="button" className="text-action" onClick={() => add('addresses', ADDRESS_KINDS)}><span>+ адрес</span></button>
              </span>
            </div>
          </fieldset>
        )
      })}
      <div className="rel-actions">
        <button type="button" className="btn-ghost" onClick={() => onChange([...list, newRelative(nextRole())])}><PlusIcon /> Добавить родителя или родственника</button>
        <span className="faint">Варианты «Кем приходится», видов телефонов и адресов — в «Администрирование → Словари».</span>
      </div>
    </div>
  )
}
