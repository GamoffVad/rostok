// Токены дизайн-системы «Тёплый мел», цветовая схема «Ежевика».
// Значения совпадают с CSS-переменными в index.css.

export const C = {
  pageBg: '#F8F4EB',
  sheet: '#FFFDF8',
  text: '#2A2230',
  textSecondary: '#463E4D',
  textMuted: '#655C6C',
  textFaint: '#6B6272',
  darkBorder: '#CFC8BC',
  rowDivider: '#E0DAD0',
  primary: '#5A2B63',
  primaryLight: '#7A4A89',
  primaryHover: '#431F4A',
  soft: '#F0EADF',
  softAlt: '#F2EDE3',
  darkSoft: '#E9E2D6',
  amber: '#7A5312',
  danger: '#A32D22',
  ok: '#2C6B45',
}

// Цвета уровней 0–3: от нормы к выраженному несоответствию.
export const LEVEL = [
  { ink: '#2C6B45', bg: '#DDE9DF', name: 'норма' },
  { ink: '#746410', bg: '#EFE8CF', name: 'формируется' },
  { ink: '#9A5413', bg: '#F3E0CC', name: 'нужна коррекция' },
  { ink: '#A32D22', bg: '#F3DEDB', name: 'выраженное несоответствие' },
]

export const RADIUS = 2
export const DASH = `1px dashed ${C.darkBorder}`
export const LINE = `1px solid ${C.rowDivider}`
export const RULE = `1px solid ${C.primary}`
