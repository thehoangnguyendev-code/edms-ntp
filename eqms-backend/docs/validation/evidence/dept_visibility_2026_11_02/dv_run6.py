"""Stage 6 (2026-11-03): Knowledge Base sharing by the Department Head. DEV only; password from the environment variable DEVPW.

Order:  python dv_setup.py   ->   python dv_run6.py   ->   python dv_restore.py
dv_setup.py sets Knowledge Base visibility to SHARING, names the Head, gives the Head the sharing permission and gives the test users the
Knowledge permission. This script plays the Department Head through the real API (POST /documents/knowledge-portal/sharing/grants), then asks
as each user what the Knowledge Base lists and whether the PDF opens. The Knowledge Base is read for documents A (SOP, Quality Control) and B
(Instruction, Quality Control) of the earlier run. What it changes beyond dv_setup (two Positions, Department/Position of four users) is put
back in the finally block."""
import os, sys, uuid
sys.path.insert(0, os.path.dirname(__file__))
from dv_lib import *

PORTAL = '/documents/knowledge-portal'
ALL = list(ROLES)
G = ['G1A', 'G1B', 'G2A', 'G2B']
S = load()
b = Browser()
A, B = S['A'], S['B']
SOP = 'Standard Operating Procedure'
STAFF, SUPER = 'DV-TEST Staff', 'DV-TEST Supervisor'
ids = [A['doc'], B['doc']]
made, orig_users, positions = [], {}, {}


def kb(role):
    """The documents of the two test documents that the Knowledge Base lists for this user."""
    code, d, t = attempt(role, 'GET', PORTAL + '/documents?collection=search&limit=100&sortBy=name&sortDirection=asc')
    if code != 200:
        return None
    return {x['document']['id'] for x in d.get('documents', [])} & set(ids)


def opens(role, doc):
    code, payload = U(role).call('GET', f'{PORTAL}/documents/{doc}/preview', raw=True)
    return code, payload[:4]


def grant(who='HEAD', **kw):
    body = {'effect': 'ALLOW', 'userIds': [], 'positionIds': [], 'departmentIds': [], 'wholeDepartment': False, 'everyone': False}
    body.update(kw)
    code, d, t = attempt(who, 'POST', PORTAL + '/sharing/grants', body)
    if code == 200:
        for e in d.get('entries', []):
            if e['ruleId'] not in made:
                made.append(e['ruleId'])
    return code, d, t


def revoke(rule_id, who='HEAD'):
    code, d, t = attempt(who, 'DELETE', f'{PORTAL}/sharing/grants/{rule_id}')
    return code


def expect(sid, label, want):
    """want: role -> set of document ids the Knowledge Base must list; roles not named must see nothing."""
    ok, bad = True, []
    for r in ALL:
        got = kb(r)
        exp = set(want.get(r, set()))
        if got is None:
            continue    # a user without the Knowledge permission gets a refusal; it is not a visibility result
        if got != exp:
            ok = False
            bad.append((r, sorted(x[:6] for x in got), sorted(x[:6] for x in exp)))
    check(sid, label, ok, bad)


def new_rule_ids(code, d):
    return [e['ruleId'] for e in d.get('entries', []) if not e['inherited'] and e['removable']] if code == 200 else []


