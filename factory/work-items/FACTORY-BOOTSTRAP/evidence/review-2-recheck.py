import sys, unittest, json
from unittest.mock import patch
sys.path.insert(0, '/tmp/factory-review-candidate-3652c7e/factory/tests')
from test_factory import FactoryTest, f

class IndependentReview2(FactoryTest):
    def accept(self, attempt=1):
        run,payload=self.review(attempt=attempt); self.report(run,payload); self.advance('VERIFYING')
    def verified(self, attempt=1, result='PASS'):
        run,payload=self.verify(attempt=attempt,overall=result); self.report(run,payload)
    def complete(self):
        self.advance('READY_FOR_HANDOFF'); self.call(f.cmd_handoff,id='TEST-1',result='PASS',summary='verified'); self.advance('COMPLETE')
    def test_failed_latest_verify_requires_fresh_full_pipeline(self):
        self.build(); self.accept(); self.verified()
        run=self.dispatch('Verify','verifier-2')
        self.assertIsNone(f.current_verify(self.state()))
        with self.assertRaises(f.Invalid): self.advance('READY_FOR_HANDOFF')
        self.call(f.cmd_close_run,id='TEST-1',run=run,result='FAIL',reason='new check failed')
        with self.assertRaises(f.Invalid): self.advance('READY_FOR_HANDOFF')
        with self.assertRaises(f.Invalid): self.dispatch('Verify')
        self.advance('BUILDING')
        with self.assertRaises(f.Invalid): self.advance('REVIEWING')
        self.implement_report(); self.advance('REVIEWING')
        with self.assertRaises(f.Invalid): self.advance('VERIFYING')
        run,payload=self.review(attempt=1)
        with self.assertRaisesRegex(f.Invalid,'stale review attempt'): self.report(run,payload)
        payload['attempt']=2; self.report(run,payload); self.advance('VERIFYING')
        run,payload=self.verify(attempt=1)
        with self.assertRaisesRegex(f.Invalid,'stale verification attempt'): self.report(run,payload)
        payload['attempt']=2; self.report(run,payload); self.complete()
        self.assertEqual(self.state()['final_result'],'PASS')
    def test_review_revision_requires_new_attempt_then_can_pass(self):
        self.build(); run,payload=self.review(recommendation='REVISE'); self.report(run,payload)
        with self.assertRaises(f.Invalid): self.dispatch('Review')
        self.advance('BUILDING')
        with self.assertRaises(f.Invalid): self.advance('REVIEWING')
        self.implement_report(); self.advance('REVIEWING'); self.accept(2); self.verified(2); self.complete()
    def test_review_closed_rerun_supersedes_but_fresh_review_can_pass(self):
        self.build(); run,payload=self.review(); self.report(run,payload)
        run=self.dispatch('Review','new-reviewer')
        self.assertIsNone(f.current_review(self.state()))
        self.call(f.cmd_close_run,id='TEST-1',run=run,result='BLOCKED',reason='missing evidence')
        with self.assertRaises(f.Invalid): self.advance('VERIFYING')
        self.accept(); self.verified(); self.complete()
    def test_spec_change_after_saved_handoff_requires_new_full_pipeline(self):
        self.spec_build(); self.accept(); self.verified(); self.advance('READY_FOR_HANDOFF')
        self.call(f.cmd_handoff,id='TEST-1',result='PASS',summary='original')
        (f.item_dir('TEST-1')/'TECH.md').write_text('changed after saved handoff')
        with self.assertRaises(f.Invalid): self.advance('COMPLETE')
        with self.assertRaises(f.Invalid): self.call(f.cmd_handoff,id='TEST-1',result='PASS',summary='original')
        self.advance('WAITING_FOR_SPEC_APPROVAL'); self.assertIsNone(self.state()['final_result'])
        self.call(f.cmd_approve_spec,id='TEST-1',by='human'); self.advance('BUILDING')
        with self.assertRaises(f.Invalid): self.advance('REVIEWING')
        self.implement_report(); self.advance('REVIEWING'); self.accept(2); self.verified(2); self.complete()
        self.assertEqual(self.state()['handoff']['summary'],'verified')
    def test_report_mirror_fault_recovers_without_duplicate_report(self):
        self.build(); run,payload=self.review()
        actual=f.atomic
        def fault(path,content):
            if path.parent.name=='reports' and path.name==run+'.json': raise OSError('injected report mirror failure')
            actual(path,content)
        with patch.object(f,'atomic',side_effect=fault):
            with self.assertRaises(OSError): self.report(run,payload)
        self.assertEqual(f.main(['recover','TEST-1']),0)
        mirror=f.item_dir('TEST-1')/'reports'/(run+'.json')
        self.assertEqual(json.loads(mirror.read_text())['recommendation'],'ACCEPT')
        self.assertEqual(sum(r['run_id']==run for r in self.state()['reports']),1)
        self.advance('VERIFYING'); self.verified(); self.complete()
    def test_handoff_fault_recovery_is_idempotent(self):
        self.build(); self.accept(); self.verified(); self.advance('READY_FOR_HANDOFF')
        actual=f.atomic
        def fault(path,content):
            if path.name=='PUBLIC_NOTES.md': raise OSError('injected note failure')
            actual(path,content)
        with patch.object(f,'atomic',side_effect=fault):
            with self.assertRaises(OSError): self.call(f.cmd_handoff,id='TEST-1',result='PASS',summary='verified')
            with self.assertRaises(OSError): self.advance('COMPLETE')
        self.assertEqual(f.main(['recover','TEST-1']),0)
        self.call(f.cmd_handoff,id='TEST-1',result='PASS',summary='verified')
        self.assertEqual(sum(e['kind']=='handoff' for e in self.state()['events']),1)
        self.advance('COMPLETE')
        self.assertTrue((f.JOURNAL/'TEST-1.md').is_file())
        self.assertTrue((f.item_dir('TEST-1')/'PUBLIC_NOTES.md').is_file())

names=[n for n in IndependentReview2.__dict__ if n.startswith('test_')]
result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(IndependentReview2(n) for n in names))
sys.exit(not result.wasSuccessful())
