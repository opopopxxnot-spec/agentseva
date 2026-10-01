// InjectionHighlighter — shows exactly which injection patterns were detected
import type { InjectionMatch } from '../types'

interface Props {
  matches: InjectionMatch[]
  rawContext?: string
}

export function InjectionHighlighter({ matches, rawContext }: Props) {
  if (!matches.length) return null

  return (
    <div
      className="fade-in"
      style={{
        marginTop: 8,
        padding: '8px 10px',
        background: 'rgba(255,61,87,0.04)',
        border: '1px solid rgba(255,61,87,0.15)',
        borderRadius: 3,
      }}
    >
      <div style={{ fontSize: '0.65rem', color: 'var(--clr-block)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        🔍 Injection Patterns Detected ({matches.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {matches.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '4px 8px',
              background: 'rgba(255,61,87,0.06)',
              borderRadius: 2,
              borderLeft: `2px solid ${m.severity === 'CRITICAL' ? 'var(--clr-block)' : 'var(--clr-warn)'}`,
            }}
          >
            <span
              className="badge"
              style={{
                fontSize: '0.58rem',
                flexShrink: 0,
                marginTop: 1,
                background: m.severity === 'CRITICAL' ? 'rgba(255,61,87,0.15)' : 'rgba(255,170,0,0.15)',
                color: m.severity === 'CRITICAL' ? 'var(--clr-block)' : 'var(--clr-warn)',
                border: 'none',
              }}
            >
              {m.severity}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--clr-block)' }}>
                "{m.pattern}"
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--clr-text-dim)', fontFamily: 'monospace', marginTop: 2 }}>
                {highlightPattern(m.context_snippet, m.pattern)}
              </div>
            </div>
            <span style={{ fontSize: '0.6rem', color: 'var(--clr-muted)', flexShrink: 0 }}>
              pos:{m.position}
            </span>
          </div>
        ))}
      </div>

      {/* Full context with highlighted patterns */}
      {rawContext && (
        <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--clr-bg)', borderRadius: 2, fontSize: '0.7rem', fontFamily: 'monospace', lineHeight: 1.6 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--clr-text-dim)', marginBottom: 4 }}>FULL CONTEXT:</div>
          {highlightAllPatterns(rawContext, matches.map(m => m.pattern))}
        </div>
      )}
    </div>
  )
}

function highlightPattern(text: string, pattern: string) {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(pattern.toLowerCase())
  if (idx === -1) return <span>{text}</span>

  return (
    <span>
      {text.slice(0, idx)}
      <span style={{ background: 'rgba(255,61,87,0.3)', color: 'var(--clr-block)', fontWeight: 700, padding: '0 2px', borderRadius: 2 }}>
        {text.slice(idx, idx + pattern.length)}
      </span>
      {text.slice(idx + pattern.length)}
    </span>
  )
}

function highlightAllPatterns(text: string, patterns: string[]) {
  // Build a list of {start, end, pattern} ranges
  const ranges: Array<{ start: number; end: number; pattern: string }> = []
  const lower = text.toLowerCase()

  for (const p of patterns) {
    let searchFrom = 0
    while (true) {
      const idx = lower.indexOf(p.toLowerCase(), searchFrom)
      if (idx === -1) break
      ranges.push({ start: idx, end: idx + p.length, pattern: p })
      searchFrom = idx + p.length
    }
  }

  // Sort by start position and merge overlaps
  ranges.sort((a, b) => a.start - b.start)

  if (ranges.length === 0) return <span>{text}</span>

  const parts: React.ReactNode[] = []
  let lastEnd = 0

  for (const r of ranges) {
    if (r.start > lastEnd) {
      parts.push(<span key={`t-${lastEnd}`}>{text.slice(lastEnd, r.start)}</span>)
    }
    const actualStart = Math.max(r.start, lastEnd)
    if (actualStart < r.end) {
      parts.push(
        <span
          key={`h-${actualStart}`}
          style={{
            background: 'rgba(255,61,87,0.3)',
            color: '#ff6b7f',
            fontWeight: 700,
            padding: '1px 2px',
            borderRadius: 2,
            textDecoration: 'underline',
            textDecorationStyle: 'wavy',
            textDecorationColor: 'var(--clr-block)',
          }}
        >
          {text.slice(actualStart, r.end)}
        </span>
      )
    }
    lastEnd = Math.max(lastEnd, r.end)
  }

  if (lastEnd < text.length) {
    parts.push(<span key="tail">{text.slice(lastEnd)}</span>)
  }

  return <>{parts}</>
}
