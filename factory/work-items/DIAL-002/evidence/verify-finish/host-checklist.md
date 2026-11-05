# DIAL-002 ChatGPT host check — candidate 542a2b32d4e7ac3cfec69657667567994af04aec

Refresh the ChatGPT MCP Apps connection for this candidate. Run `find_stations_by_country` once for `FR` and once for `GB`. For each call, record the date, tool status, and the displayed country and station rows.

For **two distinct FR stations** and **two distinct GB stations**, record the station name, UUID, stream URL, exact origin, and format. For each station:

1. Select its row. Confirm the visible selected name and audio source match that row. When switching from a playing station, confirm the old audio stops and the new station remains idle; selection must not autoplay.
2. Press **Play** and confirm sound is audible from the selected station. Record the result and any media, CSP, redirect, or network error.
3. Press **Pause** and confirm silence. Press **Play** again and confirm audible sound resumes. Record both observations separately.

UI labels, tool results, and Inspector output alone cannot establish audible playback. Save dated host observations or recordings and identify any failed station explicitly. This recovery Verify run did not have an authorized ChatGPT host session; these observations remain pending.
