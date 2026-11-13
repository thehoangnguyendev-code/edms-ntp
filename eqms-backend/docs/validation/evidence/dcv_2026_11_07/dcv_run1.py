"""Stage 1 (DEV only): two documents with CROSSED roles. X: Author U1, Reviewer U2, Approver U3. Y: Author U2, Reviewer U1, Approver U3. One profile (DC Contributor) serves all three people.
Checks who sees what at every state, and that a name in the flow gives the action only on THAT document. Run: DEVPW=... python dcv_run1.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *

ALL = list(ROLES)
S = load()
b = Browser()

if 'X' not in S:
    x = new_document('DCV-TEST X Sampling of raw materials', co=(), author='U1', reviewers=('U2',), approvers=('U3',))
    y = new_document('DCV-TEST Y Weighing room cleaning', dtype='Instruction (Working Instruction, Drafting Instruction)', co=(), author='U2', reviewers=('U1',), approvers=('U3',))
    S['X'] = {'doc': x['id'], 'number': x['documentNumber']}
    S['Y'] = {'doc': y['id'], 'number': y['documentNumber']}
    save(S)
X, Y = S['X'], S['Y']
docs = [X['doc'], Y['doc']]
print('X', X['number'], '| Y', Y['number'])

NAMED = {'U1', 'U2', 'U3'}        # in the flow of both documents
VIEW = {'ALLVIEW', 'DCO'}   # view-everything bundle (the operator is ticked too)
print('== S1 documents exist (no revision)')
matrix('S1', 'documents, no revision yet', ALL, {r: {'documents': set(docs)} for r in NAMED | VIEW}, docs=docs)
b.shot('DCO', '/documents/all', 'S1', 'operator-documents', 'S1: the operator (no view-everything) who created the documents')
b.shot('U1', '/documents/all', 'S1', 'U1-documents', 'S1: U1 is Author of X and Reviewer of Y: sees both with ONE profile')
b.shot('UCAPP', '/documents/all', 'S1', 'outsider-documents', 'S1: a person with the module permission but no name in the flow sees nothing')
b.shot('READER', '/', 'S1', 'reader-home', 'S1: the Knowledge-Base-only reader has no Document Control menu')

if 'rx' not in X:
    X['rx'] = new_revision(X['doc'])['id']
    Y['rx'] = new_revision(Y['doc'])['id']
    save(S)
revs = [X['rx'], Y['rx']]
print('== S2 revision 1 in Draft')
matrix('S2', 'revision 1 in Draft', ALL, {r: {'documents': set(docs), 'revisions': set(revs)} for r in NAMED | VIEW}, revs=revs, docs=docs)

print('== S3 a name on ONE document gives the action only there (negative checks while Draft)')
c, d, t = attempt('U2', 'POST', f'/revisions/{X["rx"]}/submit-review', {'signatureToken': sign('U2'), 'comment': 'x', 'reason': 'x'})
check('S3.1', 'U2 (Reviewer of X, not Author) cannot complete editing of X', c in (400, 403, 409), (c, t))
c, d, t = attempt('UCAPP', 'POST', f'/revisions/{X["rx"]}/submit-review', {'signatureToken': sign('UCAPP'), 'comment': 'x', 'reason': 'x'})
check('S3.2', 'a person outside the flow cannot complete editing of X', c in (400, 403, 404, 409), (c, t))
c, d, t = attempt('READER', 'GET', f'/revisions/{X["rx"]}')
check('S3.3', 'the Knowledge-only reader cannot open the Draft revision', c in (403, 404), (c, t))

for key, doc, au, rv, ap in (('X', X, 'U1', 'U2', 'U3'), ('Y', Y, 'U2', 'U1', 'U3')):
    rid = doc['rx']
    upload(au, rid, [f'DCV-TEST {key}', 'Purpose', 'Scope', 'Procedure'])
    c, t = step(au, rid, 'submit-review')
    check(f'{key}.1', f'{key}: the Author submits it for review', c == 200, t)
print('== S4 both revisions Pending Review')
matrix('S4', 'Pending Review', ALL, {r: {'documents': set(docs), 'revisions': set(revs)} for r in NAMED | VIEW}, revs=revs, docs=docs)
b.shot('U1', '/documents/revisions/all', 'S4', 'U1-revisions', 'S4: U1 sees both revisions (Author of X, Reviewer of Y)')

print('== S5 only the assigned Reviewer can review, per document')
c, t = step('U1', X['rx'], 'review/complete')
check('S5.1', 'U1 (Author of X) cannot review X', c in (400, 403, 409), (c, t))
c, t = step('U3', X['rx'], 'review/complete')
check('S5.2', 'U3 (Approver of X) cannot review X', c in (400, 403, 409), (c, t))
c, t = step('U2', X['rx'], 'review/complete')
check('S5.3', 'U2 (Reviewer of X) reviews X', c == 200, t)
c, t = step('U2', Y['rx'], 'review/complete')
check('S5.4', 'U2 (Author of Y) cannot review Y', c in (400, 403, 409), (c, t))
c, t = step('U1', Y['rx'], 'review/complete')
check('S5.5', 'U1 (Reviewer of Y) reviews Y', c == 200, t)

print('== S6 approval')
c, t = step('U1', X['rx'], 'approve/complete')
check('S6.1', 'U1 (Author of X) cannot approve X', c in (400, 403, 409), (c, t))
c, t = step('U3', X['rx'], 'approve/complete')
check('S6.2', 'U3 approves X', c == 200, t)
c, t = step('U3', Y['rx'], 'approve/complete')
check('S6.3', 'U3 approves Y', c == 200, t)
print('statuses', status_of(X['rx']), status_of(Y['rx']))
matrix('S6', 'Ready for Publishing', ALL, {**{r: {'documents': set(docs), 'revisions': set(revs)} for r in NAMED | VIEW}}, revs=revs, docs=docs)
# the operator publishes: must he see what he publishes?
s = seen('DCO', revs, docs)
print('operator sees (list/detail)', s['revisions'], s['documents'])
save(S)
b.close()
