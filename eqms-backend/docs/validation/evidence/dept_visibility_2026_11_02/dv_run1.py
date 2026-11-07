"""Stage 1: two documents of Quality Control (a SOP and an Instruction) go through the whole flow; who sees what at every state. Needs dv_setup.py first."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dv_lib import *

ALL = list(ROLES)
FLOW = {'DCO', 'ADMIN', 'AUTHOR', 'COAUTHOR', 'REVIEWER', 'APPROVER'}   # the document control office, the administrator (view-all), the people of the flow
FLOW_AND_HEAD = FLOW | {'HEAD'}
S = load()
b = Browser()


def exp(roles, **kw):
    return {r: kw for r in roles}


# ------------------------------------------------------------------ the two documents
if 'A' not in S:
    a = new_document('DV-TEST SOP Sampling of raw materials')
    bdoc = new_document('DV-TEST Instruction Weighing room cleaning', dtype='Instruction (Working Instruction, Drafting Instruction)')
    S['A'] = {'doc': a['id'], 'number': a['documentNumber']}
    S['B'] = {'doc': bdoc['id'], 'number': bdoc['documentNumber']}
    save(S)
A, B = S['A'], S['B']
print('Document A', A['number'], '| Document B', B['number'])

print('== S1 the documents exist (no revision yet)')
matrix('S1', 'documents only, no revision yet', ALL, {r: {'documents': {A['doc'], B['doc']}} for r in FLOW_AND_HEAD}, docs=[A['doc'], B['doc']])
b.shot('DCO', '/documents/all', 'S1', 'DCO-documents', 'S1: the DCO, who created the two documents, sees both in the Document list')
b.shot('G1A', '/documents/all', 'S1', 'outsider-documents', 'S1: an employee with the View permission who is not in the flow and not named by the Head sees nothing')

# ------------------------------------------------------------------ revisions
if 'rev1' not in A:
    A['rev1'] = new_revision(A['doc'])['id']
    B['rev1'] = new_revision(B['doc'])['id']
    save(S)
revs = [A['rev1'], B['rev1']]
docs = [A['doc'], B['doc']]
print('== S2 revision 1 of each document is created (Draft)')
matrix('S2', 'revision 1 in Draft', ALL, {r: {'documents': set(docs), 'revisions': set(revs)} for r in FLOW_AND_HEAD}, revs=revs, docs=docs)
b.shot('AUTHOR', '/documents/revisions/all', 'S2', 'author-revisions-draft', 'S2: the Author sees the two Draft revisions of the documents they write')


def walk(key, label, doc, snaps):
    rid = doc['rev1']
    if doc.get('state') == 'EFFECTIVE':
        return
    upload('AUTHOR', rid, ['DV-TEST ' + label, 'Purpose', 'Scope', 'Procedure'])
    c, t = step('AUTHOR', rid, 'complete-editing')
    check(f'{key}.0', f'{label}: the Author completes the editing', c == 200, t)
    c, t = step('DCO', rid, 'submit-review')
    check(f'{key}.1', f'{label}: the DCO submits it for review', c == 200, t)
    if snaps:
        snaps('Pending Review', 'S3')
    c, t = step('REVIEWER', rid, 'review/complete')
    check(f'{key}.2', f'{label}: the Reviewer completes the review', c == 200, t)
    if snaps:
        snaps('Pending Approval', 'S4')
    c, t = step('APPROVER', rid, 'approve/complete')
    check(f'{key}.3', f'{label}: the Approver approves', c == 200, t)
    st, problems = publish(rid)
    check(f'{key}.4', f'{label}: the DCO publishes it (status {st})', str(st).upper() == 'EFFECTIVE', problems)
    doc['state'] = str(st).upper()
    save(S)


def snaps_a(state, sid):
    print(f'== {sid} document A is {state}')
    got = status_of(A['rev1'])
    check(sid + '.state', f'revision of document A is {state}', got == state, got)
    matrix(sid, f'A and B, A is {state}', ALL, {r: {'documents': set(docs), 'revisions': set(revs)} for r in FLOW_AND_HEAD}, revs=revs, docs=docs)
    b.shot('REVIEWER' if 'Review' in state else 'APPROVER', '/documents/revisions/pending-review' if 'Review' in state else '/documents/revisions/pending-approval', sid, 'task-' + state.replace(' ', '-'),
           f'{sid}: the {"Reviewer" if "Review" in state else "Approver"} sees the revision waiting for them in their task list')


walk('F-A', 'SOP Sampling of raw materials', A, snaps_a)
walk('F-B', 'Instruction Weighing room cleaning', B, None)

print('== S5 both documents are Effective')
check('S5.state', 'both revisions are Effective', status_of(A['rev1']) == 'Effective' and status_of(B['rev1']) == 'Effective', (status_of(A['rev1']), status_of(B['rev1'])))
matrix('S5', 'A and B Effective', ALL, {r: {'documents': set(docs), 'revisions': set(revs)} for r in FLOW_AND_HEAD}, revs=revs, docs=docs)
b.shot('ADMIN', '/documents/all', 'S5', 'ADMIN-documents', 'S5: the administrator (view-all permission, no part in any flow) sees both documents')
b.shot('HEAD', '/documents/all', 'S5', 'HEAD-documents', 'S5: the Department Head of Quality Control sees both documents of the Department')
save(S)
b.close()
print('stage 1 done')
