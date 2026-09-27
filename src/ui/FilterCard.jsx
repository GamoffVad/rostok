export default function FilterCard({ label, wide, children }) {
  return (
    <div className={`filter${wide ? ' filter--wide' : ''}`}>
      <span className="filter-label">{label}</span>
      {children}
    </div>
  )
}
