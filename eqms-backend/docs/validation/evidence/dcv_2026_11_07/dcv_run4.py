"""Stage 4 (DEV only): exceptions. Reject a review, reject an Uncontrolled Copy, recall a Controlled Copy, upgrade an Effective document to a new revision. Needs stages 1-2."""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *

ALL = list(ROLES)
S = load(); X, Y = S['X'], S['Y']
cc, uc = X['cc'], X['uc']
NAMED = {'U1', 'U2', 'U3'}; VIEW = {'ALLVIEW', 'DCO'}
b = Browser()

print('== S13 a review is rejected: the revision goes back to the Author, nobody else sees it')
if 'Z' not in S:
    z = new_document('DCV-TEST Z Cleaning validation', co=(), author='U1', reviewers=('U2',), approvers=('U3',))
    S['Z'] = {'doc': z['id'], 'number': z['documentNumber'], 'rx': new_revision(z['id'])['id']}; save(S)
Z = S['Z']
if not Z.get('rejected'):
    upload('U1', Z['rx'], ['DCV-TEST Z', 'Purpose', 'Scope', 'Procedure'])
    c, t = step('U1', Z['rx'], 'submit-review'); check('S13.1', 'U1 submits Z for review', c == 200, t)
    c, t = step('U3', Z['rx'], 'review/reject'); check('S13.2', 'U3 (Approver, not Reviewer) cannot reject the review', c in (400, 403, 409), (c, t))
    c, t = step('U2', Z['rx'], 'review/reject'); check('S13.3', 'U2 (Reviewer) rejects the review', c == 200, t)
    Z['rejected'] = True; save(S)
st = status_of(Z['rx'])
check('S13.4', f'Z is back in Draft (status {st})', str(st).upper() in ('DRAFT',), st)
matrix('S13', 'Z after the rejection', ALL, {r: {'documents': {Z['doc']}, 'revisions': {Z['rx']}} for r in {'U1', 'U2', 'U3'} | VIEW}, revs=[Z['rx']], docs=[Z['doc']])

print('== S14 an Uncontrolled Copy request is rejected by the approver')
if 'uc2' not in X:
    body = {'documentId': X['doc'], 'revisionId': X['rx'], 'reason': 'DCV-TEST second request', 'recipientUserId': uid('U2'), 'signatureToken': sign('U2')}
    c, d, t = attempt('U2', 'POST', '/uncontrolled-copies', body)
    check('S14.1', 'U2 requests an Uncontrolled Copy of X', c == 200, t)
    X['uc2'] = d.get('id'); save(S)
uc2 = X['uc2']
code, d, t = attempt('UCAPP', 'GET', f'/uncontrolled-copies/{uc2}')
check('S14.2', 'the approver sees the waiting request', code == 200, (code, t))
code, d, t = attempt('U1', 'GET', f'/uncontrolled-copies/{uc2}')
check('S14.3', 'U1 (not the requester, not an approver) does not see it', code in (403, 404), (code, t))
c, d, t = attempt('UCAPP', 'POST', f'/uncontrolled-copies/{uc2}/reject', {'signatureToken': sign('UCAPP'), 'reason': 'DCV-TEST reject', 'comment': 'DCV-TEST reject'})
check('S14.4', 'the approver rejects it', c == 200, t)
code, d, t = attempt('UCAPP', 'GET', f'/uncontrolled-copies/{uc2}')
check('S14.5', 'after the decision the approver no longer sees it', code in (403, 404), (code, t))
code, d, t = attempt('U2', 'GET', f'/uncontrolled-copies/{uc2}')
check('S14.6', 'U2 still sees their rejected request', code == 200 and str(d.get('status')).upper() == 'REJECTED', (code, d.get('status')))
c, d, t = attempt('DCO', 'POST', f'/uncontrolled-copies/{uc2}/generate', {'signatureToken': sign('DCO'), 'reason': 'x'})
check('S14.7', 'a rejected request cannot be generated', c in (400, 403, 409), (c, t))
b.shot('U2', '/documents/uncontrolled-copies/all', 'S14', 'U2-rejected', 'S14: U2 sees the rejected request')

print('== S15 the operator recalls the Controlled Copy')
cd0 = U('U3').call('GET', f'/controlled-copies/{cc}').get('status')
c, d, t = attempt('U1', 'POST', f'/controlled-copies/{cc}/recall', {'signatureToken': sign('U1'), 'reason': 'x', 'comment': 'x'})
check('S15.1', 'U1 cannot recall the copy', c in (400, 403, 404), (c, t))
c, d, t = attempt('DCO', 'POST', f'/controlled-copies/{cc}/recall', {'signatureToken': sign('DCO'), 'reason': 'DCV-TEST recall', 'comment': 'DCV-TEST recall'})
check('S15.2', f'the operator recalls the copy (was {cd0})', c == 200, t)
print('   status after', U('U3').call('GET', f'/controlled-copies/{cc}').get('status'))

print('== S16 a new revision (upgrade) of X: Draft visible only to the named; the Effective one stays')
if 'rx2' not in X:
    c, d, t = attempt('U1', 'POST', f'/revisions/{X["rx"]}/upgrade', {'signatureToken': sign('U1'), 'reason': 'DCV-TEST upgrade', 'comment': 'DCV-TEST upgrade'})
    check('S16.1', 'U1 (Author) starts an upgrade of X', c == 200, t)
    if c != 200:
        c, d, t = attempt('DCO', 'POST', f'/documents/{X["doc"]}/revisions', {})
        check('S16.1b', 'the operator creates revision 2 instead', c == 200, t)
    X['rx2'] = d.get('id') or d.get('revisionId'); save(S)
r2 = X['rx2']
print('   rev2', r2, status_of(r2) if r2 else None)
if r2:
    matrix('S16', 'revision 2 Draft', ALL, {r: {'documents': set([X['doc'], Y['doc']]), 'revisions': set([X['rx'], Y['rx'], r2])} for r in {'U1', 'U2', 'U3'} | VIEW}, revs=[X['rx'], Y['rx'], r2], docs=[X['doc'], Y['doc']])
    b.shot('READER', f'/documents/revisions/{r2}', 'S16', 'reader-draft-denied', 'S16: the Knowledge-only reader opening the Draft revision directly')
b.close()
save(S)
