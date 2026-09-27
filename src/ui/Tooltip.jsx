import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Подсказки библиотеки вместо системного title: любой элемент с data-tip="…" получает
// подсказку в стиле приложения — при наведении (с задержкой) и при фокусе с клавиатуры.
// Слой один на приложение, подключается в App.
export default function TooltipLayer() {
  const [tip, setTip] = useState(null)
  const box = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    let timer
    const target = (e) => (e.target instanceof Element ? e.target.closest('[data-tip]') : null)
    const show = (el) => {
      const text = el.getAttribute('data-tip')
      if (!text) return
      setTip({ text, rect: el.getBoundingClientRect() })
    }
    const hide = () => { clearTimeout(timer); setTip(null) }
    const onOver = (e) => {
      const el = target(e)
      clearTimeout(timer)
      if (!el) { setTip(null); return }
      timer = setTimeout(() => show(el), 300)
    }
    const onFocus = (e) => { const el = target(e); if (el && el.matches(':focus-visible')) show(el) }
    document.addEventListener('mouseover', onOver)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', hide)
    document.addEventListener('mousedown', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('mousedown', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  // Подсказка над элементом; у верхнего края — под ним; по горизонтали не выходит за экран
  useLayoutEffect(() => {
    if (!tip || !box.current) { setPos(null); return }
    const w = box.current.offsetWidth
    const h = box.current.offsetHeight
    const { rect } = tip
    const below = rect.top < h + 12
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2))
    setPos({ left, top: below ? rect.bottom + 8 : rect.top - h - 8 })
  }, [tip])

  if (!tip) return null
  return (
    <div className="tip" role="tooltip" ref={box} style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
      {tip.text}
    </div>
  )
}
