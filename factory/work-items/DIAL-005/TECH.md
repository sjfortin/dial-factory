# DIAL-005 — implementation plan

## Decision gate

**Draft, design choice pending.** `PRODUCT.md` and this file require revision to name the owner-selected A/B/C direction and refinements. Foreman obtains exact revision approval before Implement edits production files. `design/player-directions.html` is a non-production visual reference, not an implementation source or verified host rendering.

## Architecture and components

- Update the two UI resources, `public/player.html` and `public/discovery.html`, as a coherent small component treatment. Preserve tool names, the script injection marker, semantic status/button/audio hooks, and delivery flow in `src/server.ts`. Version the delivered UI resource URIs when the HTML or injected script changes, following the DIAL-004 cache practice; update references and resource tests together.
- Keep shared behavior in `src/player-controller.ts`, `src/playback-coordinator.ts`, `src/player.ts`, and `src/station-list.ts`. If markup or selected-row styling needs a small binding change, Implement may make it in those files without changing the coordination/discovery contract. Preserve text updates and state transitions as the source of truth; CSS should reflect state, not infer it from stale visual state.
- Preserve the country result schema, validation, at-most-ten bound, provider attribution and reporting text. Escape or use text nodes for provider names. Do not introduce external fonts, assets, network fetches, new origins, or dependencies for styling.
- Use scoped CSS and system appearance (`color-scheme`/`prefers-color-scheme`) in the delivered resources. Choose actual colors and spacing after the owner selects a direction; check real rendered contrast and focus visibility in both appearances.

## Constraints

The working DIAL-004 protocol supports same-browser/profile coordination; its failure and stale-status semantics must survive. A request to play is not proof of audible playback. Do not replace ambiguous remote status with an asserted “Now playing,” and do not show successful remote Pause until acknowledged. Keep play controls reachable at 320px and long station names manageable. Do not change CSP/media origin allowlists or report clicks differently.

## Tests and verification

- Extend the smallest relevant tests in `test/player.test.js`, `test/station-list.test.js`, `test/ui-harness.test.js`, or `test/server.test.js` for any markup/state binding changes. Existing playback, timing, list validation, and delivered-resource tests must still pass; use the repository's test command.
- Inspect both UI resources in a local browser at about 320px and 560px in light and dark modes. Check focus order, keyboard activation, Play/Pause, selected row, loading/error/empty message visibility, long names, and no horizontal overflow. This preview is layout evidence, not host evidence.
- Verify delivered MCP resources through Inspector as applicable, then record actual ChatGPT thread visual QA and owner-observed takeover/remote Pause behavior for the candidate. Review and Verify must be independent identities, bound to the same candidate commit, and account for each work-item criterion.

## Failure and rollback

If the chosen treatment cannot fit or remain legible in the host, revise the approved design through Foreman and implement a new candidate. If visual edits regress playback or coordination, revert the candidate UI/binding changes to the previously verified DIAL-004 behavior and run the relevant resource/player checks again. No automatic merge, publish, or deployment.
