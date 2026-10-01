import sys, unittest
from unittest.mock import patch
sys.path.insert(0, '/home/sam/Work/dial/factory/tests')
from test_factory import FactoryTest, f

class IndependentRepro(FactoryTest):
    def pass_review(self):
        run,payload=self.review(); self.report(run,payload); self.advance('VERIFYING')
    def pass_verify(self):
        run,payload=self.verify(); self.report(run,payload)
    def test_closed_failed_verify_still_passes(self):
        self.build(); self.pass_review(); self.pass_verify()
        run=self.dispatch('Verify','verifier-2')
        self.call(f.cmd_close_run,id='TEST-1',run=run,result='FAIL',reason='new check failed')
        self.advance('READY_FOR_HANDOFF')
        self.call(f.cmd_handoff,id='TEST-1',result='PASS',summary='old pass reused')
        self.assertEqual(self.state()['final_result'],'PASS')
    def test_revision_can_skip_implement_and_review(self):
        self.build(); self.pass_review()
        run,payload=self.verify(overall='FAIL'); self.report(run,payload)
        self.advance('BUILDING'); self.advance('REVIEWING'); self.advance('VERIFYING')
        self.assertEqual(len([r for r in self.state()['reports'] if r['role']=='Implement']),1)
    def test_spec_change_after_reviewing_still_passes(self):
        self.triage('SPEC'); self.advance('PLANNING')
        d=f.item_dir('TEST-1')
        (d/'PRODUCT.md').write_text('approved product'); (d/'TECH.md').write_text('approved tech')
        run=self.dispatch('Spec'); self.report(run,{'agent':'spec','documents':['PRODUCT.md','TECH.md']})
        self.advance('WAITING_FOR_SPEC_APPROVAL'); self.call(f.cmd_approve_spec,id='TEST-1',by='human')
        self.advance('BUILDING'); run=self.dispatch('Implement','implementer')
        self.report(run,{'agent':'implementer','change_summary':'implemented','decisions':[], 'candidate_commit':self.commit,'tests':['checked'],'ambiguities':[],'blockers':[]})
        self.advance('REVIEWING'); (d/'PRODUCT.md').write_text('unapproved product')
        self.assertFalse(f.spec_ready(self.state()))
        self.pass_review(); self.pass_verify(); self.advance('READY_FOR_HANDOFF')
        self.call(f.cmd_handoff,id='TEST-1',result='PASS',summary='unapproved spec')
        self.advance('COMPLETE'); self.assertEqual(self.state()['final_result'],'PASS')
    def test_interrupted_handoff_completes_without_artifacts(self):
        self.build(); self.pass_review(); self.pass_verify(); self.advance('READY_FOR_HANDOFF')
        actual=f.atomic
        def fault(path,content):
            if path.parent==f.JOURNAL: raise OSError('simulated interrupted artifact write')
            actual(path,content)
        with patch.object(f,'atomic',side_effect=fault):
            with self.assertRaises(OSError): self.call(f.cmd_handoff,id='TEST-1',result='PASS',summary='checked')
        f.load('TEST-1')
        self.advance('COMPLETE')
        self.assertFalse((f.JOURNAL/'TEST-1.md').exists())
        self.assertFalse((f.item_dir('TEST-1')/'PUBLIC_NOTES.md').exists())

suite=unittest.TestSuite(IndependentRepro(n) for n in ['test_closed_failed_verify_still_passes','test_revision_can_skip_implement_and_review','test_spec_change_after_reviewing_still_passes','test_interrupted_handoff_completes_without_artifacts'])
unittest.TextTestRunner(verbosity=2).run(suite)
