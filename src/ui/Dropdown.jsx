import { useEffect, useRef, useState } from 'react'

// Кастомный список: plain — для фильтров над контентом, light — для форм.
export default function Dropdown({ value, options, onChange, variant = 'plain', placeholder = 'не выбрано', label }) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(-1)
  const root = useRef(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [open])

  const pick = (o) => { onChange(o.value); setOpen(false) }
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); setFocus(Math.max(0, options.indexOf(current))); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocus((f) => Math.min(options.length - 1, f + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocus((f) => Math.max(0, f - 1)) }
    if (e.key === 'Enter' && options[focus]) { e.preventDefault(); pick(options[focus]) }
  }

  return (
    <div className={`dd dd--${variant}`} ref={root} onKeyDown={onKey}>
      <button type="button" className="dd-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span className="dd-value">{current ? current.label : <span className="faint">{placeholder}</span>}</span>
        <span className="dd-caret">▾</span>
      </button>
      {open && (
        <ul className="dd-list" role="listbox">
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button type="button" className={`dd-item${i === focus ? ' is-focus' : ''}`} aria-selected={o.value === value} onClick={() => pick(o)}>
                {o.label}
              </button>
            </li>
          ))}
          {!options.length && <li className="dd-item faint">пока нет</li>}
        </ul>
      )}
    </div>
  )
}
