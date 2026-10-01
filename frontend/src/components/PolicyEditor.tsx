// PolicyEditor — live policy management panel
import { useState } from 'react'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { api } from '../api'
import type { AgentPolicy } from '../types'

interface Props {
  policies: AgentPolicy[]
  onUpdate: () => void
}

const CAP_LABELS: Record<string, string> = {
  'read:public_documents': 'Read public documents',
  'search:web_cache':      'Search approved cache',
  'read:internal_docs':    'Read internal docs',
  'write:database':        'Write database',
  'read:secrets':          'Read secrets',
  'execute:shell':         'Execute shell',
  'network:external':      'Network (external)',
  'read:credentials':      'Read credentials',
  'data_export':           'Export sensitive data',
}

function allCapabilities(policy: AgentPolicy): string[] {
  return Array.from(new Set([...policy.capabilities.allowed, ...policy.capabilities.denied]))
}

export function PolicyEditor({ policies, onUpdate }: Props) {
  const [toggling, setToggling] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState(policies[0]?.agent_id ?? '')

  const policy = policies.find(p => p.agent_id === selectedAgent)

  const toggle = async (cap: string, currentlyAllowed: boolean) => {
    const key = `${selectedAgent}:${cap}`
    setToggling(key)
    try {
      await api.updateCapability({ agent_id: selectedAgent, capability: cap, permitted: !currentlyAllowed })
      onUpdate()
    } finally {
      setToggling(null)
    }
  }

  if (!policy) return null
  const caps = allCapabilities(policy)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Policy Editor
        </div>
        <button className="btn btn-ghost" onClick={onUpdate} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
          <RefreshCw size={11} /> Reload
        </button>
      </div>

      {/* Agent selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {policies.map(p => (
          <button
            key={p.agent_id}
            onClick={() => setSelectedAgent(p.agent_id)}
            className={selectedAgent === p.agent_id ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: '0.72rem', padding: '4px 10px' }}
          >
            {p.agent_id}
          </button>
        ))}
      </div>

      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-dim)', marginTop: -4 }}>
        {policy.description}
      </div>

      {/* Capability toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {caps.map(cap => {
          const isAllowed = policy.capabilities.allowed.includes(cap)
          const key = `${selectedAgent}:${cap}`
          const busy = toggling === key

          return (
            <div
              key={cap}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                background: isAllowed ? 'rgba(0,230,118,0.05)' : 'rgba(255,61,87,0.04)',
                border: `1px solid ${isAllowed ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.15)'}`,
                borderRadius: 3,
              }}
            >
              {isAllowed
                ? <CheckCircle size={14} color="var(--clr-allow)" />
                : <XCircle    size={14} color="var(--clr-block)" />
              }
              <span style={{ flex: 1, fontSize: '0.78rem' }}>
                {CAP_LABELS[cap] ?? cap}
              </span>
              <span style={{ fontSize: '0.63rem', color: 'var(--clr-text-dim)', fontFamily: 'monospace' }}>
                {cap}
              </span>
              <button
                onClick={() => toggle(cap, isAllowed)}
                disabled={busy}
                className={isAllowed ? 'btn btn-danger' : 'btn btn-allow'}
                style={{ fontSize: '0.68rem', padding: '2px 8px' }}
              >
                {busy ? '…' : isAllowed ? 'Revoke' : 'Grant'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
