import { BLOCKS, ALL_SECTIONS, RECOMMENDATIONS, SCALE, SCAN_OPTIONS, SIDE_OPTIONS, SOUND_STATES, YESNO_OPTIONS, isScored } from '../data/methodology'
import { ADDRESS_KINDS, LEVEL_PHRASE, OUTCOMES, PARENT_LEVEL, PHONE_KINDS, POINT_NAMES, ROLES, THRESHOLDS } from '../data/dictionaries'
import { LEVEL } from '../theme'

// Реестр словарей для «Администрирование → Словари».
// Правки хранятся в db.dicts только там, где отличаются от значений по умолчанию:
//   табличный словарь — db.dicts[id][код строки][поле] = текст
//   список            — db.dicts[id] = [значения]
// applyDicts накладывает правки на объекты методики на месте; пустая правка = значение по умолчанию.

const byValue = (list) => (row) => list.find((o) => String(o.value) === row)
const section = (id) => ALL_SECTIONS.find((s) => s.id === id)

export const DICTS = [
  {
    id: 'levels', group: 'Оценка', title: 'Уровни 0–3', type: 'table',
    hint: 'Название уровня — в легендах и графиках; описание — в протоколах и справке; формулировки — в заключении и отчёте для родителей.',
    rows: () => ['0', '1', '2', '3'].map((k) => ({ key: k, lead: '', level: Number(k) })),
    fields: [
      { key: 'name', label: 'Название', target: (r) => [LEVEL[r], 'name'] },
      { key: 'scale', label: 'Описание балла', target: (r) => [SCALE[r], 'label'], multiline: true },
      { key: 'phrase', label: 'В заключении', target: (r) => [LEVEL_PHRASE, r], multiline: true },
      { key: 'parent', label: 'Для родителей', target: (r) => [PARENT_LEVEL, r], multiline: true },
    ],
  },
  {
    id: 'sound', group: 'Оценка', title: 'Этапы звукопроизношения', type: 'table',
    hint: 'Знак — буква в протоколе и на кнопке отметки (1–2 символа). Балл этапа менять нельзя: от него зависит расчёт.',
    rows: () => SOUND_STATES.map((s) => ({ key: s.value, lead: `балл ${s.score}`, level: s.score })),
    fields: [
      { key: 'mark', label: 'Знак', target: (r) => [byValue(SOUND_STATES)(r), 'mark'], max: 2, narrow: true },
      { key: 'label', label: 'Название этапа', target: (r) => [byValue(SOUND_STATES)(r), 'label'] },
    ],
  },
  {
    id: 'answers', group: 'Оценка', title: 'Варианты ответов', type: 'table',
    hint: 'Латеральность (глаз, рука, нога), ошибки и наблюдаемые симптомы.',
    rows: () => [
      { key: 'right', lead: 'латеральность' }, { key: 'left', lead: 'латеральность' },
      { key: 'no', lead: 'есть / нет' }, { key: 'yes', lead: 'есть / нет' },
    ],
    fields: [
      { key: 'mark', label: 'Знак', target: (r) => [byValue([...SIDE_OPTIONS, ...YESNO_OPTIONS])(r), 'mark'], max: 2, narrow: true },
      { key: 'label', label: 'Название', target: (r) => [byValue([...SIDE_OPTIONS, ...YESNO_OPTIONS])(r), 'label'] },
    ],
  },
  {
    id: 'scan', group: 'Оценка', title: 'Стратегии сканирования', type: 'table',
    hint: 'Варианты для пробы «Стратегия сканирования зрительного поля». Первый вариант считается нормой.',
    rows: () => SCAN_OPTIONS.map((o) => ({ key: o.value, lead: o.mark })),
    fields: [{ key: 'label', label: 'Название', target: (r) => [byValue(SCAN_OPTIONS)(r), 'label'] }],
  },
  {
    id: 'blocks', group: 'Методика', title: 'Блоки методики', type: 'table',
    rows: () => BLOCKS.map((b) => ({ key: b.id, lead: b.id === 'speech' ? 'речь' : 'нейро' })),
    fields: [{ key: 'title', label: 'Название блока', target: (r) => [BLOCKS.find((b) => b.id === r), 'title'] }],
  },
  {
    id: 'sections', group: 'Методика', title: 'Разделы', type: 'table',
    hint: 'Полное название — в заголовках и отчётах; краткое — на вкладках, в графиках и списках.',
    rows: () => ALL_SECTIONS.map((s) => ({ key: s.id, lead: s.blockId === 'speech' ? 'речь' : 'нейро' })),
    fields: [
      { key: 'title', label: 'Полное название', target: (r) => [section(r), 'title'] },
      { key: 'short', label: 'Краткое', target: (r) => [section(r), 'short'], narrow: true },
    ],
  },
  {
    id: 'groups', group: 'Методика', title: 'Группы проб', type: 'table',
    hint: 'Подзаголовки внутри раздела: «Свистящие», «Словарь признаков»…',
    filterBySection: true,
    rows: () => ALL_SECTIONS.flatMap((s) => s.groups.map((g, i) => ({ key: `${s.id}#${i}`, section: s.id, lead: s.short }))),
    fields: [{ key: 'title', label: 'Название группы', target: (r) => { const [sid, i] = r.split('#'); return [section(sid).groups[Number(i)], 'title'] } }],
  },
  {
    id: 'items', group: 'Методика', title: 'Пробы', type: 'table',
    hint: 'Полное название — в обследовании, программе и отчётах; краткое — в заголовках столбцов протокола и графиках. Код пробы не меняется, поэтому баллы и упражнения сохраняются.',
    filterBySection: true,
    rows: () => ALL_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.items.map((it) => ({ key: it.id, section: s.id, lead: it.id })))),
    fields: [
      { key: 'label', label: 'Полное название', target: (r) => [itemById(r), 'label'], multiline: true },
      { key: 'short', label: 'Краткое', target: (r) => [itemById(r), 'short'], narrow: true },
    ],
  },
  {
    id: 'directions', group: 'Методика', title: 'Направления работы', type: 'table',
    hint: 'Текст «Направление работы» в программе коррекции и рекомендации в заключении для разделов с уровнем 2–3.',
    rows: () => ALL_SECTIONS.filter((s) => isScored(s) || s.kind === 'choice').map((s) => ({ key: s.id, lead: s.short })),
    fields: [{ key: 'text', label: 'Направление работы', target: (r) => [RECOMMENDATIONS, r], multiline: true }],
  },
  {
    id: 'outcomes', group: 'Результаты', title: 'Итоги коррекционной работы', type: 'table',
    hint: 'Подписи итогов на экране «Динамика», в карте ребёнка, заключении и выгрузках. Правила расчёта не меняются.',
    rows: () => OUTCOMES.map((o) => ({ key: o.id, lead: { norm: 'норма', major: 'Δ ≥ 1,0', minor: 'Δ ≥ 0,3', none: '|Δ| < 0,3', worse: 'Δ ≤ −0,3' }[o.id] })),
    fields: [{ key: 'label', label: 'Название итога', target: (r) => [OUTCOMES.find((o) => o.id === r), 'label'] }],
  },
  {
    id: 'thresholds', group: 'Результаты', title: 'Пороги дефицита', type: 'table',
    hint: 'Варианты «Что считать дефицитом» в программе коррекции.',
    rows: () => THRESHOLDS.map((t) => ({ key: String(t.value), lead: `балл ≥ ${t.value}` })),
    fields: [{ key: 'label', label: 'Название', target: (r) => [byValue(THRESHOLDS)(r), 'label'] }],
  },
  {
    id: 'points', group: 'Результаты', title: 'Срезы', type: 'table',
    hint: 'Полное название точки среза — в заключении и отчёте для родителей. Код (НГ, КГ) хранится в данных и не меняется.',
    rows: () => Object.keys(POINT_NAMES).map((k) => ({ key: k, lead: k })),
    fields: [{ key: 'label', label: 'Полное название', target: (r) => [POINT_NAMES, r] }],
  },
  { id: 'roles', group: 'Контакты', title: 'Кем приходится', type: 'list', list: ROLES, hint: 'Подсказки в поле «Кем приходится» у родителей и родственников. В карточке по-прежнему можно вписать своё.' },
  { id: 'phoneKinds', group: 'Контакты', title: 'Виды телефонов', type: 'list', list: PHONE_KINDS, hint: 'Подсказки для вида телефона; новый телефон получает виды по очереди.' },
  { id: 'addressKinds', group: 'Контакты', title: 'Виды адресов', type: 'list', list: ADDRESS_KINDS, hint: 'Подсказки для вида адреса.' },
]

