# ZeroTrust Gateway

> **Runtime zero-trust security layer for autonomous AI agents.**
>
> *"Don't make the agent smarter. Make its power controllable."*

---

## What It Does

ZeroTrust Gateway sits between an AI agent and every tool it can call. When an agent is manipulated by untrusted external content (prompt injection), the gateway intercepts the tool request, evaluates it against a deterministic capability policy, and **blocks** the action before any sensitive system is touched.

```
Agent → External Context (malicious) → Tool Request
     → ZeroTrust Gateway
          → Identity check
          → Capability policy
          → Injection detection
          → BLOCK / ALLOW / REQUIRE APPROVAL
     → Audit Ledger
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node 18+

### 1. Start the Backend (Gateway + API)

```powershell
cd backend
uvicorn main:app --reload --port 8000
```

### 2. Start the Frontend (Dashboard)

```powershell
cd frontend
npm run dev
```

Then open: **http://localhost:5173**

---

## Demo: 3-Minute Sequence

1. Open the **Simulator** tab
2. Click **START DEMO** — this runs the automated sequence
3. Watch the live trace animate as the attack is blocked
4. Click any audit event to inspect the full security decision
5. Go to **Policy** tab, toggle a permission, re-run the attack

Or run individual scenarios:
- ✅ `Safe Document Read` — expected: ALLOW
- 🚨 `Secret File Access Attempt` — expected: BLOCK (prompt injection + denied capability)
- 🚨 `Unauthorized Shell Execution` — expected: BLOCK
- 🚨 `External Data Exfiltration` — expected: BLOCK
- 🚨 `Unauthorized DB Mutation` — expected: BLOCK

---

## Architecture

```
Frontend (React + Vite + Tailwind)
    ↓ HTTP / WebSocket
Backend (FastAPI, Python)
    ↓
Gateway (policy_engine.py)
    ├── Identity Resolution
    ├── Capability Policy (policies.yaml)
    ├── Injection Detection
    └── Runtime Enforcement
    ↓
Audit Ledger (audit_ledger.py, SQLite)
    └── SHA-256 hash chain (prototype)
    ↓
Simulated Tool Server (scenarios.py)
    └── Synthetic files and resources only
```

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/policy_engine.py` | Deterministic capability enforcement |
| `backend/audit_ledger.py` | Hash-chained audit ledger |
| `backend/scenarios.py` | Synthetic attack scenarios |
| `backend/policies.yaml` | Agent capability definitions |
| `backend/main.py` | FastAPI routes + WebSocket stream |
| `frontend/src/components/` | All UI components |
| `docs/` | Architecture, threat model, demo script |

---

## Simulated vs Real

| Component | Status |
|-----------|--------|
| Policy enforcement engine | ✅ REAL |
| Capability evaluation | ✅ REAL |
| Prompt injection detection | ✅ REAL |
| Audit event hashing | ✅ REAL |
| Hash chain verification | ✅ REAL |
| YAML policy hot-reload | ✅ REAL |
| Live WebSocket event stream | ✅ REAL |
| MCP transport | ⚠ SIMULATED |
| OS sandbox | ⚠ SIMULATED |
| File/shell execution | ⚠ SIMULATED |
| AI/SLM semantic layer | 🔮 FUTURE |

---

## Security Principles Implemented

1. **Least privilege** — agents have explicit allowed lists; all else is denied
2. **Default deny** — unknown capabilities are blocked by default
3. **Deterministic enforcement** — LLM output is never the final security authority
4. **Defense in depth** — injection detection + capability check + sandbox boundary
5. **Complete auditability** — every decision is logged with hash chain integrity
6. **Fail closed** — unknown agents are immediately blocked

---

## Judge-Facing Summary (30 seconds)

> AI agents can now read files, run code, query databases, and call APIs.
> But they also read untrusted external content.
> If that content contains hidden instructions, the agent may attempt actions it should never take.
>
> ZeroTrust Gateway is the enforcement layer between the agent and its tools.
> It doesn't make the agent smarter — it makes the agent's power **governable**.
>
> Every tool call passes through a deterministic policy engine.
> Every decision is audited with a hash chain.
> Even a fully compromised agent cannot bypass the gateway.