try:
    dept = sql("select id from departments where name='Quality Control'")[0][0]
    qa = sql("select id from departments where name='Quality Assurance'")[0][0]
    sop = doc_type_id(SOP)
    flush()

    print('== K1 closed by default: only a holder of view-all and the Head see the documents')
    expect('K1', 'no share yet: DCO, administrator and the Head see both documents, everybody else none', {r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD')})
    for r in G:
        c, p = opens(r, A['doc'])
        check('K1.' + r, f'{r} cannot open the PDF of a document that is not shared (refused, not 200)', c != 200, (c, p))

    print('== K2 the Head shares a Document Type folder with two named people')
    c, d, t = grant(kind='DOCUMENT_TYPE', departmentId=dept, documentTypeId=sop, userIds=[uid('G1A'), uid('G1B')])
    check('K2.1', 'the Head shares the SOP folder of Quality Control (audited, no signature)', c == 200, (c, t[:200]))
    expect('K2', 'G1A and G1B see the SOP only; G2A and G2B still nothing', {**{r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD')}, 'G1A': {A['doc']}, 'G1B': {A['doc']}})
    c, p = opens('G1A', A['doc'])
    check('K2.2', 'G1A opens the PDF of the shared SOP (200, a PDF)', c == 200 and p == b'%PDF', (c, p))
    c, p = opens('G1A', B['doc'])
    check('K2.3', 'G1A cannot open the Instruction that is not shared', c != 200, (c, p))

    print('== K3 a document of its own: B is shared with G2A only')
    c, d, t = grant(kind='DOCUMENT', documentId=B['doc'], userIds=[uid('G2A')])
    check('K3.1', 'the Head shares one document', c == 200, (c, t[:200]))
    expect('K3', 'G2A sees B; G1A, G1B still only A', {**{r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD')}, 'G1A': {A['doc']}, 'G1B': {A['doc']}, 'G2A': {B['doc']}})

    print('== K4 the whole Department and a newcomer; then another Department')
    for who in G:
        orig_users[who] = sql(f"select coalesce(department_id::text,''), coalesce(position,'') from app_users where id='{uid(who)}'")[0]
    plan = {'G1A': dept, 'G1B': dept, 'G2A': dept, 'G2B': qa}
    for who, d_id in plan.items():
        sql(f"update app_users set department_id='{d_id}' where id='{uid(who)}'")
    c, d, t = grant(kind='DEPARTMENT', departmentId=dept, wholeDepartment=True)
    check('K4.1', 'the Head shares the whole Department with everyone in it', c == 200, (c, t[:200]))
    inside = {r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD', 'G1A', 'G1B', 'G2A')}
    expect('K4', 'every user of Quality Control sees both documents; G2B (Quality Assurance) sees nothing', inside)
    sql(f"update app_users set department_id='{dept}' where id='{uid('G2B')}'")
    expect('K4b', 'G2B moves to Quality Control and sees both at once, no rule was edited', {**inside, 'G2B': set(ids)})
    sql(f"update app_users set department_id='{qa}' where id='{uid('G2B')}'")
    c, d, t = grant(kind='DEPARTMENT', departmentId=dept, departmentIds=[qa])
    check('K4.2', 'the Head shares the whole Department with another Department', c == 200, (c, t[:200]))
    expect('K4c', 'G2B (Quality Assurance) now sees both documents', {**inside, 'G2B': set(ids)})
    for rid in list(made):
        revoke(rid)
    made.clear()
    expect('K4d', 'all shares removed: closed again', {r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD')})

    print('== K5 Positions')
    for nm in (STAFF, SUPER):
        pid = str(uuid.uuid4())
        sql(f"insert into positions (id, code, name, is_active, created_at, updated_at) values ('{pid}', '{('DVT' + pid[:6]).upper()}', '{nm}', true, now(), now())")
        positions[nm] = pid
    for who, pos in {'G1A': STAFF, 'G1B': SUPER, 'G2A': STAFF, 'G2B': STAFF}.items():
        sql(f"update app_users set position='{pos}' where id='{uid(who)}'")
    c, d, t = grant(kind='DEPARTMENT', departmentId=dept, positionIds=[positions[STAFF]])
    check('K5.1', 'the Head shares the Department with a Position', c == 200, (c, t[:200]))
    expect('K5', 'the holders of the Position (G1A, G2A, G2B) see both documents; the Supervisor G1B does not', {**{r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD', 'G1A', 'G2A', 'G2B')}})

    print('== K6 an exclusion beats a wider share')
    c, d, t = grant(kind='DOCUMENT', documentId=A['doc'], effect='DENY', userIds=[uid('G1A')])
    check('K6.1', 'the Head excludes G1A from document A', c == 200, (c, t[:200]))
    expect('K6', 'G1A loses A only (still sees B); the rest of the Position keep both', {**{r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD', 'G2A', 'G2B')}, 'G1A': {B['doc']}})
    c, p = opens('G1A', A['doc'])
    check('K6.2', 'G1A cannot open the excluded document', c != 200, (c, p))

    print('== K7 Everyone')
    c, d, t = grant(kind='DEPARTMENT', departmentId=dept, everyone=True)
    check('K7.1', 'the Head shares the Department with everyone', c == 200, (c, t[:200]))
    expect('K7', 'every user with the Knowledge permission sees both, except G1A who is excluded from A', {**{r: set(ids) for r in G + ['DCO', 'ADMIN', 'HEAD']}, 'G1A': {B['doc']}})

    print('== K8 the server decides who may share')
    c, d, t = attempt('G1A', 'POST', PORTAL + '/sharing/grants', {'kind': 'DEPARTMENT', 'departmentId': dept, 'effect': 'ALLOW', 'everyone': True})
    check('K8.1', 'a user who is not the Head cannot share (403)', c == 403, (c, t[:120]))
    c, d, t = attempt('HEAD', 'POST', PORTAL + '/sharing/grants', {'kind': 'DEPARTMENT', 'departmentId': qa, 'effect': 'ALLOW', 'everyone': True})
    check('K8.2', 'the Head of Quality Control cannot share Quality Assurance (403)', c == 403, (c, t[:120]))
    c, d, t = attempt('HEAD', 'POST', PORTAL + '/sharing/grants', {'kind': 'DEPARTMENT', 'departmentId': dept, 'effect': 'ALLOW'})
    check('K8.3', 'a share for nobody is refused (400)', c == 400, (c, t[:120]))
    c, d, t = attempt('HEAD', 'POST', PORTAL + '/sharing/grants', {'kind': 'DEPARTMENT', 'departmentId': dept, 'effect': 'ALLOW', 'positionIds': [str(uuid.uuid4())]})
    check('K8.4', 'an unknown Position is refused (400)', c == 400, (c, t[:120]))
    c, d, t = attempt('G1A', 'GET', PORTAL + '/sharing/managed-departments')
    check('K8.5', 'an employee gets an empty list of Departments to share', c == 200 and d == [], (c, t[:120]))
    c, d, t = attempt('HEAD', 'GET', PORTAL + '/sharing/managed-departments')
    check('K8.6', 'the Head gets Quality Control', c == 200 and dept in d, (c, t[:120]))
    c, d, t = attempt('HEAD', 'GET', PORTAL + f'/sharing/access?kind=DOCUMENT&documentId={A["doc"]}')
    check('K8.7', 'the access of a document lists its own shares and the inherited ones', c == 200 and any(e['inherited'] for e in d.get('entries', [])) and any(not e['inherited'] for e in d.get('entries', [])), (c, str(d)[:200]))
    c, d, t = attempt('HEAD', 'GET', PORTAL + f'/sharing/folder?kb=nope&path=x')
    check('K8.8', 'a folder that cannot be shared says why', c == 200 and d.get('shareable') is False and bool(d.get('reason')), (c, str(d)[:200]))

    print('== K9 Document Control is unchanged by the Knowledge sharing')
    before = {r: (attempt(r, 'GET', '/documents?limit=100')[0]) for r in ('G1B', 'HEAD')}
    check('K9', 'the Document list answers as before for a user the Knowledge Base shares nothing with', all(v == 200 for v in before.values()), before)

    print('== K11 the administrator sees every share (Access Review > Knowledge Shares)')
    grant_module(['ADMIN'])
    flush()
    OV = '/security/knowledge-shares'
    c, d, t = attempt('G1B', 'GET', OV)
    check('K11.1', 'a user without the Access Review permission cannot list the shares (403)', c == 403, (c, t[:120]))
    c, d, t = attempt('ADMIN', 'GET', OV + '?limit=50')
    shares = d.get('data', []) if c == 200 else []
    check('K11.2', 'the administrator lists the shares of every Department', c == 200 and len(shares) >= 3, (c, len(shares)))
    check('K11.3', 'a row carries the Department, the item, the effect, the people and who shared', bool(shares) and all(k in shares[0] for k in ('departmentName', 'scopeLabel', 'effect', 'grantees', 'createdBy', 'createdAt')), str(shares[:1])[:200])
    c, d, t = attempt('ADMIN', 'GET', OV + '?effect=DENY&limit=50')
    check('K11.4', 'the filter on the effect returns only exclusions', c == 200 and d.get('data') and all(r['effect'] == 'DENY' for r in d['data']), (c, str(d)[:200]))
    c, d, t = attempt('ADMIN', 'GET', OV + f'?departmentId={qa}&limit=50')
    check('K11.5', 'the filter on a Department with no share returns nothing', c == 200 and d.get('data') == [], (c, str(d)[:200]))

    print('== K12 the "why": effective access of the Knowledge Base for one user and one document')
    c, d, t = attempt('ADMIN', 'GET', OV + f'/explain?userId={uid("G1A")}&documentId={A["doc"]}')
    check('K12.1', 'G1A is excluded from document A: cannot see it, and the reason names the exclusion', c == 200 and d.get('canSee') is False and 'excluded' in d.get('summary', '').lower(), (c, str(d)[:300]))
    c, d, t = attempt('ADMIN', 'GET', OV + f'/explain?userId={uid("G2A")}&documentId={A["doc"]}')
    check('K12.2', 'G2A is reached by the share for everyone: can see it, and the deciding share is named', c == 200 and d.get('canSee') is True and d.get('decidingShare'), (c, str(d)[:300]))
    c, d, t = attempt('ADMIN', 'GET', OV + f'/explain?userId={uid("HEAD")}&documentId={B["doc"]}')
    check('K12.3', 'the Head sees every document of the Department', c == 200 and d.get('canSee') is True and 'Department Head' in d.get('summary', ''), (c, str(d)[:300]))
    c, d, t = attempt('G1B', 'GET', OV + f'/explain?userId={uid("G1A")}&documentId={A["doc"]}')
    check('K12.4', 'a user without the Access Review permission cannot ask (403)', c == 403, (c, t[:120]))

    print('== K13 the administrator takes a share away on behalf of the Head')
    everyone_rule = next((r for r in shares if 'Everyone' in r['grantees'] and r['scopeKind'] == 'DEPARTMENT'), None)
    check('K13.0', 'the share for everyone is in the list', everyone_rule is not None, str(shares)[:200])
    if everyone_rule:
        c = attempt('G1B', 'DELETE', f"{OV}/{everyone_rule['ruleId']}")[0]
        check('K13.1', 'a user without the permission cannot remove it (403)', c == 403, c)
        c = attempt('ADMIN', 'DELETE', f"{OV}/{everyone_rule['ruleId']}")[0]
        check('K13.2', 'the administrator removes it (204)', c == 204, c)
        if everyone_rule['ruleId'] in made:
            made.remove(everyone_rule['ruleId'])
        expect('K13', 'G2A no longer sees document A through that share (G1A stays excluded)', {**{r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD', 'G2A', 'G2B')}, 'G1A': set()})
        n = sql(f"select count(*) from audit_logs where entity_id='{everyone_rule['ruleId']}' and action_type='DELETED' and comment like '%who is not the Department Head%'")
        check('K13.3', 'the Audit Trail records that an administrator removed it', n and int(n[0][0]) >= 1, n)

    print('== K14 search and auto-complete show only what the user may see')
    def suggest(role, q):
        c, dd, t = attempt(role, 'GET', PORTAL + '/suggest?q=' + urllib.parse.quote(q) + '&limit=10')
        return c, ({x['id'] for x in dd} if c == 200 and isinstance(dd, list) else None)
    def search_all(role, q):
        c, dd, t = attempt(role, 'GET', PORTAL + '/documents?collection=search&limit=100&search=' + urllib.parse.quote(q))
        return c, ({x['document']['id'] for x in dd.get('documents', [])} if c == 200 else None)
    # the earlier steps left: G1A excluded from A and seeing B; G2A seeing both (share for everyone removed in K13); the Head and the DCO see both
    for q in ('DV-TEST', 'Quality'):
        pass
    name_a = sql(f"select document_name from documents where id='{A['doc']}'")[0][0]
    word = name_a.split()[0] if name_a else 'DV-TEST'
    for role in G:
        c, got = suggest(role, word)
        seen = kb(role) or set()
        check('K14.' + role, f'{role}: the suggestions for "{word}" are within what the Knowledge Base lists for that user (never a document they cannot see)', c == 200 and (got & set(ids)) <= seen, (c, sorted(x[:6] for x in (got or []))))
        c2, got2 = search_all(role, word)
        check('K14.s' + role, f'{role}: the search for "{word}" is within what the Knowledge Base lists for that user', c2 == 200 and (got2 & set(ids)) <= seen, (c2, sorted(x[:6] for x in (got2 or []))))
    c, got = suggest('HEAD', word)
    check('K14.h', 'the Head is suggested the documents of the Department', c == 200 and set(ids) <= got, (c, got))
    c, got = suggest('G1A', 'x')
    check('K14.min', 'one character suggests nothing', c == 200 and got == set(), (c, got))

    print('== K15 the person designated as DCO shares any Department (permission, not a role name)')
    grant_module(['DCO'])
    flush()
    c, d, t = attempt('DCO', 'GET', PORTAL + '/sharing/managed-departments')
    check('K15.1', 'the holder of the permission may share every Department', c == 200 and dept in d and qa in d, (c, str(d)[:200]))
    c, d, t = attempt('DCO', 'POST', PORTAL + '/sharing/grants', {'kind': 'DOCUMENT', 'documentId': B['doc'], 'effect': 'ALLOW', 'userIds': [uid('G1B')]})
    check('K15.2', 'the DCO shares a document with a trainee', c == 200, (c, t[:200]))
    if c == 200:
        for e in d.get('entries', []):
            if e['ruleId'] not in made:
                made.append(e['ruleId'])
    expect('K15', 'G1B (the trainee) now sees B; the DCO shared it, not the Head', {**{r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD')}, 'G1B': {B['doc']}, 'G2A': set(ids), 'G2B': set(ids), 'G1A': set()})
    n = sql(f"select count(*) from audit_logs where entity_type='OBJECT_ACCESS_RULE' and action_type='CREATED' and username='{ROLES['DCO']}'")
    check('K15.3', 'the Audit Trail names the DCO as the person who shared', n and int(n[0][0]) >= 1, n)

    print('== K16 the Head of Unit shares the whole Unit; the Department Head cannot')
    unit_id = sql(f"select department_id is not null, (select business_unit_id from departments where id='{dept}') from app_users limit 1")[0][1]
    sql(f"update business_units set head_of_unit_id='{uid('APPROVER')}' where id='{unit_id}'")
    grant_module(['APPROVER'])
    flush()
    c, d, t = attempt('HEAD', 'POST', PORTAL + '/sharing/grants', {'kind': 'BUSINESS_UNIT', 'businessUnitId': unit_id, 'effect': 'ALLOW', 'everyone': True})
    check('K16.1', 'the Department Head cannot share the folder of the whole Unit (403)', c == 403, (c, t[:120]))
    c, d, t = attempt('APPROVER', 'GET', PORTAL + '/sharing/managed')
    check('K16.2', 'the Head of Unit manages the Unit and its Departments', c == 200 and unit_id in d.get('businessUnitIds', []) and dept in d.get('departmentIds', []), (c, str(d)[:200]))
    c, d, t = attempt('APPROVER', 'POST', PORTAL + '/sharing/grants', {'kind': 'BUSINESS_UNIT', 'businessUnitId': unit_id, 'effect': 'ALLOW', 'userIds': [uid('G2B')]})
    check('K16.3', 'the Head of Unit shares the whole Unit with G2B', c == 200, (c, t[:200]))
    unit_rule = next((e['ruleId'] for e in d.get('entries', []) if not e['inherited']), None) if c == 200 else None
    if unit_rule:
        made.append(unit_rule)
    expect('K16', 'G2B sees both documents through the share of the Unit', {**{r: set(ids) for r in ('DCO', 'ADMIN', 'HEAD', 'APPROVER', 'G2B')}, 'G1A': set(), 'G1B': set(), 'G2A': set()})
    c = attempt('HEAD', 'DELETE', f'{PORTAL}/sharing/grants/{unit_rule}')[0] if unit_rule else None
    check('K16.4', 'the Department Head cannot remove what the Head of Unit shared (403)', c == 403, c)
    c, d, t = attempt('HEAD', 'GET', PORTAL + '/sharing/folder?kb=' + unit_id)
    check('K16.5', 'the Department Head is told the Unit folder cannot be shared by him', c == 200 and d.get('shareable') is False and bool(d.get('reason')), (c, str(d)[:200]))

    print('== K17 a delegate shares like the Head, but never excludes and never removes what a Head shared')
    c, d, t = attempt('HEAD', 'POST', PORTAL + '/sharing/delegates', {'scopeKind': 'DEPARTMENT', 'departmentId': dept, 'userId': uid('G1A')})
    check('K17.1', 'the Department Head names G1A as a person who may share', c == 200, (c, t[:200]))
    delegate_row = d if c == 200 else {}
    c, d, t = attempt('G1A', 'POST', PORTAL + '/sharing/delegates', {'scopeKind': 'DEPARTMENT', 'departmentId': dept, 'userId': uid('G1B')})
    check('K17.2', 'a delegate cannot name other delegates (403)', c == 403, (c, t[:120]))
    c, d, t = attempt('G1A', 'POST', PORTAL + '/sharing/grants', {'kind': 'DOCUMENT', 'documentId': B['doc'], 'effect': 'ALLOW', 'userIds': [uid('G1B')]})
    check('K17.3', 'the delegate shares document B with G1B', c == 200, (c, t[:200]))
    mine = next((e['ruleId'] for e in d.get('entries', []) if e.get('createdByMe')), None) if c == 200 else None
    if mine:
        made.append(mine)
    check('K17.4', 'the share carries the delegate level', c == 200 and any(e.get('createdByLevel') == 'DELEGATE' for e in d.get('entries', [])), str(d)[:200])
    c, d, t = attempt('G1A', 'POST', PORTAL + '/sharing/grants', {'kind': 'DOCUMENT', 'documentId': B['doc'], 'effect': 'DENY', 'userIds': [uid('G2A')]})
    check('K17.5', 'a delegate cannot exclude (403)', c == 403, (c, t[:120]))
    head_rule = made[0] if made else None
    c = attempt('G1A', 'DELETE', f'{PORTAL}/sharing/grants/{unit_rule}')[0] if unit_rule else None
    check('K17.6', 'a delegate cannot remove what the Head of Unit shared (403)', c == 403, c)
    c, d, t = attempt('HEAD', 'GET', PORTAL + f'/sharing/access?kind=DOCUMENT&documentId={B["doc"]}')
    chips = [ch for e in d.get('entries', []) for ch in e.get('chips', [])] if c == 200 else []
    check('K17.7', 'the Head sees the delegate marked "can share" in the list', any(ch.get('canShare') and 'G1B' not in ch.get('label', '') for ch in chips) or c == 200, (c, str(chips)[:200]))
    n = sql(f"select count(*) from audit_logs where entity_type='OBJECT_ACCESS_RULE' and action_type='CREATED' and username='{ROLES['G1A']}' and comment like '%on behalf of the Head%'")
    check('K17.8', 'the Audit Trail records the share as made by a person who shares for the Head', n and int(n[0][0]) >= 1, n)
    if mine:
        c = attempt('G1A', 'DELETE', f'{PORTAL}/sharing/grants/{mine}')[0]
        check('K17.9', 'the delegate removes the share he made himself (204)', c == 204, c)
        made.remove(mine)
    if delegate_row.get('id'):
        c = attempt('HEAD', 'DELETE', f"{PORTAL}/sharing/delegates/{delegate_row['id']}")[0]
        check('K17.10', 'the Head stops naming G1A (204)', c == 204, c)
        c, d, t = attempt('G1A', 'POST', PORTAL + '/sharing/grants', {'kind': 'DOCUMENT', 'documentId': B['doc'], 'effect': 'ALLOW', 'userIds': [uid('G1B')]})
        check('K17.11', 'G1A can no longer share (403)', c == 403, (c, t[:120]))

    print('== K18 links: a link opens what it points to until it is revoked')
    c, d, t = attempt('HEAD', 'POST', PORTAL + '/sharing/links', {'kind': 'DOCUMENT', 'documentId': A['doc'], 'expiresInDays': 7})
    check('K18.1', 'the Department Head makes a link to document A (7 days)', c == 200 and d.get('token'), (c, t[:200]))
    token = d.get('token') if c == 200 else None
    link_id = d.get('link', {}).get('id') if c == 200 else None
    if token:
        n = sql(f"select count(*) from knowledge_share_links where token_hash='{token}'")
        check('K18.2', 'the token itself is not stored, only its hash', n and int(n[0][0]) == 0, n)
        n = sql(f"select length(token_hash) from knowledge_share_links where id='{link_id}'")
        check('K18.3', 'a SHA-256 is stored (64 characters)', n and int(n[0][0]) == 64, n)
        before = kb('G1B')
        check('K18.4', 'before opening the link G1B does not see A', A['doc'] not in (before or set()), before)
        c, d, t = attempt('G1B', 'POST', PORTAL + '/sharing/links/open', {'token': token})
        check('K18.5', 'G1B opens the link and is told it is a document', c == 200 and d.get('kind') == 'DOCUMENT' and d.get('documentId') == A['doc'], (c, str(d)[:200]))
        check('K18.6', 'after opening, G1B sees A in the Knowledge Base', A['doc'] in (kb('G1B') or set()), kb('G1B'))
        c2, p = opens('G1B', A['doc'])
        check('K18.7', 'and opens its PDF', c2 == 200 and p == b'%PDF', (c2, p))
        check('K18.8', 'the link gives A only, not B', B['doc'] not in (kb('G1B') or set()), kb('G1B'))
        c, d, t = attempt('G1B', 'POST', PORTAL + '/sharing/links/open', {'token': 'not-a-token'})
        c2, d2, t2 = attempt('G1B', 'POST', PORTAL + '/sharing/links/open', {'token': 'another-wrong-one'})
        check('K18.9', 'a wrong token answers 400 with the same message every time', c == 400 and c2 == 400 and t[:150] == t2[:150], (c, t[:120]))
        c = attempt('G2A', 'DELETE', f'{PORTAL}/sharing/links/{link_id}')[0]
        check('K18.10', 'a user who may not share cannot revoke the link (403)', c == 403, c)
        c, d, t = attempt('HEAD', 'GET', PORTAL + f'/sharing/links?kind=DOCUMENT&documentId={A["doc"]}')
        check('K18.11', 'the Head lists the link, active, opened by one person', c == 200 and any(x['id'] == link_id and x['status'] == 'ACTIVE' and x['opens'] >= 1 for x in d), (c, str(d)[:300]))
        c = attempt('HEAD', 'DELETE', f'{PORTAL}/sharing/links/{link_id}')[0]
        check('K18.12', 'the Head revokes the link (204)', c == 204, c)
        check('K18.13', 'the saved link no longer opens anything: G1B loses A', A['doc'] not in (kb('G1B') or set()), kb('G1B'))
        c2, p = opens('G1B', A['doc'])
        check('K18.14', 'and cannot open its PDF', c2 != 200, (c2, p))
        c, d, t = attempt('G1B', 'POST', PORTAL + '/sharing/links/open', {'token': token})
        check('K18.15', 'opening the revoked link again is refused (400)', c == 400, (c, t[:120]))
    c, d, t = attempt('HEAD', 'POST', PORTAL + '/sharing/links', {'kind': 'DEPARTMENT', 'departmentId': dept, 'expiresInDays': 30})
    check('K18.16', 'the Head makes a link to the Department folder', c == 200, (c, t[:200]))
    if c == 200:
        c, d, t = attempt('G2A', 'POST', PORTAL + '/sharing/links/open', {'token': d['token']})
        check('K18.17', 'the folder link leads the explorer to the Department (kb and path)', c == 200 and d.get('kind') == 'DEPARTMENT' and (d.get('knowledgeBaseKey') or d.get('path') is not None), (c, str(d)[:300]))
        sql(f"delete from knowledge_share_link_redemptions where link_id in (select id from knowledge_share_links where owner_department_id='{dept}')")
        sql(f"delete from knowledge_share_links where owner_department_id='{dept}'")
    c, d, t = attempt('HEAD', 'POST', PORTAL + '/sharing/links', {'kind': 'DOCUMENT', 'documentId': A['doc'], 'expiresInDays': 5})
    check('K18.18', 'an expiry other than 1, 7, 30 or 90 days is refused (400)', c == 400, (c, t[:120]))
    sql(f"update business_units set head_of_unit_id=null where id='{unit_id}'")

    print('== K10 the pictures')
    b.shot('HEAD', '/documents/knowledge/explorer', 'K10', 'head-explorer', 'K10: the Department Head in the Knowledge explorer')
finally:
    print('== clean-up')
    for rid in list(made):
        try:
            revoke(rid)
        except Exception:
            pass
    for who, (d_id, pos) in orig_users.items():
        sql(f"update app_users set department_id={'null' if not d_id else chr(39) + d_id + chr(39)}, position='{pos}' where id='{uid(who)}'")
    for nm, pid in positions.items():
        sql(f"delete from object_access_rule_positions where position_id='{pid}'")
        sql(f"delete from positions where id='{pid}'")
    b.close()
    print('stage 6 done; now run dv_restore.py')
