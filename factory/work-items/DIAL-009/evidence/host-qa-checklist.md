# Pending ChatGPT desktop QA

Candidate: d4da1f9d1c9bb4c509bd35789fcb676607c3fbde (country-v12). This checklist is a plan, not observed evidence. Candidate has not been pushed, merged or deployed; owner authorization is required for rollout to the existing testing endpoint.

After authorized rollout, refresh the Dial connection and open a fresh card. Record date, station and country with every playback observation.

- Check Countries/NTS navigation, country picker and long names at narrow/desktop widths in light/dark themes, plus keyboard focus and selection.
- Select a country station and separately press Play; observe audible audio, Pause and resume. Check selected/play state remains truthful. Cover admitted candidates across the supported countries; Sweden currently has no compatible result in the bounded scan and must not advertise its excluded Bandit stream.
- Test US More while audio plays: additional unique choices appear without changing selected audio. Check manual Retry where a partial failure can be reproduced; old/pending responses must not replace a new country selection or stop newer audio.
- Verify same-browser two-thread takeover and remote Pause remain functional, and stream failure leaves a clear error with a usable station list.
- NTS 1/2 should show official links and explicit in-player unavailability, no invented country or Radio Browser click. Switching collection alone should preserve country playback and its disclosure; selecting a link-only NTS row clears the old source. NTS in-app audio is BLOCKED, not accepted by this fallback.
- Check Radio Browser attribution/IP disclosure on country content and active country selection. Note any host CSP or network errors separately from catalog counts and direct MP3 bytes.

No host results have been recorded for this candidate yet.
