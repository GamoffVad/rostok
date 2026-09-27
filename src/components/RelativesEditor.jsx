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

// Строка «подпись — значения»: телефоны, почты, адреса.
function MultiRow({ title, items, kinds, type = 'text', inputMode, placeholder, addLabel, multiline, onChange }) {
  const set = (id, patch) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return (
    <div className="rel-row">
      <span className="rel-label">{title}</span>
      <div className="rel-items">
        {items.map((x) => (
          <div className={`multi-row${kinds ? '' : ' multi-row--plain'}`} key={x.id}>
            {kinds && <Dropdown variant="light" label={`${title}: вид`} value={x.kind} placeholder="вид" options={dictOptions(kinds, x.kind)} onChange={(kind) => set(x.id, { kind })} />}
            {multiline
              ? <textarea className="input" rows={1} value={x.value} onChange={(e) => set(x.id, { value: e.target.value })} placeholder={placeholder} aria-label={title} />
              : <input className="input" type={type} inputMode={inputMode} autoComplete="off" value={x.value} onChange={(e) => set(x.id, { value: e.target.value })} placeholder={placeholder} aria-label={title} />}
            <button type="button" className="icon-btn danger" onClick={() => onChange(items.filter((y) => y.id !== x.id))} aria-label={`Удалить: ${title.toLowerCase()}`} title="Удалить"><TrashIcon /></button>
          </div>
        ))}
        <button type="button" className="text-action rel-add" onClick={() => onChange([...items, entry(kinds ? kinds[items.length % kinds.length] || '' : '')])}><span>+ {addLabel}</span></button>
      </div>
    </div>
  )
}

export default function RelativesEditor({ value = [], onChange }) {
  const list = value.map(normalizeRelative)
  const set = (id, patch) => onChange(list.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const nextRole = () => {
    const used = new Set(list.map((r) => r.role))
    return ROLES.find((r) => !used.has(r)) || ROLES[0] || ''
  }

  return (
    <div className="relatives">
      {list.map((r, i) => (
        <fieldset className="relative" key={r.id}>
          <legend className="relative-head">
            <span className="caps">Контакт {i + 1}{r.legal ? ' · законный представитель' : ''}</span>
            <button type="button" className="text-action danger" onClick={() => onChange(list.filter((x) => x.id !== r.id))}><span>удалить контакт</span></button>
          </legend>

          <div className="rel-top">
            <div className="field">
              <span className="field-label">Кем приходится</span>
              <Dropdown variant="light" label="Кем приходится" value={r.role} placeholder="выберите" options={dictOptions(ROLES, r.role)} onChange={(role) => set(r.id, { role })} />
            </div>
            <label className="field">
              <span className="field-label">ФИО</span>
              <input className="input" value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} placeholder="Фамилия Имя Отчество" autoComplete="off" />
            </label>
            <label className="check rel-legal"><input type="checkbox" checked={r.legal} onChange={() => set(r.id, { legal: !r.legal })} /> Законный представитель</label>
          </div>

          <MultiRow title="Телефоны" items={r.phones} kinds={PHONE_KINDS} type="tel" inputMode="tel"
            placeholder="+7 …" addLabel="телефон" onChange={(phones) => set(r.id, { phones })} />
          <MultiRow title="Эл. почта" items={r.emails} type="email" inputMode="email"
            placeholder="name@example.ru" addLabel="почта" onChange={(emails) => set(r.id, { emails })} />
          <MultiRow title="Адреса" items={r.addresses} kinds={ADDRESS_KINDS} multiline
            placeholder="Город, улица, дом, квартира" addLabel="адрес" onChange={(addresses) => set(r.id, { addresses })} />
          <label className="rel-row">
            <span className="rel-label">Примечание</span>
            <input className="input" value={r.note} onChange={(e) => set(r.id, { note: e.target.value })} placeholder="Удобное время для связи, кто забирает ребёнка…" />
          </label>
        </fieldset>
      ))}
      <div className="rel-actions">
        <button type="button" className="btn-ghost" onClick={() => onChange([...list, newRelative(nextRole())])}><PlusIcon /> Добавить родителя или родственника</button>
        <span className="faint">Варианты «Кем приходится» и видов телефонов и адресов — в «Администрирование → Словари».</span>
      </div>
    </div>
  )
}
