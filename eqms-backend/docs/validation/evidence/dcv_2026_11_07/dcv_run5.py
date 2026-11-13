"""Stage 5 (DEV only): owner decisions of 2026-11-08. F1: the creator sees what he created, even without view-everything. F2: the Author may start a new revision."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import dcv_lib
dcv_lib.ROLES['CREATOR'] = 'dcv.creator'
from dcv_lib import *
S = load(); X, Y = S['X'], S['Y']
b = Browser()
print('== F1 the creator who is not ticked with view-everything')
if 'W' not in S:
    w = new_document('DCV-TEST W Gowning procedure', co=(), author='U1', reviewers=('U2',), approvers=('U3',), creator='CREATOR')
    S['W'] = {'doc': w['id'], 'number': w['documentNumber']}; save(S)
W = S['W']
if not W.get('rx'):
    c, d, t = attempt('CREATOR', 'POST', f'/documents/{W["doc"]}/revisions', {})
    check('F1.1', 'the creator opens the first revision of the document he created', c == 200, t)
    W['rx'] = d.get('id'); save(S)
matrix('F1', 'the creator sees his own document and revision, not the other documents', ['CREATOR', 'U1', 'U2', 'U3', 'READER'],
       {'CREATOR': {'documents': {W['doc']}, 'revisions': {W['rx']}}, 'U1': {'documents': {W['doc'], X['doc'], Y['doc'], S['Z']['doc']}, 'revisions': {W['rx'], X['rx'], Y['rx'], S['Z']['rx'], X['rx2']}},
        'U2': {'documents': {W['doc'], X['doc'], Y['doc'], S['Z']['doc']}, 'revisions': {W['rx'], X['rx'], Y['rx'], S['Z']['rx'], X['rx2']}},
        'U3': {'documents': {W['doc'], X['doc'], Y['doc'], S['Z']['doc']}, 'revisions': {W['rx'], X['rx'], Y['rx'], S['Z']['rx'], X['rx2']}}},
       revs=[W['rx'], X['rx'], Y['rx'], S['Z']['rx'], X['rx2']], docs=[W['doc'], X['doc'], Y['doc'], S['Z']['doc']])
b.shot('CREATOR', '/documents/all', 'F1', 'creator-sees-own', 'F1: the operator who is NOT ticked with view-everything now sees the document he created')
print('== F2 the Author starts a new revision of an Effective document')
c, d, t = attempt('U2', 'POST', f'/revisions/{Y["rx"]}/upgrade', {'signatureToken': sign('U2'), 'reason': 'DCV-TEST upgrade', 'comment': 'DCV-TEST upgrade'})
check('F2.1', 'U2, Author of Y, starts revision 2 of Y', c == 200, t)
c, d, t = attempt('U3', 'POST', f'/revisions/{S["Z"]["rx"]}/upgrade', {'signatureToken': sign('U3'), 'reason': 'x', 'comment': 'x'})
check('F2.2', 'U3 (Approver, not Author) cannot start a revision of a document he does not write', c in (400, 403, 409), (c, t))
b.close()
