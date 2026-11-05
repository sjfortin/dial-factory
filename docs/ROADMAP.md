# Dial roadmap — proposal

This is a proposed sequence, not approval to implement every phase. The owner requested cross-thread playback next and a plan for what follows. Changes to sequence and scope remain possible after real host evidence. Only DIAL-003 has been admitted as the active next-phase work item.

## Current delivery: country discovery (DIAL-002)

Country lookup, station selection and the player are implemented and independently reviewed; 19 automated tests and live Inspector checks passed. Owner reports successful ChatGPT QA. Formal verification still needs dated station-specific host evidence required by its approved spec. Existing work is pushed on work/DIAL-002; PR #2 targets main: https://github.com/sjfortin/dial-factory/pull/2. The PR is open and mergeable, not merged. main was created from factory/bootstrap at 487e865; changing the default branch is a separate repository setting not performed here.

## Next: single active playback across threads (DIAL-003)

First proposed support boundary: two live Dial views in separate ChatGPT chats in the same browser profile/device. Proposed behavior: Play takes ownership from the other view; Pause can stop active playback from either. These are explicit proposals pending owner approval, not assumed completed product behavior.

First gate is an actual ChatGPT capability test for shared messaging and atomic ownership primitives. The host may partition iframe origins/storage or suspend old views; browser API availability in a local fixture is insufficient. If coordination cannot be made reliable, return with evidence and a revised proposal rather than silently introducing accounts, a server registry or cross-device promises.

Then build the smallest supported protocol, clear ownership/status UI, safe failure behavior and rapid-interaction/lifecycle tests. Exit requires independent Review, automated verification and actual two-thread host observations demonstrating the approved Play/Pause/transfer behavior. No hard guarantee is made about paused/suspended or unreachable instances before that evidence exists.

## Afterward: reliability and easy operation (proposed)

Make repeat testing and routine use predictable: an explicitly approved automatic-start setup for the local server, restart/reconnect handling, understandable ownership/provider/media errors and the previously deferred controlled stream-error/recovery host check. Define what happens on sleep, reboot, closed views and expired click tokens. Do not promise background playback through host teardown. Exit with a documented runbook and real interruption/recovery evidence.

Rationale: playback should be dependable before adding more discovery or stored state. Hosting on a laptop still depends on its power, network and awake state; an always-on host would be a separate deployment decision.

## Then: useful station coverage and discovery (proposed)

Expand beyond the present finite FR/GB media-origin proof. Begin with owner-valued stations such as FIP and a small set of known compatible streams; evaluate name search and a conversational country-selection flow. Investigate media CSP/origin policy and redirects first. Keep result sizes bounded and errors clear. Do not replace the existing finite policy with unrestricted media access without an approved design. Exit with documented coverage and actual audible evidence for the supported stations.

## Later: favorites and resume (proposed)

Save favorites and the last selected station only after choosing explicit storage, identity and privacy semantics. State what persists across threads, browsers and devices, and what the user can clear. A server has no safe basis to treat all unauthenticated listeners as the same user. Cross-device playback control depends on an identity-backed design and is deferred until explicitly requested and approved.

## Release path

Each phase receives bounded intake/criteria, Triage, a Spec when needed, exact revision approval, Implement, independent Review and Verify, then a Foreman handoff. Proposals are not automatic authorization. Merge, publication and production deployment remain separate human actions. Keep successful owner QA distinct from missing evidence and retain prior failures honestly.
