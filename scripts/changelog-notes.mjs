// Печатает раздел CHANGELOG.md для версии: node scripts/changelog-notes.mjs 1.2.0
import { readFileSync } from 'node:fs'

const version = process.argv[2]
const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf-8').split(/\r?\n/)
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`))
if (start < 0) {
  console.error(`В CHANGELOG.md нет раздела ## [${version}]`)
  process.exit(1)
}
const rest = lines.slice(start + 1)
const end = rest.findIndex((l) => l.startsWith('## [') || /^\[[^\]]+\]: /.test(l))
console.log(rest.slice(0, end < 0 ? undefined : end).join('\n').trim())
