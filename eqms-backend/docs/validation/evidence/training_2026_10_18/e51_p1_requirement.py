"""Phase 1: the training requirement (APD.0118): prepared, reviewed and approved with electronic signatures by three different people; the form is made; the screens are shot."""
from e51_lib import *

state = load()
YEAR = int(os.environ.get('E51_YEAR', '2028'))
step('1.1 the requirement is created and its lines written')
doc = sql("select id from documents where document_number = 'SOP.0003' limit 1")
check('1.0 a document to train on exists', bool(doc), doc)
code, req, text = attempt(admin, 'POST', '/training/requirements', {'year': YEAR, 'kind': 'SOP_PERIODIC', 'reviewCompletedOn': TODAY})
if code != 200:
    # one exists already for the year: take it
    rows = [r for r in admin.call('GET', f'/training/requirements?limit=50&search={YEAR}')['data'] if r.get('year') == YEAR and r.get('kind') == 'SOP_PERIODIC']
    req = rows[0] if rows else None
check('1.1 the requirement is created (Draft) with a request number', req is not None and bool(req.get('requestNo')), (code, text))
rid = req['id']
req = admin.call('GET', f'/training/requirements/{rid}')
if req['status'] == 'DRAFT':
    lines = [{'plannedMonth': f'{YEAR}-03-01', 'documentId': doc}, {'plannedMonth': f'{YEAR}-06-01', 'topicText': 'E2E51 Data integrity refresher'}]
    req = admin.call('PUT', f'/training/requirements/{rid}', {'version': req['version'], 'lines': lines})
    check('1.2 two lines are written', len(req['lines']) == 2, req['lines'])

    step('1.2 prepared, reviewed, approved: three people, three signatures')
    req = admin.call('POST', f'/training/requirements/{rid}/submit', {'version': req['version'], 'signatureToken': sign(admin), 'nextApproverUserId': qa.user['id']})
    check('1.3 submitted by the preparer (admin)', req['status'] in ('SUBMITTED', 'PENDING_REVIEW', 'IN_REVIEW') or 'REVIEW' in req['status'], req['status'])
    code, r2, text = attempt(admin, 'POST', f'/training/requirements/{rid}/review', {'version': req['version'], 'signatureToken': sign(admin), 'nextApproverUserId': t3.user['id']})
    check('1.4 the preparer cannot review their own requirement (segregation of duties)', code >= 400, (code, text))
    req = qa.call('POST', f'/training/requirements/{rid}/review', {'version': req['version'], 'signatureToken': sign(qa), 'nextApproverUserId': t3.user['id']})
    check('1.5 reviewed by the QA specialist', 'APPROV' in req['status'] or 'REVIEWED' in req['status'], req['status'])
    req = t3.call('POST', f'/training/requirements/{rid}/approve', {'version': req['version'], 'signatureToken': sign(t3)})
    check('1.6 approved', req['status'] == 'APPROVED', req['status'])
req = admin.call('GET', f'/training/requirements/{rid}')
check('1.7 approved, with the three signatures kept', req['status'] == 'APPROVED' and all(req.get(k) for k in ('preparedSignatureId', 'reviewedSignatureId', 'approvedSignatureId')), {k: req.get(k) for k in ('status', 'preparedSignatureId', 'reviewedSignatureId', 'approvedSignatureId')})
state['requirement'] = {'id': rid, 'requestNo': req['requestNo'], 'year': YEAR, 'lines': [l['id'] for l in req['lines']]}
save(state)

step('1.3 APD.0118 is made from the requirement (the tokenized template)')
st, w = fetch(admin, f'/training/requirements/{rid}/export?format=docx', 'APD0118-approved.docx')
check('1.8 Word of the requirement', st == 200 and w[:2] == b'PK', (st, w[:200]))
if st == 200:
    t = words(w)
    check('1.9 request number, year, both lines and the three signatures are written', req['requestNo'] in t and str(YEAR) in t and 'Data integrity refresher' in t and t.count('(UTC+') >= 3, t[:500])
    check('1.10 the notes of the template are not written, no token is left', 'HISTORY REVISION' not in t and '{{' not in t and 'Header:' not in t, t[:200])
    st, p = fetch(admin, f'/training/requirements/{rid}/export?format=pdf', 'APD0118-approved.pdf')
    check('1.11 PDF of the requirement', st == 200 and p[:4] == b'%PDF', st)
    print('   pages', render_pdf(p, 'p1_03_APD0118_approved'))

step('1.4 the screens')
b = Browser()
b.shot('admin', '/training-management/requirements', 'p1_01_requirements_list')
b.shot('admin', f'/training-management/requirements/{rid}', 'p1_02_requirement_detail', wait=5000)
finish(b)
