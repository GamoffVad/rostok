import { BLOCKS, RECOMMENDATIONS, isScored, optionsFor, sectionItems } from '../data/methodology'
import { itemScore, sectionStats } from './calc'

export { THRESHOLDS } from '../data/dictionaries'

// Проба — дефицит, если балл не ниже порога; звук — если он не в норме; сканирование — если не сформировано.
function isDeficit(section, value, threshold) {
  if (value === undefined || value === null) return false
  if (section.kind === 'sound') return value !== 'norm'
  if (section.kind === 'scale') return itemScore(section, value) >= threshold
  if (section.kind === 'choice') return value !== 'formed'
  return false
}

// Дефициты среза, сгруппированные по блокам и разделам. off — пробы, которые специалист исключил.
export function buildProgram(scores, program = {}) {
  const threshold = program.threshold ?? 2
  const off = new Set(program.off || [])
  const blocks = []
  let total = 0
  let active = 0
  for (const block of BLOCKS) {
    const sections = []
    for (const section of block.sections) {
      const opts = optionsFor(section)
      const items = sectionItems(section)
        .filter((item) => isDeficit(section, scores[item.id], threshold))
        .map((item) => {
          const value = scores[item.id]
          return { item, value, mark: opts.find((o) => o.value === value), score: itemScore(section, value), off: off.has(item.id) }
        })
      if (!items.length) continue
      total += items.length
      active += items.filter((i) => !i.off).length
      const st = isScored(section) ? sectionStats(section, scores) : null
      sections.push({ section, items, level: st?.level ?? null, mean: st?.mean ?? null, direction: RECOMMENDATIONS[section.id] || '' })
    }
    if (sections.length) blocks.push({ block, sections })
  }
  return { threshold, blocks, total, active }
}

export const exerciseLines = (text) => (text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
