// LiveTrace — animated execution trace that updates as events stream in
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Bot, FileText, AlertTriangle, ShieldOff, Shield, CheckCircle, Ban, Database } from 'lucide-react'
import type { AuditEvent } from '../types'

interface Props { latestEvent: AuditEvent | null }

interface TraceStep {
  id: string
  icon: React.ReactNode
  label: string
  sublabel?: string
  state: 'idle' | 'active' | 'allowed' | 'blocked' | 'approval'
}

function idleSteps(): TraceStep[] {
  return [
    { id: 'agent',    icon: <Bot size={14} />,          label: 'Agent',             state: 'idle' },
    { id: 'context',  icon: <FileText size={14} />,     label: 'External Context',  state: 'idle' },
    { id: 'tool',     icon: <Database size={14} />,     label: 'Tool Request',      state: 'idle' },
    { id: 'gateway',  icon: <Shield size={14} />,       label: 'Gateway',           state: 'idle' },
    { id: 'policy',   icon: <ShieldOff size={14} />,    label: 'Policy Evaluation', state: 'idle' },
    { id: 'decision', icon: <AlertTriangle size={14} />,label: 'Decision',          state: 'idle' },
    { id: 'audit',    icon: <CheckCircle size={14} />,  label: 'Audit Ledger',      state: 'idle' },
  ]
}

function activeSteps(event: AuditEvent): TraceStep[] {
  const decState = event.decision === 'ALLOW' ? 'allowed'
                 : event.decision === 'BLOCK' ? 'blocked'
                 : 'approval'

  const riskSignals = event.risk_signals ?? []

  return [
    { id: 'agent',    icon: <Bot size={14} />,       label: 'Agent',            sublabel: event.agent_id,                                         state: 'active' },
    { id: 'context',  icon: <FileText size={14} />,  label: 'External Context', sublabel: event.resource,                                         state: riskSignals.includes('PROMPT_INJECTION_DETECTED') ? 'blocked' : 'active' },
    { id: 'tool',     icon: <Database size={14} />,  label: 'Tool Request',     sublabel: `${event.tool}(${event.action})`,                       state: 'active' },
    { id: 'gateway',  icon: <Shield size={14} />,    label: 'Gateway',          sublabel: 'Intercepted',                                          state: 'active' },
    { id: 'policy',   icon: <ShieldOff size={14} />, label: 'Policy Evaluation',sublabel: event.policy_matched ?? undefined,                      state: 'active' },
    { id: 'decision', icon: event.decision === 'ALLOW' ? <CheckCircle size={14} /> : <Ban size={14} />, label: 'Decision', sublabel: event.decision, state: decState },
    { id: 'audit',    icon: <CheckCircle size={14} />, label: 'Audit Ledger',   sublabel: event.hash_preview,                                    state: 'allowed' },
  ]
}

const STATE_COLORS: Record<string, string> = {
  idle:     'var(--clr-text-dim)',
  active:   'var(--clr-accent)',
  allowed:  'var(--clr-allow)',
  blocked:  'var(--clr-block)',
  approval: 'var(--clr-approval)',
}

export function LiveTrace({ latestEvent }: Props) {
  const [steps, setSteps] = useState<TraceStep[]>(idleSteps)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Clear any previous animation
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const timerId = setTimeout(() => {
      if (!latestEvent) {
        setSteps(idleSteps())
        setAnimating(false)
        return
      }

      // Animate step by step
      setAnimating(true)
      const target = activeSteps(latestEvent)
      const base = idleSteps()
      let i = 0

      // Reset to idle first
      setSteps(base)

      timerRef.current = setInterval(() => {
        if (i >= target.length) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          setAnimating(false)
          return
        }
        const idx = i // capture
        setSteps(prev => {
          const next = [...prev]
          next[idx] = target[idx]
          return next
        })
        i++
      }, 300)
    }, 0)

    return () => {
      clearTimeout(timerId)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [latestEvent])

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        Live Execution Trace
        {animating && <span style={{ marginLeft: 8, color: 'var(--clr-accent)' }}>● LIVE</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((step, idx) => {
          if (!step) return null // safety guard
          return (
            <div key={step.id}>
              <div
                className={`trace-node ${step.state !== 'idle' ? step.state : ''} fade-in`}
                style={{ color: STATE_COLORS[step.state] ?? 'var(--clr-text-dim)' }}
              >
                <span style={{ opacity: step.state === 'idle' ? 0.3 : 1 }}>{step.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{step.label}</div>
                  {step.sublabel && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)', marginTop: 1 }}>
                      {step.sublabel}
                    </div>
                  )}
                </div>
                {step.state === 'blocked' && step.id === 'decision' && (
                  <span className="badge badge-block" style={{ fontSize: '0.65rem' }}>BLOCKED</span>
                )}
                {step.state === 'allowed' && step.id === 'decision' && (
                  <span className="badge badge-allow" style={{ fontSize: '0.65rem' }}>ALLOWED</span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div style={{ paddingLeft: 20, color: 'var(--clr-border)' }}>
                  <ArrowDown size={10} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
