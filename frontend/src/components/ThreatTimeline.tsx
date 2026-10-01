// ThreatTimeline — visual threat activity heatmap/timeline
import { useEffect, useState } from 'react'
import { Activity, TrendingUp } from 'lucide-react'
import { api } from '../api'
import type { ThreatTimelineEntry } from '../types'

const THREAT_COLORS: Record<string, string> = {
  NONE: 'var(--clr-muted)',
  LOW: '#4a9eff',
  MEDIUM: 'var(--clr-warn)',
  HIGH: 'var(--clr-block)',
  CRITICAL: '#ff1744',
}

const DECISION_SHAPES: Record<string, string> = {
  ALLOW: '●',
  BLOCK: '■',
  REQUIRE_APPROVAL: '▲',
}

interface Props {
  refreshTrigger?: number
}

export function ThreatTimeline({ refreshTrigger }: Props) {
  const [entries, setEntries] = useState<ThreatTimelineEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.threatTimeline()
      setEntries(data)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [refreshTrigger])

  // Calculate stats
  const totalBlocks = entries.filter(e => e.decision === 'BLOCK').length
  const totalAllow = entries.filter(e => e.decision === 'ALLOW').length
  const totalApproval = entries.filter(e => e.decision === 'REQUIRE_APPROVAL').length
  const highThreats = entries.filter(e => e.threat_level === 'HIGH' || e.threat_level === 'CRITICAL').length

  // Group by time windows for the heatmap
  const maxCells = 40
  const recentEntries = entries.slice(-maxCells)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={14} color="var(--clr-accent)" />
          <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Threat Activity Timeline
          </span>
          {highThreats > 0 && (
            <span className="badge badge-block" style={{ fontSize: '0.58rem' }}>
              {highThreats} HIGH THREATS
            </span>
          )}
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading} style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
          <Activity size={10} />
          Refresh
        </button>
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--clr-text-dim)' }}>
          No events yet — run scenarios to see the threat timeline
        </div>
      ) : (
        <>
          {/* Heatmap bar */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 48, padding: '4px 0' }}>
            {recentEntries.map((entry, i) => {
              const heightMap: Record<string, number> = { NONE: 8, LOW: 16, MEDIUM: 28, HIGH: 40, CRITICAL: 48 }
              const h = heightMap[entry.threat_level] ?? 8
              return (
                <div
                  key={i}
                  title={`${entry.agent_id} → ${entry.tool} [${entry.decision}] (${entry.threat_level})`}
                  style={{
                    flex: 1,
                    height: h,
                    minWidth: 4,
                    background: THREAT_COLORS[entry.threat_level] ?? 'var(--clr-muted)',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.85,
                    transition: 'height 0.3s ease',
                    cursor: 'pointer',
                  }}
                />
              )
            })}
          </div>

          {/* Legend + stats row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Compact stats */}
            <div style={{ display: 'flex', gap: 12 }}>
              <Stat label="Allowed" value={totalAllow} color="var(--clr-allow)" />
              <Stat label="Blocked" value={totalBlocks} color="var(--clr-block)" />
              <Stat label="Approval" value={totalApproval} color="var(--clr-approval)" />
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 10 }}>
              {Object.entries(THREAT_COLORS).map(([level, color]) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 1, background: color }} />
                  <span style={{ fontSize: '0.6rem', color: 'var(--clr-text-dim)' }}>{level}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent events list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', maxHeight: 120, overflowY: 'auto' }}>
            {[...recentEntries].reverse().slice(0, 8).map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '3px 8px', fontSize: '0.68rem',
                  background: 'var(--clr-surface)',
                }}
              >
                <span style={{ color: THREAT_COLORS[entry.threat_level], fontSize: '0.85rem' }}>
                  {DECISION_SHAPES[entry.decision] ?? '●'}
                </span>
                <span style={{ color: 'var(--clr-text-dim)', width: 55, flexShrink: 0 }}>
                  {new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false })}
                </span>
                <span style={{ flex: 1 }}>{entry.agent_id}</span>
                <span style={{ color: 'var(--clr-text-dim)' }}>{entry.tool}</span>
                <span
                  className={`badge badge-${entry.decision === 'ALLOW' ? 'allow' : entry.decision === 'BLOCK' ? 'block' : 'approval'}`}
                  style={{ fontSize: '0.55rem', padding: '1px 5px' }}
                >
                  {entry.decision}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: '1rem', fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: '0.6rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}
