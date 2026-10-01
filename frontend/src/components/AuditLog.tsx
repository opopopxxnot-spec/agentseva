// AuditLog — live event ledger table with click-to-inspect
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { AuditEvent } from '../types'
import { DecisionBadge } from './DecisionBadge'

interface Props {
  events: AuditEvent[]
}

function ts(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour12: false })
}

export function AuditLog({ events }: Props) {
  const [selected, setSelected] = useState<AuditEvent | null>(null)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 0 10px 0' }}>
        Audit Ledger <span style={{ color: 'var(--clr-border)', fontWeight: 400 }}>— {events.length} events</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--clr-border)', maxHeight: 380, overflowY: 'auto' }}>
        {events.length === 0 && (
          <div style={{ background: 'var(--clr-surface)', padding: '20px', textAlign: 'center', color: 'var(--clr-text-dim)', fontSize: '0.78rem' }}>
            No events yet — run a scenario to see the audit trail
          </div>
        )}
        {events.map((evt) => {
          const isSelected = selected?.event_id === evt.event_id
          return (
            <div key={evt.event_id}>
              <div
                onClick={() => setSelected(isSelected ? null : evt)}
                style={{
                  background: isSelected ? 'rgba(0,191,255,0.05)' : 'var(--clr-surface)',
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  borderLeft: `2px solid ${evt.decision === 'ALLOW' ? 'var(--clr-allow)' : evt.decision === 'BLOCK' ? 'var(--clr-block)' : 'var(--clr-approval)'}`,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)', width: 60, flexShrink: 0 }}>{ts(evt.timestamp)}</span>
                <DecisionBadge decision={evt.decision} size="sm" />
                <span style={{ fontSize: '0.78rem', flex: 1 }}>{evt.tool}({evt.action}) → <span style={{ color: 'var(--clr-text-dim)' }}>{evt.resource}</span></span>
                <span style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)' }}>{evt.agent_id}</span>
                <span style={{ fontSize: '0.63rem', color: 'var(--clr-muted)', fontFamily: 'monospace' }}>{evt.hash_preview}</span>
                {isSelected ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>

              {/* Expanded event inspector */}
              {isSelected && (
                <div
                  className="fade-in"
                  style={{
                    background: 'rgba(0,191,255,0.03)',
                    borderLeft: '2px solid var(--clr-accent)',
                    padding: '10px 16px',
                    fontSize: '0.75rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px 24px',
                  }}
                >
                  <Field label="Request ID"    value={evt.request_id} mono />
                  <Field label="Agent"         value={evt.agent_id} />
                  <Field label="Tool"          value={evt.tool} />
                  <Field label="Action"        value={evt.action} />
                  <Field label="Resource"      value={evt.resource} />
                  <Field label="Category"      value={evt.category} />
                  <Field label="Policy Rule"   value={evt.policy_matched ?? '—'} />
                  <Field label="Threat Level"  value={evt.threat_level} />
                  <Field label="Hash"          value={evt.hash_preview} mono />
                  <Field label="Prev Hash"     value={evt.previous_hash.slice(0, 16) + '…'} mono />
                  <div style={{ gridColumn: '1/-1' }}>
                    <span style={{ color: 'var(--clr-text-dim)', display: 'block', marginBottom: 2 }}>REASON</span>
                    <span style={{ color: evt.decision === 'ALLOW' ? 'var(--clr-allow)' : 'var(--clr-block)', lineHeight: 1.5 }}>
                      {evt.reason}
                    </span>
                  </div>
                  {evt.risk_signals.length > 0 && (
                    <div style={{ gridColumn: '1/-1', display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      <span style={{ color: 'var(--clr-text-dim)', marginRight: 4 }}>RISK SIGNALS:</span>
                      {evt.risk_signals.map(s => (
                        <span key={s} className="badge badge-warn" style={{ fontSize: '0.63rem' }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ color: 'var(--clr-text-dim)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: mono ? 'monospace' : undefined, fontSize: '0.75rem', marginTop: 1 }}>{value}</div>
    </div>
  )
}
