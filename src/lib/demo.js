import { ALL_SECTIONS, sectionItems } from '../data/methodology'
import { uid, yearPeriods } from './store'

// Учебный пример: вымышленные дети, воспроизводимые баллы (генератор с фиксированным зерном).
const NAMES = [
  'Белкина Соня', 'Воронов Лев', 'Грачёва Мила', 'Дроздов Тимур', 'Ежова Варя', 'Зайцев Платон',
  'Калинина Ева', 'Лисицын Марк', 'Орлова Алиса', 'Синицын Гриша', 'Соколова Тая', 'Чижов Рома',
]
const MAIN_SOUNDS = new Set(['s_s', 's_sj', 's_z', 's_zj', 's_c', 's_sh', 's_zh', 's_sch', 's_ch', 's_l', 's_lj', 's_r', 's_rj'])
const SOUND_BY_SCORE = ['norm', 'diff', 'auto', 'stage']

function rng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
const clamp = (v) => Math.max(0, Math.min(3, Math.round(v)))

export function buildDemo(now = new Date()) {
  const rand = rng(11)
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const periods = [...yearPeriods(`${y - 1}–${y}`), ...yearPeriods(`${y}–${y + 1}`)]
  const group = { id: uid(), name: 'Группа № 5 «Рябинка» (пример)' }
  const children = NAMES.map((name, i) => ({
    id: uid(), groupId: group.id, name, note: '', tpmpk: '',
    birthDate: `${y - 6}-${String(((i * 5) % 12) + 1).padStart(2, '0')}-${String(((i * 7) % 27) + 1).padStart(2, '0')}`,
  }))
  // вымышленные контакты; номера из несуществующего диапазона +7 900 000-…
  const DAD = ['Андрей', 'Сергей', 'Илья', 'Павел', 'Олег', 'Роман']
  const MOM = ['Анна', 'Мария', 'Елена', 'Ольга', 'Наталья', 'Ирина']
  const phone = (i, n, kind) => ({ id: uid(), kind, value: `+7 900 000-${String(10 + i).padStart(2, '0')}-0${n}` })
  children.forEach((child, i) => {
    const surname = child.name.split(' ')[0]
    const base = surname.replace(/а$/, '')
    child.relatives = [
      {
        id: uid(), role: 'мама', name: `${base}а ${MOM[i % 6]} Викторовна`, legal: true, note: i % 3 === 0 ? 'Удобно звонить после 18:00' : '',
        phones: [phone(i, 1, 'мобильный'), ...(i % 2 ? [phone(i, 4, 'рабочий')] : [])],
        emails: i % 3 === 1 ? [{ id: uid(), kind: '', value: `mama${i + 1}@example.ru` }] : [],
        addresses: [{ id: uid(), kind: 'проживания', value: `г. Примерск, ул. Садовая, д. ${i + 3}, кв. ${12 + i * 7}` }],
      },
      {
        id: uid(), role: 'папа', name: `${base} ${DAD[i % 6]} Николаевич`, legal: true, note: '',
        phones: [phone(i, 2, 'мобильный')], emails: [],
        addresses: i % 4 === 2 ? [{ id: uid(), kind: 'проживания', value: `г. Примерск, пр. Мира, д. ${20 + i}, кв. ${5 + i}` }] : [],
      },
      ...(i % 4 === 1 ? [{
        id: uid(), role: 'бабушка', name: `${base}а Галина Петровна`, legal: false, note: 'Забирает из сада по вторникам и четвергам',
        phones: [phone(i, 3, 'мобильный'), phone(i, 5, 'домашний')], emails: [],
        addresses: [{ id: uid(), kind: 'проживания', value: `г. Примерск, ул. Лесная, д. ${7 + i}` }],
      }] : []),
    ]
  })
  const scores = {}
  children.forEach((child) => {
    const severity = 0.9 + rand() * 1.8
    const pace = rand() < 0.2 ? 0.05 : 0.3 + rand() * 0.5
    scores[child.id] = {}
    // три заполненных среза: НГ и КГ прошлого года, НГ текущего
    periods.slice(0, 3).forEach((period, step) => {
      const level = severity - pace * step
      const data = {}
      for (const section of ALL_SECTIONS) {
        const weight = section.blockId === 'neuro' ? 0.7 : 1
        for (const item of sectionItems(section)) {
          const v = clamp(level * weight + (rand() - 0.5) * 1.6)
          if (section.kind === 'scale') data[item.id] = v
          else if (section.kind === 'sound') {
            if (!MAIN_SOUNDS.has(item.id)) continue
            data[item.id] = step === 0 && v === 3 && rand() > 0.5 ? 'broken' : SOUND_BY_SCORE[v]
          } else if (section.kind === 'side') data[item.id] = rand() > 0.82 ? 'left' : 'right'
          else if (section.kind === 'yesno') data[item.id] = rand() > 0.9 - level * 0.05 ? 'yes' : 'no'
          else data[item.id] = level > 2 && rand() > 0.5 ? 'chaotic' : 'formed'
        }
      }
      scores[child.id][period.id] = data
    })
  })
  // пример своих рекомендаций в программе коррекции на последнем заполненном срезе
  const programs = {}
  for (const child of children) {
    programs[child.id] = {
      [periods[2].id]: {
        threshold: 2,
        recs: [
          'Индивидуальные занятия с логопедом 2 раза в неделю, подгрупповые — 1 раз в неделю.',
          'Занятия с педагогом-психологом по развитию произвольной регуляции — 1 раз в неделю.',
        ].join('\n'),
        home: [
          'Артикуляционная гимнастика перед зеркалом ежедневно по 5–7 минут.',
          'Читать ребёнку каждый день и обсуждать прочитанное: кто? что делал? почему?',
          'Играть в «Назови ласково», «Один — много» по дороге в детский сад.',
        ].join('\n'),
      },
    }
  }
  return { groups: [group], children, periods, scores, notes: {}, programs }
}
