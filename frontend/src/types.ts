// Shared TypeScript types mirroring backend models

export type Decision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL'
export type ThreatLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ActionCategory = 'READ' | 'WRITE' | 'EXECUTE' | 'NETWORK' | 'CREDENTIAL' | 'DATA_EXPORT' | 'SEARCH'
export type DemoMode = 'DEMO' | 'EXPERIMENTAL'

export interface ToolRequest {
  request_id: string
  agent_id: string
  session_id: string
  tool: string
  action: string
  resource: string
  arguments: Record<string, unknown>
  raw_context: string
  timestamp: string
}

export interface InjectionMatch {
  pattern: string
  position: number
  context_snippet: string
  severity: string
}

export interface RateLimitInfo {
  calls_in_window: number
  window_seconds: number
  limit: number
  remaining: number
  burst_detected: boolean
}

export interface ToolResponse {
  request_id: string
  decision: Decision
  reason: string
  policy_matched: string | null
  risk_signals: string[]
  threat_level: ThreatLevel
  simulated_result: string | null
  injection_matches: InjectionMatch[]
  rate_limit: RateLimitInfo | null
  timestamp: string
}

export interface AgentCapabilities {
  allowed: string[]
  denied: string[]
}

export interface PerformanceMetrics {
  latency_ms: number
  success_rate: number
}

export interface AgentPolicy {
  agent_id: string
  description: string
  capabilities: AgentCapabilities
  performance: PerformanceMetrics
}

export interface AuditEvent {
  seq?: number
  event_id: string
  request_id: string
  agent_id: string
  session_id: string
  tool: string
  action: string
  resource: string
  arguments: Record<string, unknown>
  category: ActionCategory
  decision: Decision
  reason: string
  policy_matched: string | null
  risk_signals: string[]
  threat_level: ThreatLevel
  event_hash: string
  hash_preview: string
  previous_hash: string
  timestamp: string
  injection_matches?: InjectionMatch[]
  rate_limit?: RateLimitInfo | null
}

export interface GatewayStats {
  gateway_status: string
  protected_agents: number
  active_sessions: number
  total_tool_calls: number
  allowed_actions: number
  blocked_actions: number
  approval_requests: number
  current_threat_level: ThreatLevel
  demo_mode: DemoMode
}

export interface Scenario {
  scenario_id: string
  name: string
  description: string
}

export interface LedgerVerification {
  total_events: number
  violations: Array<{ seq: number; event_id: string; issue: string }>
  status: 'INTEGRITY_OK' | 'INTEGRITY_VIOLATION'
}

// ─── Approval Queue ──────────────────────────────────────────────────────────

export interface ApprovalQueueItem {
  request_id: string
  agent_id: string
  tool: string
  action: string
  resource: string
  raw_context: string
  reason: string
  risk_signals: string[]
  injection_matches: InjectionMatch[]
  timestamp: string
}

export interface ApprovalDecision {
  request_id: string
  approved: boolean
  reviewer_note: string
}

// ─── Custom Scenario ─────────────────────────────────────────────────────────

export interface CustomScenarioRequest {
  agent_id: string
  tool: string
  action: string
  resource: string
  raw_context: string
}

// ─── Threat Timeline ─────────────────────────────────────────────────────────

export interface ThreatTimelineEntry {
  timestamp: string
  threat_level: ThreatLevel
  decision: Decision
  tool: string
  agent_id: string
}
