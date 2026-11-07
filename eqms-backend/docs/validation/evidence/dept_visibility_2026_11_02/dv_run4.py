"""Stage 4: "Specific documents". Many documents of ONE type; the Head lets A see two of them and B see three. Needs stages 1-3."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dv_lib import *

ALL = list(ROLES)
FLOW = {'DCO', 'ADMIN', 'AUTHOR', 'COAUTHOR', 'REVIEWER', 'APPROVER'}
BASE = FLOW | {'HEAD'}
S = load()
b = Browser()
A, B = S['A'], S['B']
probe = json.load(open(os.path.join(HERE, 'probe.json')))
P = {'doc': probe['probe_doc'], 'rev1': probe['probe_rev']}

# ------------------------------------------------------------------ six new SOPs (Draft is enough to be seen), one new rule at a time
if 'sops' not in S:
    S['sops'] = []
    for n in range(1, 7):
        d = new_document(f'DV-TEST SOP number {n} of Quality Control')
        r = new_revision(d['id'])
        S['sops'].append({'doc': d['id'], 'rev1': r['id'], 'number': d['documentNumber']})
    save(S)
sop = S['sops']
print('SOPs:', [x['number'] for x in sop])
for n in (1, 2, 3, 4, 5, 6):
    pass

DOCS = [P['doc'], A['doc'], B['doc']] + [x['doc'] for x in sop]
REVS = [P['rev1'], A['rev1'], A['rev2'], B['rev1']] + [x['rev1'] for x in sop]


def view(*items):
    """The documents and revisions of the given records (dicts with doc and revs)."""
    return {'documents': {i['doc'] for i in items}, 'revisions': {r for i in items for r in i['revs']}}


def rec(x):
    return {'doc': x['doc'], 'revs': [x['rev1']] + ([x['rev2']] if x.get('rev2') else [])}


everything = view(*[rec(x) for x in (P, A, B)], *[rec(x) for x in sop])
flow_sees = {r: everything for r in BASE}
INS_GROUP = {'G2A': view(rec(B)), 'G2B': view(rec(B))}   # the Instruction rule of group 2 is still there


def mx(sid, label, extra, **kw):
    expect = dict(flow_sees)
    expect.update(INS_GROUP)
    expect.update(extra)
    return matrix(sid, label, ALL, expect, revs=REVS, docs=DOCS, **kw)


print('== S23 the rule "group 1 sees every SOP" is removed: nobody of group 1 sees any SOP (a rule per type no longer exists)')
if S.get('rule1'):
    check('S23.1', 'the Head deletes the rule "every SOP" of group 1', drop_rule(S['rule1']) == 204, '')
    S['rule1'] = None
    save(S)
mx('S23', 'ten SOPs and one Instruction of the Department; group 1 has no rule', {})
b.shot('G1A', '/documents/all', 'S23', 'G1A-no-rule', 'S23: with no rule, G1A sees none of the ten documents of Quality Control')

print('== S24 the Head names the documents: A sees SOP 1 and 2, B sees SOP 3, 4 and 5')
c1, ra, t1 = make_rule('A sees SOP 1 and 2', 'ALLOW', 10, 'DOCUMENT', ['G1A'], extra={'documentIds': [sop[0]['doc'], sop[1]['doc']]})
c2, rb, t2 = make_rule('B sees SOP 3, 4 and 5', 'ALLOW', 10, 'DOCUMENT', ['G1B'], extra={'documentIds': [sop[2]['doc'], sop[3]['doc'], sop[4]['doc']]})
check('S24.1', 'the Head creates the two rules of specific documents', c1 == 200 and c2 == 200, (c1, t1[:200], c2, t2[:200]))
S['ra'], S['rb'] = ra.get('id'), rb.get('id')
save(S)
mx('S24', 'A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both', {'G1A': view(rec(sop[0]), rec(sop[1])), 'G1B': view(rec(sop[2]), rec(sop[3]), rec(sop[4]))})
b.shot('HEAD', '/security/department-visibility', 'S24', 'head-document-rules', 'S24: the Head sees the rules of specific documents: A for SOP 1 and 2, B for SOP 3, 4 and 5')
b.shot('G1A', '/documents/all', 'S24', 'A-two-of-ten', 'S24: A (G1A) sees 2 of the 10 documents of the Department')
b.shot('G1B', '/documents/all', 'S24', 'B-three-of-ten', 'S24: B (G1B) sees 3 of the 10 documents of the Department')

print('== S25 a Deny on one document: B must not see SOP 4')
c, rd, t = make_rule('B must not see SOP 4', 'DENY', 50, 'DOCUMENT', ['G1B'], extra={'documentIds': [sop[3]['doc']]})
check('S25.1', 'the Head creates a Deny rule for one document', c == 200, t[:200])
mx('S25', 'B loses SOP 4 only', {'G1A': view(rec(sop[0]), rec(sop[1])), 'G1B': view(rec(sop[2]), rec(sop[4]))})
check('S25.2', 'the Head deletes the Deny rule', drop_rule(rd['id']) == 204, '')

print('== S26 a new SOP is made after the rules: the list does not widen by itself')
if 'sop7' not in S:
    d7 = new_document('DV-TEST SOP number 7 of Quality Control')
    r7 = new_revision(d7['id'])
    S['sop7'] = {'doc': d7['id'], 'rev1': r7['id'], 'number': d7['documentNumber']}
    save(S)
s7 = S['sop7']
DOCS.append(s7['doc'])
REVS.append(s7['rev1'])
everything = view(*[rec(x) for x in (P, A, B)], *[rec(x) for x in sop], rec(s7))
flow_sees = {r: everything for r in BASE}
mx('S26', 'SOP 7 is new: only the flow, the Head and view-all see it; A and B do not', {'G1A': view(rec(sop[0]), rec(sop[1])), 'G1B': view(rec(sop[2]), rec(sop[3]), rec(sop[4]))})

print('== S27 the rules are checked on the server')
dept = dept_id()
qa = sql("select x.id from documents x join departments d on d.id=x.department_id where d.name='Quality Assurance' limit 1")[0][0]
c, d, t = make_rule('DV-TEST wrong department', 'ALLOW', 10, 'DOCUMENT', ['G1A'], extra={'documentIds': [qa]})
check('S27.1', 'a document of another Department cannot be named (400)', c == 400, (c, t[:150]))
import uuid
c, d, t = make_rule('DV-TEST too many', 'ALLOW', 10, 'DOCUMENT', ['G1A'], extra={'documentIds': [str(uuid.uuid4()) for _ in range(201)]})
check('S27.2', 'more than 200 documents are refused (400)', c == 400 and '200' in t, (c, t[:200]))
c, d, t = make_rule('DV-TEST none', 'ALLOW', 10, 'DOCUMENT', ['G1A'], extra={'documentIds': []})
check('S27.3', 'a rule of specific documents without a document is refused (400)', c == 400, (c, t[:150]))
c, d, t = make_rule('DV-TEST unknown document', 'ALLOW', 10, 'DOCUMENT', ['G1A'], extra={'documentIds': [str(uuid.uuid4())]})
check('S27.4', 'an unknown document is refused (400)', c == 400, (c, t[:150]))

print('== S28 the picker searches on the server, inside the Department')
c, d, t = attempt('HEAD', 'GET', f'{API}/departments/{dept}/documents?search=' + urllib.parse.quote('SOP number 4') + '&limit=20')
check('S28.1', 'a search by name finds the document of the Department', c == 200 and any('number 4' in (x.get('documentName') or '') for x in d), (c, str(d)[:200]))
c, d, t = attempt('HEAD', 'GET', f'{API}/departments/{dept}/documents?search=&limit=5')
check('S28.2', 'a search without text returns at most the limit', c == 200 and len(d) <= 5, (c, len(d) if isinstance(d, list) else t[:100]))
c, d, t = attempt('HEAD', 'GET', f'{API}/departments/{dept}/documents?search=' + urllib.parse.quote('%') + '&limit=20')
check('S28.3', 'the character % is searched as text, not as a wildcard', c == 200 and d == [], (c, str(d)[:150]))
c, d, t = attempt('G1A', 'GET', f'{API}/departments/{dept}/documents?search=SOP&limit=20')
check('S28.4', 'a user who is not the Head cannot search (403)', c == 403, (c, t[:100]))
nums = [x.get('documentNumber') for x in (attempt('HEAD', 'GET', f'{API}/departments/{dept}/documents?search=DV-TEST&limit=50')[1] or [])]
deps = {r[0] for r in sql("select distinct d.name from documents x join departments d on d.id=x.department_id where x.document_number in (" + ",".join("'" + n + "'" for n in nums if n) + ")")} if nums else set()
check('S28.5', 'every document found belongs to Quality Control', deps == {DEPT}, deps)

print('== S29 a rule of specific documents also covers the copies of those documents')
c, rc, t = make_rule('B may see everything of the SOP of the run', 'ALLOW', 10, 'DOCUMENT', ['G1B'], extra={'documentIds': [A['doc']]})
check('S29.1', 'the Head names document A (SOP of the run) for B', c == 200, t[:150])
cc, uc = A['cc'], A['uc']
exp_copy = {'DCO': {'ccs': {cc}, 'ucs': {uc}}, 'ADMIN': {'ccs': {cc}, 'ucs': {uc}}, 'G1B': {'ccs': {cc}, 'ucs': {uc}}, 'G2B': {'ccs': {cc}}, 'G2A': {'ucs': {uc}}}
exp = {}
for r in ALL:
    exp[r] = {**(flow_sees.get(r) or {}), **(INS_GROUP.get(r) or {})}
exp['G1A'] = view(rec(sop[0]), rec(sop[1]))
exp['G1B'] = view(rec(sop[2]), rec(sop[3]), rec(sop[4]), rec(A))
for r, e in exp_copy.items():
    exp[r] = {**exp.get(r, {}), **e}
matrix('S29', 'B also sees document A, its revisions and its two copies; the recipients still see their copy', ALL, exp, revs=REVS, docs=DOCS, ccs=[cc], ucs=[uc], cc_docs=[A['doc']], uc_docs=[A['doc']])
b.shot('G1B', '/documents/controlled-copies/all', 'S29', 'B-copy-by-document-rule', 'S29: B sees the Controlled Copy of document A because the rule names that document')
check('S29.2', 'the Head deletes the rule', drop_rule(rc['id']) == 204, '')

print('== S30 cleaning up the rules of the run')
for rid in (S.get('ra'), S.get('rb')):
    if rid:
        check('S30', 'the Head deletes a rule of specific documents', drop_rule(rid) == 204, rid)
mx('S30z', 'no rule of group 1 left: group 1 sees nothing again', {})

# the picture of the form
def open_form(pg):
    pg.get_by_role('button', name='New Rule').click()
    pg.wait_for_timeout(1200)
    pg.get_by_text('Whole Department').first.click()
    pg.wait_for_timeout(600)
    pg.get_by_text('Specific documents', exact=True).first.click()
    pg.wait_for_timeout(800)
b.shot('HEAD', '/security/department-visibility', 'S31', 'form-specific-documents', 'S31: the form of a rule with the target "Specific documents" and the search picker', action=open_form)
b.close()
save(S)
print('stage 4 done')
