# DIAL-002 host verification checklist

Connect an authorized ChatGPT MCP Apps endpoint running this exact candidate
and refresh the registered resource. For each country FR and GB:

1. Call `find_stations_by_country` with the country code. Record timestamp,
   status, searchedCount/limit, and every returned station's ID, name, stream
   URL, origin, and codec/bitrate. Confirm no more than ten stations are shown.
2. Select two distinct returned stations one at a time. Confirm the displayed
   selected name matches the row and selection stops/clears prior playback.
3. For each selected station press Play and confirm audible output; then Pause
   and confirm silence, then resume and confirm audible output. Record each
   result separately; UI state or tool success alone is not audibility.
4. Record any CSP/network/redirect errors and whether the origin is one of the
   approved exact origins. Also record any station-selection or playback errors.

This agent did not access a ChatGPT host session. All host selection and audio
checks remain unobserved and blocked pending this checklist.
