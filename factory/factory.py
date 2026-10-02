#!/usr/bin/env python3
"""Small, local record keeper for the Dial factory.

This program does not run agents. The Foreman uses the harness collaboration tools,
then records the real run and its report here.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FACTORY = ROOT / "factory"
ITEMS = FACTORY / "work-items"
JOURNAL = ROOT / "docs" / "factory-journal"
ROLES = {"Triage", "Spec", "Implement", "Review", "Verify"}
STATES = {"INTAKE", "TRIAGE", "WAITING_FOR_HUMAN", "PLANNING",
          "WAITING_FOR_SPEC_APPROVAL", "BUILDING", "REVIEWING", "VERIFYING",
          "READY_FOR_HANDOFF", "COMPLETE", "PARKED", "CANCELLED"}
NEXT = {
    "INTAKE": {"TRIAGE", "CANCELLED"},
    "TRIAGE": {"WAITING_FOR_HUMAN", "PLANNING", "BUILDING", "PARKED", "CANCELLED"},
    "WAITING_FOR_HUMAN": {"TRIAGE", "PLANNING", "WAITING_FOR_SPEC_APPROVAL", "BUILDING", "REVIEWING", "VERIFYING", "CANCELLED"},
    "PLANNING": {"WAITING_FOR_SPEC_APPROVAL", "WAITING_FOR_HUMAN", "CANCELLED"},
    "WAITING_FOR_SPEC_APPROVAL": {"BUILDING", "PLANNING", "WAITING_FOR_HUMAN", "CANCELLED"},
    "BUILDING": {"REVIEWING", "WAITING_FOR_SPEC_APPROVAL", "WAITING_FOR_HUMAN", "CANCELLED"},
    "REVIEWING": {"BUILDING", "VERIFYING", "WAITING_FOR_SPEC_APPROVAL", "WAITING_FOR_HUMAN", "CANCELLED"},
    "VERIFYING": {"BUILDING", "READY_FOR_HANDOFF", "WAITING_FOR_SPEC_APPROVAL", "WAITING_FOR_HUMAN", "CANCELLED"},
    "READY_FOR_HANDOFF": {"COMPLETE", "WAITING_FOR_SPEC_APPROVAL", "CANCELLED"},
    "PARKED": {"TRIAGE", "CANCELLED"},
    "COMPLETE": set(), "CANCELLED": set(),
}
MODEL = {"Triage": ("gpt-6-luna", "medium"), "Spec": ("gpt-6-sol", "high"),
         "Implement": ("gpt-6-sol", "medium"), "Review": ("gpt-6-astra", "medium"),
         "Verify": ("gpt-6-luna", "medium")}
ID_RE = re.compile(r"^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$")
COMMIT_RE = re.compile(r"^[0-9a-f]{7,40}$")


class Invalid(ValueError):
    pass


def need(ok, message):
    if not ok:
        raise Invalid(message)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def item_dir(item_id):
    need(bool(ID_RE.fullmatch(item_id)) and len(item_id) <= 80, "unsafe work-item ID")
    return ITEMS / item_id


def atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=".factory-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def dump(obj):
    return json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def load(item_id):
    path = item_dir(item_id) / "state.json"
    need(path.is_file(), f"unknown work item {item_id}")
    data = json.loads(path.read_text(encoding="utf-8"))
    # state.json is authoritative. Repair an interrupted mirror write on read.
    mirror = item_dir(item_id) / "events.jsonl"
    expected = "".join(json.dumps(e, sort_keys=True) + "\n" for e in data["events"])
    if not mirror.exists() or mirror.read_text(encoding="utf-8") != expected:
        atomic(mirror, expected)
    for report in data["reports"]:
        path = item_dir(item_id) / "reports" / f"{report['run_id']}.json"
        expected_report = dump(report)
        if not path.exists() or path.read_text(encoding="utf-8") != expected_report:
            atomic(path, expected_report)
    if data["handoff"] is not None:
        ensure_handoff_artifacts(data)
    return data


def save(data):
    directory = item_dir(data["id"])
    atomic(directory / "state.json", dump(data))
    atomic(directory / "events.jsonl", "".join(json.dumps(e, sort_keys=True) + "\n" for e in data["events"]))


def event(data, kind, **details):
    data["events"].append({"seq": len(data["events"]) + 1, "at": now(), "kind": kind, **details})
    data["updated_at"] = now()


def nonempty(value, name):
    need(isinstance(value, str) and bool(value.strip()), f"{name} must be nonempty text")


def text_list(value, name):
    need(isinstance(value, list) and bool(value), f"{name} must be a nonempty list")
    for v in value:
        nonempty(v, name + " entry")


def read_json_file(path):
    p = Path(path).resolve()
    need(p.is_file(), f"file missing: {path}")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise Invalid(f"invalid JSON: {exc}") from exc


def last_run(data, role):
    return next((r for r in reversed(data["runs"]) if r["role"] == role), None)


def latest(data, role):
    run = last_run(data, role)
    if run is None or run["status"] != "FINISHED":
        return None
    return next((r for r in reversed(data["reports"]) if r["role"] == role and r["run_id"] == run["id"]), None)


def entered_after(data, role, stage):
    report = latest(data, role)
    if report is None:
        return None
    entry = max((e["seq"] for e in data["events"] if e["kind"] == "advanced" and e.get("to_state") == stage), default=0)
    reported = next((e["seq"] for e in reversed(data["events"]) if e["kind"] == "reported" and e["run_id"] == report["run_id"]), 0)
    return report if reported > entry else None


def candidate(data):
    return entered_after(data, "Implement", "BUILDING")


def current_review(data):
    impl = candidate(data)
    review = entered_after(data, "Review", "REVIEWING")
    return review if review and impl and review["attempt"] == impl["attempt"] and review["candidate_commit"] == impl["candidate_commit"] else None


def current_verify(data):
    impl = candidate(data)
    verify = entered_after(data, "Verify", "VERIFYING")
    return verify if verify and impl and verify["attempt"] == impl["attempt"] and verify["candidate_commit"] == impl["candidate_commit"] else None


def spec_hashes(data):
    directory = item_dir(data["id"])
    result = {}
    for name in ("PRODUCT.md", "TECH.md"):
        path = directory / name
        need(path.is_file() and path.stat().st_size > 0, f"missing {name}")
        result[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def spec_ready(data):
    spec = data["spec"]
    if spec["mode"] == "skipped":
        return bool(spec.get("reason"))
    if spec["mode"] == "approved":
        try:
            return spec["hashes"] == spec_hashes(data)
        except (Invalid, OSError):
            return False
    return False


def validate_report(role, report, data, run):
    need(isinstance(report, dict), "report must be a JSON object")
    need(report.get("work_item") == data["id"], "report work_item mismatch")
    need(report.get("agent") == run["agent"], "report agent mismatch")
    need(report.get("run_id") == run["id"], "report run_id mismatch")
    if role == "Triage":
        for key in ("scope", "relevant_code", "evidence", "complexity", "risks", "open_questions"):
            need(key in report, f"missing {key}")
        need(report.get("recommendation") in {"IMPLEMENT", "SPEC", "HUMAN_INPUT", "PARK"}, "invalid triage recommendation")
        nonempty(report["scope"], "scope")
        text_list(report["evidence"], "evidence")
    elif role == "Spec":
        need(report.get("documents") == ["PRODUCT.md", "TECH.md"], "Spec must name PRODUCT.md and TECH.md")
        spec_hashes(data)
    elif role == "Implement":
        for key in ("change_summary", "decisions", "tests", "ambiguities", "blockers"):
            need(key in report, f"missing {key}")
        nonempty(report["change_summary"], "change_summary")
        text_list(report["tests"], "tests")
        need(bool(COMMIT_RE.fullmatch(str(report.get("candidate_commit", "")))), "invalid candidate_commit")
    elif role == "Review":
        for key in ("requirements", "architecture", "correctness", "tests", "security", "complexity", "findings"):
            need(key in report, f"missing {key}")
        need(report.get("recommendation") in {"ACCEPT", "REVISE", "HUMAN_DECISION"}, "invalid review recommendation")
        need(isinstance(report["findings"], list), "findings must be a list")
        impl = candidate(data)
        need(impl is not None, "review requires implementation")
        need(report.get("candidate_commit") == impl["candidate_commit"], "stale review commit")
        need(run["agent"] != impl["agent"], "Implement cannot review own work")
        need(report.get("attempt") == impl["attempt"], "stale review attempt")
    elif role == "Verify":
        impl = candidate(data)
        need(impl is not None, "verification requires implementation")
        need(run["agent"] != impl["agent"], "Implement cannot verify own work")
        need(report.get("candidate_commit") == impl["candidate_commit"], "stale verification commit")
        need(report.get("attempt") == impl["attempt"], "stale verification attempt")
        criteria = report.get("criteria")
        need(isinstance(criteria, list) and len(criteria) == len(data["criteria"]), "all acceptance criteria required")
        for expected, result in zip(data["criteria"], criteria):
            need(isinstance(result, dict) and result.get("criterion") == expected, "criterion mismatch")
            nonempty(result.get("method"), "verification method")
            need(result.get("result") in {"PASS", "FAIL", "BLOCKED"}, "invalid criterion result")
            nonempty(result.get("evidence"), "verification evidence")
        overall = report.get("overall")
        need(overall in {"PASS", "FAIL", "BLOCKED"}, "invalid verification overall")
        derived = "FAIL" if any(c["result"] == "FAIL" for c in criteria) else ("BLOCKED" if any(c["result"] == "BLOCKED" for c in criteria) else "PASS")
        need(overall == derived, "verification overall disagrees with criteria")
    return report


def cmd_create(args):
    directory = item_dir(args.id)
    need(not directory.exists(), "work item already exists")
    criteria = read_json_file(args.criteria_file)
    text_list(criteria, "criteria")
    nonempty(args.title, "title")
    nonempty(args.objective, "objective")
    data = {"id": args.id, "title": args.title, "objective": args.objective, "criteria": criteria,
            "state": "INTAKE", "resume_stage": None, "final_result": None,
            "created_at": now(), "updated_at": now(), "spec": {"mode": "unresolved"},
            "runs": [], "reports": [], "interventions": [], "events": [], "handoff": None}
    event(data, "created", title=args.title)
    save(data)
    print(args.id)


def cmd_dispatch(args):
    data = load(args.id)
    need(args.role in ROLES, "invalid role")
    stage = {"Triage": "TRIAGE", "Spec": "PLANNING", "Implement": "BUILDING",
             "Review": "REVIEWING", "Verify": "VERIFYING"}[args.role]
    need(data["state"] == stage, f"{args.role} dispatch requires {stage}")
    if args.role in {"Implement", "Review", "Verify"}:
        need(spec_ready(data), "current Spec approval or skip required")
    if args.role == "Review":
        impl = candidate(data)
        need(impl is not None, "current implementation report required")
        previous = latest(data, "Review")
        need(previous is None or previous.get("attempt") != impl["attempt"] or previous["recommendation"] != "REVISE",
             "review requested revision; return to BUILDING")
    if args.role == "Verify":
        review = current_review(data)
        need(review is not None and review["recommendation"] == "ACCEPT", "current accepted review required")
        previous = current_verify(data)
        need(previous is None or previous["overall"] != "FAIL", "failed verification requires Implement and Review revision")
        prior_run = last_run(data, "Verify")
        need(prior_run is None or prior_run.get("attempt") != candidate(data)["attempt"] or prior_run["result"] != "FAIL",
             "failed verification requires Implement and Review revision")
    nonempty(args.agent, "agent")
    nonempty(args.reason, "selection reason")
    need(args.model.startswith("gpt-"), "explicit model ID required")
    need(args.reasoning in {"low", "medium", "high", "xhigh", "max", "ultra"}, "invalid reasoning")
    need(not any(r["status"] == "RUNNING" for r in data["runs"]), "close current run first")
    previous = next((r for r in reversed(data["runs"]) if r["role"] == args.role), None)
    if previous and previous["requested_model"] != args.model:
        need(args.replaces == previous["id"], "model change requires --replaces prior run ID")
    run_id = "run-" + uuid.uuid4().hex[:12]
    run = {"id": run_id, "role": args.role, "agent": args.agent, "harness": "current-collaboration",
           "attempt": candidate(data)["attempt"] if args.role in {"Review", "Verify"} else None,
           "requested_model": args.model, "requested_reasoning": args.reasoning,
           "reported_model": None, "selection_reason": args.reason, "replaces": args.replaces,
           "started_at": now(), "ended_at": None, "duration_seconds": None, "status": "RUNNING",
           "result": None, "retry_of": args.retry_of, "input_tokens": None, "output_tokens": None,
           "cost": None, "unavailable_reason": "collaboration harness does not expose per-worker usage or billing"}
    data["runs"].append(run)
    event(data, "dispatched", run_id=run_id, role=args.role, agent=args.agent,
          requested_model=args.model, requested_reasoning=args.reasoning, replaces=args.replaces)
    save(data)
    packet = {"work_item": data["id"], "run_id": run_id, "role": args.role, "agent": args.agent,
              "state": data["state"], "objective": data["objective"], "criteria": data["criteria"],
              "contract": f"factory/agents/{args.role.lower()}/agent.md", "candidate": candidate(data),
              "spec": data["spec"], "requested_model": args.model,
              "requested_reasoning": args.reasoning, "harness_note": "Dispatch with real collaboration tool; this packet is not execution."}
    atomic(item_dir(args.id) / "packets" / f"{run_id}.json", dump(packet))
    print(run_id)


def cmd_report(args):
    data = load(args.id)
    run = next((r for r in data["runs"] if r["id"] == args.run), None)
    need(run is not None and run["status"] == "RUNNING", "unknown or closed run")
    report = read_json_file(args.file)
    role = run["role"]
    stage = {"Triage": "TRIAGE", "Spec": "PLANNING", "Implement": "BUILDING",
             "Review": "REVIEWING", "Verify": "VERIFYING"}[role]
    need(data["state"] == stage, f"report requires {stage}")
    if role in {"Implement", "Review", "Verify"}:
        need(spec_ready(data), "current Spec approval or skip required")
    if role == "Implement":
        report["attempt"] = 1 + sum(r["role"] == "Implement" for r in data["reports"])
    validate_report(role, report, data, run)
    if role == "Implement":
        # A candidate is a real Git commit, not an arbitrary label.
        import subprocess
        resolved = subprocess.run(["git", "cat-file", "-t", report["candidate_commit"]],
                                  cwd=ROOT, capture_output=True, text=True)
        need(resolved.returncode == 0 and resolved.stdout.strip() == "commit", "candidate commit missing from Git")
    record = {**report, "role": role, "run_id": run["id"], "agent": run["agent"], "at": now()}
    data["reports"].append(record)
    run["status"] = "FINISHED"
    run["result"] = (report.get("overall") or report.get("recommendation") or "REPORTED")
    run["ended_at"] = now()
    run["duration_seconds"] = max(0, int((datetime.fromisoformat(run["ended_at"]) - datetime.fromisoformat(run["started_at"])).total_seconds()))
    event(data, "reported", role=role, run_id=run["id"], result=run["result"],
          attempt=record.get("attempt"), candidate_commit=record.get("candidate_commit"))
    save(data)
    atomic(item_dir(args.id) / "reports" / f"{run['id']}.json", dump(record))
    print(run["result"])


def cmd_close_run(args):
    data = load(args.id)
    run = next((r for r in data["runs"] if r["id"] == args.run), None)
    need(run is not None and run["status"] == "RUNNING", "unknown or closed run")
    nonempty(args.reason, "reason")
    run.update(status="FINISHED", result=args.result, ended_at=now())
    run["duration_seconds"] = max(0, int((datetime.fromisoformat(run["ended_at"]) - datetime.fromisoformat(run["started_at"])).total_seconds()))
    event(data, "run_closed", run_id=run["id"], result=args.result, reason=args.reason)
    save(data)


def cmd_approve_spec(args):
    data = load(args.id)
    need(data["state"] == "WAITING_FOR_SPEC_APPROVAL", "approval requires WAITING_FOR_SPEC_APPROVAL")
    nonempty(args.by, "approver")
    hashes = spec_hashes(data)
    data["spec"] = {"mode": "approved", "hashes": hashes, "by": args.by, "at": now()}
    event(data, "spec_approved", by=args.by, hashes=hashes)
    save(data)


def cmd_skip_spec(args):
    data = load(args.id)
    need(data["state"] == "TRIAGE", "skip requires TRIAGE")
    triage = latest(data, "Triage")
    need(triage is not None and triage["recommendation"] == "IMPLEMENT", "skip requires Implement triage recommendation")
    nonempty(args.reason, "skip reason")
    data["spec"] = {"mode": "skipped", "reason": args.reason, "by": args.by, "at": now()}
    event(data, "spec_skipped", reason=args.reason, by=args.by)
    save(data)


def cmd_intervene(args):
    data = load(args.id)
    for name in ("reason", "question", "human_response", "possible_improvement"):
        nonempty(getattr(args, name), name)
    record = {"at": now(), "work_item": args.id, "stage": data["state"], "reason": args.reason,
              "question": args.question, "human_response": args.human_response,
              "human_implementation": args.human_implementation == "yes",
              "could_factory_have_avoided_this": args.avoidable == "yes",
              "possible_improvement": args.possible_improvement}
    data["interventions"].append(record)
    event(data, "intervention", **record)
    save(data)


def cmd_advance(args):
    data = load(args.id)
    old, target = data["state"], args.state
    need(target in NEXT[old], f"illegal transition {old} -> {target}")
    need(not any(r["status"] == "RUNNING" for r in data["runs"]), "close running agent before transition")
    if old in {"BUILDING", "REVIEWING", "VERIFYING", "READY_FOR_HANDOFF"} and target == "WAITING_FOR_SPEC_APPROVAL":
        need(data["spec"]["mode"] == "approved" and not spec_ready(data),
             "reapproval route requires changed approved Spec")
        data["handoff"] = None
        data["final_result"] = None
    elif old in {"REVIEWING", "VERIFYING", "READY_FOR_HANDOFF"} and target != "CANCELLED":
        need(spec_ready(data), "current Spec approval invalid; return to WAITING_FOR_SPEC_APPROVAL")
    if old == "TRIAGE":
        triage = latest(data, "Triage")
        need(triage is not None, "triage report required")
        expected = {"IMPLEMENT": "BUILDING", "SPEC": "PLANNING", "HUMAN_INPUT": "WAITING_FOR_HUMAN", "PARK": "PARKED"}[triage["recommendation"]]
        need(target == expected or target == "CANCELLED", f"triage recommends {expected}")
        if target == "BUILDING":
            need(spec_ready(data), "record justified Spec skip before build")
    if old == "PLANNING" and target == "WAITING_FOR_SPEC_APPROVAL":
        need(latest(data, "Spec") is not None, "Spec report required")
        spec_hashes(data)
    if old == "WAITING_FOR_SPEC_APPROVAL" and target == "BUILDING":
        need(spec_ready(data), "exact current Spec revision approval required")
    if old == "BUILDING" and target == "REVIEWING":
        need(spec_ready(data), "current Spec approval or skip required")
        need(candidate(data) is not None, "fresh implementation report required for this BUILDING entry")
    if old == "REVIEWING" and target != "WAITING_FOR_SPEC_APPROVAL":
        review = current_review(data)
        need(review is not None, "current candidate review required")
        if target == "VERIFYING":
            need(review["recommendation"] == "ACCEPT", "review must ACCEPT")
        elif target == "BUILDING":
            need(review["recommendation"] == "REVISE", "review must request revision")
        elif target == "WAITING_FOR_HUMAN":
            need(review["recommendation"] == "HUMAN_DECISION", "review must ask human")
    if old == "VERIFYING" and target != "WAITING_FOR_SPEC_APPROVAL":
        verify = current_verify(data)
        failed_unreported = (target == "BUILDING" and last_run(data, "Verify") is not None
                             and last_run(data, "Verify")["status"] == "FINISHED"
                             and last_run(data, "Verify")["result"] == "FAIL"
                             and candidate(data) is not None
                             and last_run(data, "Verify").get("attempt") == candidate(data)["attempt"])
        need(verify is not None or failed_unreported, "current candidate verification required")
        if target == "READY_FOR_HANDOFF":
            if verify["overall"] == "FAIL":
                nonempty(args.terminal_failure_reason, "terminal failure reason")
            else:
                need(verify["overall"] in {"PASS", "BLOCKED"}, "invalid verification result")
        elif target == "BUILDING":
            need(failed_unreported or verify["overall"] == "FAIL", "revision requires failed verification")
    if target == "WAITING_FOR_HUMAN":
        data["resume_stage"] = old
    if old == "WAITING_FOR_HUMAN" and target != "CANCELLED":
        need(target == data["resume_stage"] or (data["resume_stage"] == "REVIEWING" and target == "BUILDING"), "resume stage mismatch")
        need(bool(data["interventions"]), "human intervention record required")
        data["resume_stage"] = None
    if old == "READY_FOR_HANDOFF" and target == "COMPLETE":
        need(data["handoff"] is not None, "handoff artifact required")
        need((JOURNAL / f"{data['id']}.md").is_file() and
             (item_dir(data["id"]) / "PUBLIC_NOTES.md").is_file(), "required handoff artifacts missing")
    data["state"] = target
    event(data, "advanced", from_state=old, to_state=target,
          terminal_failure_reason=args.terminal_failure_reason if old == "VERIFYING" and target == "READY_FOR_HANDOFF" else None)
    save(data)
    print(target)


def seconds(start, end):
    return max(0, int((datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds()))


def metrics(data):
    events = data["events"]
    handoff_at = data["handoff"]["at"] if data["handoff"] else None
    waits = []
    opened = None
    for e in events:
        if e["kind"] == "advanced" and e["to_state"] == "WAITING_FOR_HUMAN":
            opened = e["at"]
        elif e["kind"] == "advanced" and e["from_state"] == "WAITING_FOR_HUMAN" and opened:
            waits.append(seconds(opened, e["at"]))
            opened = None
    impls = [r for r in data["reports"] if r["role"] == "Implement"]
    first = impls[0] if impls else None
    review_first = next((r for r in data["reports"] if r["role"] == "Review" and first and r.get("attempt") == first["attempt"]), None)
    verify_first = next((r for r in data["reports"] if r["role"] == "Verify" and first and r.get("attempt") == first["attempt"]), None)
    return {"work_item": data["id"], "sample_size": 1, "final_result": data["final_result"],
            "handoff_without_human_implementation": bool(data["handoff"] and not any(i["human_implementation"] for i in data["interventions"])),
            "intervention_count": len(data["interventions"]),
            "intake_to_handoff_seconds": seconds(data["created_at"], handoff_at) if handoff_at else None,
            "human_wait_seconds": sum(waits) if not opened else None,
            "first_implementation_review_success": (review_first["recommendation"] == "ACCEPT") if review_first else None,
            "first_implementation_verification_success": (verify_first["overall"] == "PASS") if verify_first else None,
            "review_to_implement_loops": sum(e["kind"] == "advanced" and e.get("from_state") == "REVIEWING" and e.get("to_state") == "BUILDING" for e in events),
            "verify_to_implement_loops": sum(e["kind"] == "advanced" and e.get("from_state") == "VERIFYING" and e.get("to_state") == "BUILDING" for e in events),
            "input_tokens": None, "output_tokens": None, "cost": None,
            "usage_unavailable_reason": "collaboration harness does not expose per-worker usage or billing"}


def handoff_documents(data):
    handoff = data["handoff"]
    need(handoff is not None, "handoff missing")
    verify = next((r for r in data["reports"] if r["run_id"] == handoff["verification_run"]), None)
    need(verify is not None, "handoff verification report missing")
    result, summary = handoff["result"], handoff["summary"]
    m = metrics(data)
    roles = ", ".join(f"{r['role']} {r['agent']} ({r['requested_model']}/{r['requested_reasoning']})" for r in data["runs"])
    interventions = "\n".join(f"- {i['stage']}: {i['reason']} — {i['human_response']}" for i in data["interventions"]) or "None"
    findings = "\n".join(f"- {f}" for r in data["reports"] if r["role"] == "Review" for f in r["findings"]) or "None"
    journal = f"# {data['id']}: {data['title']}\n\nObjective: {data['objective']}\n\nRoute: " + " → ".join(e["to_state"] for e in data["events"] if e["kind"] == "advanced") + f"\n\nAgents: {roles}\n\nInterventions:\n{interventions}\n\nReview findings:\n{findings}\n\nResult: **{result}** — {summary}\n\nCandidate: {handoff['candidate_commit']}\n\nCost/usage: unavailable; {m['usage_unavailable_reason']}.\nCycle time: {m['intake_to_handoff_seconds']} seconds; human wait: {m['human_wait_seconds']} seconds.\n\nWhat worked: recorded reports and gates.\n\nWhat failed or remains blocked: {summary if result != 'PASS' else 'No known acceptance failure.'}\n\nImprovements: review intervention records and propose changes under factory/improvements/.\n"
    public = f"# {data['id']}: {data['title']}\n\n{summary}\n\nResult: **{result}**\n\nCandidate commit: {handoff['candidate_commit']}\n\nVerification evidence: see reports/{verify['run_id']}.json.\n\nThis note is for human review; it has not been published.\n"
    return {JOURNAL / f"{data['id']}.md": journal,
            item_dir(data["id"]) / "PUBLIC_NOTES.md": public}


def ensure_handoff_artifacts(data):
    for path, content in handoff_documents(data).items():
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            atomic(path, content)


def cmd_handoff(args):
    data = load(args.id)
    need(data["state"] == "READY_FOR_HANDOFF", "handoff requires READY_FOR_HANDOFF")
    need(spec_ready(data), "current Spec approval invalid; return to WAITING_FOR_SPEC_APPROVAL")
    need(current_review(data) is not None and current_review(data)["recommendation"] == "ACCEPT", "current accepted review required")
    verify = current_verify(data)
    need(verify is not None, "current verification required")
    need(args.result == verify["overall"], "handoff result must match verification")
    nonempty(args.summary, "handoff summary")
    if data["handoff"] is not None:
        need(data["handoff"]["result"] == args.result and data["handoff"]["summary"] == args.summary,
             "existing handoff differs")
        ensure_handoff_artifacts(data)
        print(args.result)
        return
    data["final_result"] = args.result
    data["handoff"] = {"at": now(), "result": args.result, "summary": args.summary,
                       "candidate_commit": candidate(data)["candidate_commit"], "verification_run": verify["run_id"]}
    event(data, "handoff", **data["handoff"])
    save(data)
    ensure_handoff_artifacts(data)
    print(args.result)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create"); p.add_argument("id"); p.add_argument("--title", required=True); p.add_argument("--objective", required=True); p.add_argument("--criteria-file", required=True); p.set_defaults(fn=cmd_create)
    p = sub.add_parser("advance"); p.add_argument("id"); p.add_argument("state", choices=sorted(STATES)); p.add_argument("--terminal-failure-reason"); p.set_defaults(fn=cmd_advance)
    p = sub.add_parser("dispatch"); p.add_argument("id"); p.add_argument("role", choices=sorted(ROLES)); p.add_argument("--agent", required=True); p.add_argument("--model", required=True); p.add_argument("--reasoning", required=True); p.add_argument("--reason", required=True); p.add_argument("--replaces"); p.add_argument("--retry-of"); p.set_defaults(fn=cmd_dispatch)
    p = sub.add_parser("report"); p.add_argument("id"); p.add_argument("--run", required=True); p.add_argument("--file", required=True); p.set_defaults(fn=cmd_report)
    p = sub.add_parser("close-run"); p.add_argument("id"); p.add_argument("--run", required=True); p.add_argument("--result", choices=["BLOCKED", "FAIL"], required=True); p.add_argument("--reason", required=True); p.set_defaults(fn=cmd_close_run)
    p = sub.add_parser("approve-spec"); p.add_argument("id"); p.add_argument("--by", required=True); p.set_defaults(fn=cmd_approve_spec)
    p = sub.add_parser("skip-spec"); p.add_argument("id"); p.add_argument("--reason", required=True); p.add_argument("--by", required=True); p.set_defaults(fn=cmd_skip_spec)
    p = sub.add_parser("intervene"); p.add_argument("id"); p.add_argument("--reason", required=True); p.add_argument("--question", required=True); p.add_argument("--human-response", required=True); p.add_argument("--avoidable", choices=["yes", "no"], required=True); p.add_argument("--human-implementation", choices=["yes", "no"], default="no"); p.add_argument("--possible-improvement", required=True); p.set_defaults(fn=cmd_intervene)
    p = sub.add_parser("handoff"); p.add_argument("id"); p.add_argument("--result", choices=["PASS", "FAIL", "BLOCKED"], required=True); p.add_argument("--summary", required=True); p.set_defaults(fn=cmd_handoff)
    p = sub.add_parser("status"); p.add_argument("id"); p.set_defaults(fn=lambda a: print(dump(load(a.id)), end=""))
    p = sub.add_parser("recover"); p.add_argument("id"); p.set_defaults(fn=lambda a: print(f"recovered {load(a.id)['id']}"))
    p = sub.add_parser("metrics"); p.add_argument("id"); p.set_defaults(fn=lambda a: print(dump(metrics(load(a.id))), end=""))
    args = parser.parse_args(argv)
    try:
        args.fn(args)
    except (Invalid, OSError, KeyError, TypeError) as exc:
        print(f"factory: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
