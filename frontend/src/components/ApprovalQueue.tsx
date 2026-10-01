// ApprovalQueue — human-in-the-loop approval/deny panel
import { useState } from 'react'
import { UserCheck, ShieldAlert, CheckCircle, XCircle, MessageSquare } from 'lucide-react'
import { api } from '../api'
import type { ApprovalQueueItem } from '../types'
import { InjectionHighlighter } from './InjectionHighlighter'

interface Props {
  pendingItems: ApprovalQueueItem[]
  onDecision?: () => void
}

export function ApprovalQueue({ pendingItems, onDecision }: Props) {
  const [deciding, setDeciding] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [decidedIds, setDecidedIds] = useState<Set<string>>(new Set())

  const decide = async (requestId: string, approved: boolean) => {
    setDeciding(requestId)
    try {
      await api.decideApproval({
        request_id: requestId,
        approved,
        reviewer_note: notes[requestId] || '',
      })
      setDecidedIds(prev => new Set(prev).add(requestId))
      onDecision?.()
    } catch (e) {
      console.error(e)
    } finally {
      setDeciding(null)
    }
  }

  const pending = pendingItems.filter(item => !decidedIds.has(item.request_id))

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <UserCheck size={14} color="var(--clr-approval)" />
        <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Human-in-the-Loop
        </span>
        {pending.length > 0 && (
          <span className="badge badge-approval" style={{ fontSize: '0.6rem' }}>
            {pending.length} PENDING
          </span>
        )}
      </div>

      {pending.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--clr-text-dim)' }}>
          <ShieldAlert size={24} color="var(--clr-muted)" style={{ marginBottom: 6 }} />
          <div>No actions awaiting approval</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--clr-muted)', marginTop: 4 }}>
            When an allowed capability is triggered with prompt injection signals,
            the gateway escalates to human review instead of auto-blocking.
          </div>
        </div>
      )}

      {pending.map(item => (
        <div
          key={item.request_id}
          className="fade-in"
          style={{
            border: '1px solid rgba(155,89,255,0.3)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '10px 12px',
            background: 'rgba(155,89,255,0.08)',
            borderBottom: '1px solid rgba(155,89,255,0.15)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div className="pulse-dot blue" />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--clr-approval)' }}>
              APPROVAL REQUIRED
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)', marginLeft: 'auto' }}>
              {item.agent_id}
            </span>
          </div>

          {/* Details */}
          <div style={{ padding: '10px 12px', background: 'rgba(155,89,255,0.03)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 12px', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase' }}>Tool</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{item.tool}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase' }}>Action</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{item.action}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase' }}>Resource</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--clr-warn)' }}>{item.resource}</div>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-dim)', lineHeight: 1.5, marginBottom: 8 }}>
              <strong>Reason:</strong> {item.reason}
            </div>

            {/* Risk signals */}
            {item.risk_signals.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {item.risk_signals.map(sig => (
                  <span key={sig} className="badge badge-warn" style={{ fontSize: '0.6rem' }}>{sig}</span>
                ))}
              </div>
            )}

            {/* Injection highlights */}
            {item.injection_matches && item.injection_matches.length > 0 && (
              <InjectionHighlighter matches={item.injection_matches} rawContext={item.raw_context} />
            )}

            {/* Reviewer note */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare size={12} color="var(--clr-text-dim)" />
              <input
                type="text"
                placeholder="Reviewer note (optional)…"
                value={notes[item.request_id] || ''}
                onChange={e => setNotes(prev => ({ ...prev, [item.request_id]: e.target.value }))}
                style={{
                  flex: 1, padding: '5px 8px', background: 'var(--clr-bg)', color: 'var(--clr-text)',
                  border: '1px solid var(--clr-border)', borderRadius: 3, fontSize: '0.72rem', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Approve / Deny buttons */}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                className="btn btn-allow"
                disabled={deciding === item.request_id}
                onClick={() => decide(item.request_id, true)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <CheckCircle size={14} />
                {deciding === item.request_id ? '…' : 'APPROVE'}
              </button>
              <button
                className="btn btn-danger"
                disabled={deciding === item.request_id}
                onClick={() => decide(item.request_id, false)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <XCircle size={14} />
                {deciding === item.request_id ? '…' : 'DENY'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
