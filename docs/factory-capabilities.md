# Observed factory capabilities

Bootstrap environment: 2026-10-02 Asia/Tokyo (tool clock uses UTC).

| Capability | Evidence | Limit |
| --- | --- | --- |
| Real subagents | Spawned capability probe with fresh context; received its independent output. Implement, Review, Verify subsequently performed real work. | Four active slots including root; this is a live session, not a daemon. |
| Worker continuity | Followed up completed probe; it recalled DIAL-FACTORY-PROBE-42 without receiving the token again. Reused Implement for revision and Verify after planning. | Restart recovery of the live agent tree has not been tested. |
| Context isolation | `fork_turns=none` supplies task-specific conversation context. | Workers inherit harness instructions and share tools/files; no per-role security boundary. |
| Model selection | Spawn requests used gpt-6-sol/high, gpt-6-astra/medium and gpt-6-luna/medium. | Backend version and billed usage not independently attested by spawn responses. |
| Files/processes | Shell, Git 2.55.0, Node 24.21.0 and Python 3.14.7 available. Local repo created; workers used disposable test workspaces. | Workspace writes limited to allowed roots; network/other access can require approval. |
| Codex CLI | 0.155.1; authenticated with ChatGPT; help exposes exec/resume, JSONL, output schemas and worktrees. | Nested CLI agent execution and CLI-session restart not tested; not the v0 adapter. |
| GitHub | Connector returned authenticated login sjfortin; scoped Dial repo search succeeded with no result. PR/issue/CI tools available in tool inventory. | Remote write permission untested; no repository created, pushed, merged or published. |
| Browser verification | Browser tool discovery returned empty apps and browsers lists. | ChatGPT rendering/playback cannot currently be automated; audible playback requires separate evidence. |
| Usage/cost | Wall timestamps, identities, requested settings and output reports can be saved. | Collaboration tools do not expose per-worker token accounting or billed cost. |

The durable record consists of files in Git. Foreman can rebuild worker context from the saved packet, but must record a replacement/context loss when the original session is unavailable. The recorder validates state and evidence metadata; it cannot attest that an external harness call occurred or that an evidence claim is true. Independent behavioral verification remains required.

See [the official multi-agent contract](https://developers.openai.com/api/docs/guides/responses-multi-agent) for documented primitives. Runtime observations above determine what this factory actually relies on.
