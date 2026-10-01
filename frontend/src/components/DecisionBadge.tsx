// DecisionBadge — shows ALLOW / BLOCK / REQUIRE_APPROVAL as a pill badge
import type { Decision } from '../types'

interface Props { decision: Decision; size?: 'sm' | 'md' }

const MAP = {
  ALLOW:            { cls: 'badge-allow',    label: 'ALLOW' },
  BLOCK:            { cls: 'badge-block',    label: 'BLOCK' },
  REQUIRE_APPROVAL: { cls: 'badge-approval', label: 'APPROVAL' },
}

export function DecisionBadge({ decision, size = 'md' }: Props) {
  const { cls, label } = MAP[decision]
  return (
    <span className={`badge ${cls}`} style={size === 'sm' ? { fontSize: '0.68rem', padding: '1px 6px' } : {}}>
      {label}
    </span>
  )
}
