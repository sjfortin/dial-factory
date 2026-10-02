import argparse
import contextlib
import io
import json
import subprocess
import tempfile
import unittest
from unittest import mock
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import factory as f


class FactoryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.old = (f.ROOT, f.FACTORY, f.ITEMS, f.JOURNAL)
        self.addCleanup(self.restore)
        f.ROOT = Path(self.temp.name)
        f.FACTORY = f.ROOT / "factory"
        f.ITEMS = f.FACTORY / "work-items"
        f.JOURNAL = f.ROOT / "docs" / "factory-journal"
        subprocess.run(["git", "init", "-q", str(f.ROOT)], check=True)
        subprocess.run(["git", "-C", str(f.ROOT), "config", "user.email", "test@example.invalid"], check=True)
        subprocess.run(["git", "-C", str(f.ROOT), "config", "user.name", "Factory Test"], check=True)
        (f.ROOT / "code.txt").write_text("candidate\n")
        subprocess.run(["git", "-C", str(f.ROOT), "add", "code.txt"], check=True)
        subprocess.run(["git", "-C", str(f.ROOT), "commit", "-qm", "candidate"], check=True)
        self.commit = subprocess.check_output(["git", "-C", str(f.ROOT), "rev-parse", "HEAD"], text=True).strip()
        self.criteria = ["runs", "plays"]
        self.criteria_file = f.ROOT / "criteria.json"
        self.criteria_file.write_text(json.dumps(self.criteria))
        self.call(f.cmd_create, id="TEST-1", title="Test", objective="Prove behavior", criteria_file=str(self.criteria_file))

    def restore(self):
        f.ROOT, f.FACTORY, f.ITEMS, f.JOURNAL = self.old

    def call(self, func, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            func(argparse.Namespace(**kwargs))
        return out.getvalue().strip()

    def state(self):
        return f.load("TEST-1")

    def dispatch(self, role, agent=None):
        return self.call(f.cmd_dispatch, id="TEST-1", role=role, agent=agent or role.lower(),
                         model=f.MODEL[role][0], reasoning=f.MODEL[role][1], reason="test selection",
                         replaces=None, retry_of=None)

    def report(self, run, payload):
        path = f.ROOT / "incoming.json"
        path.write_text(json.dumps({"work_item": "TEST-1", "run_id": run, **payload}))
        return self.call(f.cmd_report, id="TEST-1", run=run, file=str(path))

    def advance(self, state):
        return self.call(f.cmd_advance, id="TEST-1", state=state, terminal_failure_reason=None)

    def triage(self, recommendation="IMPLEMENT"):
        self.advance("TRIAGE")
        run = self.dispatch("Triage")
        self.report(run, {"agent": "triage", "scope": "small", "relevant_code": [],
                          "evidence": ["read code"], "complexity": "low", "risks": [],
                          "open_questions": [], "recommendation": recommendation})

    def build(self):
        self.triage()
        self.call(f.cmd_skip_spec, id="TEST-1", by="foreman", reason="bounded behavior")
        self.advance("BUILDING")
        run = self.dispatch("Implement", "implementer")
        self.report(run, {"agent": "implementer", "change_summary": "created behavior", "decisions": [],
                          "candidate_commit": self.commit, "tests": ["actual check passed"],
                          "ambiguities": [], "blockers": []})
        self.advance("REVIEWING")

    def spec_build(self):
        self.triage("SPEC")
        self.advance("PLANNING")
        directory = f.item_dir("TEST-1")
        (directory / "PRODUCT.md").write_text("product v1")
        (directory / "TECH.md").write_text("tech v1")
        run = self.dispatch("Spec")
        self.report(run, {"agent": "spec", "documents": ["PRODUCT.md", "TECH.md"]})
        self.advance("WAITING_FOR_SPEC_APPROVAL")
        self.call(f.cmd_approve_spec, id="TEST-1", by="human")
        self.advance("BUILDING")
        self.implement_report()
        self.advance("REVIEWING")

    def implement_report(self):
        run = self.dispatch("Implement", "implementer")
        self.report(run, {"agent": "implementer", "change_summary": "candidate or revision", "decisions": [],
                          "candidate_commit": self.commit, "tests": ["real test passed"],
                          "ambiguities": [], "blockers": []})
        return run

    def review(self, recommendation="ACCEPT", agent="reviewer", commit=None, attempt=1):
        run = self.dispatch("Review", agent)
        payload = {"agent": agent, "candidate_commit": commit or self.commit, "attempt": attempt,
                   "requirements": "checked", "architecture": "checked", "correctness": "checked",
                   "tests": "checked", "security": "checked", "complexity": "checked",
                   "findings": [], "recommendation": recommendation}
        return run, payload

    def verify(self, overall="PASS", criteria=None, attempt=1):
        run = self.dispatch("Verify", "verifier")
        payload = {"agent": "verifier", "candidate_commit": self.commit, "attempt": attempt,
                   "criteria": criteria or [{"criterion": c, "method": "run test", "result": overall,
                                             "evidence": "observed outcome"} for c in self.criteria],
                   "overall": overall}
        return run, payload

    def test_illegal_transition_and_spec_skip_gate(self):
        with self.assertRaisesRegex(f.Invalid, "illegal transition"):
            self.advance("BUILDING")
        self.triage()
        with self.assertRaisesRegex(f.Invalid, "Spec skip"):
            self.advance("BUILDING")
        self.call(f.cmd_skip_spec, id="TEST-1", by="foreman", reason="bounded")
        self.advance("BUILDING")
        self.assertEqual(self.state()["state"], "BUILDING")

    def test_exact_spec_approval_and_recovery(self):
        self.triage("SPEC")
        self.advance("PLANNING")
        directory = f.item_dir("TEST-1")
        (directory / "PRODUCT.md").write_text("product v1")
        (directory / "TECH.md").write_text("tech v1")
        run = self.dispatch("Spec")
        self.report(run, {"agent": "spec", "documents": ["PRODUCT.md", "TECH.md"]})
        self.advance("WAITING_FOR_SPEC_APPROVAL")
        with self.assertRaisesRegex(f.Invalid, "approval"):
            self.advance("BUILDING")
        self.call(f.cmd_approve_spec, id="TEST-1", by="human")
        (directory / "PRODUCT.md").write_text("product v2")
        with self.assertRaisesRegex(f.Invalid, "approval"):
            self.advance("BUILDING")
        self.call(f.cmd_approve_spec, id="TEST-1", by="human")
        self.advance("BUILDING")
        (directory / "events.jsonl").write_text("corrupt")
        self.assertEqual(self.state()["state"], "BUILDING")
        self.assertIn("spec_approved", (directory / "events.jsonl").read_text())

    def test_self_review_stale_commit_and_revision(self):
        self.build()
        run, payload = self.review(agent="implementer")
        with self.assertRaisesRegex(f.Invalid, "own work"):
            self.report(run, payload)
        self.call(f.cmd_close_run, id="TEST-1", run=run, result="FAIL", reason="wrong reviewer")
        run, payload = self.review(commit="a" * 40)
        with self.assertRaisesRegex(f.Invalid, "stale review commit"):
            self.report(run, payload)
        payload["candidate_commit"] = self.commit
        payload["recommendation"] = "REVISE"
        self.report(run, payload)
        with self.assertRaisesRegex(f.Invalid, "review requested revision"):
            self.dispatch("Review")
        with self.assertRaisesRegex(f.Invalid, "review must ACCEPT"):
            self.advance("VERIFYING")
        self.advance("BUILDING")
        run = self.dispatch("Implement", "implementer")
        self.report(run, {"agent": "implementer", "change_summary": "revision", "decisions": [],
                          "candidate_commit": self.commit, "tests": ["retested"],
                          "ambiguities": [], "blockers": []})
        self.advance("REVIEWING")
        with self.assertRaisesRegex(f.Invalid, "current candidate review"):
            self.advance("VERIFYING")
        run, payload = self.review(attempt=2)
        self.report(run, payload)
        self.advance("VERIFYING")

    def test_verification_evidence_failure_and_metrics(self):
        self.build()
        run, payload = self.review()
        self.report(run, payload)
        self.advance("VERIFYING")
        run, payload = self.verify(criteria=[{"criterion": "runs", "method": "test", "result": "PASS", "evidence": "yes"}])
        with self.assertRaisesRegex(f.Invalid, "all acceptance"):
            self.report(run, payload)
        payload["criteria"].append({"criterion": "plays", "method": "test", "result": "FAIL", "evidence": "no audio"})
        payload["overall"] = "FAIL"
        self.report(run, payload)
        with self.assertRaisesRegex(f.Invalid, "terminal failure reason"):
            self.advance("READY_FOR_HANDOFF")
        self.advance("BUILDING")
        m = f.metrics(self.state())
        self.assertTrue(m["first_implementation_review_success"])
        self.assertFalse(m["first_implementation_verification_success"])
        self.assertEqual(m["verify_to_implement_loops"], 1)
        self.assertIsNone(m["cost"])

    def test_blocked_handoff_and_artifacts(self):
        self.build()
        run, payload = self.review()
        self.report(run, payload)
        self.advance("VERIFYING")
        results = [{"criterion": "runs", "method": "test", "result": "PASS", "evidence": "observed"},
                   {"criterion": "plays", "method": "manual UI", "result": "BLOCKED", "evidence": "no browser access"}]
        run, payload = self.verify(overall="BLOCKED", criteria=results)
        self.report(run, payload)
        self.advance("READY_FOR_HANDOFF")
        self.call(f.cmd_handoff, id="TEST-1", result="BLOCKED", summary="Playback inaccessible")
        self.advance("COMPLETE")
        self.assertEqual(self.state()["final_result"], "BLOCKED")
        self.assertTrue((f.JOURNAL / "TEST-1.md").is_file())
        self.assertTrue((f.item_dir("TEST-1") / "PUBLIC_NOTES.md").is_file())

    def test_terminal_failure_needs_reason(self):
        self.build()
        run, payload = self.review()
        self.report(run, payload)
        self.advance("VERIFYING")
        run, payload = self.verify(overall="FAIL")
        self.report(run, payload)
        with self.assertRaisesRegex(f.Invalid, "terminal failure reason"):
            self.advance("READY_FOR_HANDOFF")
        self.call(f.cmd_advance, id="TEST-1", state="READY_FOR_HANDOFF",
                  terminal_failure_reason="experiment disproved approach")
        self.call(f.cmd_handoff, id="TEST-1", result="FAIL", summary="Experiment failed")
        self.advance("COMPLETE")
        self.assertEqual(self.state()["final_result"], "FAIL")

    def test_latest_runs_invalidate_old_evidence(self):
        self.triage()
        self.call(f.cmd_skip_spec, id="TEST-1", by="foreman", reason="bounded")
        self.advance("BUILDING")
        self.implement_report()
        run = self.dispatch("Implement", "implementer")
        with self.assertRaisesRegex(f.Invalid, "running agent"):
            self.advance("REVIEWING")
        self.call(f.cmd_close_run, id="TEST-1", run=run, result="FAIL", reason="rerun failed")
        # A closed failed run supersedes the previous candidate.
        with self.assertRaisesRegex(f.Invalid, "fresh implementation report"):
            self.advance("REVIEWING")
        self.implement_report()
        self.advance("REVIEWING")
        run, payload = self.review(attempt=2)
        self.report(run, payload)
        rerun = self.dispatch("Review")
        with self.assertRaisesRegex(f.Invalid, "running agent"):
            self.advance("VERIFYING")
        self.call(f.cmd_close_run, id="TEST-1", run=rerun, result="FAIL", reason="review rerun failed")
        with self.assertRaisesRegex(f.Invalid, "current candidate review"):
            self.advance("VERIFYING")
        run, payload = self.review(attempt=2)
        self.report(run, payload)
        self.advance("VERIFYING")
        run, payload = self.verify(attempt=2)
        self.report(run, payload)
        rerun = self.dispatch("Verify")
        with self.assertRaisesRegex(f.Invalid, "running agent"):
            self.advance("READY_FOR_HANDOFF")
        self.call(f.cmd_close_run, id="TEST-1", run=rerun, result="BLOCKED", reason="new check inaccessible")
        with self.assertRaisesRegex(f.Invalid, "current candidate verification"):
            self.advance("READY_FOR_HANDOFF")
        run, payload = self.verify(overall="BLOCKED", attempt=2)
        self.report(run, payload)
        self.advance("READY_FOR_HANDOFF")

    def test_verify_failure_requires_fresh_implement_and_review(self):
        self.build()
        run, payload = self.review()
        self.report(run, payload)
        self.advance("VERIFYING")
        run, payload = self.verify(overall="FAIL")
        self.report(run, payload)
        with self.assertRaisesRegex(f.Invalid, "failed verification requires"):
            self.dispatch("Verify")
        self.advance("BUILDING")
        with self.assertRaisesRegex(f.Invalid, "fresh implementation report"):
            self.advance("REVIEWING")
        self.implement_report()
        self.advance("REVIEWING")
        with self.assertRaisesRegex(f.Invalid, "current candidate review"):
            self.advance("VERIFYING")
        run, payload = self.review(attempt=2)
        self.report(run, payload)
        self.advance("VERIFYING")
        run, payload = self.verify(attempt=2)
        self.report(run, payload)
        self.advance("READY_FOR_HANDOFF")

    def test_closed_failed_verify_can_enter_revision_path(self):
        self.build()
        run, payload = self.review()
        self.report(run, payload)
        self.advance("VERIFYING")
        run = self.dispatch("Verify")
        self.call(f.cmd_close_run, id="TEST-1", run=run, result="FAIL", reason="check failed before report")
        with self.assertRaisesRegex(f.Invalid, "failed verification requires"):
            self.dispatch("Verify")
        with self.assertRaisesRegex(f.Invalid, "current candidate verification"):
            self.advance("READY_FOR_HANDOFF")
        self.advance("BUILDING")
        self.implement_report()
        self.advance("REVIEWING")
        run, payload = self.review(attempt=2)
        self.report(run, payload)
        self.advance("VERIFYING")

    def test_spec_change_requires_reapproval_and_fresh_attempt(self):
        self.spec_build()
        directory = f.item_dir("TEST-1")
        (directory / "PRODUCT.md").write_text("product v2")
        with self.assertRaisesRegex(f.Invalid, "Spec approval invalid"):
            self.advance("VERIFYING")
        self.advance("WAITING_FOR_SPEC_APPROVAL")
        with self.assertRaisesRegex(f.Invalid, "approval"):
            self.advance("BUILDING")
        self.call(f.cmd_approve_spec, id="TEST-1", by="human")
        self.advance("BUILDING")
        with self.assertRaisesRegex(f.Invalid, "fresh implementation report"):
            self.advance("REVIEWING")
        self.implement_report()
        self.advance("REVIEWING")
        run, payload = self.review(attempt=2)
        self.report(run, payload)
        self.advance("VERIFYING")
        (directory / "TECH.md").write_text("tech v2")
        with self.assertRaisesRegex(f.Invalid, "Spec approval"):
            self.dispatch("Verify")
        self.advance("WAITING_FOR_SPEC_APPROVAL")
        self.call(f.cmd_approve_spec, id="TEST-1", by="human")
        self.advance("BUILDING")
        self.implement_report()
        self.advance("REVIEWING")
        run, payload = self.review(attempt=3)
        self.report(run, payload)
        self.advance("VERIFYING")
        run, payload = self.verify(attempt=3)
        self.report(run, payload)
        self.advance("READY_FOR_HANDOFF")
        (directory / "PRODUCT.md").write_text("product v3")
        with self.assertRaisesRegex(f.Invalid, "Spec approval invalid"):
            self.call(f.cmd_handoff, id="TEST-1", result="PASS", summary="done")
        self.advance("WAITING_FOR_SPEC_APPROVAL")
        self.assertIsNone(self.state()["handoff"])

    def test_spec_change_during_build_has_reapproval_route(self):
        self.triage("SPEC")
        self.advance("PLANNING")
        directory = f.item_dir("TEST-1")
        (directory / "PRODUCT.md").write_text("product v1")
        (directory / "TECH.md").write_text("tech v1")
        run = self.dispatch("Spec")
        self.report(run, {"agent": "spec", "documents": ["PRODUCT.md", "TECH.md"]})
        self.advance("WAITING_FOR_SPEC_APPROVAL")
        self.call(f.cmd_approve_spec, id="TEST-1", by="human")
        self.advance("BUILDING")
        self.implement_report()
        (directory / "PRODUCT.md").write_text("product v2")
        self.advance("WAITING_FOR_SPEC_APPROVAL")
        self.call(f.cmd_approve_spec, id="TEST-1", by="human")
        self.advance("BUILDING")
        with self.assertRaisesRegex(f.Invalid, "fresh implementation report"):
            self.advance("REVIEWING")

    def test_interrupted_handoff_artifacts_recover(self):
        self.build()
        run, payload = self.review()
        self.report(run, payload)
        self.advance("VERIFYING")
        run, payload = self.verify()
        self.report(run, payload)
        self.advance("READY_FOR_HANDOFF")
        real_atomic = f.atomic

        def fail_journal(path, content):
            if path == f.JOURNAL / "TEST-1.md":
                raise OSError("injected journal failure")
            return real_atomic(path, content)

        with mock.patch.object(f, "atomic", side_effect=fail_journal):
            with self.assertRaisesRegex(OSError, "injected journal failure"):
                self.call(f.cmd_handoff, id="TEST-1", result="PASS", summary="done")
            with self.assertRaisesRegex(OSError, "injected journal failure"):
                self.advance("COMPLETE")
        self.assertEqual(json.loads((f.item_dir("TEST-1") / "state.json").read_text())["handoff"]["result"], "PASS")
        f.load("TEST-1")
        journal = f.JOURNAL / "TEST-1.md"
        public = f.item_dir("TEST-1") / "PUBLIC_NOTES.md"
        self.assertTrue(journal.is_file() and public.is_file())
        public.unlink()
        f.load("TEST-1")
        self.assertTrue(public.is_file())
        report_mirror = f.item_dir("TEST-1") / "reports" / f"{run}.json"
        report_mirror.unlink()
        f.load("TEST-1")
        self.assertTrue(report_mirror.is_file())
        self.advance("COMPLETE")

    def test_interrupted_public_note_write_recovers(self):
        self.build()
        run, payload = self.review()
        self.report(run, payload)
        self.advance("VERIFYING")
        run, payload = self.verify()
        self.report(run, payload)
        self.advance("READY_FOR_HANDOFF")
        real_atomic = f.atomic

        def fail_public(path, content):
            if path == f.item_dir("TEST-1") / "PUBLIC_NOTES.md":
                raise OSError("injected public note failure")
            return real_atomic(path, content)

        with mock.patch.object(f, "atomic", side_effect=fail_public):
            with self.assertRaisesRegex(OSError, "injected public note failure"):
                self.call(f.cmd_handoff, id="TEST-1", result="PASS", summary="done")
            with self.assertRaisesRegex(OSError, "injected public note failure"):
                self.advance("COMPLETE")
        self.assertEqual(json.loads((f.item_dir("TEST-1") / "state.json").read_text())["state"], "READY_FOR_HANDOFF")
        f.load("TEST-1")
        self.advance("COMPLETE")
        self.assertTrue((f.item_dir("TEST-1") / "PUBLIC_NOTES.md").is_file())


if __name__ == "__main__":
    unittest.main()
