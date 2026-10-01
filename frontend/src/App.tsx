import { useEffect, useState, useCallback, useRef, Component, type ReactNode } from 'react'
import { Shield, Activity, BookOpen, Settings, List, Wand2, UserCheck } from 'lucide-react'
import { api } from './api'
import { useEventStream } from './useEventStream'
import type { AuditEvent, GatewayStats, AgentPolicy, Scenario, ApprovalQueueItem } from './types'

import { StatsBar }              from './components/StatsBar'
import { LiveTrace }             from './components/LiveTrace'
import { AttackSimulator }       from './components/AttackSimulator'
import { PolicyEditor }          from './components/PolicyEditor'
import { AuditLog }              from './components/AuditLog'
import { ArchitectureView }      from './components/ArchitectureView'
import { LedgerVerifier }        from './components/LedgerVerifier'
import { ThreatChip }            from './components/ThreatChip'
import { CustomScenarioBuilder } from './components/CustomScenarioBuilder'
import { ApprovalQueue }         from './components/ApprovalQueue'
import { ThreatTimeline }        from './components/ThreatTimeline'

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#ff3d57' }}>
          <h2>UI Error</h2>
          <pre style={{ fontSize: '0.75rem', color: '#6a7f94', marginTop: 12 }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{
              marginTop: 16, padding: '8px 24px', background: '#00bfff',
              color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'simulator' | 'scenario-builder' | 'approvals' | 'policy' | 'audit' | 'architecture'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'dashboard',         label: 'Overview',     icon: <Activity size={14} /> },
  { id: 'simulator',         label: 'Simulator',    icon: <Shield size={14} /> },
  { id: 'scenario-builder',  label: 'Builder',      icon: <Wand2 size={14} /> },
  { id: 'approvals',         label: 'Approvals',    icon: <UserCheck size={14} /> },
  { id: 'policy',            label: 'Policy',       icon: <Settings size={14} /> },
  { id: 'audit',             label: 'Audit',        icon: <List size={14} /> },
  { id: 'architecture',      label: 'Architecture', icon: <BookOpen size={14} /> },
]

