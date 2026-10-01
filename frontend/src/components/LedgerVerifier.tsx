// LedgerVerifier — integrity check panel for the audit chain
import { useState } from 'react'
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react'
import { api } from '../api'
import type { LedgerVerification } from '../types'

export function LedgerVerifier() {
  const [result, setResult] = useState<LedgerVerification | null>(null)
  const [loading, setLoading] = useState(false)

  const verify = async () => {
    setLoading(true)
    try {
      const r = await api.verifyLedger()
      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  const ok = result?.status === 'INTEGRITY_OK'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Ledger Integrity
          <span style={{ marginLeft: 6, color: 'var(--clr-muted)', fontWeight: 400 }}>— prototype SHA-256 chain</span>
        </div>
        <button
          className="btn btn-ghost"
          onClick={verify}
          disabled={loading}
          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Verifying…' : 'Verify Ledger'}
        </button>
      </div>

      {result && (
        <div
          className="fade-in"
          style={{
            padding: '12px',
            borderRadius: 3,
            background: ok ? 'rgba(0,230,118,0.05)' : 'rgba(255,61,87,0.05)',
            border: `1px solid ${ok ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,87,0.2)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {ok
              ? <ShieldCheck size={18} color="var(--clr-allow)" />
              : <ShieldAlert size={18} color="var(--clr-block)" />
            }
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: ok ? 'var(--clr-allow)' : 'var(--clr-block)' }}>
              {result.status}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-dim)' }}>
              {result.total_events} events checked
            </span>
          </div>

          {result.violations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.violations.map((v, i) => (
                <div key={i} style={{ fontSize: '0.72rem', color: 'var(--clr-block)', paddingLeft: 8, borderLeft: '2px solid var(--clr-block)' }}>
                  Event #{v.seq} — {v.issue}
                </div>
              ))}
            </div>
          )}

          {ok && (
            <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-dim)' }}>
              All {result.total_events} events verified. Hash chain is intact.
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: '0.68rem', color: 'var(--clr-muted)', lineHeight: 1.5 }}>
        Each event is SHA-256 hashed and chained to the previous event's hash.
        This is a <strong>prototype integrity mechanism</strong>, not a cryptographically hardened ledger.
      </div>
    </div>
  )
}
