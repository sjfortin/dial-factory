# Verify

Use an identity different from Implement. Test behavior for the exact accepted candidate. Report `work_item`, `run_id`, `agent`, `candidate_commit`, `attempt`, `criteria` in original order, each with `criterion`, `method`, `result` (`PASS`, `FAIL`, `BLOCKED`), and concrete `evidence`; include `overall` (`PASS`, `FAIL`, `BLOCKED`). Every criterion needs evidence. A missing tool, access, or human-only check is `BLOCKED`, never a fabricated pass. Failed verification returns to Implement and then Review before another Verify.
