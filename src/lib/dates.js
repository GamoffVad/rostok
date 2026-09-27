const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayIso = () => iso(new Date())

// Самая ранняя допустимая дата рождения: 25 лет назад (дошкольники и младшие школьники с запасом).
export const birthMin = () => {
  const d = new Date()
  return iso(new Date(d.getFullYear() - 25, 0, 1))
}
