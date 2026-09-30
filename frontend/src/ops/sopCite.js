const RULES = [
  { key: 'STRUCTURAL', test: /hatch|stow|sensor|sortie|outdoor/ },
  { key: 'THERMAL', test: /auxiliary|generator|heater/ },
  { key: 'FUEL_CRIT', test: /scientific|science|summer|shed|payload|depressur/ },
  { key: 'FUEL_ADV', test: /scientific|science|summer|shed|payload/ },
  { key: 'STARVE', test: /shed|essential|science|summer|fuel/ },
  { key: 'MISS_SEA', test: /sea|resupply|ship|voyage/ },
  { key: 'WX_WATCH', test: /stow|outdoor|lockout|watch/ },
]

export function citationForAction(action, citations) {
  if (!action || !citations?.length) return null
  const actionLower = String(action).toLowerCase()
  const mandated = citations.find((item) => {
    const text = String(item?.mandated_action || '').toLowerCase()
    return text && (text === actionLower || actionLower.includes(text.slice(0, 28)))
  })
  if (mandated) return mandated
  return (
    citations.find((item) => {
      const rule = RULES.find((entry) => entry.key === item?.rule_key)
      return rule ? rule.test.test(actionLower) : false
    }) || null
  )
}