function Dashboard() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [stats, setStats] = useState<GatewayStats | null>(null)
  const [policies, setPolicies] = useState<AgentPolicy[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [latestEvent, setLatestEvent] = useState<AuditEvent | null>(null)
  const [online, setOnline] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalQueueItem[]>([])
  const [timelineRefresh, setTimelineRefresh] = useState(0)

  // Use refs for functions that are called from event handlers to avoid
  // re-creating callbacks (and thus tearing down the WebSocket) on every render.
  const statsRef = useRef(stats)
  useEffect(() => { statsRef.current = stats })

  const loadStats      = useCallback(() => { api.stats().then(setStats).catch(() => {}) }, [])
  const loadPolicies   = useCallback(() => { api.policies().then(setPolicies).catch(() => {}) }, [])
  const loadScenarios  = useCallback(() => { api.scenarios().then(setScenarios).catch(() => {}) }, [])
  const loadEvents     = useCallback(() => { api.auditEvents(80).then(setEvents).catch(() => {}) }, [])
  const loadApprovals  = useCallback(() => { api.pendingApprovals().then(setPendingApprovals).catch(() => {}) }, [])

  // ─── Load initial data ──────────────────────────────────────────────
  useEffect(() => {
    api.health()
      .then(() => {
        setOnline(true)
        loadStats()
        loadPolicies()
        loadScenarios()
        loadEvents()
        loadApprovals()
      })
      .catch(() => setOnline(false))

    const interval = setInterval(() => {
      api.health().then(() => setOnline(true)).catch(() => setOnline(false))
      loadStats()
    }, 5000)

    return () => clearInterval(interval)
  }, [loadStats, loadPolicies, loadScenarios, loadEvents, loadApprovals])

  // ─── Live event stream via WebSocket ────────────────────────────────
  const handleEvent = useCallback((data: any) => {
    if (data.type === 'audit_event' && data.event) {
      setLatestEvent(data.event)
      setEvents(prev => [data.event, ...prev].slice(0, 100))
      setTimelineRefresh(prev => prev + 1)
    }
    if (data.type === 'approval_required') {
      loadApprovals()
      // Switch to approvals tab if not there already
    }
    if (data.type === 'approval_decided') {
      loadApprovals()
    }
    // Always refresh stats
    api.stats().then(setStats).catch(() => {})
  }, [loadApprovals])

  const handleReset = useCallback(() => {
    setEvents([])
    setLatestEvent(null)
    setPendingApprovals([])
    setTimelineRefresh(0)
    api.stats().then(setStats).catch(() => {})
  }, [])

  useEventStream(handleEvent, handleReset)

  const pendingCount = pendingApprovals.length

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 48,
        background: 'var(--clr-surface)',
        borderBottom: '1px solid var(--clr-border)',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={20} color="var(--clr-accent)" />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--clr-text)', letterSpacing: '0.04em' }}>
            ZEROTRUST <span style={{ color: 'var(--clr-accent)' }}>GATEWAY</span>
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--clr-text-dim)', marginLeft: 4 }}>
            AI AGENT SECURITY LAYER · PROTOTYPE
          </span>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stats && <ThreatChip level={stats.current_threat_level} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className={`pulse-dot ${online ? 'green' : 'red'}`} />
            <span style={{ fontSize: '0.72rem', color: online ? 'var(--clr-allow)' : 'var(--clr-block)' }}>
              {online ? 'GATEWAY ONLINE' : 'GATEWAY OFFLINE'}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)' }}>
            MODE: {stats?.demo_mode ?? 'DEMO'}
          </span>
        </div>
      </header>

      {/* ── Nav tabs ───────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex',
        gap: 0,
        background: 'var(--clr-surface)',
        borderBottom: '1px solid var(--clr-border)',
        padding: '0 24px',
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--clr-accent)' : '2px solid transparent',
              color: tab === t.id ? 'var(--clr-accent)' : 'var(--clr-text-dim)',
              fontSize: '0.78rem',
              fontWeight: tab === t.id ? 600 : 400,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'color 0.15s',
              position: 'relative',
            }}
          >
            {t.icon} {t.label.toUpperCase()}
            {/* Pending approval badge */}
            {t.id === 'approvals' && pendingCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                background: 'var(--clr-approval)', color: '#fff',
                borderRadius: '50%', width: 16, height: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700,
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>

        {/* DASHBOARD TAB */}
        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {stats && <StatsBar stats={stats} />}
            <ThreatTimeline refreshTrigger={timelineRefresh} />
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
              <LiveTrace latestEvent={latestEvent} />
              <AuditLog events={events.slice(0, 15)} />
            </div>
            <LedgerVerifier />
          </div>
        )}

        {/* SIMULATOR TAB */}
        {tab === 'simulator' && (
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16 }}>
            <AttackSimulator
              scenarios={scenarios}
              onResult={() => { loadStats(); loadEvents(); loadApprovals(); setTimelineRefresh(p => p + 1) }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <LiveTrace latestEvent={latestEvent} />
              <AuditLog events={events.slice(0, 20)} />
            </div>
          </div>
        )}

        {/* CUSTOM SCENARIO BUILDER TAB */}
        {tab === 'scenario-builder' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <CustomScenarioBuilder
              onResult={() => { loadStats(); loadEvents(); loadApprovals(); setTimelineRefresh(p => p + 1) }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ThreatTimeline refreshTrigger={timelineRefresh} />
              <LiveTrace latestEvent={latestEvent} />
            </div>
          </div>
        )}

        {/* APPROVALS TAB (Human-in-the-Loop) */}
        {tab === 'approvals' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ApprovalQueue
              pendingItems={pendingApprovals}
              onDecision={() => { loadApprovals(); loadStats(); loadEvents(); setTimelineRefresh(p => p + 1) }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ThreatTimeline refreshTrigger={timelineRefresh} />
              <AuditLog events={events.filter(e => e.action?.startsWith('HUMAN_')).concat(events.filter(e => e.decision === 'REQUIRE_APPROVAL')).slice(0, 15)} />
            </div>
          </div>
        )}

        {/* POLICY TAB */}
        {tab === 'policy' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <PolicyEditor policies={policies} onUpdate={() => { loadPolicies(); loadStats() }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <AttackSimulator scenarios={scenarios} onResult={() => { loadEvents(); loadStats() }} />
            </div>
          </div>
        )}

        {/* AUDIT TAB */}
        {tab === 'audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <LedgerVerifier />
            <AuditLog events={events} />
          </div>
        )}

        {/* ARCHITECTURE TAB */}
        {tab === 'architecture' && <ArchitectureView />}

        {/* Offline warning */}
        {!online && (
          <div style={{
            position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255,61,87,0.9)', color: '#fff', borderRadius: 4,
            padding: '8px 20px', fontSize: '0.8rem', fontWeight: 600,
            zIndex: 100,
          }}>
            ⚠ Backend offline — start the FastAPI server on port 8000
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  )
}
