"""
ZeroTrust Gateway — Core Data Models
All shared types used across gateway, policy, and audit layers.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────

class ActionCategory(str, Enum):
    READ = "READ"
    WRITE = "WRITE"
    EXECUTE = "EXECUTE"
    NETWORK = "NETWORK"
    CREDENTIAL = "CREDENTIAL"
    DATA_EXPORT = "DATA_EXPORT"
    SEARCH = "SEARCH"


class Decision(str, Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"


class ThreatLevel(str, Enum):
    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DemoMode(str, Enum):
    DEMO = "DEMO"           # Deterministic — never depends on external APIs
    EXPERIMENTAL = "EXPERIMENTAL"  # Optional AI/SLM semantic layer enabled


# ─── Tool Request / Response ──────────────────────────────────────────────────

class ToolRequest(BaseModel):
    """Represents an MCP-style tool call submitted by an agent."""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    session_id: str
    tool: str
    action: str
    resource: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    raw_context: str = ""  # The text the agent was processing (for injection detection)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InjectionMatch(BaseModel):
    """Details about a detected injection pattern."""
    pattern: str           # The pattern that triggered
    position: int          # Character offset in raw_context
    context_snippet: str   # Surrounding text for highlighting
    severity: str = "HIGH" # Severity of this specific pattern


class RateLimitInfo(BaseModel):
    """Rate limiting metadata for a tool request."""
    calls_in_window: int
    window_seconds: int = 60
    limit: int = 10
    remaining: int
    burst_detected: bool = False


class ToolResponse(BaseModel):
    """Gateway's response to a tool request."""
    request_id: str
    decision: Decision
    reason: str
    policy_matched: str | None = None
    risk_signals: list[str] = Field(default_factory=list)
    threat_level: ThreatLevel = ThreatLevel.NONE
    simulated_result: str | None = None  # Only populated for ALLOW decisions in demo mode
    injection_matches: list[InjectionMatch] = Field(default_factory=list)  # Detailed injection highlights
    rate_limit: RateLimitInfo | None = None  # Rate limiting metadata
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Policy ───────────────────────────────────────────────────────────────────

class AgentCapabilities(BaseModel):
    allowed: list[str] = Field(default_factory=list)
    denied: list[str] = Field(default_factory=list)


class PerformanceMetrics(BaseModel):
    latency_ms: int = Field(default=100, description="Average response time in milliseconds")
    success_rate: float = Field(default=1.0, description="Historical success rate")


class AgentPolicy(BaseModel):
    agent_id: str
    description: str = ""
    capabilities: AgentCapabilities
    performance: PerformanceMetrics = Field(default_factory=PerformanceMetrics)


class PolicyUpdate(BaseModel):
    """Frontend payload for updating a single agent's permissions."""
    agent_id: str
    capability: str     # e.g. "read:secrets"
    permitted: bool     # True = add to allowed, False = add to denied


# ─── Audit ────────────────────────────────────────────────────────────────────

class AuditEvent(BaseModel):
    """An immutable audit record for one gateway decision."""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    agent_id: str
    session_id: str
    tool: str
    action: str
    resource: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    category: ActionCategory
    decision: Decision
    reason: str
    policy_matched: str | None = None
    risk_signals: list[str] = Field(default_factory=list)
    threat_level: ThreatLevel
    event_hash: str = ""          # SHA-256 of the event content
    previous_hash: str = ""       # previous event's hash (chaining)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

class GatewayStats(BaseModel):
    gateway_status: str = "ONLINE"
    protected_agents: int = 0
    active_sessions: int = 0
    total_tool_calls: int = 0
    allowed_actions: int = 0
    blocked_actions: int = 0
    approval_requests: int = 0
    current_threat_level: ThreatLevel = ThreatLevel.NONE
    demo_mode: DemoMode = DemoMode.DEMO


# ─── Scenario ─────────────────────────────────────────────────────────────────

class AttackScenario(BaseModel):
    scenario_id: str
    name: str
    description: str
    request: ToolRequest


# ─── Custom Scenario Builder ─────────────────────────────────────────────────

class CustomScenarioRequest(BaseModel):
    """Payload from the Custom Scenario Builder in the frontend."""
    agent_id: str = "research-agent"
    tool: str = "read_file"
    action: str = "read"
    resource: str = "SECRET.txt"
    raw_context: str = "Summarize this document."


# ─── Approval Queue ──────────────────────────────────────────────────────────

class ApprovalQueueItem(BaseModel):
    """An action waiting for human approval."""
    request_id: str
    agent_id: str
    tool: str
    action: str
    resource: str
    raw_context: str
    reason: str
    risk_signals: list[str] = Field(default_factory=list)
    injection_matches: list[InjectionMatch] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ApprovalDecision(BaseModel):
    """Human decision on a pending approval."""
    request_id: str
    approved: bool
    reviewer_note: str = ""


# ─── Threat Timeline ─────────────────────────────────────────────────────────

class ThreatTimelineEntry(BaseModel):
    """One point in the threat activity timeline."""
    timestamp: str
    threat_level: ThreatLevel
    decision: Decision
    tool: str
    agent_id: str