export const DICT_BY_ID = Object.fromEntries(DICTS.map((d) => [d.id, d]))

function itemById(id) {
  for (const s of ALL_SECTIONS) for (const g of s.groups) for (const it of g.items) if (it.id === id) return it
  return null
}

// Значения по умолчанию снимаются один раз — до того, как на объекты легли правки.
const DEFAULTS = {}
for (const d of DICTS) {
  if (d.type === 'list') { DEFAULTS[d.id] = [...d.list]; continue }
  DEFAULTS[d.id] = {}
  for (const row of d.rows()) {
    DEFAULTS[d.id][row.key] = {}
    for (const f of d.fields) {
      const [obj, prop] = f.target(row.key)
      DEFAULTS[d.id][row.key][f.key] = obj?.[prop] ?? ''
    }
  }
}

export const defaultValue = (dictId, row, field) => DEFAULTS[dictId]?.[row]?.[field] ?? ''
export const defaultList = (dictId) => DEFAULTS[dictId] || []

export function applyDicts(overrides = {}) {
  for (const d of DICTS) {
    const ov = overrides[d.id]
    if (d.type === 'list') {
      const next = Array.isArray(ov) ? ov.map((s) => s.trim()).filter(Boolean) : DEFAULTS[d.id]
      d.list.splice(0, d.list.length, ...(next.length ? next : DEFAULTS[d.id]))
      continue
    }
    for (const row of d.rows()) {
      for (const f of d.fields) {
        const [obj, prop] = f.target(row.key)
        if (!obj) continue
        const v = ov?.[row.key]?.[f.key]
        obj[prop] = typeof v === 'string' && v.trim() ? v.trim() : DEFAULTS[d.id][row.key][f.key]
      }
    }
  }
}

// Сколько значений словаря изменено — для счётчика в списке словарей.
export function changedCount(dictId, overrides = {}) {
  const ov = overrides[dictId]
  if (!ov) return 0
  if (Array.isArray(ov)) return 1
  return Object.values(ov).reduce((n, fields) => n + Object.values(fields).filter((v) => typeof v === 'string' && v.trim()).length, 0)
}
