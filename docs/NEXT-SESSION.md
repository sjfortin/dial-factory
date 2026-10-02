# Resume Dial Factory

Factory scaffold is COMPLETE/PASS at accepted candidate 3652c7e5958e8552892805996740b8d5e3e32760. Independent review-2.json and verify-2.json are under factory/work-items/FACTORY-BOOTSTRAP, with durable evidence and metrics. Initial failed reports remain as history. One revision fixed R1–R4.

Current objective: run DIAL-001 through Triage -> optional Spec -> Implement -> Review -> Verify. Inspect its actual ledger state and Git status before continuing; do not repeat bootstrap. Read AGENTS.md and docs/BOOTSTRAP-CONTRACT.md. Owner approval persists, including appropriate per-worker models and public repository pushes. Never merge/deploy automatically.

Local repo /home/sam/Work/dial; public remote https://github.com/sjfortin/dial-factory. Bootstrap branch factory/bootstrap. Root coordinates only; real workers implement/review/verify. Use the actual collaboration tools; Python records dispatches but cannot spawn agents.

Model policy: Triage and Verify gpt-6-luna/medium; Implement gpt-6-sol/medium for bounded product work; Spec gpt-6-sol/high; Review gpt-6-astra/medium. Requested models are known; backend model/usage/cost may be unknown.

At the October 3 resume, live-agent inventory contained only the Foreman. DIAL-001's interrupted Implement run `run-b4502348cf78` was closed BLOCKED, preserving its partial files. Replacement `/root/dial_001_resume` uses Sol/medium and run `run-d7771bdbdc1b`, with explicit replacement/retry references. Reuse worker context when available; record replacements when it is lost. Product workers receive fresh focused packets, not the full bootstrap conversation. Run elapsed time includes the usage outage and must not be described as compute time.

Known limitations: dispatch packet write failure needs explicit close/retry; role boundaries are procedural; no per-worker cost telemetry. Browser discovery still returned no surfaces after resume, so ChatGPT rendering/audio checks may need minimal human verification and must be recorded BLOCKED until observed.

Accepted bootstrap and handoff were pushed to `factory/bootstrap` at `6aa5eaf`. Current product work is on `work/DIAL-001`; inspect local and remote state before the next authorized push. No production deployment.
