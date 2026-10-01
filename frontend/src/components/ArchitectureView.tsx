// ArchitectureView — static system architecture diagram using SVG-free ASCII + CSS
import { Shield, Bot, Database, Server, Lock, FileText, CheckCircle } from 'lucide-react'

interface LayerProps {
  icon: React.ReactNode
  label: string
  sublabel?: string
  color?: string
  subItems?: string[]
}

function Layer({ icon, label, sublabel, color = 'var(--clr-text)', subItems }: LayerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '10px 16px',
        background: 'var(--clr-surface)',
        border: `1px solid var(--clr-border)`,
        borderRadius: 3,
        minWidth: 140,
        textAlign: 'center',
      }}
    >
      <span style={{ color }}>{icon}</span>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color }}>{label}</div>
      {sublabel && <div style={{ fontSize: '0.65rem', color: 'var(--clr-text-dim)' }}>{sublabel}</div>}
      {subItems && (
        <div style={{ width: '100%', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
          {subItems.map(item => (
            <div key={item} style={{ fontSize: '0.65rem', color: 'var(--clr-text-dim)', paddingLeft: 8, borderLeft: '2px solid var(--clr-muted)' }}>
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Arrow() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--clr-muted)', fontSize: '1rem', padding: '2px 0' }}>
      ↓
    </div>
  )
}

export function ArchitectureView() {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
        System Architecture
        <span style={{ marginLeft: 8, color: 'var(--clr-muted)', fontWeight: 400 }}>— Prototype Overview</span>
      </div>

      <div style={{ display: 'flex', gap: 32 }}>
        {/* Main flow column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <Layer icon={<Bot size={18} />}      label="AI Agent"      sublabel="research-agent"           color="var(--clr-accent)" />
          <Arrow />
          <Layer icon={<FileText size={18} />} label="External Context" sublabel="Untrusted input / documents" color="var(--clr-warn)" />
          <Arrow />
          <Layer icon={<Server size={18} />}   label="MCP Client"    sublabel="Tool Request"             color="var(--clr-text)" />
          <Arrow />
          <div
            style={{
              border: '2px solid var(--clr-accent)',
              borderRadius: 4,
              padding: '12px 16px',
              textAlign: 'center',
              minWidth: 140,
              background: 'rgba(0,191,255,0.05)',
            }}
          >
            <Shield size={20} color="var(--clr-accent)" />
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--clr-accent)', marginTop: 4 }}>
              ZeroTrust Gateway
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--clr-text-dim)', marginTop: 2 }}>
              Enforcement Boundary
            </div>
          </div>
          <Arrow />
          <Layer icon={<Database size={18} />} label="MCP Tool Server" sublabel="Simulated Sandbox"     color="var(--clr-text)" />
          <Arrow />
          <Layer icon={<Lock size={18} />}     label="Protected Resource" sublabel="Files / DB / Shell" color="var(--clr-text-dim)" />
        </div>

        {/* Gateway layers breakdown */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Gateway Layers
          </div>
          {[
            { label: 'Layer 1 — Identity',          desc: 'Agent ID / Session / Tool classification' },
            { label: 'Layer 2 — Capability Policy',  desc: 'YAML-defined allowed / denied per agent' },
            { label: 'Layer 3 — Tool Classification',desc: 'READ / WRITE / EXECUTE / NETWORK / CREDENTIAL' },
            { label: 'Layer 4 — Context Inspection', desc: 'Prompt injection detection via pattern analysis' },
            { label: 'Layer 5 — Runtime Enforcement',desc: 'ALLOW / BLOCK / REQUIRE_APPROVAL decision' },
            { label: 'Layer 6 — Sandbox (Simulated)',desc: '⚠ Prototype boundary — labeled simulation' },
            { label: 'Layer 7 — Audit Ledger',       desc: 'SHA-256 hash chain (prototype integrity)' },
          ].map((l, i) => (
            <div
              key={i}
              style={{
                padding: '6px 12px',
                background: 'var(--clr-surface)',
                border: '1px solid var(--clr-border)',
                borderRadius: 3,
                display: 'flex',
                gap: 10,
              }}
            >
              <CheckCircle size={13} color="var(--clr-accent)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{l.label}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)' }}>{l.desc}</div>
              </div>
            </div>
          ))}

          {/* Legend */}
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.2)', borderRadius: 3 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--clr-warn)', marginBottom: 4, fontWeight: 600 }}>
              ⚠ Prototype Transparency
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)', lineHeight: 1.5 }}>
              <strong>REAL:</strong> Policy engine, capability enforcement, audit hashing, prompt injection detection, API routing<br />
              <strong>SIMULATED:</strong> OS sandbox, MCP transport, actual file/shell execution<br />
              <strong>FUTURE:</strong> Real MCP server, HSM-backed audit ledger, RBAC integration
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
