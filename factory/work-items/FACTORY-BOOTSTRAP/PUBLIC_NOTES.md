# Factory bootstrap — draft checkpoint notes

This draft is publicly visible in the repository because the owner requested a public checkpoint. No separate post or announcement was published. Human review remains required before reusing or expanding these notes elsewhere.

We built a small recorder around real worker agents, with a cheaper model handling bounded verification and a separate stronger reviewer. The first implementation passed its own six tests. Independent workers nevertheless found lifecycle bugs: old passing evidence could survive a failed retry, and some required revision/recovery steps could be bypassed.

The factory routed findings back to Implement. We paused at a committed checkpoint before applying the fixes; the product experiment has not started.

Useful result: independent review and behavioral verification caught defects that the first test suite missed. This is not a claim that the factory is ready or that radio playback works.

Safe metrics: first Review requested changes; first Verify failed; no human implementation. One revision batch pending. Cost and token usage unavailable. No final cycle-time or automation percentage claim from this incomplete bootstrap.
