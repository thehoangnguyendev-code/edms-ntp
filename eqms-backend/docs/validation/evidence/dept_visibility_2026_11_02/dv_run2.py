"""Stage 2: the Department Head's groups. Group 1 sees the SOP, group 2 sees the Instruction; the administrator gives the module permission; a Deny; a higher Allow; the scope gate; revoking."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dv_lib import *

ALL = list(ROLES)
FLOW = {'DCO', 'ADMIN', 'AUTHOR', 'COAUTHOR', 'REVIEWER', 'APPROVER'}
BASE = FLOW | {'HEAD'}
S = load()
b = Browser()
A, B = S['A'], S['B']
docs, revs = [A['doc'], B['doc']], [A['rev1'], B['rev1']]
SOP, INS = 'Standard Operating Procedure', 'Instruction (Working Instruction, Drafting Instruction)'


def seesets(extra):
    """The people of the flow and the Head see both documents; `extra` adds role -> what else they see."""
    out = {r: {'documents': set(docs), 'revisions': set(revs)} for r in BASE}
    out.update(extra)
    return out


def only(role_docs):
    return {'documents': {x['doc'] for x in role_docs}, 'revisions': {x['rev1'] for x in role_docs}}


flush()
print('== S6 before any rule: nobody outside the flow sees anything, named or not')
matrix('S6', 'no rule yet; G1B, G2A, G2B also lack the module permission', ALL, seesets({}), revs=revs, docs=docs)

print('== S7 the Head makes two rules: group 1 -> every SOP, group 2 -> every Instruction')
c1, r1, t = make_rule('group 1 sees SOP', 'ALLOW', 10, 'DOCUMENT_TYPE', ['G1A', 'G1B'], resource_id=doc_type_id(SOP))
c2, r2, t2 = make_rule('group 2 sees Instruction', 'ALLOW', 10, 'DOCUMENT_TYPE', ['G2A', 'G2B'], resource_id=doc_type_id(INS))
check('S7.1', 'the Head creates the two rules (signed, audited)', c1 == 200 and c2 == 200, (c1, t[:150], c2, t2[:150]))
S['rule1'], S['rule2'] = r1.get('id'), r2.get('id')
save(S)
b.shot('HEAD', '/security/department-visibility', 'S7', 'head-rules-screen', 'S7: the Department Head lists the rules of Quality Control: group 1 for SOP, group 2 for Instruction')
matrix('S7', 'rules exist, but only G1A already holds the module permission', ALL, seesets({'G1A': only([A])}), revs=revs, docs=docs)
check('S7.2', 'a person named in a rule but without the module permission still sees nothing (G1B, G2A, G2B above)', True, '')

print('== S8 the administrator gives G1B, G2A and G2B the module permission')
grant_module(['G1B', 'G2A', 'G2B'])
flush()
matrix('S8', 'module permission granted', ALL, seesets({'G1A': only([A]), 'G1B': only([A]), 'G2A': only([B]), 'G2B': only([B])}), revs=revs, docs=docs)
b.shot('G1A', '/documents/all', 'S8', 'group1-documents', 'S8: a member of group 1 sees the SOP and not the Instruction')
b.shot('G2A', '/documents/all', 'S8', 'group2-documents', 'S8: a member of group 2 sees the Instruction and not the SOP')
b.shot('G1B', '/documents/revisions/all', 'S8', 'group1-revisions', 'S8: the revisions list of a group 1 member shows the SOP revision only')

print('== S9 a Deny: the Head hides the Effective revisions from one person (G1B), a higher priority than the Allow')
c3, r3, t3 = make_rule('G1B must not see Effective', 'DENY', 50, 'DOCUMENT_STATUS', ['G1B'], resource_name='EFFECTIVE')
check('S9.1', 'the Head creates a Deny rule for a status', c3 == 200, (c3, t3[:150]))
S['rule3'] = r3.get('id')
exp = seesets({'G1A': only([A]), 'G1B': {'documents': {A['doc']}, 'revisions': set()}, 'G2A': only([B]), 'G2B': only([B])})
matrix('S9', 'Deny EFFECTIVE for G1B', ALL, exp, revs=revs, docs=docs)

print('== S10 a higher Allow for the same person beats the Deny')
c4, r4, t4 = make_rule('G1B may see Effective SOP revisions again', 'ALLOW', 90, 'DOCUMENT_STATUS', ['G1B'], resource_name='EFFECTIVE')
S['rule4'] = r4.get('id')
# G1B now matches an Allow of priority 90 on every Effective revision, in any Department document: the rule is owned by Quality Control, so it opens the Effective revisions of Quality Control to G1B, both documents
exp = seesets({'G1A': only([A]), 'G1B': {'documents': {A['doc']}, 'revisions': {A['rev1'], B['rev1']}}, 'G2A': only([B]), 'G2B': only([B])})
matrix('S10', 'Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B', ALL, exp, revs=revs, docs=docs)
for rid in (S['rule4'], S['rule3']):
    check('S10.d', 'the Head deletes a rule', drop_rule(rid) == 204, rid)
matrix('S10b', 'both status rules deleted: back to the groups', ALL, seesets({'G1A': only([A]), 'G1B': only([A]), 'G2A': only([B]), 'G2B': only([B])}), revs=revs, docs=docs)

print('== S11 who may manage: only the Head of the Department')
c, d, t = attempt('G1A', 'POST', f'{API}/departments/{dept_id()}/rules', {'name': 'DV-TEST x', 'effect': 'ALLOW', 'priority': 1, 'active': True, 'resourceType': 'DEPARTMENT', 'granteeUserIds': [uid('G1A')], 'signatureToken': 'x'})
check('S11.1', 'an employee who is not the Head cannot make a rule for the Department (403)', c == 403, (c, t[:100]))
qa = sql("select id from departments where name='Quality Assurance'")[0][0]
c, d, t = attempt('HEAD', 'GET', f'{API}/departments/{qa}/rules')
check('S11.2', 'the Head of Quality Control cannot read or change the rules of Quality Assurance (403)', c == 403, (c, t[:100]))
c, d, t = attempt('G1A', 'GET', API + '/departments')
check('S11.3', 'an employee sees no Department to manage', c == 200 and d == [], (c, t[:100]))
b.shot('G1A', '/security/department-visibility', 'S11', 'employee-no-department', 'S11: an employee who is not a Department Head opens the screen and finds nothing to manage')

print('== S12 the scope of the Access Profile is a gate over every rule')
bk = json.load(open(os.path.join(HERE, 'backup.json'), encoding='utf-8'))
sql(f"update roles set department_scope='Logistics' where id='{bk['dv_role']}'")
time.sleep(2)
matrix('S12', 'profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected', ALL,
       seesets({'G1A': only([A])}), revs=revs, docs=docs)
sql(f"update roles set department_scope=null where id='{bk['dv_role']}'")
time.sleep(2)
matrix('S12b', 'scope removed: they see again', ALL, seesets({'G1A': only([A]), 'G1B': only([A]), 'G2A': only([B]), 'G2B': only([B])}), revs=revs, docs=docs)

print('== S13 revoking: the Head deletes the group 1 rule, then the administrator withdraws the module permission of G2A')
check('S13.1', 'the Head deletes the rule of group 1', drop_rule(S['rule1']) == 204, '')
matrix('S13', 'group 1 rule gone', ALL, seesets({'G2A': only([B]), 'G2B': only([B])}), revs=revs, docs=docs)
revoke_module(['G2A'])
flush()
matrix('S13b', 'the module permission of G2A withdrawn', ALL, seesets({'G2B': only([B])}), revs=revs, docs=docs)
grant_module(['G2A'])
flush()
c, r, t = make_rule('group 1 sees SOP (again)', 'ALLOW', 10, 'DOCUMENT_TYPE', ['G1A', 'G1B'], resource_id=doc_type_id(SOP))
S['rule1'] = r.get('id')
save(S)
b.close()
print('stage 2 done')
