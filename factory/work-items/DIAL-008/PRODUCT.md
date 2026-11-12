# DIAL-008 — show More only for known compatible choices

## Problem

The country player currently offers **More stations** when a provider window contains 50 raw rows. That says nothing about whether another unique, compatible MP3 station exists. The owner observed misleading continuation on France and Japan. A short or empty early window also must not prevent the bounded scan from finding a compatible choice in a later window, as can matter for Canada and Germany.

## Behavior and UX

- A valid country request inspects the existing three 50-row Radio Browser windows, offsets 0, 50, and 100. It gathers at most 30 unique stations that pass the existing finite MP3/media policy. It checks later windows even when an earlier window is short, empty, unsupported, duplicate-only, or the choice cap has been reached. A provider failure is reported as incomplete, not as exhaustion.
- The player initially shows up to eight gathered choices in provider-window and row order. **More stations** appears only while at least one *already gathered, unique, compatible* choice is hidden. Each press reveals up to eight more; the last press can reveal fewer. More never fetches a speculative provider page or starts audio. Thus the dated US sample of nine choices yields eight, then one; France's six and Japan's one show no More.
- While the initial bounded request runs, show a neutral scanning status and no More. After a complete scan, state the number of compatible catalog choices and whether the 30-choice limit was reached. Do not imply the Radio Browser directory is exhausted beyond the three windows or that a catalog choice is audibly playable. Keep the existing Radio Browser attribution and click disclosure.
- If one of the three provider windows fails or times out, show the choices gathered from successful windows, mark the scan incomplete, and offer a separate **Retry scan** control. More may also appear if known choices remain hidden. A retry is user initiated, repeats the same bounded scan, and merges newly found unique choices up to 30 while retaining visible choices, selection, and audio. A failed retry leaves those states intact. A new country request resets the catalog and selection according to existing behavior; late retry responses cannot affect it.

## Dated evidence and limits

Foreman performed a live Radio Browser scan dated **2026-11-08**: US 9 compatible catalog choices across windows 1+5+3; FR 6 across 5+0+1; JP 1; GB 6; CA 2; DE 1; ES 1; IT 5. These are observed catalog counts under the finite policy, not direct stream checks or audible ChatGPT playback proof. The counts can change. US is the genuine pagination regression country; CA and DE are later-window coverage cases.

## Non-goals and edge cases

No new provider or media origin, source override, codec, arbitrary URL, proxy, user account, recommendation, persistence, hosting, publication, deployment, or automatic merge. Keep the neutral Studio layout, keyboard selection, separate Play/Pause, same-browser coordination, signed click tokens, finite CSP, and clean playback errors. Duplicate UUIDs or canonical stream URLs across windows or retries count once. The 30-choice cap is a display limit, not proof that later provider rows contain no compatible stations. Empty complete scans, incompatible complete scans, partial scans, invalid countries, and playback failures need distinct truthful states.

## Acceptance

1. More is visible only when another unique, browser-compatible gathered choice is hidden; every More press adds at least one and at most eight, without a provider request, duplicate, or playback change. US nine-choice fixture yields 8+1; FR six and JP one have no More.
2. A single country scan makes no more than three existing-origin provider requests at offsets 0/50/100, each limited to 50 rows, the existing timeout and response cap. It finds later-window CA/DE-style choices even after short, empty, or duplicate-only earlier windows and returns at most 30 unique choices.
3. Complete versus partial/failure states and the choice-cap flag are distinct. A partial scan keeps successful choices, offers manual retry, never calls itself exhausted, and never advertises More without a known hidden choice. Retry preserves visible choices, selection, and playing audio; stale retry/results cannot mutate a newer search.
4. Exact finite stream admission, browser validation, CSP, click-token attribution, selection/Play separation, pause/coordination, safe text, neutral layout, attribution, and playback errors remain intact.
5. Independent Review and Verify bind to the exact candidate and record focused automated regressions plus a fresh dated live US pagination observation and eight-country catalog coverage. Catalog admission, direct stream reachability, and audible ChatGPT host playback are separate evidence. Missing host CSP/playback/continuity checks remain BLOCKED. The owner decides acceptance before any hosting work.
