# Architecture Decisions (ADRs)

1. **Deterministic Over LLM-based Security**
   - *Decision*: The final ALLOW/BLOCK decision will be made by a deterministic policy engine, not an LLM.
   - *Rationale*: Security boundaries must be provable and consistent. LLMs can be bypassed; hardcoded rules cannot.

2. **Simulated Sandbox**
   - *Decision*: We will simulate the execution of sensitive tools instead of building a full OS-level sandbox or Docker runtime.
   - *Rationale*: Hackathon constraints. The product value is the *gateway interception*, not the execution environment itself.

3. **Standalone Gateway**
   - *Decision*: The Gateway acts as a proxy between the Agent/Client and the MCP Tool Server.
   - *Rationale*: Clean interception point. Does not require modifying the agent code itself.

4. **Local Execution Only**
   - *Decision*: No cloud dependencies, no external databases.
   - *Rationale*: Eliminates demo failure risk due to WiFi or API rate limits.
