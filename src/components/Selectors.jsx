import Dropdown from './Dropdown'
import FilterCard from './FilterCard'
import { setUi } from '../lib/ui'
import { periodLabel } from '../lib/store'

export function GroupFilter({ db, group }) {
  return (
    <FilterCard label="Группа">
      <Dropdown label="Группа" value={group?.id} options={db.groups.map((g) => ({ value: g.id, label: g.name }))} onChange={(groupId) => setUi({ groupId })} />
    </FilterCard>
  )
}

export function PeriodFilter({ db, period, label = 'Срез' }) {
  return (
    <FilterCard label={label}>
      <Dropdown label={label} value={period?.id} options={db.periods.map((p) => ({ value: p.id, label: periodLabel(p) }))} onChange={(periodId) => setUi({ periodId })} />
    </FilterCard>
  )
}
