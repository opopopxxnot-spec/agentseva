# Implementation Plan

## Phase 1: Planning & Setup (DONE)
- Workspace inspected.
- Documentation created.

## Phase 2: Core Backend (Gateway & Policy)
- Setup FastAPI project.
- Define data models (Agent, Policy, Request, Event).
- Implement YAML policy loader.
- Implement capability evaluator logic.

## Phase 3: Simulated Tool Server & Attack Simulator
- Create fake `secrets.txt` and `public.txt`.
- Implement endpoints to simulate Agent Tool Requests.
- Implement standard responses for ALLOW and BLOCK.

## Phase 4: Audit & Storage
- Setup SQLite DB.
- Implement event hashing for integrity.

## Phase 5: Frontend Dashboard
- Setup Vite + React + Tailwind.
- Create dashboard layout (dark, minimal, security-focused).
- Implement stats overview.

## Phase 6: Live Event Stream & Trace
- Add polling or WebSocket to frontend to receive gateway events.
- Implement the visual trace component.

## Phase 7: Demo Scenarios & UI Polish
- Wire up the Attack Simulator panel (buttons to trigger fake scenarios).
- Implement the Event Inspector.
- Ensure the "3-minute demo" flow is frictionless.
