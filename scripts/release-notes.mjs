// Описание релиза: изменения по сравнению с предыдущей версией.
//   node scripts/release-notes.mjs v1.3.0 > notes.md
// Берёт раздел версии из CHANGELOG.md, добавляет коммиты с предыдущего тега и ссылку на сравнение.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const tag = process.argv[2]
if (!tag) {
  console.error('Укажите тег: node scripts/release-notes.mjs v1.3.0')
  process.exit(1)
}
const version = tag.replace(/^v/, '')
const repo = process.env.GITHUB_REPOSITORY || 'GamoffVad/rostok'
const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' }
}

// Разделы CHANGELOG идут от новой версии к старой: предыдущая версия — следующий раздел.
const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf-8').split(/\r?\n/)
const heads = lines.map((l, i) => [l.match(/^## \[([^\]]+)\]/)?.[1], i]).filter(([v]) => v)
const at = heads.findIndex(([v]) => v === version)
let section = ''
if (at >= 0) {
  const from = heads[at][1] + 1
  const rest = lines.slice(from)
  const end = rest.findIndex((l) => l.startsWith('## [') || /^\[[^\]]+\]: /.test(l))
  section = rest.slice(0, end < 0 ? undefined : end).join('\n').trim()
}
const prevFromChangelog = at >= 0 ? heads[at + 1]?.[0] : undefined

// Предыдущий тег в git — для списка коммитов и ссылки на сравнение.
const tags = sh('git tag --list "v*" --sort=-v:refname').split('\n').filter(Boolean)
const prevTag = tags[tags.indexOf(tag) + 1] || (tags.indexOf(tag) < 0 ? tags[0] : undefined)
const prevVersion = prevFromChangelog || prevTag?.replace(/^v/, '')

const out = []
out.push(prevVersion ? `## Что изменилось по сравнению с ${prevVersion}` : '## Первая версия')
out.push('')
out.push(section || '_В CHANGELOG.md нет описания этой версии — изменения видны по коммитам ниже._')

if (prevTag) {
  const commits = sh(`git log --no-merges --format=%s ${prevTag}..${tag}`)
    .split('\n').filter((c) => c && !/^Версия \d+\.\d+\.\d+$/.test(c))
  out.push('', `### Коммиты с ${prevTag}`, '')
  out.push(commits.length ? commits.map((c) => `- ${c}`).join('\n') : '- только смена номера версии')
  out.push('', `**Полное сравнение:** https://github.com/${repo}/compare/${prevTag}...${tag}`)
} else if (prevVersion) {
  out.push('', `_Версия ${prevVersion} выпускалась до публикации на GitHub, сравнение по коммитам недоступно._`)
}
console.log(out.join('\n'))
