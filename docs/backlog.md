# Dial backlog

## Verify the rendered stream failure and recovery in ChatGPT

Deferred explicitly by the owner when closing DIAL-001. The controlled host error-state check was waived for that experiment; it was not observed passing.

Local controller tests already cover rejected play and retained-media-error recovery. A later bounded factory work item should induce an actual stream failure in the ChatGPT player, observe a readable rendered error, restore the stream, and confirm audible recovery. Assign an ID at intake. Do not assume the error state is broken; its host behavior remains unverified.
