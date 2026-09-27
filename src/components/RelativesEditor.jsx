import { uid } from '../lib/store'
import { PlusIcon, TrashIcon } from './Icons'

// Роли и виды контактов — подсказки; можно вписать своё («крёстная», «дача»).
const ROLES = ['мама', 'папа', 'бабушка', 'дедушка', 'опекун', 'приёмный родитель', 'брат', 'сестра', 'тётя', 'дядя']
const PHONE_KINDS = ['мобильный', 'рабочий', 'домашний']
const ADDRESS_KINDS = ['проживания', 'регистрации', 'рабочий']

const entry = (kind = '') => ({ id: uid(), kind, value: '' })

export const newRelative = (role = 'мама') => ({
  id: uid(), role, name: '', legal: role === 'мама' || role === 'папа', note: '',
  phones: [entry('мобильный')], emails: [], addresses: [],
})

// Записи из прежней версии хранили один телефон и одну почту строкой — переводим в списки.
export function normalizeRelative(r) {
  const phones = r.phones || (r.phone ? [{ id: uid(), kind: 'мобильный', value: r.phone }] : [])
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

// Список однотипных значений: телефоны, почты, адреса.
function MultiField({ title, items, kinds, listId, type = 'text', inputMode, placeholder, kindPlaceholder, addLabel, multiline, onChange }) {
  const set = (id, patch) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return (
    <div className="multi">
      <span className="field-label">{title}</span>
      {kinds && <datalist id={listId}>{kinds.map((k) => <option key={k} value={k} />)}</datalist>}
      {items.map((x) => (
        <div className={`multi-row${kinds ? '' : ' multi-row--plain'}`} key={x.id}>
          {kinds && <input className="input multi-kind" list={listId} value={x.kind} onChange={(e) => set(x.id, { kind: e.target.value })} placeholder={kindPlaceholder} aria-label={`${title}: вид`} />}
          {multiline
            ? <textarea className="input multi-value" rows={1} value={x.value} onChange={(e) => set(x.id, { value: e.target.value })} placeholder={placeholder} aria-label={title} />
            : <input className="input multi-value" type={type} inputMode={inputMode} autoComplete="off" value={x.value} onChange={(e) => set(x.id, { value: e.target.value })} placeholder={placeholder} aria-label={title} />}
          <button type="button" className="icon-btn danger" onClick={() => onChange(items.filter((y) => y.id !== x.id))} aria-label={`Удалить: ${title.toLowerCase()}`} title="Удалить"><TrashIcon /></button>
        </div>
      ))}
      <button type="button" className="text-action" onClick={() => onChange([...items, entry(kinds ? kinds[items.length % kinds.length] : '')])}><span>+ {addLabel}</span></button>
    </div>
  )
}

export default function RelativesEditor({ value = [], onChange }) {
  const list = value.map(normalizeRelative)
  const set = (id, patch) => onChange(list.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const nextRole = () => {
    const used = new Set(list.map((r) => r.role))
    return ['мама', 'папа', 'бабушка', 'дедушка'].find((r) => !used.has(r)) || ''
  }

  return (
    <div className="relatives">
      <datalist id="relative-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
      {list.map((r, i) => (
        <fieldset className="relative" key={r.id}>
          <legend className="relative-head">
            <span className="caps">Контакт {i + 1}{r.legal ? ' · законный представитель' : ''}</span>
          </legend>
          <div className="relative-grid">
            <label className="field"><span className="field-label">Кем приходится</span>
              <input className="input" list="relative-roles" value={r.role} onChange={(e) => set(r.id, { role: e.target.value })} placeholder="мама, папа, бабушка…" /></label>
            <label className="field relative-name"><span className="field-label">ФИО</span>
              <input className="input" value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} placeholder="Фамилия Имя Отчество" autoComplete="off" /></label>
          </div>
          <div className="relative-contacts">
            <MultiField title="Телефоны" items={r.phones} kinds={PHONE_KINDS} listId="phone-kinds" type="tel" inputMode="tel"
              placeholder="+7 …" kindPlaceholder="мобильный" addLabel="телефон" onChange={(phones) => set(r.id, { phones })} />
            <MultiField title="Эл. почта" items={r.emails} type="email" inputMode="email"
              placeholder="name@example.ru" addLabel="почта" onChange={(emails) => set(r.id, { emails })} />
            <MultiField title="Адреса" items={r.addresses} kinds={ADDRESS_KINDS} listId="address-kinds" multiline
              placeholder="Город, улица, дом, квартира" kindPlaceholder="проживания" addLabel="адрес" onChange={(addresses) => set(r.id, { addresses })} />
          </div>
          <label className="field"><span className="field-label">Примечание</span>
            <input className="input" value={r.note} onChange={(e) => set(r.id, { note: e.target.value })} placeholder="Удобное время для связи, кто забирает ребёнка…" /></label>
          <div className="relative-foot">
            <label className="check"><input type="checkbox" checked={r.legal} onChange={() => set(r.id, { legal: !r.legal })} /> Законный представитель</label>
            <button type="button" className="text-action danger" onClick={() => onChange(list.filter((x) => x.id !== r.id))}><span>удалить контакт</span></button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn-ghost" onClick={() => onChange([...list, newRelative(nextRole())])}><PlusIcon /> Добавить родителя или родственника</button>
    </div>
  )
}
