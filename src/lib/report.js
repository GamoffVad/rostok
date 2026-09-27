import { BLOCKS, RECOMMENDATIONS, SCAN_OPTIONS, SOUND_STATES, isScored, sectionItems } from '../data/methodology'
import { ageText, fmt, itemScore, outcome, sectionStats, speechMean } from './calc'
import { LEVEL_PHRASE, POINT_NAMES } from '../data/dictionaries'

const SIDE_WORD = {
  nl_eye: { right: 'правый', left: 'левый' },
  nl_hand: { right: 'правая', left: 'левая' },
  nl_foot: { right: 'правая', left: 'левая' },
}
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1)
const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Черновик заключения: собирается из баллов, специалист правит текст перед печатью.
export function buildReport({ child, group, period, scores, prevPeriod, prevScores, note }) {
  const SOUND_LABEL = Object.fromEntries(SOUND_STATES.map((s) => [s.value, s.label]))
  const lines = []
  lines.push('ЗАКЛЮЧЕНИЕ ПО РЕЗУЛЬТАТАМ ОБСЛЕДОВАНИЯ')
  lines.push('')
  const birth = child.birthDate ? `, дата рождения ${new Date(child.birthDate).toLocaleDateString('ru-RU')} (${ageText(child.birthDate)})` : ''
  lines.push(`Ребёнок: ${child.name}${birth}`)
  lines.push(`Группа: ${group?.name || '—'}`)
  lines.push(`Срез: ${period.year} учебный год, ${POINT_NAMES[period.point]}`)
  if (child.tpmpk) lines.push(`Заключение ТПМПК: ${child.tpmpk}`)

  for (const block of BLOCKS) {
    const parts = []
    const recs = []
    for (const section of block.sections) {
      const st = sectionStats(section, scores)
      if (!st.filled) continue
      const items = sectionItems(section)
      if (isScored(section)) {
        let text = `${section.title}: ${LEVEL_PHRASE[st.level]} (средний балл ${fmt(st.mean)}, уровень ${st.level}).`
        if (section.kind === 'sound') {
          const byState = {}
          items.forEach((i) => {
            const v = scores[i.id]
            if (v && v !== 'norm') (byState[v] ||= []).push(`[${i.label}]`)
          })
          const list = Object.entries(byState).map(([state, sounds]) => `${SOUND_LABEL[state]} — ${sounds.join(', ')}`)
          if (list.length) text += ` Звуки: ${list.join('; ')}.`
        } else {
          const hard = items.filter((i) => itemScore(section, scores[i.id]) >= 2).map((i) => lower(i.label))
          const forming = items.filter((i) => itemScore(section, scores[i.id]) === 1).map((i) => lower(i.label))
          if (hard.length) text += ` Требуют коррекции: ${hard.join('; ')}.`
          if (forming.length) text += ` Формируются: ${forming.join('; ')}.`
        }
        if (prevScores) {
          const prev = sectionStats(section, prevScores)
          if (prev.mean !== null) {
            const d = prev.mean - st.mean
            if (d >= 0.3) text += ` Динамика положительная (было ${fmt(prev.mean)}).`
            else if (d <= -0.3) text += ` Динамика отрицательная (было ${fmt(prev.mean)}).`
            else text += ' Без выраженной динамики.'
          }
        }
        parts.push(`— ${text}`)
        if (st.level >= 2 && RECOMMENDATIONS[section.id]) recs.push(RECOMMENDATIONS[section.id])
      } else if (section.kind === 'side') {
        const sides = items.filter((i) => scores[i.id]).map((i) => `${lower(i.short)} — ${SIDE_WORD[i.id][scores[i.id]]}`)
        parts.push(`— ${section.title}: ${sides.join(', ')}.`)
      } else if (section.kind === 'yesno') {
        const yes = items.filter((i) => scores[i.id] === 'yes').map((i) => lower(i.label))
        parts.push(`— ${section.title}: ${yes.length ? yes.join('; ') : 'не выявлены'}.`)
      } else {
        const opt = SCAN_OPTIONS.find((o) => o.value === scores[items[0].id])
        if (opt) parts.push(`— ${section.title}: ${opt.label}.`)
      }
    }
    if (!parts.length) continue
    lines.push('')
    lines.push(block.title.toUpperCase())
    lines.push(...parts)
    if (recs.length) {
      lines.push('')
      lines.push('Рекомендации:')
      recs.forEach((r, i) => lines.push(`${i + 1}. ${upper(r)}.`))
    }
  }

  if (prevScores && prevPeriod) {
    const res = outcome(speechMean(prevScores), speechMean(scores))
    if (res) {
      lines.push('')
      lines.push(`ИТОГ РЕЧЕВОГО РАЗВИТИЯ (${prevPeriod.year} ${prevPeriod.point} → ${period.year} ${period.point}): ${res.label}; средний балл ${fmt(speechMean(prevScores))} → ${fmt(speechMean(scores))}.`)
    }
  }
  if (note) {
    lines.push('')
    lines.push(`Наблюдения специалиста: ${note}`)
  }
  lines.push('')
  lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}          Специалист: ______________________`)
  return lines.join('\n')
}
