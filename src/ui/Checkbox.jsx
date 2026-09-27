import { CheckIcon } from './Icons'

// Флажок библиотеки: свой квадрат 18×18 с галочкой. Настоящий input скрыт визуально,
// но остаётся для клавиатуры и экранного диктора (пробел переключает, фокус виден).
export default function Checkbox({ checked, onChange, children, disabled, className = '' }) {
  return (
    <label className={`cbx${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="cbx-box" aria-hidden="true"><CheckIcon width={12} height={12} strokeWidth={2.6} /></span>
      {children !== undefined && <span className="cbx-label">{children}</span>}
    </label>
  )
}
