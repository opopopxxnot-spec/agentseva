"""
ZeroTrust Gateway — FastAPI Backend
All HTTP + WebSocket routes for the gateway.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from audit_ledger import AuditLedger
from models import (
    ActionCategory,
    ApprovalDecision,
    ApprovalQueueItem,
    AuditEvent,
    CustomScenarioRequest,
    Decision,
    DemoMode,
    GatewayStats,
    InjectionMatch,
    PolicyUpdate,
    ThreatLevel,
    ThreatTimelineEntry,
    ToolRequest,
    ToolResponse,
)
from policy_engine import PolicyEngine
from scenarios import ALL_SCENARIOS

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="ZeroTrust Gateway API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Singletons ───────────────────────────────────────────────────────────────

engine = PolicyEngine()
ledger = AuditLedger()
_demo_mode: DemoMode = DemoMode.DEMO

# Active WebSocket clients for live event streaming
_ws_clients: set[WebSocket] = set()

# In-memory stats counters (reset on restart — fine for prototype)
_stats = {
    "total_tool_calls": 0,
    "allowed_actions": 0,
    "blocked_actions": 0,
    "approval_requests": 0,
}

# ─── Approval Queue ──────────────────────────────────────────────────────────

_approval_queue: dict[str, ApprovalQueueItem] = {}

# ─── Threat Timeline ─────────────────────────────────────────────────────────

_threat_timeline: list[ThreatTimelineEntry] = []

# ─── WebSocket Broadcast ──────────────────────────────────────────────────────

async def broadcast(payload: dict[str, Any]) -> None:
    dead: set[WebSocket] = set()
    # Snapshot the client set to avoid RuntimeError from concurrent modification
    # (other coroutines may add/remove clients while we await sends).
    clients = set(_ws_clients)
    for ws in clients:
        try:
            await ws.send_text(json.dumps(payload, default=str))
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


# ─── Helper: Build AuditEvent from request + response ────────────────────────

def _build_audit(request: ToolRequest, response: ToolResponse) -> AuditEvent:
    return AuditEvent(
        request_id=request.request_id,
        agent_id=request.agent_id,
        session_id=request.session_id,
        tool=request.tool,
        action=request.action,
        resource=request.resource,
        arguments=request.arguments,
        category=_infer_category(request),
        decision=response.decision,
        reason=response.reason,
        policy_matched=response.policy_matched,
        risk_signals=response.risk_signals,
        threat_level=response.threat_level,
        timestamp=datetime.now(timezone.utc),
    )


def _infer_category(request: ToolRequest) -> ActionCategory:
    t = request.tool.lower()
    mapping = {
        "execute_shell": ActionCategory.EXECUTE,
        "run_command": ActionCategory.EXECUTE,
        "http_request": ActionCategory.NETWORK,
        "fetch_url": ActionCategory.NETWORK,
        "write_database": ActionCategory.WRITE,
        "write_file": ActionCategory.WRITE,
        "export_data": ActionCategory.DATA_EXPORT,
        "send_email": ActionCategory.DATA_EXPORT,
        "search": ActionCategory.SEARCH,
    }
    if t in mapping:
        return mapping[t]
    if "read" in t:
        return ActionCategory.READ
    return ActionCategory.EXECUTE


# ─── Core Gateway Route ───────────────────────────────────────────────────────

@app.post("/gateway/evaluate", response_model=ToolResponse)
async def evaluate_tool_request(request: ToolRequest) -> ToolResponse:
    """
    Single enforcement boundary.
    Every tool call submitted by an agent MUST pass through here.
    """
    global _stats

    response = engine.evaluate(request)

    # Update stats
    _stats["total_tool_calls"] += 1
    if response.decision == Decision.ALLOW:
        _stats["allowed_actions"] += 1
    elif response.decision == Decision.BLOCK:
        _stats["blocked_actions"] += 1
    elif response.decision == Decision.REQUIRE_APPROVAL:
        _stats["approval_requests"] += 1
        # Add to approval queue
        _approval_queue[request.request_id] = ApprovalQueueItem(
            request_id=request.request_id,
            agent_id=request.agent_id,
            tool=request.tool,
            action=request.action,
            resource=request.resource,
            raw_context=request.raw_context,
            reason=response.reason,
            risk_signals=response.risk_signals,
            injection_matches=response.injection_matches,
            timestamp=datetime.now(timezone.utc),
        )
        # Broadcast approval request
        await broadcast({
            "type": "approval_required",
            "item": _approval_queue[request.request_id].model_dump(),
        })

    # Track in threat timeline
    _threat_timeline.append(ThreatTimelineEntry(
        timestamp=datetime.now(timezone.utc).isoformat(),
        threat_level=response.threat_level,
        decision=response.decision,
        tool=request.tool,
        agent_id=request.agent_id,
    ))
    # Keep timeline bounded
    if len(_threat_timeline) > 200:
        _threat_timeline.pop(0)

    # Persist to audit ledger
    event = _build_audit(request, response)
    finalized_event = ledger.append(event)

    # Broadcast to live WebSocket clients
    await broadcast(
        {
            "type": "audit_event",
            "event": {
                **finalized_event.model_dump(),
                "hash_preview": finalized_event.event_hash[:16] + "...",
                "injection_matches": [m.model_dump() for m in response.injection_matches],
                "rate_limit": response.rate_limit.model_dump() if response.rate_limit else None,
            },
        }
    )

    return response


# ─── Scenarios ────────────────────────────────────────────────────────────────

@app.get("/scenarios")
def list_scenarios() -> list[dict]:
    return [
        {
            "scenario_id": s.scenario_id,
            "name": s.name,
            "description": s.description,
        }
        for s in ALL_SCENARIOS.values()
    ]


# ─── Custom Scenario Builder ─────────────────────────────────────────────────

@app.post("/scenarios/custom/run", response_model=ToolResponse)
async def run_custom_scenario(custom: CustomScenarioRequest) -> ToolResponse:
    """
    Let users (judges!) craft their own attack scenario interactively.
    Builds a ToolRequest from the custom parameters and evaluates it.
    """
    request = ToolRequest(
        request_id=str(uuid.uuid4()),
        agent_id=custom.agent_id,
        session_id=f"custom-{uuid.uuid4().hex[:8]}",
        tool=custom.tool,
        action=custom.action,
        resource=custom.resource,
        arguments={"custom": True},
        raw_context=custom.raw_context,
    )
    return await evaluate_tool_request(request)


@app.post("/scenarios/{scenario_id}/run", response_model=ToolResponse)
async def run_scenario(scenario_id: str) -> ToolResponse:
    scenario = ALL_SCENARIOS.get(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    # Create a fresh request ID for each run
    request = scenario.request.model_copy(
        update={"request_id": str(uuid.uuid4())}
    )
    return await evaluate_tool_request(request)


# ─── Approval Queue ──────────────────────────────────────────────────────────

@app.get("/approvals")
def get_pending_approvals() -> list[dict]:
    """Return all pending approval requests."""
    return [item.model_dump() for item in _approval_queue.values()]


@app.post("/approvals/decide")
async def decide_approval(decision: ApprovalDecision) -> dict:
    """
    Human-in-the-loop: approve or deny a pending action.
    This is the key differentiator — the human is the final authority.
    """
    item = _approval_queue.pop(decision.request_id, None)
    if not item:
        raise HTTPException(status_code=404, detail="Approval request not found or already decided.")

    # Record the human decision in the audit ledger
    human_event = AuditEvent(
        request_id=decision.request_id,
        agent_id=item.agent_id,
        session_id="human-review",
        tool=item.tool,
        action=f"HUMAN_{'APPROVED' if decision.approved else 'DENIED'}",
        resource=item.resource,
        arguments={"reviewer_note": decision.reviewer_note},
        category=ActionCategory.EXECUTE,
        decision=Decision.ALLOW if decision.approved else Decision.BLOCK,
        reason=(
            f"Human reviewer {'APPROVED' if decision.approved else 'DENIED'} "
            f"the action. Note: {decision.reviewer_note or 'No comment.'}"
        ),
        policy_matched="human_review",
        risk_signals=["HUMAN_REVIEWED"],
        threat_level=ThreatLevel.NONE if decision.approved else ThreatLevel.HIGH,
        timestamp=datetime.now(timezone.utc),
    )
    finalized = ledger.append(human_event)

    # Broadcast the decision
    await broadcast({
        "type": "approval_decided",
        "request_id": decision.request_id,
        "approved": decision.approved,
        "reviewer_note": decision.reviewer_note,
        "event": {
            **finalized.model_dump(),
            "hash_preview": finalized.event_hash[:16] + "...",
        },
    })

    # Update stats
    if decision.approved:
        _stats["allowed_actions"] += 1
    else:
        _stats["blocked_actions"] += 1

    return {
        "status": "ok",
        "request_id": decision.request_id,
        "decision": "APPROVED" if decision.approved else "DENIED",
        "reviewer_note": decision.reviewer_note,
    }


# ─── Policy Management ────────────────────────────────────────────────────────

class RouteTaskRequest(BaseModel):
    task_description: str
    required_capability: str


@app.post("/router/select-agent")
def select_agent(req: RouteTaskRequest) -> dict:
    """
    Selects the fastest available agent that has the required capability.
    """
    capable_agents = [
        p for p in engine.all_policies() 
        if req.required_capability in p.capabilities.allowed
    ]
    if not capable_agents:
        raise HTTPException(
            status_code=404, 
            detail=f"No agent found with the required capability: {req.required_capability}"
        )
    
    # Sort capable agents by latency_ms (ascending)
    best_agent = sorted(capable_agents, key=lambda a: a.performance.latency_ms)[0]
    
    return {
        "task": req.task_description,
        "required_capability": req.required_capability,
        "selected_agent": best_agent.agent_id,
        "latency_ms": best_agent.performance.latency_ms,
        "success_rate": best_agent.performance.success_rate,
        "reason": f"Selected as the fastest agent with '{req.required_capability}' capability."
    }


@app.get("/policies")
def get_policies() -> list[dict]:
    return [p.model_dump() for p in engine.all_policies()]


@app.patch("/policies/capability")
def update_capability(update: PolicyUpdate) -> dict:
    ok = engine.update_capability(
        update.agent_id, update.capability, update.permitted
    )
    if not ok:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{update.agent_id}' not found in policy registry.",
        )
    return {"status": "ok", "agent_id": update.agent_id, "capability": update.capability, "permitted": update.permitted}


@app.post("/policies/reload")
def reload_policies() -> dict:
    engine.reload()
    return {"status": "ok", "message": "Policies reloaded from disk."}


# ─── Audit Routes ─────────────────────────────────────────────────────────────

@app.get("/audit/events")
def get_audit_events(limit: int = 50) -> list[dict]:
    events = ledger.recent(limit)
    for e in events:
        if "event_hash" in e:
            e["hash_preview"] = e["event_hash"][:16] + "..."
    return events


@app.get("/audit/verify")
def verify_ledger() -> dict:
    return ledger.verify_integrity()


# ─── Threat Timeline ─────────────────────────────────────────────────────────

@app.get("/threat-timeline")
def get_threat_timeline() -> list[dict]:
    """Returns the threat activity timeline for visualization."""
    return [entry.model_dump() for entry in _threat_timeline]


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

@app.get("/stats", response_model=GatewayStats)
def get_stats() -> GatewayStats:
    return GatewayStats(
        protected_agents=len(engine.all_policies()),
        active_sessions=1,
        total_tool_calls=_stats["total_tool_calls"],
        allowed_actions=_stats["allowed_actions"],
        blocked_actions=_stats["blocked_actions"],
        approval_requests=_stats["approval_requests"],
        current_threat_level=(
            ThreatLevel.HIGH if _stats["blocked_actions"] > 0 else ThreatLevel.NONE
        ),
        demo_mode=_demo_mode,
    )


# ─── Demo Control ─────────────────────────────────────────────────────────────

@app.post("/demo/reset")
async def reset_demo() -> dict:
    global _stats, _threat_timeline, _approval_queue
    ledger.clear()
    engine.reset_rate_limiter()
    _stats = {
        "total_tool_calls": 0,
        "allowed_actions": 0,
        "blocked_actions": 0,
        "approval_requests": 0,
    }
    _threat_timeline = []
    _approval_queue = {}
    await broadcast({"type": "demo_reset"})
    return {"status": "ok", "message": "Demo state reset."}


@app.post("/demo/run-sequence")
async def run_demo_sequence() -> dict:
    """
    Runs the enhanced demo sequence automatically.
    Now includes multi-agent scenarios and the approval flow.
    """
    async def _sequence() -> None:
        # 1. Safe request (research-agent)
        await asyncio.sleep(0.5)
        safe = ALL_SCENARIOS["safe-001"].request.model_copy(update={"request_id": str(uuid.uuid4())})
        await evaluate_tool_request(safe)

        await asyncio.sleep(2.5)

        # 2. Safe admin read (admin-agent)
        await asyncio.sleep(0.5)
        admin_safe = ALL_SCENARIOS["safe-002"].request.model_copy(update={"request_id": str(uuid.uuid4())})
        await evaluate_tool_request(admin_safe)

        await asyncio.sleep(2.5)

        # 3. Inject malicious context — secret file access
        await asyncio.sleep(0.5)
        attack1 = ALL_SCENARIOS["attack-001"].request.model_copy(update={"request_id": str(uuid.uuid4())})
        await evaluate_tool_request(attack1)

        await asyncio.sleep(2.5)

        # 4. Admin privilege escalation
        await asyncio.sleep(0.5)
        attack5 = ALL_SCENARIOS["attack-005"].request.model_copy(update={"request_id": str(uuid.uuid4())})
        await evaluate_tool_request(attack5)

        await asyncio.sleep(2.5)

        # 5. Rogue unknown agent
        await asyncio.sleep(0.5)
        attack6 = ALL_SCENARIOS["attack-006"].request.model_copy(update={"request_id": str(uuid.uuid4())})
        await evaluate_tool_request(attack6)

        await asyncio.sleep(2.5)

        # 6. Injection in allowed context → REQUIRE_APPROVAL
        await asyncio.sleep(0.5)
        attack7 = ALL_SCENARIOS["attack-007"].request.model_copy(update={"request_id": str(uuid.uuid4())})
        await evaluate_tool_request(attack7)

    asyncio.create_task(_sequence())
    return {"status": "ok", "message": "Demo sequence started (6 scenarios)."}


# ─── WebSocket: Live Event Stream ─────────────────────────────────────────────

@app.websocket("/ws/events")
async def ws_events(websocket: WebSocket) -> None:
    await websocket.accept()
    _ws_clients.add(websocket)
    try:
        while True:
            # Keep connection alive — data is pushed via broadcast()
            await asyncio.sleep(30)
            try:
                await websocket.send_text(json.dumps({"type": "ping"}))
            except RuntimeError:
                break  # connection already closed
    except WebSocketDisconnect:
        pass
    finally:
        _ws_clients.discard(websocket)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ZeroTrust Gateway", "version": "0.2.0"}
