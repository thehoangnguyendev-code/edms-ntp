"""Stage 6 (DEV only): Co-Author sees the document they are named on; the Author's own upload creates the first revision. Creator rule re-checked."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import dcv_lib
dcv_lib.ROLES['CREATOR'] = 'dcv.creator'
from dcv_lib import *
S = load()
print('== V: Co-Author U2, Author U1, Reviewer+Approver U3, created by the operator (DCO)')
if 'V' not in S:
    v = new_document('DCV-TEST V Line clearance', co=('U2',), author='U1', reviewers=('U3',), approvers=('UCAPP',))
    S['V'] = {'doc': v['id'], 'number': v['documentNumber']}; save(S)
V = S['V']
ALL = ['U1', 'U2', 'U3', 'DCO', 'CREATOR', 'READER', 'UCAPP']
matrix('V1', 'V before any revision: documents only', ALL,
       {'U1': {'documents': {V['doc']}}, 'U2': {'documents': {V['doc']}}, 'U3': {'documents': {V['doc']}}, 'UCAPP': {'documents': {V['doc']}}, 'DCO': {'documents': {V['doc']}}},
       docs=[V['doc']])
print('== the Author uploads: the system creates the revision')
c, d, t = attempt('U2', 'GET', f'/documents/{V["doc"]}')
check('V2.1', 'Co-Author opens the document detail', c == 200, (c, t[:150]))
if not V.get('rx'):
    cu = U('U2').upload(f'/documents/{V["doc"]}/revisions/upload', 'file', 'dv-test.docx', mini_docx('DCV-TEST V Purpose Scope Procedure'), DOCX) if False else None
    import requests  # noqa
    # Co-Author must be refused first
    code, _, tt = attempt('U2', 'POST', f'/documents/{V["doc"]}/revisions', {})
    check('V2.2', 'Co-Author cannot open a revision (no workspace permission)', code in (400, 403), (code, tt[:150]))
    try:
        U('U2').upload(f'/documents/{V["doc"]}/revisions/upload', 'file', 'dv-test.docx', mini_docx('DCV-TEST V by coauthor'), DOCX)
        check('V2.3', 'Co-Author cannot upload a revision (not the Author)', False, 'accepted')
    except BaseException as e:
        check('V2.3', 'Co-Author cannot upload a revision (not the Author)', True, str(e)[:150])
    try:
        r = U('U1').upload(f'/documents/{V["doc"]}/revisions/upload', 'file', 'dv-test.docx', mini_docx('DCV-TEST V Purpose Scope Procedure'), DOCX)
        rid = (r or {}).get('id') if isinstance(r, dict) else None
        check('V2.4', 'the Author uploads and a revision is created', bool(rid), r)
        V['rx'] = rid; save(S)
    except BaseException as e:
        check('V2.4', 'the Author uploads and a revision is created', False, str(e)[:300])
if V.get('rx'):
    print('   revision', V['rx'], status_of(V['rx']))
    matrix('V3', 'V after the Author upload: Draft revision visible to the named only', ALL,
           {'U1': {'documents': {V['doc']}, 'revisions': {V['rx']}}, 'U2': {'documents': {V['doc']}, 'revisions': {V['rx']}},
            'U3': {'documents': {V['doc']}, 'revisions': {V['rx']}}, 'UCAPP': {'documents': {V['doc']}, 'revisions': {V['rx']}}, 'DCO': {'documents': {V['doc']}, 'revisions': {V['rx']}}},
           revs=[V['rx']], docs=[V['doc']])
