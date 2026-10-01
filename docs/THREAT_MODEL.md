# Threat Model

## Assumptions
- The AI Agent is fundamentally untrusted. It can be manipulated by external prompts.
- Tool arguments may be maliciously crafted.
- External context parsed by the agent can contain hidden instructions (prompt injection).

## Vectors Examined
- **Prompt Injection**: Agent instructed to ignore constraints.
- **Capability Escalation**: Agent attempts action outside allowed permissions.
- **Unauthorized Tool Selection**: Using tools restricted for the current session.
- **Argument Manipulation**: Altering file paths (e.g., `../../etc/shadow`).
- **Data Exfiltration**: Exporting sensitive data via uncontrolled channels.
- **Policy Tampering**: Attempts to alter the YAML policy at runtime.

## Mitigations
- **Deterministic Gateway Enforcement**: LLM output is not the final authority; a deterministic policy engine intercepts the MCP call.
- **Least Privilege**: Agents have explicit allowed/denied lists. Default deny.
- **Sandboxed Execution**: Simulated in prototype. Prevents real OS calls for dangerous actions.
- **Immutable Audit**: All interactions logged securely.
