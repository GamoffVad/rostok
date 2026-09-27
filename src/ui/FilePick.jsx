import { useRef, useState } from 'react'

// Выбор файла библиотеки: наша кнопка открывает системный диалог (его заменить нельзя),
// а файл можно просто перетащить на кнопку — она подсвечивается.
export default function FilePick({ accept, onFile, disabled, className = 'btn-ghost', children }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const take = (file) => { if (file && !disabled) onFile(file) }

  return (
    <>
      <button type="button" className={`${className} file-pick${over ? ' is-over' : ''}`} disabled={disabled}
        onClick={() => input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]) }}>
        {children}
      </button>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = '' }} />
    </>
  )
}
