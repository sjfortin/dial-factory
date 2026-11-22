# DIAL-011 host-evidence reconciliation — run-bd4fc9f14a61

- Candidate remains `699560e5d3b710dc4d7500cc10b85f5957b50ed7`, attempt 1; no production changes since prior Verify.
- Before fix, public resource read for country-v9 returned `-32602 not found`; evidence is in `pre-fix-host-evidence.md`.
- After rollout, public SDK checks pass all country-v1 through country-v12 aliases with current canonical HTML/CSP and NTS tab; country-v99 is rejected.
- The owner answered the explicit post-rollout France retry question with “awesome, yes that is working.” This is a narrow, recorded owner-reported confirmation that the player opens. It is not instrumented URI/DOM or iframe-layout evidence.
- Prior independent checks remain bound to the exact candidate: `npm test` 40/40 and focused SDK alias test 1/1; independent Review ACCEPT. No tests, browser checks, or public-service operations were repeated for this unchanged-production reconciliation.
- Original criteria: PASS / PASS / PASS. Overall: PASS for the reported player-opening outcome and bounded alias fix; exact causal trace and dimensions remain unobserved.
- Structured report: `/tmp/dial011-verify-host.json`.
