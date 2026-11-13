"""Stage 2 (DEV only): publish X and Y, Knowledge Base, then Controlled and Uncontrolled Copies. Needs dcv_run1.py first."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *

ALL = list(ROLES)
S = load(); X, Y = S['X'], S['Y']
docs = [X['doc'], Y['doc']]; revs = [X['rx'], Y['rx']]
NAMED = {'U1', 'U2', 'U3'}; VIEW = {'ALLVIEW', 'DCO'}
b = Browser()

print('== S7 the operator publishes X and Y')
for key, d in (('X', X), ('Y', Y)):
    if d.get('state') != 'EFFECTIVE':
        st, problems = publish(d['rx'])
        d['state'] = str(st).upper(); save(S)
        check(f'S7.{key}', f'{key} published by the operator (status {st})', d['state'] == 'EFFECTIVE', problems)
matrix('S7', 'Effective: visibility of documents and revisions is unchanged (name in flow or view-everything)', ALL, {r: {'documents': set(docs), 'revisions': set(revs)} for r in NAMED | VIEW}, revs=revs, docs=docs)

print('== S8 Knowledge Base: every holder of the Knowledge permission reads Effective documents')
for r in ALL:
    c, d, t = attempt(r, 'GET', '/documents/knowledge-base')
    n = None
    if c == 200:
        body = d.get('data', d) if isinstance(d, dict) else d
        n = len(body) if isinstance(body, list) else (d.get('total') or d.get('totalElements'))
    print('   KB', ROLES[r], c, n)
    S.setdefault('kb', {})[r] = [c, n]
for r in ALL:
    check('S8.' + r, f'{ROLES[r]} can open the Knowledge Base list', S['kb'][r][0] == 200, S['kb'][r])
b.shot('READER', '/self-service/knowledge', 'S8', 'reader-kb', 'S8: the Knowledge-only reader reads Effective documents here')
save(S)

print('== S9 Controlled Copy of X for U3')
if 'cc' not in X:
    body = {'documentId': X['doc'], 'sourceRevisionId': X['rx'], 'purpose': 'DCV-TEST controlled copy', 'reason': 'DCV-TEST', 'copies': 1, 'quantity': 1, 'distributionMode': 'INTERNAL',
            'distributionScope': 'INTERNAL', 'usagePurpose': 'READ_AND_COMPLY', 'recipients': [{'recipientType': 'USER', 'recipientUserId': uid('U3'), 'quantity': 1}],
            'recipientIds': [uid('U3')], 'signatureToken': sign('DCO')}
    c, d, t = attempt('DCO', 'POST', '/controlled-copies', body)
    check('S9.1', 'the operator requests a Controlled Copy for U3', c == 200, t)
    X['cc'] = d['id']; save(S)
cc = X['cc']
matrix('S9', 'Controlled Copy ready: operator and view-everything, and the recipient U3. NOT the other flow members', ALL, {
    'DCO': {'documents': set(docs), 'revisions': set(revs), 'ccs': {cc}}, 'ALLVIEW': {'documents': set(docs), 'revisions': set(revs), 'ccs': {cc}},
    'U1': {'documents': set(docs), 'revisions': set(revs)}, 'U2': {'documents': set(docs), 'revisions': set(revs)}, 'U3': {'documents': set(docs), 'revisions': set(revs), 'ccs': {cc}}},
    revs=revs, docs=docs, ccs=[cc], cc_docs=[X['doc']])
b.shot('U3', '/documents/controlled-copies/all', 'S9', 'recipient-cc', 'S9: U3, the recipient, sees the Controlled Copy')
b.shot('U1', '/documents/controlled-copies/all', 'S9', 'other-flow-member-cc', 'S9: U1 (in the flow but not the recipient) does not see it')
c, d, t = attempt('U1', 'POST', f'/controlled-copies/{cc}/distribute', {'signatureToken': sign('U1'), 'reason': 'x'})
check('S9.2', 'U1 cannot distribute the copy', c in (400, 403, 404), (c, t))
c, d, t = attempt('DCO', 'POST', f'/controlled-copies/{cc}/distribute', {'signatureToken': sign('DCO'), 'reason': 'DCV-TEST'})
check('S9.3', 'the operator distributes the copy', c == 200, t)
cd = U('U3').call('GET', f'/controlled-copies/{cc}')
check('S9.4', 'U3 sees status Distributed', str(cd.get('status')).upper() in ('DISTRIBUTED',), cd.get('status'))

print('== S10 Uncontrolled Copy: U1 asks for X for themselves; the approver sees only the request waiting for a decision')
if 'uc' not in X:
    body = {'documentId': X['doc'], 'revisionId': X['rx'], 'reason': 'DCV-TEST uncontrolled copy', 'recipientUserId': uid('U1'), 'signatureToken': sign('U1')}
    c, d, t = attempt('U1', 'POST', '/uncontrolled-copies', body)
    check('S10.1', 'U1 requests an Uncontrolled Copy of X', c == 200, t)
    X['uc'] = d.get('id'); save(S)
uc = X['uc']
print('   uc status', U('U1').call('GET', f'/uncontrolled-copies/{uc}').get('status'))
base = {r: {'documents': set(docs), 'revisions': set(revs)} for r in NAMED | VIEW}
exp = {**base, 'DCO': {**base['DCO'], 'ccs': {cc}, 'ucs': {uc}}, 'ALLVIEW': {**base['ALLVIEW'], 'ccs': {cc}, 'ucs': {uc}}, 'U1': {**base['U1'], 'ucs': {uc}}, 'U3': {**base['U3'], 'ccs': {cc}},
       'UCAPP': {'ucs': {uc}}}
matrix('S10', 'Uncontrolled Copy REQUESTED: requester, operator, view-everything, and the approver (waiting for decision)', ALL, exp, revs=revs, docs=docs, ccs=[cc], ucs=[uc], cc_docs=[X['doc']], uc_docs=[X['doc']])
b.shot('UCAPP', '/documents/uncontrolled-copies/all', 'S10', 'approver-sees-pending', 'S10: the approver sees the request waiting for their decision')
b.shot('U2', '/documents/uncontrolled-copies/all', 'S10', 'U2-no-uc', 'S10: U2 sees no Uncontrolled Copy of someone else')
c, d, t = attempt('U2', 'POST', f'/uncontrolled-copies/{uc}/approve', {'signatureToken': sign('U2'), 'reason': 'x'})
check('S10.2', 'U2 (no approve permission) cannot approve', c in (400, 403, 404), (c, t))
c, d, t = attempt('UCAPP', 'POST', f'/uncontrolled-copies/{uc}/approve', {'signatureToken': sign('UCAPP'), 'reason': 'DCV-TEST approve'})
check('S10.3', 'the approver approves', c == 200, t)
print('   uc status', U('U1').call('GET', f'/uncontrolled-copies/{uc}').get('status'))
code, d, t = attempt('UCAPP', 'GET', f'/uncontrolled-copies/{uc}')
check('S10.4', 'after the decision the approver no longer sees the request', code in (403, 404), (code, t))
c, d, t = attempt('DCO', 'POST', f'/uncontrolled-copies/{uc}/generate', {'signatureToken': sign('DCO'), 'reason': 'DCV-TEST'})
check('S10.5', 'the operator generates the copy', c == 200, t)
c, d, t = attempt('DCO', 'POST', f'/uncontrolled-copies/{uc}/distribute', {'signatureToken': sign('DCO'), 'reason': 'DCV-TEST'})
check('S10.6', 'the operator distributes the copy', c == 200, t)
print('   uc status', U('U1').call('GET', f'/uncontrolled-copies/{uc}').get('status'))
b.shot('U1', '/documents/uncontrolled-copies/all', 'S10', 'U1-own-uc', 'S10: U1 sees their own Uncontrolled Copy')
save(S)
b.close()
