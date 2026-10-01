"""
ZeroTrust Gateway — Audit Ledger
Prototype integrity mechanism: SHA-256 event hashing with chain linking.
Clearly labeled as a prototype — not a cryptographically hardened ledger.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from models import AuditEvent, Decision, ThreatLevel


DB_PATH = Path(__file__).parent / "audit.db"


def _event_content_string(event: AuditEvent) -> str:
    """Canonical string representation of an event for hashing."""
    return json.dumps(
        {
            "event_id": event.event_id,
            "request_id": event.request_id,
            "agent_id": event.agent_id,
            "session_id": event.session_id,
            "tool": event.tool,
            "action": event.action,
            "resource": event.resource,
            "arguments": event.arguments,
            "category": event.category,
            "decision": event.decision,
            "reason": event.reason,
            "policy_matched": event.policy_matched,
            "risk_signals": event.risk_signals,
            "threat_level": event.threat_level,
            "previous_hash": event.previous_hash,
            "timestamp": event.timestamp.isoformat(),
        },
        sort_keys=True,
    )


def _compute_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class AuditLedger:
    """
    Append-only audit ledger with hash chaining (prototype).
    Each event includes a SHA-256 hash of its own content plus the
    previous event's hash — creating a tamper-evident chain.
    """

    def __init__(self, db_path: str | None = None) -> None:
        self._db_path = db_path or str(DB_PATH)
        self._init_db()

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_events (
                    seq         INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id    TEXT NOT NULL,
                    request_id  TEXT NOT NULL,
                    agent_id    TEXT NOT NULL,
                    session_id  TEXT NOT NULL,
                    tool        TEXT NOT NULL,
                    action      TEXT NOT NULL,
                    resource    TEXT NOT NULL,
                    arguments   TEXT NOT NULL,
                    category    TEXT NOT NULL,
                    decision    TEXT NOT NULL,
                    reason      TEXT NOT NULL,
                    policy_matched TEXT,
                    risk_signals TEXT NOT NULL,
                    threat_level TEXT NOT NULL,
                    event_hash  TEXT NOT NULL,
                    previous_hash TEXT NOT NULL,
                    timestamp   TEXT NOT NULL
                )
                """
            )

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _last_hash(self) -> str:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT event_hash FROM audit_events ORDER BY seq DESC LIMIT 1"
            ).fetchone()
            return row["event_hash"] if row else "0" * 64

    def append(self, event: AuditEvent) -> AuditEvent:
        """Compute hashes and persist the event. Returns the finalized event."""
        event.previous_hash = self._last_hash()
        content_str = _event_content_string(event)
        event.event_hash = _compute_hash(content_str)

        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO audit_events
                (event_id, request_id, agent_id, session_id, tool, action,
                 resource, arguments, category, decision, reason, policy_matched,
                 risk_signals, threat_level, event_hash, previous_hash, timestamp)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    event.event_id,
                    event.request_id,
                    event.agent_id,
                    event.session_id,
                    event.tool,
                    event.action,
                    event.resource,
                    json.dumps(event.arguments),
                    event.category,
                    event.decision,
                    event.reason,
                    event.policy_matched,
                    json.dumps(event.risk_signals),
                    event.threat_level,
                    event.event_hash,
                    event.previous_hash,
                    event.timestamp.isoformat(),
                ),
            )
        return event

    def recent(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_events ORDER BY seq DESC LIMIT ?", (limit,)
            ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def all(self) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_events ORDER BY seq ASC"
            ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def verify_integrity(self) -> dict[str, Any]:
        """
        Walk the entire chain and verify hashes.
        Returns a summary of the integrity check.
        [PROTOTYPE] — not a production-grade cryptographic audit.
        """
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_events ORDER BY seq ASC"
            ).fetchall()

        violations: list[dict[str, Any]] = []
        previous_hash = "0" * 64

        for row in rows:
            r = dict(row)
            # Reconstruct the event to recompute hash
            ev = AuditEvent(
                event_id=r["event_id"],
                request_id=r["request_id"],
                agent_id=r["agent_id"],
                session_id=r["session_id"],
                tool=r["tool"],
                action=r["action"],
                resource=r["resource"],
                arguments=json.loads(r["arguments"]),
                category=r["category"],
                decision=Decision(r["decision"]),
                reason=r["reason"],
                policy_matched=r["policy_matched"],
                risk_signals=json.loads(r["risk_signals"]),
                threat_level=ThreatLevel(r["threat_level"]),
                event_hash=r["event_hash"],
                previous_hash=r["previous_hash"],
                timestamp=datetime.fromisoformat(r["timestamp"]),
            )
            content_str = _event_content_string(ev)
            expected_hash = _compute_hash(content_str)

            if r["previous_hash"] != previous_hash:
                violations.append(
                    {
                        "seq": r["seq"],
                        "event_id": r["event_id"],
                        "issue": "CHAIN_BREAK: previous_hash mismatch",
                    }
                )
            if r["event_hash"] != expected_hash:
                violations.append(
                    {
                        "seq": r["seq"],
                        "event_id": r["event_id"],
                        "issue": "HASH_MISMATCH: event content was altered",
                    }
                )
            previous_hash = r["event_hash"]

        return {
            "total_events": len(rows),
            "violations": violations,
            "status": "INTEGRITY_OK" if not violations else "INTEGRITY_VIOLATION",
        }

    def clear(self) -> None:
        """Reset ledger (used only for demo reset)."""
        with self._conn() as conn:
            conn.execute("DELETE FROM audit_events")

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
        r = dict(row)
        r["arguments"] = json.loads(r["arguments"])
        r["risk_signals"] = json.loads(r["risk_signals"])
        return r
