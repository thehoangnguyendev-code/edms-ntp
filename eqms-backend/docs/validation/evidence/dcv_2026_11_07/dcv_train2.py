"""DEV only: runs the Training activity TRN/QC/26-079 (revision 1.0.1 of SOP.7147) to COMPLETED, then Complete Training + publish.
Organizer/QA accounts are the existing DEV training test accounts; trainees are dcv.u2 (Co-Author) and dcv.u3 (Reviewer)."""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'training_2026_10_18'))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf, attempt, sign, admin, qa, trainee, get, TODAY
AID = '8018f6b5-6048-468a-a4f2-29806706c7c1'
RID = '69163672-54d5-41b1-babf-c8f5fa7aeb32'
t1, t2 = Client('dcv.u2'), Client('dcv.u3')

def step(name, fn):
    try:
        r = fn(); print('OK  ', name, (r or {}).get('status') if isinstance(r, dict) else ''); return r
    except BaseException as e:
        print('FAIL', name, str(e)[:400]); raise SystemExit(1)
a = get(AID)
print(a['status'], a.get('attendanceSentAt'), a.get('resultsFinishedAt'), a['contentRules'])
print({k: v for k, v in a['capabilities'].items() if v})
print({k:a.get(k) for k in ('assessmentExempt','assessmentDefId','assessmentName')})
