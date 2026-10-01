// Typed API client for the ZeroTrust Gateway backend

import type {
  AgentPolicy,
  ApprovalDecision,
  ApprovalQueueItem,
  AuditEvent,
  CustomScenarioRequest,
  GatewayStats,
  LedgerVerification,
  Scenario,
  ThreatTimelineEntry,
  ToolResponse,
} from './types'

const BASE = '' // uses Vite proxy

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

// ─── Exported API ─────────────────────────────────────────────────────────────

export const api = {
  stats:             () => get<GatewayStats>('/stats'),
  scenarios:         () => get<Scenario[]>('/scenarios'),
  policies:          () => get<AgentPolicy[]>('/policies'),
  auditEvents:       (limit = 50) => get<AuditEvent[]>(`/audit/events?limit=${limit}`),
  verifyLedger:      () => get<LedgerVerification>('/audit/verify'),

  runScenario:       (id: string) => post<ToolResponse>(`/scenarios/${id}/run`),
  updateCapability:  (body: { agent_id: string; capability: string; permitted: boolean }) =>
                       patch<unknown>('/policies/capability', body),
  reloadPolicies:    () => post<unknown>('/policies/reload'),

  resetDemo:         () => post<unknown>('/demo/reset'),
  startDemoSequence: () => post<unknown>('/demo/run-sequence'),

  health:            () => get<{ status: string }>('/health'),

  // ─── New Feature APIs ──────────────────────────────────────────────────────

  // Custom scenario builder
  runCustomScenario: (body: CustomScenarioRequest) => post<ToolResponse>('/scenarios/custom/run', body),

  // Approval queue (human-in-the-loop)
  pendingApprovals:  () => get<ApprovalQueueItem[]>('/approvals'),
  decideApproval:    (body: ApprovalDecision) => post<unknown>('/approvals/decide', body),

  // Threat timeline
  threatTimeline:    () => get<ThreatTimelineEntry[]>('/threat-timeline'),
}

export type PolicyUpdate = { agent_id: string; capability: string; permitted: boolean }
