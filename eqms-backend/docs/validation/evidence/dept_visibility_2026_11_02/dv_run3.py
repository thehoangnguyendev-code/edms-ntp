"""Stage 3: upgrade to revision 2, a Deny on Draft, Controlled and Uncontrolled Copies, the three conveniences, the other two modes, the Knowledge Base."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dv_lib import *

ALL = list(ROLES)
FLOW = {'DCO', 'ADMIN', 'AUTHOR', 'COAUTHOR', 'REVIEWER', 'APPROVER'}
BASE = FLOW | {'HEAD'}
S = load()
b = Browser()
A, B = S['A'], S['B']


def lists():
    return [x for x in (A['rev1'], A.get('rev2'), B['rev1']) if x], [A['doc'], B['doc']]


def sees(extra, a_revs=None, b_revs=None, flow=True, head=True, docs_for_flow=None):
    """People of the flow and the Head see both documents and all their revisions; `extra`: role -> sets."""
    revs, docs = lists()
    out = {}
    base = (FLOW if flow else {'DCO', 'ADMIN'}) | ({'HEAD'} if head else set())
    for r in base:
        out[r] = {'documents': set(docs), 'revisions': set(revs)}
    out.update(extra)
    return out


def a_only(revs_of_a):
    return {'documents': {A['doc']}, 'revisions': set(revs_of_a)}


def b_only():
    return {'documents': {B['doc']}, 'revisions': {B['rev1']}}


# ------------------------------------------------------------------ upgrade
print('== S14 the DCO upgrades document A: revision 2 (Draft)')
if 'rev2' not in A:
    c, d, t = attempt('DCO', 'POST', f"/revisions/{A['rev1']}/upgrade")
    check('S14.1', 'the DCO upgrades the Effective revision of document A to a new revision', c == 200, t)
    A['rev2'] = d['id']
    save(S)
revs, docs = lists()
check('S14.2', 'revision 2 is a Draft', status_of(A['rev2']) == 'Draft', status_of(A['rev2']))
g1 = a_only([A['rev1'], A['rev2']])
matrix('S14', 'revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction', ALL,
       sees({'G1A': g1, 'G1B': g1, 'G2A': b_only(), 'G2B': b_only()}), revs=revs, docs=docs)
b.shot('AUTHOR', '/documents/revisions/all', 'S14', 'author-revisions-rev2', 'S14: the Author sees revision 2 (Draft) next to revision 1 (Effective)')
b.shot('G1A', '/documents/revisions/all', 'S14', 'group1-sees-draft', 'S14: a member of group 1 sees the Draft revision 2 as well: the rule is for every SOP, whatever its status')

print('== S15 the Head hides Draft revisions from G1B (Deny, priority 50)')
c, r, t = make_rule('G1B must not see Draft', 'DENY', 50, 'DOCUMENT_STATUS', ['G1B'], resource_name='DRAFT')
check('S15.1', 'the Head creates a Deny rule on the status Draft', c == 200, t[:150])
matrix('S15', 'Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2', ALL,
       sees({'G1A': g1, 'G1B': a_only([A['rev1']]), 'G2A': b_only(), 'G2B': b_only()}), revs=revs, docs=docs)
b.shot('G1B', '/documents/revisions/all', 'S15', 'G1B-draft-hidden', 'S15: G1B (Deny on Draft) sees revision 1 only; the Draft revision 2 is hidden from this one person')
check('S15.2', 'the Head deletes the Deny rule', drop_rule(r['id']) == 204, '')

print('== S16 revision 2 goes to Effective: written, submitted, reviewed, approved, published')
rid = A['rev2']
if A.get('state2') != 'EFFECTIVE':
    upload('AUTHOR', rid, ['DV-TEST SOP revision 2', 'Purpose', 'Scope', 'Procedure changed'])
    for who, st in (('AUTHOR', 'complete-editing'), ('DCO', 'submit-review'), ('REVIEWER', 'review/complete'), ('APPROVER', 'approve/complete')):
        c, t = step(who, rid, st)
        check('S16.' + st, f'revision 2: {who} {st}', c == 200, t)
    st, problems = publish(rid)
    check('S16.pub', f'revision 2 is published (status {st})', str(st).upper() == 'EFFECTIVE', problems)
    A['state2'] = str(st).upper()
    save(S)
check('S16.obs', 'revision 1 is no longer Effective (Obsolete)', status_of(A['rev1']) != 'Effective', status_of(A['rev1']))
matrix('S16', 'revision 2 Effective, revision 1 Obsolete: nobody loses or gains', ALL, sees({'G1A': g1, 'G1B': g1, 'G2A': b_only(), 'G2B': b_only()}), revs=revs, docs=docs)

# ------------------------------------------------------------------ copies
print('== S17 Controlled Copy of document A (revision 2), for G2B, who is not in the SOP rule')
if 'cc' not in A:
    body = {'documentId': A['doc'], 'sourceRevisionId': A['rev2'], 'purpose': 'DV-TEST controlled copy', 'reason': 'DV-TEST', 'copies': 1, 'quantity': 1, 'distributionMode': 'INTERNAL',
            'distributionScope': 'INTERNAL', 'usagePurpose': 'READ_AND_COMPLY', 'recipients': [{'recipientType': 'USER', 'recipientUserId': uid('G2B'), 'quantity': 1}],
            'recipientIds': [uid('G2B')], 'signatureToken': sign('DCO')}
    c, d, t = attempt('DCO', 'POST', '/controlled-copies', body)
    check('S17.1', 'the DCO requests a Controlled Copy for G2B', c == 200, t)
    A['cc'] = d['id']
    save(S)
cc = A['cc']
detail = U('DCO').call('GET', f'/controlled-copies/{cc}')
print('   copy recipient:', detail.get('recipientUserName') or detail.get('recipient') or [k for k in detail if 'ecip' in k])
revs, docs = lists()
copy_exp = {'DCO': {'ccs': {cc}}, 'ADMIN': {'ccs': {cc}}, 'G1B': {'ccs': {cc}}, 'G2B': {'ccs': {cc}}}
def with_docs(extra_copy):
    out = sees({'G1A': g1, 'G1B': g1, 'G2A': b_only(), 'G2B': b_only()})
    for r, e in extra_copy.items():
        out[r] = {**out.get(r, {}), **e}
    return out
matrix('S17', 'Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission of copies', ALL,
       with_docs(copy_exp), revs=revs, docs=docs, ccs=[cc], cc_docs=[A['doc']])
b.shot('G2B', '/documents/controlled-copies/all', 'S17', 'recipient-controlled-copies', 'S17: G2B, the recipient, sees the Controlled Copy although the SOP is not in the rule of group 2')
b.shot('G2A', '/documents/controlled-copies/all', 'S17', 'group2-no-copy', 'S17: G2A (group 2, not the recipient) does not see the SOP copy')
set_config({'departmentRulesCopyRecipientAlwaysSees': False})
matrix('S17b', 'the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it', ALL,
       with_docs({'DCO': {'ccs': {cc}}, 'ADMIN': {'ccs': {cc}}, 'G1B': {'ccs': {cc}}}), revs=revs, docs=docs, ccs=[cc], cc_docs=[A['doc']])
set_config({'departmentRulesCopyRecipientAlwaysSees': True})

print('== S18 Uncontrolled Copy of document A (revision 2), for G2A')
if 'uc' not in A:
    body = {'documentId': A['doc'], 'revisionId': A['rev2'], 'reason': 'DV-TEST uncontrolled copy', 'recipientUserId': uid('G2A'), 'signatureToken': sign('DCO')}
    c, d, t = attempt('DCO', 'POST', '/uncontrolled-copies', body)
    check('S18.1', 'the DCO requests an Uncontrolled Copy for G2A', c == 200, t)
    A['uc'] = d['id']
    save(S)
uc = A['uc']
uc_exp = {'DCO': {'ucs': {uc}}, 'ADMIN': {'ucs': {uc}}, 'G1B': {'ucs': {uc}}, 'G2A': {'ucs': {uc}}}
matrix('S18', 'Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule)', ALL, with_docs({**copy_exp, **{r: {**copy_exp.get(r, {}), **e} for r, e in uc_exp.items()}}),
       revs=revs, docs=docs, ccs=[cc], ucs=[uc], cc_docs=[A['doc']], uc_docs=[A['doc']])
b.shot('G2A', '/documents/uncontrolled-copies/all', 'S18', 'recipient-uncontrolled-copies', 'S18: G2A, the recipient, sees the Uncontrolled Copy')
b.shot('G1B', '/documents/uncontrolled-copies/all', 'S18', 'group1-uncontrolled-copies', 'S18: G1B sees the copy because the SOP rule of the Head covers the copies of the SOP')

# ------------------------------------------------------------------ the three conveniences
print('== S19 "participants always see their records" switched off')
set_config({'departmentRulesParticipantsAlwaysSee': False})
matrix('S19', 'participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain', ALL,
       {**{r: {'documents': set(docs), 'revisions': set(revs)} for r in ('DCO', 'ADMIN', 'HEAD')}, 'G1A': g1, 'G1B': g1, 'G2A': b_only(), 'G2B': b_only()}, revs=revs, docs=docs)
set_config({'departmentRulesParticipantsAlwaysSee': True})
set_config({'departmentRulesHeadSeesDepartment': False})
matrix('S19b', 'the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give', ALL,
       sees({'G1A': g1, 'G1B': g1, 'G2A': b_only(), 'G2B': b_only()}, head=False), revs=revs, docs=docs)
set_config({'departmentRulesHeadSeesDepartment': True})

# ------------------------------------------------------------------ the other two modes
print('== S20 the older modes still behave as before')
set_config({'documentVisibilityMode': 'PARTICIPANTS_ONLY'})
matrix('S20a', 'Participants only: the flow and view-all; the Head and the groups see nothing', ALL, sees({}, head=False), revs=revs, docs=docs)
set_config({'documentVisibilityMode': 'ALL_WITH_VIEW_PERMISSION'})
everyone = {r: {'documents': set(docs), 'revisions': set(revs)} for r in ALL}
matrix('S20b', 'Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now)', ALL, everyone, revs=revs, docs=docs)
set_config({'documentVisibilityMode': 'DEPARTMENT_RULES'})
b.shot('ADMIN', '/documents/administration/properties', 'S20', 'document-properties-mode', 'S20: Document Properties > Record Visibility, with the three modes')

# ------------------------------------------------------------------ the Knowledge Base
print('== S21 Knowledge Base: the Effective documents each person may see')
def kb(role):
    c, d, t = attempt(role, 'GET', '/documents/knowledge-base')
    nums = set()
    for f in (d.get('folders') or []):
        for doc in f.get('documents', []):
            nums.add(doc.get('documentNumber') or doc.get('number'))
    return nums
for role, want_a, want_b in (('ADMIN', True, True), ('HEAD', True, True), ('AUTHOR', True, True), ('G1A', True, False), ('G1B', True, False), ('G2A', False, True), ('G2B', False, True)):
    n = kb(role)
    check('S21.' + role, f'Knowledge Base of {ROLES[role]}: SOP {A["number"]} {"listed" if want_a else "absent"}, Instruction {B["number"]} {"listed" if want_b else "absent"}',
          (A['number'] in n) == want_a and (B['number'] in n) == want_b, sorted(x for x in n if x and ('10413' in x or 'INS.0004' in x)))
b.shot('G1A', '/self-service/knowledge', 'S21', 'knowledge-group1', 'S21: the Knowledge Base of a group 1 member lists the SOP of Quality Control only')
b.shot('G2A', '/self-service/knowledge', 'S21', 'knowledge-group2', 'S21: the Knowledge Base of a group 2 member lists the Instruction only')

b.shot('HEAD', '/security/department-visibility', 'S22', 'head-rules-final', 'S22: the Head screen with the rules of the run')
save(S)
b.close()
print('stage 3 done')
