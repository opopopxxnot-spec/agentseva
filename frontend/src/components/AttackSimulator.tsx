// AttackSimulator — demo panel with scenario buttons
import { useState } from 'react'
import { Play, RotateCcw, Zap, ShieldAlert } from 'lucide-react'
import { api } from '../api'
import type { Scenario, ToolResponse } from '../types'
import { DecisionBadge } from './DecisionBadge'
import { ThreatChip } from './ThreatChip'

interface Props {
  scenarios: Scenario[]
  onResult?: (r: ToolResponse) => void
}

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  'safe-001':   <Play size={13} />,
  'attack-001': <ShieldAlert size={13} />,
  'attack-002': <Zap size={13} />,
  'attack-003': <Zap size={13} />,
  'attack-004': <Zap size={13} />,
}

export function AttackSimulator({ scenarios, onResult }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<(ToolResponse & { scenario_name: string }) | null>(null)
  const [resetting, setResetting] = useState(false)

  const run = async (s: Scenario) => {
    setLoading(s.scenario_id)
    try {
      const result = await api.runScenario(s.scenario_id)
      const enriched = { ...result, scenario_name: s.name }
      setLastResult(enriched)
      onResult?.(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  const reset = async () => {
    setResetting(true)
    try {
      await api.resetDemo()
      setLastResult(null)
    } finally {
      setResetting(false)
    }
  }

  const startSequence = async () => {
    setLoading('sequence')
    try {
      await api.startDemoSequence()
    } finally {
      setLoading(null)
    }
  }

  const isSafe = (id: string) => id.startsWith('safe')

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Attack Simulator
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-primary"
            onClick={startSequence}
            disabled={loading === 'sequence'}
            style={{ fontSize: '0.72rem' }}
          >
            <Play size={12} />
            {loading === 'sequence' ? 'Running…' : 'START DEMO'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={reset}
            disabled={resetting}
            style={{ fontSize: '0.72rem' }}
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* Scenario Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scenarios.map((s) => (
          <button
            key={s.scenario_id}
            onClick={() => run(s)}
            disabled={loading === s.scenario_id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '8px 12px',
              background: 'transparent',
              border: `1px solid ${isSafe(s.scenario_id) ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,87,0.2)'}`,
              borderRadius: 3,
              color: isSafe(s.scenario_id) ? 'var(--clr-allow)' : 'var(--clr-block)',
              textAlign: 'left',
              transition: 'background 0.15s',
              opacity: loading === s.scenario_id ? 0.6 : 1,
              cursor: 'pointer',
            }}
          >
            <span style={{ marginTop: 2, flexShrink: 0 }}>{SCENARIO_ICONS[s.scenario_id] ?? <Play size={13} />}</span>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)', marginTop: 2 }}>{s.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Last Result */}
      {lastResult && (
        <div
          style={{
            background: lastResult.decision === 'ALLOW' ? 'rgba(0,230,118,0.05)' : 'rgba(255,61,87,0.05)',
            border: `1px solid ${lastResult.decision === 'ALLOW' ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,87,0.2)'}`,
            borderRadius: 3,
            padding: '10px 12px',
          }}
          className="fade-in"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <DecisionBadge decision={lastResult.decision} />
            <ThreatChip level={lastResult.threat_level} />
            <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-dim)' }}>{lastResult.scenario_name}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-dim)', lineHeight: 1.5 }}>
            {lastResult.reason}
          </div>
          {lastResult.risk_signals.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {lastResult.risk_signals.map(sig => (
                <span key={sig} className="badge badge-warn" style={{ fontSize: '0.63rem' }}>{sig}</span>
              ))}
            </div>
          )}
          {lastResult.simulated_result && (
            <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--clr-allow)', opacity: 0.8 }}>
              ↳ {lastResult.simulated_result}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
