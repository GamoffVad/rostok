import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Dropdown from './Dropdown'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons'

// Поле даты библиотеки «Росток»: ввод по маске дд.мм.гггг и свой календарь вместо системного.
// Значение — строка ISO «ГГГГ-ММ-ДД» или ''.

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

const pad = (n) => String(n).padStart(2, '0')
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 ? d : null
}
const isoToText = (s) => {
  const d = fromIso(s)
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : ''
}
// «07031998» или «7.3.1998» → «07.03.1998» по мере набора
const mask = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.')
}
const parseText = (text) => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? d : null
}
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d, n) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()))
}

export default function DatePicker({ value, onChange, min, max, label = 'Дата', placeholder = 'дд.мм.гггг', invalidText = 'Такой даты нет' }) {
  const [text, setText] = useState(isoToText(value))
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => fromIso(value) || new Date())
  const root = useRef(null)
  const grid = useRef(null)
  const toggle = useRef(null)
  const id = useId()
  const minD = fromIso(min)
  const maxD = fromIso(max)
  const selected = fromIso(value)
  // сегодня без времени: иначе «сейчас» позже полуночи и сегодняшний день считается вне диапазона
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  useEffect(() => { setText(isoToText(value)); setError('') }, [value])

  const outOfRange = (d) => (minD && d < minD) || (maxD && d > maxD)

  const commit = (d) => {
    if (!d) return
    if (outOfRange(d)) { setError(maxD && d > maxD ? `Не позже ${isoToText(max)}` : `Не раньше ${isoToText(min)}`); return }
    setError('')
    onChange(toIso(d))
  }

  const onType = (e) => {
    const next = mask(e.target.value)
    setText(next)
    setError('')
    if (next.length === 10) {
      const d = parseText(next)
      if (d) { commit(d); setCursor(d) } else setError(invalidText)
    } else if (!next) onChange('')
  }
  const onBlurText = () => {
    if (text && text.length < 10) setError('Введите дату полностью: дд.мм.гггг')
  }

  const openCalendar = () => {
    setCursor(selected || (maxD && today > maxD ? maxD : today))
    setOpen(true)
  }
  const close = (refocus) => {
    setOpen(false)
    if (refocus) toggle.current?.focus()
  }

  // Закрытие по клику вне поля и календаря
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [open])

  // Фокус держится на выбранном дне — стрелки двигают его, как в таблице
  useEffect(() => {
    if (open) grid.current?.querySelector('[data-cursor="true"]')?.focus({ preventScroll: true })
  }, [open, cursor])

  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const shift = (first.getDay() + 6) % 7
    const start = addDays(first, -shift)
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (__, d) => addDays(start, w * 7 + d)))
  }, [cursor])

  const years = useMemo(() => {
    const top = (maxD || addMonths(today, 12 * 5)).getFullYear()
    const bottom = (minD || new Date(today.getFullYear() - 100, 0, 1)).getFullYear()
    return Array.from({ length: top - bottom + 1 }, (_, i) => top - i).map((y) => ({ value: y, label: String(y) }))
  }, [min, max]) // eslint-disable-line react-hooks/exhaustive-deps

  const onGridKey = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (moves[e.key]) { e.preventDefault(); setCursor((c) => addDays(c, moves[e.key])); return }
    if (e.key === 'PageUp') { e.preventDefault(); setCursor((c) => addMonths(c, e.shiftKey ? -12 : -1)); return }
    if (e.key === 'PageDown') { e.preventDefault(); setCursor((c) => addMonths(c, e.shiftKey ? 12 : 1)); return }
    if (e.key === 'Home') { e.preventDefault(); setCursor((c) => addDays(c, -((c.getDay() + 6) % 7))); return }
    if (e.key === 'End') { e.preventDefault(); setCursor((c) => addDays(c, 6 - ((c.getDay() + 6) % 7))); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!outOfRange(cursor)) { commit(cursor); close(true) } }
  }

  return (
    <div className={`dp${error ? ' is-invalid' : ''}`} ref={root} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close(true) } }}>
      <div className="dp-field">
        <input className="input dp-input" inputMode="numeric" autoComplete="off" value={text} placeholder={placeholder}
          aria-label={label} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
          onChange={onType} onBlur={onBlurText} />
        <button type="button" className="dp-toggle" ref={toggle} aria-label="Открыть календарь" aria-expanded={open} aria-haspopup="dialog"
          onClick={() => (open ? close(false) : openCalendar())}><CalendarIcon /></button>
      </div>
      {error && <span className="dp-error" id={`${id}-err`} role="alert">{error}</span>}

      {open && (
        <div className="dp-pop" role="dialog" aria-label={`${label}: календарь`}>
          <div className="dp-head">
            <button type="button" className="icon-btn" aria-label="Предыдущий месяц" onClick={() => setCursor((c) => addMonths(c, -1))}><ChevronLeftIcon /></button>
            <Dropdown variant="light" label="Месяц" value={cursor.getMonth()} options={MONTHS.map((m, i) => ({ value: i, label: m }))}
              onChange={(m) => setCursor((c) => new Date(c.getFullYear(), m, Math.min(c.getDate(), new Date(c.getFullYear(), m + 1, 0).getDate())))} />
            <Dropdown variant="light" label="Год" value={cursor.getFullYear()} options={years}
              onChange={(y) => setCursor((c) => new Date(y, c.getMonth(), Math.min(c.getDate(), new Date(y, c.getMonth() + 1, 0).getDate())))} />
            <button type="button" className="icon-btn" aria-label="Следующий месяц" onClick={() => setCursor((c) => addMonths(c, 1))}><ChevronRightIcon /></button>
          </div>
          <div className="dp-grid" role="grid" ref={grid} onKeyDown={onGridKey}>
            <div className="dp-row" role="row">{WEEKDAYS.map((w) => <span key={w} className="dp-wd" role="columnheader">{w}</span>)}</div>
            {weeks.map((week, wi) => (
              <div className="dp-row" role="row" key={wi}>
                {week.map((d) => {
                  const off = d.getMonth() !== cursor.getMonth()
                  const disabled = outOfRange(d)
                  const isCursor = sameDay(d, cursor)
                  return (
                    <button type="button" key={d.getTime()} role="gridcell" tabIndex={isCursor ? 0 : -1} data-cursor={isCursor}
                      aria-selected={sameDay(d, selected)} aria-disabled={disabled || undefined}
                      aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
                      className={`dp-day${off ? ' is-off' : ''}${sameDay(d, today) ? ' is-today' : ''}${sameDay(d, selected) ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                      onClick={() => { if (disabled) return; commit(d); close(true) }}>
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="dp-foot">
            <button type="button" className="text-action danger" onClick={() => { onChange(''); setText(''); close(true) }}><span>очистить</span></button>
            {!outOfRange(today) && <button type="button" className="text-action" onClick={() => { commit(today); close(true) }}><span>сегодня</span></button>}
          </div>
        </div>
      )}
    </div>
  )
}
