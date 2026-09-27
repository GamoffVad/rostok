import { SECTION_BY_ID, sectionItems } from '../data/methodology'
import { uid, yearPeriods } from './store'

// SheetJS подгружается только при импорте и выгрузке — в основной пакет не попадает.
const loadXlsx = () => import('xlsx')

// Колонки прежнего файла «Динамика речевого развития»: лист → раздел, первая строка детей, пробы по порядку колонок с C.
const LEGACY = [
  { re: /^звук/i, firstRow: 4, sections: [['sound', 13]] },
  { re: /^л\.?\s*г\.?\s*с/i, firstRow: 3, sections: [['lex', 12], ['gram', 6], ['coh', 3]] },
  { re: /^фонетика/i, firstRow: 3, sections: [['phon', 13]] },
]
// В прежнем файле 3 — норма, 0 — нарушено; в приложении шкала зеркальная.
const OLD_SOUND = { 3: 'norm', 2: 'auto', 1: 'stage', 0: 'broken' }

export async function importLegacyWorkbook(file) {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const summaryName = wb.SheetNames.find((n) => /динамика/i.test(n))
  if (!summaryName) throw new Error('В файле нет листа «динамика…»: это не файл мониторинга речевого развития.')
  const summary = XLSX.utils.sheet_to_json(wb.Sheets[summaryName], { header: 1, defval: null })

  const title = String(summary[0]?.[0] || '')
  const groupName = (title.match(/групп[аы]\s*№?\s*[\w-]+/i)?.[0] || file.name.replace(/\.xlsx?$/i, '')).replace(/^г/, 'Г')
  const startYear = Number(title.match(/(20\d{2})\s*[-–]\s*20\d{2}/)?.[1]) || new Date().getFullYear() - 1

  // ФИ детей: колонка B, строки 5–34 сводного листа
  const rows = []
  for (let r = 4; r < 34; r += 1) {
    const name = String(summary[r]?.[1] || '').trim()
    if (name) rows.push({ index: r - 4, name })
  }
  if (!rows.length) throw new Error('На листе «динамика» не найдены фамилии детей (колонка B, с 5-й строки).')

  const group = { id: uid(), name: groupName }
  const children = rows.map((row) => ({ id: uid(), groupId: group.id, name: row.name, birthDate: '', note: '', tpmpk: '', _row: row.index }))
  const periods = [...yearPeriods(`${startYear}–${startYear + 1}`), ...yearPeriods(`${startYear + 1}–${startYear + 2}`)]
  const scores = Object.fromEntries(children.map((c) => [c.id, {}]))
  let cells = 0

  for (const sheetName of wb.SheetNames) {
    const clean = sheetName.trim().replace(/\s+/g, ' ')
    const legacy = LEGACY.find((l) => l.re.test(clean))
    const m = clean.match(/(НГ|КГ)\s*(\d)\s*г/i)
    if (!legacy || !m) continue
    const period = periods[(Number(m[2]) - 1) * 2 + (m[1].toUpperCase() === 'НГ' ? 0 : 1)]
    if (!period) continue
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null })
    for (const child of children) {
      const row = grid[legacy.firstRow + child._row] || []
      let col = 2
      for (const [sectionId, count] of legacy.sections) {
        const section = SECTION_BY_ID[sectionId]
        const items = sectionItems(section).slice(0, count)
        items.forEach((item, i) => {
          const raw = row[col + i]
          if (raw === null || raw === '' || Number.isNaN(Number(raw))) return
          const old = Math.max(0, Math.min(3, Math.round(Number(raw))))
          const target = (scores[child.id][period.id] ||= {})
          target[item.id] = section.kind === 'sound' ? OLD_SOUND[old] : 3 - old
          cells += 1
        })
        col += count
      }
    }
  }

  children.forEach((c) => { delete c._row })
  return { part: { groups: [group], children, periods, scores, notes: {} }, stats: { children: children.length, cells, group: groupName } }
}

export async function exportSheets(fileName, sheets) {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, rows, widths }) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    if (widths) ws['!cols'] = widths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))
  })
  XLSX.writeFile(wb, fileName)
}

export function downloadText(fileName, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Шаблон библиотеки упражнений: одна строка — одна проба, упражнения в ячейке с новой строки.
export async function exportLibraryTemplate(blocks, library) {
  const rows = [['Блок', 'Раздел', 'Группа проб', 'Проба', 'Код (не менять)', 'Упражнения — каждое с новой строки (Alt+Enter)']]
  for (const block of blocks) {
    for (const section of block.sections) {
      for (const group of section.groups) {
        for (const item of group.items) rows.push([block.title, section.title, group.title, item.label, item.id, library[item.id] || ''])
      }
    }
  }
  const XLSX = await loadXlsx()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 26 }, { wch: 44 }, { wch: 10 }, { wch: 90 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Упражнения')
  XLSX.writeFile(wb, 'Росток — библиотека упражнений.xlsx')
}

// Загрузка заполненного шаблона: обновляются пробы с непустой ячейкой упражнений, остальные не трогаются.
export async function importLibraryTemplate(file, knownIds) {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null })
  const head = grid.findIndex((r) => r && r.some((c) => /^код/i.test(String(c || '').trim())))
  if (head < 0) throw new Error('Не найдена колонка «Код»: загрузите шаблон, выгруженный с этого экрана.')
  const idCol = grid[head].findIndex((c) => /^код/i.test(String(c || '').trim()))
  const textCol = grid[head].findIndex((c) => /^упражн/i.test(String(c || '').trim()))
  if (textCol < 0) throw new Error('Не найдена колонка «Упражнения».')
  const patch = {}
  for (const row of grid.slice(head + 1)) {
    const id = String(row?.[idCol] || '').trim()
    const text = String(row?.[textCol] ?? '').trim()
    if (id && text && knownIds.has(id)) patch[id] = text
  }
  return patch
}
