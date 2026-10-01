// ThreatChip — colour-coded threat level indicator
import type { ThreatLevel } from '../types'

interface Props { level: ThreatLevel }

const MAP: Record<ThreatLevel, { label: string; color: string }> = {
  NONE:     { label: 'NONE',     color: 'var(--clr-text-dim)' },
  LOW:      { label: 'LOW',      color: 'var(--clr-allow)'    },
  MEDIUM:   { label: 'MEDIUM',   color: 'var(--clr-warn)'     },
  HIGH:     { label: 'HIGH',     color: 'var(--clr-block)'    },
  CRITICAL: { label: 'CRITICAL', color: 'var(--clr-block)'    },
}

export function ThreatChip({ level }: Props) {
  const { label, color } = MAP[level]
  return (
    <span
      className="badge"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}44`,
        fontSize: '0.72rem',
      }}
    >
      ● {label}
    </span>
  )
}
