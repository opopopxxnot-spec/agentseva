"""
ZeroTrust Gateway — Policy Engine
Deterministic capability enforcement. The LLM is NEVER the final authority.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import yaml

from models import (
    ActionCategory,
    AgentCapabilities,
    AgentPolicy,
    Decision,
    InjectionMatch,
    PerformanceMetrics,
    RateLimitInfo,
    ThreatLevel,
    ToolRequest,
    ToolResponse,
)

# ─── Tool → Category Map ─────────────────────────────────────────────────────
# Maps (tool, action) patterns to a capability key and an ActionCategory.
# This is what the policy engine checks against the agent's allowed/denied lists.

TOOL_CAPABILITY_MAP: dict[str, tuple[str, ActionCategory]] = {
    # read operations
    "read_file:public":    ("read:public_documents", ActionCategory.READ),
    "read_file:secret":    ("read:secrets",          ActionCategory.CREDENTIAL),
    "read_file:credential":("read:credentials",       ActionCategory.CREDENTIAL),
    "search:web_cache":    ("search:web_cache",       ActionCategory.SEARCH),
    "read_file:internal":  ("read:internal_docs",     ActionCategory.READ),
    # write operations
    "write_database":      ("write:database",         ActionCategory.WRITE),
    "write_file":          ("write:database",         ActionCategory.WRITE),
    # execute operations
    "execute_shell":       ("execute:shell",          ActionCategory.EXECUTE),
    "run_command":         ("execute:shell",          ActionCategory.EXECUTE),
    # network operations
    "http_request":        ("network:external",       ActionCategory.NETWORK),
    "fetch_url":           ("network:external",       ActionCategory.NETWORK),
    # data export
    "export_data":         ("data_export",            ActionCategory.DATA_EXPORT),
    "send_email":          ("data_export",            ActionCategory.DATA_EXPORT),
}

# ─── Prompt Injection Signals ─────────────────────────────────────────────────
INJECTION_PATTERNS: list[str] = [
    "ignore previous",
    "ignore your instructions",
    "forget your previous",
    "system prompt",
    "override your",
    "new instruction",
    "you are now",
    "act as if",
    "bypass",
    "disregard",
    "secret.txt",
    "secrets.txt",
    "read secret",
    "print secret",
    "show secret",
    "your new task is",
    "jailbreak",
    "pretend",
]

# ─── Rate Limiter ─────────────────────────────────────────────────────────────

class RateLimiter:
    """
    Sliding-window rate limiter per agent.
    Tracks call timestamps and detects burst patterns.
    """

    def __init__(
        self,
        window_seconds: int = 60,
        max_calls: int = 10,
        burst_threshold: int = 5,
        burst_window_seconds: int = 5,
    ) -> None:
        self._window = window_seconds
        self._max_calls = max_calls
        self._burst_threshold = burst_threshold
        self._burst_window = burst_window_seconds
        # agent_id → list of call timestamps
        self._calls: dict[str, list[float]] = defaultdict(list)

    def check(self, agent_id: str) -> RateLimitInfo:
        """Record a call and return rate-limit info."""
        now = time.time()
        cutoff = now - self._window

        # Prune old entries
        self._calls[agent_id] = [
            t for t in self._calls[agent_id] if t > cutoff
        ]
        self._calls[agent_id].append(now)

        calls_in_window = len(self._calls[agent_id])
        remaining = max(0, self._max_calls - calls_in_window)

        # Burst detection: too many calls in a very short window
        burst_cutoff = now - self._burst_window
        recent_burst = sum(1 for t in self._calls[agent_id] if t > burst_cutoff)
        burst_detected = recent_burst >= self._burst_threshold

        return RateLimitInfo(
            calls_in_window=calls_in_window,
            window_seconds=self._window,
            limit=self._max_calls,
            remaining=remaining,
            burst_detected=burst_detected,
        )

    def is_exceeded(self, agent_id: str) -> tuple[bool, RateLimitInfo]:
        """Check and record — returns (exceeded, info)."""
        info = self.check(agent_id)
        return info.remaining == 0, info

    def reset(self, agent_id: str | None = None) -> None:
        if agent_id:
            self._calls.pop(agent_id, None)
        else:
            self._calls.clear()


class PolicyEngine:
    """
    Deterministic gateway policy engine.
    Loads policies from YAML and evaluates each ToolRequest.
    """

    def __init__(self, policy_path: str | None = None) -> None:
        self._policy_path = policy_path or str(
            Path(__file__).parent / "policies.yaml"
        )
        self._policies: dict[str, AgentPolicy] = {}
        self._rate_limiter = RateLimiter()
        self.reload()

    def reload(self) -> None:
        """Load (or re-load) policies from disk."""
        with open(self._policy_path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)

        self._policies = {}
        for entry in raw.get("agents", []):
            caps = entry.get("capabilities", {})
            perf = entry.get("performance", {})
            policy = AgentPolicy(
                agent_id=entry["agent_id"],
                description=entry.get("description", ""),
                capabilities=AgentCapabilities(
                    allowed=caps.get("allowed", []),
                    denied=caps.get("denied", []),
                ),
                performance=PerformanceMetrics(
                    latency_ms=perf.get("latency_ms", 100),
                    success_rate=perf.get("success_rate", 1.0),
                )
            )
            self._policies[policy.agent_id] = policy

    def get_policy(self, agent_id: str) -> AgentPolicy | None:
        return self._policies.get(agent_id)

    def all_policies(self) -> list[AgentPolicy]:
        return list(self._policies.values())

    def update_capability(
        self, agent_id: str, capability: str, permitted: bool
    ) -> bool:
        """
        Dynamically update a single capability for an agent and persist to YAML.
        Returns True if successful.
        """
        policy = self._policies.get(agent_id)
        if policy is None:
            return False

        caps = policy.capabilities
        # Remove from both lists first, then add to the correct one
        if capability in caps.allowed:
            caps.allowed.remove(capability)
        if capability in caps.denied:
            caps.denied.remove(capability)

        if permitted:
            caps.allowed.append(capability)
        else:
            caps.denied.append(capability)

        self._persist()
        return True

    def _persist(self) -> None:
        """Write current in-memory policies back to YAML."""
        raw: dict[str, Any] = {"agents": []}
        for policy in self._policies.values():
            raw["agents"].append(
                {
                    "agent_id": policy.agent_id,
                    "description": policy.description,
                    "performance": {
                        "latency_ms": policy.performance.latency_ms,
                        "success_rate": policy.performance.success_rate,
                    },
                    "capabilities": {
                        "allowed": policy.capabilities.allowed,
                        "denied": policy.capabilities.denied,
                    },
                }
            )
        with open(self._policy_path, "w", encoding="utf-8") as f:
            yaml.dump(raw, f, default_flow_style=False, sort_keys=False)

    def reset_rate_limiter(self) -> None:
        """Reset the rate limiter (used for demo reset)."""
        self._rate_limiter.reset()

    # ─── Injection Pattern Highlighting ───────────────────────────────────────

    def _detect_injections(self, raw_context: str) -> tuple[list[str], list[InjectionMatch]]:
        """
        Detect prompt injection patterns and return both signal names
        and detailed match objects with positions for UI highlighting.
        """
        context_lower = raw_context.lower()
        detected: list[str] = []
        matches: list[InjectionMatch] = []

        for pattern in INJECTION_PATTERNS:
            idx = context_lower.find(pattern)
            if idx != -1:
                detected.append(pattern)
                # Extract a context snippet around the match
                start = max(0, idx - 20)
                end = min(len(raw_context), idx + len(pattern) + 20)
                snippet = raw_context[start:end]
                if start > 0:
                    snippet = "…" + snippet
                if end < len(raw_context):
                    snippet = snippet + "…"

                matches.append(InjectionMatch(
                    pattern=pattern,
                    position=idx,
                    context_snippet=snippet,
                    severity="CRITICAL" if pattern in [
                        "ignore previous", "ignore your instructions",
                        "your new task is", "jailbreak"
                    ] else "HIGH",
                ))

        return detected, matches

    # ─── Core Evaluation ──────────────────────────────────────────────────────

    def evaluate(self, request: ToolRequest) -> ToolResponse:
        """
        Evaluate a ToolRequest against the deterministic policy.
        This method is the single enforcement boundary.
        """
        risk_signals: list[str] = []
        threat_level = ThreatLevel.NONE
        injection_matches: list[InjectionMatch] = []

        # ── Step 0: Rate limiting ────────────────────────────────────────
        exceeded, rate_info = self._rate_limiter.is_exceeded(request.agent_id)
        if rate_info.burst_detected:
            risk_signals.append("BURST_DETECTED")
            if threat_level == ThreatLevel.NONE:
                threat_level = ThreatLevel.MEDIUM

        if exceeded:
            risk_signals.append("RATE_LIMIT_EXCEEDED")
            return ToolResponse(
                request_id=request.request_id,
                decision=Decision.BLOCK,
                reason=(
                    f"Agent '{request.agent_id}' exceeded rate limit: "
                    f"{rate_info.calls_in_window}/{rate_info.limit} calls "
                    f"in {rate_info.window_seconds}s window."
                ),
                risk_signals=risk_signals,
                threat_level=ThreatLevel.HIGH,
                rate_limit=rate_info,
            )

        # ── Step 1: Identity check ──────────────────────────────────────────
        policy = self._policies.get(request.agent_id)
        if policy is None:
            return ToolResponse(
                request_id=request.request_id,
                decision=Decision.BLOCK,
                reason=f"Unknown agent '{request.agent_id}'. All agents must be registered.",
                risk_signals=["UNKNOWN_AGENT"],
                threat_level=ThreatLevel.HIGH,
                rate_limit=rate_info,
            )

        # ── Step 2: Detect prompt injection in raw_context ──────────────────
        detected_injections, injection_matches = self._detect_injections(request.raw_context)
        if detected_injections:
            risk_signals.append("PROMPT_INJECTION_DETECTED")
            threat_level = ThreatLevel.HIGH

        # ── Step 3: Resolve the capability key for this tool call ────────────
        lookup_key = self._resolve_lookup_key(request)
        capability_key, category = self._get_capability(lookup_key, request)

        # ── Step 4: Evaluate against policy ─────────────────────────────────
        caps = policy.capabilities

        # Explicit DENY wins first (default-deny philosophy)
        if capability_key in caps.denied:
            risk_signals.append(f"POLICY_DENIED:{capability_key}")
            if threat_level == ThreatLevel.NONE:
                threat_level = ThreatLevel.MEDIUM
            return ToolResponse(
                request_id=request.request_id,
                decision=Decision.BLOCK,
                reason=(
                    f"Agent '{request.agent_id}' requested capability '{capability_key}' "
                    f"which is explicitly denied in the active policy."
                ),
                policy_matched=f"denied:{capability_key}",
                risk_signals=risk_signals,
                threat_level=threat_level,
                injection_matches=injection_matches,
                rate_limit=rate_info,
            )

        # Not explicitly allowed → default deny
        if capability_key not in caps.allowed:
            risk_signals.append(f"CAPABILITY_NOT_GRANTED:{capability_key}")
            if threat_level == ThreatLevel.NONE:
                threat_level = ThreatLevel.MEDIUM
            return ToolResponse(
                request_id=request.request_id,
                decision=Decision.BLOCK,
                reason=(
                    f"Agent '{request.agent_id}' requested capability '{capability_key}' "
                    f"which is not in its granted capability set. Default: DENY."
                ),
                policy_matched=f"not_granted:{capability_key}",
                risk_signals=risk_signals,
                threat_level=threat_level,
                injection_matches=injection_matches,
                rate_limit=rate_info,
            )

        # ── Step 5: Even if allowed, if injection detected, escalate ─────────
        if "PROMPT_INJECTION_DETECTED" in risk_signals:
            risk_signals.append("ALLOWED_CAPABILITY_WITH_INJECTION_CONTEXT")
            return ToolResponse(
                request_id=request.request_id,
                decision=Decision.REQUIRE_APPROVAL,
                reason=(
                    f"Capability '{capability_key}' is granted, but the agent context "
                    f"contains prompt injection signals. Human approval required."
                ),
                policy_matched=f"allowed:{capability_key}",
                risk_signals=risk_signals,
                threat_level=ThreatLevel.HIGH,
                injection_matches=injection_matches,
                rate_limit=rate_info,
            )

        # ── Step 6: Burst warning — still allow but flag ─────────────────────
        if rate_info.burst_detected:
            risk_signals.append("BURST_WARNING")

        # ── Step 7: ALLOW ────────────────────────────────────────────────────
        simulated = self._simulate_result(request)
        return ToolResponse(
            request_id=request.request_id,
            decision=Decision.ALLOW,
            reason=f"Action '{capability_key}' is within the agent's granted capability set.",
            policy_matched=f"allowed:{capability_key}",
            risk_signals=risk_signals,
            threat_level=ThreatLevel.NONE,
            simulated_result=simulated,
            injection_matches=injection_matches,
            rate_limit=rate_info,
        )

    def _resolve_lookup_key(self, request: ToolRequest) -> str:
        """Build a lookup key from tool + resource hints."""
        tool = request.tool.lower()
        resource = request.resource.lower()

        if tool == "read_file":
            if any(k in resource for k in ["secret", ".env", "credential", "token", "password", "key"]):
                return "read_file:secret"
            if any(k in resource for k in ["internal", "private"]):
                return "read_file:internal"
            return "read_file:public"
        return tool

    def _get_capability(
        self, key: str, request: ToolRequest
    ) -> tuple[str, ActionCategory]:
        """Resolve capability key + category from the lookup key."""
        if key in TOOL_CAPABILITY_MAP:
            return TOOL_CAPABILITY_MAP[key]
        # Unknown tool → treat as EXECUTE (highest risk default)
        return (f"execute:{key}", ActionCategory.EXECUTE)

    def _simulate_result(self, request: ToolRequest) -> str:
        """Return a safe, synthetic result for allowed tool calls."""
        resource = request.resource
        simulated_data = {
            "summary.txt":      "Document summary: This report covers Q3 performance metrics for public disclosure.",
            "public_report.txt": "PUBLIC DOCUMENT: Annual review — no sensitive data present.",
            "web_cache":        "Search result: [SIMULATED] Top results from pre-approved web cache.",
        }
        return simulated_data.get(
            resource,
            f"[SIMULATED] Successfully read resource '{resource}'. No sensitive data exposed.",
        )
