// StatsBar — top dashboard row with key metrics
import { Shield, Activity, Ban, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import type { GatewayStats } from '../types'

interface Props { stats: GatewayStats }

export function StatsBar({ stats }: Props) {
  const items = [
    {
      icon: <Shield size={16} />,
      label: 'Protected Agents',
      value: stats.protected_agents,
      color: 'var(--clr-accent)',
    },
    {
      icon: <Activity size={16} />,
      label: 'Total Calls',
      value: stats.total_tool_calls,
      color: 'var(--clr-text)',
    },
    {
      icon: <CheckCircle size={16} />,
      label: 'Allowed',
      value: stats.allowed_actions,
      color: 'var(--clr-allow)',
    },
    {
      icon: <Ban size={16} />,
      label: 'Blocked',
      value: stats.blocked_actions,
      color: 'var(--clr-block)',
    },
    {
      icon: <AlertTriangle size={16} />,
      label: 'Approvals',
      value: stats.approval_requests,
      color: 'var(--clr-approval)',
    },
    {
      icon: <Clock size={16} />,
      label: 'Sessions',
      value: stats.active_sessions,
      color: 'var(--clr-text-dim)',
    },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: '1px',
      background: 'var(--clr-border)',
      border: '1px solid var(--clr-border)',
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: 'var(--clr-surface)',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: item.color }}>
            {item.icon}
            <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {item.label}
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: item.color, lineHeight: 1.1 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}
