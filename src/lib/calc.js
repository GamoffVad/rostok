import { ALL_SECTIONS, SOUND_STATES, SPEECH_SECTIONS, isScored, sectionItems } from '../data/methodology'

const SOUND_SCORE = Object.fromEntries(SOUND_STATES.map((s) => [s.value, s.score]))

// Балл одной пробы по единой шкале 0–3 (null — не заполнено или не балльная проба).
export function itemScore(section, value) {
  if (value === undefined || value === null || value === '') return null
  if (section.kind === 'scale') return Number(value)
  if (section.kind === 'sound') return SOUND_SCORE[value] ?? null
  return null
}

// Пороги уровня. В Excel: ЕСЛИ(ср<=0.9;0;ЕСЛИ(ср<=1.4;1;ЕСЛИ(ср<=2.4;2;3))) при шкале «3 — норма».
// Здесь шкала зеркальная («0 — норма»), поэтому пороги отражены: 3 − x.
export function levelOf(mean) {
  if (mean === null || mean === undefined || Number.isNaN(mean)) return null
  if (mean < 0.6) return 0
  if (mean < 1.6) return 1
  if (mean < 2.1) return 2
  return 3
}

export function sectionStats(section, scores = {}) {
  const items = sectionItems(section)
  let filled = 0
  let sum = 0
  let counted = 0
  let yes = 0
  for (const item of items) {
    const v = scores[item.id]
    if (v === undefined || v === null || v === '') continue
    filled += 1
    const s = itemScore(section, v)
    if (s !== null) { sum += s; counted += 1 }
    if (v === 'yes') yes += 1
  }
  const mean = counted ? sum / counted : null
  return { total: items.length, filled, sum, counted, mean, level: levelOf(mean), yes }
}

export function blockMean(sections, scores) {
  const means = sections.filter(isScored).map((s) => sectionStats(s, scores).mean).filter((m) => m !== null)
  if (!means.length) return null
  return means.reduce((a, b) => a + b, 0) / means.length
}

export const speechMean = (scores) => blockMean(SPEECH_SECTIONS, scores)

export function totalProgress(scores = {}) {
  let filled = 0
  let total = 0
  for (const s of ALL_SECTIONS) {
    const st = sectionStats(s, scores)
    filled += st.filled
    total += st.total
  }
  return { filled, total }
}

// Итог коррекционной работы: сравнение среднего на начало и конец.
export function outcome(startMean, endMean) {
  if (startMean === null || endMean === null) return null
  const delta = startMean - endMean
  if (levelOf(endMean) === 0) return { id: 'norm', label: 'возрастная норма', delta }
  if (delta >= 1) return { id: 'major', label: 'значительное улучшение', delta }
  if (delta >= 0.3) return { id: 'minor', label: 'улучшение', delta }
  if (delta > -0.3) return { id: 'none', label: 'без выраженной динамики', delta }
  return { id: 'worse', label: 'отрицательная динамика', delta }
}

export const OUTCOMES = [
  { id: 'norm', label: 'возрастная норма' },
  { id: 'major', label: 'значительное улучшение' },
  { id: 'minor', label: 'улучшение' },
  { id: 'none', label: 'без выраженной динамики' },
  { id: 'worse', label: 'отрицательная динамика' },
]

// Распределение детей по уровням 0–3 для раздела и среза (аналог СЧЁТЕСЛИ в сводной).
export function levelDistribution(section, childIds, getScores) {
  const dist = [0, 0, 0, 0]
  let n = 0
  for (const id of childIds) {
    const lvl = sectionStats(section, getScores(id)).level
    if (lvl !== null) { dist[lvl] += 1; n += 1 }
  }
  return { dist, n }
}

export const fmt = (x, d = 2) => (x === null || x === undefined ? '—' : x.toFixed(d).replace('.', ','))
export const fmtDelta = (x) => (x === null || x === undefined ? '' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2).replace('.', ',')}`)

export function ageAt(birthDate, at = new Date()) {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return null
  let months = (at.getFullYear() - b.getFullYear()) * 12 + at.getMonth() - b.getMonth()
  if (at.getDate() < b.getDate()) months -= 1
  if (months < 0) return null
  return { years: Math.floor(months / 12), months: months % 12 }
}

export function ageText(birthDate) {
  const a = ageAt(birthDate)
  if (!a) return ''
  const y = a.years
  const yWord = y % 10 === 1 && y % 100 !== 11 ? 'год' : y % 10 >= 2 && y % 10 <= 4 && (y % 100 < 12 || y % 100 > 14) ? 'года' : 'лет'
  return a.months ? `${y} ${yWord} ${a.months} мес.` : `${y} ${yWord}`
}
