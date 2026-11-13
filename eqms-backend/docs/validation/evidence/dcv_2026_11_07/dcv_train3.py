"""DEV only: QA confirms the training, Complete Training of 1.0.1, then the operator publishes."""
import os, sys
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', 'training_2026_10_18'))
from e2e21_matrix import attempt as tattempt, sign as tsign, admin, qa, get
import importlib
AID = '8018f6b5-6048-468a-a4f2-29806706c7c1'
RID = '69163672-54d5-41b1-babf-c8f5fa7aeb32'
a = get(AID)
if a['status'] == 'PENDING_QA_CONFIRMATION':
    a = qa.call('POST', f'/training/activities/{AID}/confirm-completion', {'version': a['version'], 'signatureToken': tsign(qa)})
print('activity', a['status'])
c, d, t = tattempt(admin, 'POST', f'/revisions/{RID}/training/complete', {'signatureToken': tsign(admin), 'comment': 'DCV-TEST', 'reason': 'DCV-TEST'})
print('training/complete', c, t[:200])
sys.path.insert(0, HERE0)
from dcv_lib import status_of, publish
print('revision', status_of(RID))
st, problems = publish(RID)
print('publish ->', st, problems)
