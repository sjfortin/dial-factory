# Owner-reported display error

Owner reports: "couldn't display dial try again" during host QA. Exact tool, thread scope, and host console details are not yet supplied. No audible behavior is established by this attempt.

Foreman diagnostics: public Tailscale tools/list succeeds and advertises radio-v6/country-v4. Connected Dial open_radio returns expected Radio Paradise station data. Public resources/read for radio-v6 succeeds; delivered HTML has one embedded script which vm.Script parses successfully. This establishes delivery/syntax, not runtime rendering. Public resources/read for old radio-v3 fails with MCP -32602 resource not found. Stale host metadata is therefore a plausible hypothesis, not a confirmed root cause. No production fix or new host pass is claimed.

Pending: owner identifies failing request and whether it happens in both threads; compare a new thread using the refreshed connection, and whether capability probe still renders. Preserve prior accepted source review and distinguish this missing/failed host evidence from local packaging success.
