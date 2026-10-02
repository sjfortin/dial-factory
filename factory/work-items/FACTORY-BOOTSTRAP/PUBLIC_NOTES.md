# Factory bootstrap — draft public notes

Repository content is public at the owner's request; no separate post or announcement is authorized by this file.

We built a small recorder around real worker agents. Sol implemented, Astra reviewed independently, and Luna executed behavioral checks. The first implementation passed six tests but failed independent checks. Four lifecycle/recovery bugs were returned to Implement and repaired in one revision.

The scaffold now passes independent Review and Verify: thirteen repository tests, six additional reviewer tests, and actual CLI lifecycles including a failed attempt followed by a successful retry. No human implementation was needed.

The owner approved the scope/models, paused near session limits, requested a public repo, and resumed. Costs and tokens are unavailable; exact bootstrap cycle time was not captured at intake. These are bootstrap observations, not an automation-rate claim across product work.

What changed: regression coverage now checks stale evidence, fresh revision work, late spec changes, and interrupted handoff recovery. DIAL-001 will be the first product task; no radio playback result is claimed here.
