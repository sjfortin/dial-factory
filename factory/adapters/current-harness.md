# Current collaboration harness

The Foreman uses real `spawn_agent`, `followup_task`, and messages in the active conversation. Python has no API to call those tools and cannot attest that a packet was executed. `dispatch` records the agent identity, requested model/reasoning, selection reason, and a packet before work; it does not launch an agent. The Foreman passes the run ID and packet to that agent, then records its actual report. If a replacement is needed, create a distinct agent and dispatch record; when a model changes for the same role, pass `--replaces` with the prior run ID.

Separate conversations and Git branches are procedural controls. Agents share files and tools, so neither is a security boundary. No daemon or durable agent-tree restart is assumed. A lost worker is reconstructed from saved packets, and the replacement is recorded. Per-worker billed cost and token usage are unavailable; null values and the reason are intentional.
