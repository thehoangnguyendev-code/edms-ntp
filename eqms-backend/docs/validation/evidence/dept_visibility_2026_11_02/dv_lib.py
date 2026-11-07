"""Shared helpers of the Department rules visibility run of 2026-11-02 (DEV only). The password comes from the environment variable DEVPW (never written).
Everything created is titled "DV-TEST ..." and is left in place (nothing is deleted); the DEV settings changed for the run are put back by dv_restore.py from backup.json."""
import os, sys, json, io, re, time, zipfile, datetime, subprocess, urllib.parse
from concurrent.futures import ThreadPoolExecutor
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'training_2026_10_18'))
from api import Client  # noqa: E402

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
SHOTS = os.path.join(HERE, 'shots')
os.makedirs(SHOTS, exist_ok=True)
STATE = os.path.join(HERE, 'state.json')
RESULTS = os.path.join(HERE, 'results.json')
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
DEPT = 'Quality Control'

# role -> account
ROLES = {
    'DCO': 'dco.test1',            # creates the documents, publishes (holds view-all)
    'ADMIN': 'user.a.test',        # stands for the administrator: view-all permission, no part in any flow
    'AUTHOR': 'author.test1',
    'COAUTHOR': 'coauthor.test1',
    'REVIEWER': 'reviewer.test1',
    'APPROVER': 'approver.test1',
    'HEAD': 'reviewer.test2',      # Department Head of Quality Control for the run
    'G1A': 'coauthor.test2',       # group 1 (sees SOPs), already holds the module permission
    'G1B': 'trainee.test1',        # group 1, the administrator grants the module permission during the run
    'G2A': 'trainee.test2',        # group 2 (sees Instructions)
    'G2B': 'trainer.test1',        # group 2
}

_clients = {}


def U(role):
    if role not in _clients:
        _clients[role] = Client(ROLES[role])
    return _clients[role]


def uid(role):
    return U(role).user['id']


def sql(q):
    r = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        raise SystemExit('SQL failed: ' + r.stderr[:300])
    return [x.split('|') for x in r.stdout.strip().splitlines() if x.strip()]


def load():
    return json.load(open(STATE, encoding='utf-8')) if os.path.exists(STATE) else {}


def save(s):
    json.dump(s, open(STATE, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


RES = json.load(open(RESULTS, encoding='utf-8')) if os.path.exists(RESULTS) else []


def check(sid, name, ok, detail=''):
    RES.append({'id': sid, 'name': name, 'ok': bool(ok), 'detail': str(detail)[:500]})
    json.dump(RES, open(RESULTS, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(('PASS  ' if ok else 'FAIL  ') + sid + ' ' + name + ('' if ok or not detail else ' -- ' + str(detail)[:400]), flush=True)


def attempt(who, method, path, body=None):
    code, payload = U(who).call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload else {}
    except Exception:
        data = {}
    return code, data, payload[:300].decode('utf-8', 'ignore')


def sign(who):
    return U(who).call('POST', '/auth/verify-signature', {'username': ROLES[who], 'password': PW})['signatureToken']


def mini_docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        paras = ''.join('<w:p><w:r><w:t>' + t + '</w:t></w:r></w:p>' for t in text)
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paras + '</w:body></w:document>')
    return buf.getvalue()


# ------------------------------------------------------------------ what a role can see (list AND detail)
def _detail_ok(role, kind, rid):
    for _ in range(4):
        code, _b = U(role).call('GET', f'/{kind}/{rid}', raw=True)
        if code in (200, 403, 404):
            return code == 200
        time.sleep(0.6)
    return None


def seen(role, revs=(), docs=(), ccs=(), ucs=()):
    """The ids the role sees, by the LIST and by the DETAIL of each kind. Returns {kind: (list_ids, detail_ids)}."""
    out = {}

    def lst(kind, ids, extra=None):
        if not ids:
            return set()
        code, b = U(role).call('GET', f'/{kind}?' + urllib.parse.urlencode({'ids': ','.join(ids), 'limit': 100, 'page': 1}), raw=True)
        return {r['id'] for r in json.loads(b)['data']} if code == 200 else None
    revs, docs, ccs, ucs = list(revs), list(docs), list(ccs), list(ucs)
    out['revisions'] = (lst('revisions', revs), None)
    out['documents'] = (lst('documents', docs), None)
    with ThreadPoolExecutor(max_workers=6) as pool:
        for kind, ids in (('revisions', revs), ('documents', docs), ('controlled-copies', ccs), ('uncontrolled-copies', ucs)):
            det = {i for i, ok in zip(ids, pool.map(lambda i: _detail_ok(role, kind, i), ids)) if ok}
            if kind in ('revisions', 'documents'):
                out[kind] = (out[kind][0], det)
            else:
                out[kind] = (None, det)
    return out


def copy_list(role, kind, doc_ids):
    got = set()
    for d in doc_ids:
        code, b = U(role).call('GET', f'/{kind}?' + urllib.parse.urlencode({'documentId': d, 'limit': 100, 'page': 1}), raw=True)
        if code == 200:
            got |= {r['id'] for r in json.loads(b)['data']}
    return got


def matrix(sid, label, roles, expect, revs=(), docs=(), ccs=(), ucs=(), cc_docs=(), uc_docs=()):
    """expect: {role: {'revisions': set, 'documents': set, 'ccs': set, 'ucs': set}} (missing key = nothing). Checks list == detail == expected for every role."""
    rows = {}
    for role in roles:
        s = seen(role, revs, docs, ccs, ucs)
        exp = expect.get(role, {})
        e_rev, e_doc, e_cc, e_uc = set(exp.get('revisions', ())), set(exp.get('documents', ())), set(exp.get('ccs', ())), set(exp.get('ucs', ()))
        cc_list = copy_list(role, 'controlled-copies', cc_docs) & set(ccs) if ccs else set()
        uc_list = copy_list(role, 'uncontrolled-copies', uc_docs) & set(ucs) if ucs else set()
        ok = (s['revisions'][0] == s['revisions'][1] == e_rev and s['documents'][0] == s['documents'][1] == e_doc
              and s['controlled-copies'][1] == cc_list == e_cc and s['uncontrolled-copies'][1] == uc_list == e_uc)
        rows[role] = (len(s['revisions'][1] or ()), len(s['documents'][1] or ()), len(s['controlled-copies'][1] or ()), len(s['uncontrolled-copies'][1] or ()))
        check(f'{sid}.{role}', f'{label}: {ROLES[role]}', ok, f'{label}: {ROLES[role]} sees revisions/documents/controlled/uncontrolled = {rows[role]}; expected ({len(e_rev)},{len(e_doc)},{len(e_cc)},{len(e_uc)}); '
              f'list-vs-detail rev {s["revisions"][0] == s["revisions"][1]} doc {s["documents"][0] == s["documents"][1]} cc {s["controlled-copies"][1] == cc_list} uc {s["uncontrolled-copies"][1] == uc_list}')
    return rows


# ------------------------------------------------------------------ browser pictures
class Browser:
    def __init__(self):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        self.b = self.pw.chromium.launch(channel='msedge', headless=True)
        self.pages = {}
        self.index = json.load(open(os.path.join(HERE, 'shots.json'), encoding='utf-8')) if os.path.exists(os.path.join(HERE, 'shots.json')) else []

    def page(self, role):
        if role not in self.pages:
            ctx = self.b.new_context(viewport={'width': 1500, 'height': 1000})
            pg = ctx.new_page()
            pg.goto(BASE + '/login', wait_until='domcontentloaded')
            pg.fill('input[name=username]', ROLES[role])
            pg.fill('input[name=password]', PW)
            pg.get_by_role('button', name='Sign In').click()
            pg.wait_for_timeout(4500)
            self.pages[role] = pg
        return self.pages[role]

    def shot(self, role, path, sid, name, caption, wait=3500, action=None):
        f = f'{sid}__{re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-")}.png'
        try:
            pg = self.page(role)
            pg.set_default_timeout(25000)
            if path:
                pg.goto(BASE + path, wait_until='domcontentloaded', timeout=30000)
                pg.wait_for_timeout(wait)
            if action:
                action(pg)
                pg.wait_for_timeout(1800)
            pg.screenshot(path=os.path.join(SHOTS, f), timeout=30000)
            self.index.append({'id': sid, 'file': f, 'caption': caption, 'user': ROLES[role], 'path': path})
            json.dump(self.index, open(os.path.join(HERE, 'shots.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
            print('  shot', f, flush=True)
        except Exception as e:  # a picture that fails must not stop the run
            print('  SHOT FAILED', f, str(e)[:120], flush=True)

    def close(self):
        self.b.close()
        self.pw.stop()


# ------------------------------------------------------------------ the document flow
def new_document(name, dtype='Standard Operating Procedure', co=('COAUTHOR',), reviewers=('REVIEWER',), approvers=('APPROVER',), author='AUTHOR', creator='DCO'):
    body = {'documentName': name, 'documentType': dtype, 'businessUnit': 'Quality Unit', 'department': DEPT, 'author': uid(author), 'language': 'English', 'requiresTraining': False,
            'reasonForSkippingTraining': 'DV-TEST no training needed', 'trainingPeriodDays': 0, 'description': 'DV-TEST ' + name, 'isTemplate': False, 'periodicReviewCycle': 24, 'periodicReviewNotification': 30,
            'coAuthorIds': [uid(r) for r in co], 'reviewerUserIds': [uid(r) for r in reviewers], 'approverUserIds': [uid(r) for r in approvers],
            'relatedDocumentIds': [], 'correlatedDocumentIds': []}
    code, d, t = attempt(creator, 'POST', '/documents', body)
    if code != 200:
        raise SystemExit(f'create document -> {code} {t}')
    return d


def new_revision(doc_id, who='DCO'):
    code, d, t = attempt(who, 'POST', f'/documents/{doc_id}/revisions', {})
    if code != 200:
        raise SystemExit(f'create revision -> {code} {t}')
    return d


def step(who, rid, name, label='DV-TEST'):
    code, d, t = attempt(who, 'POST', f'/revisions/{rid}/{name}', {'signatureToken': sign(who), 'comment': label, 'reason': label})
    return code, t


def upload(who, rid, text):
    U(who).upload(f'/revisions/{rid}/upload', 'file', 'dv-test.docx', mini_docx(text), DOCX)


def status_of(rid):
    return U('DCO').call('GET', f'/revisions/{rid}').get('status')


def publish(rid, who='DCO'):
    """Publishing Workspace: preview, then publish (asynchronous). Returns (status, problems)."""
    base = f'/revisions/{rid}/publishing-workspace'
    problems = []
    code, ws, t = attempt(who, 'GET', base)
    if code != 200:
        return None, [('workspace', code, t)]
    tmpl = ws.get('publishingTemplateId') or ws.get('selectedTemplateId') or (ws.get('selectedTemplate') or {}).get('id')
    if not tmpl and ws.get('templates'):
        tmpl = ws['templates'][0].get('id')
    body = {'publishingTemplateId': tmpl, 'changeSummary': 'DV-TEST publish', 'reason': 'DV-TEST publish'}
    code, d, t = attempt(who, 'POST', base + '/generate-preview', body)
    if code != 200:
        problems.append(('generate-preview', code, t))
    for _ in range(30):
        if U(who).call('GET', base).get('previewReady'):
            break
        time.sleep(3)
    code, d, t = attempt(who, 'POST', base + '/publish', {**body, 'signatureToken': sign(who)})
    if code not in (200, 202):
        problems.append(('publish', code, t))
    status = None
    for _ in range(60):
        time.sleep(3)
        status = status_of(rid)
        if str(status).upper() in ('EFFECTIVE', 'ACTIVE'):
            break
    return status, problems


# ------------------------------------------------------------------ the Department Head's rules, the administrator's grants
API = '/security/department-visibility'


def dept_id():
    code, d, t = attempt('HEAD', 'GET', API + '/departments')
    return next(x['id'] for x in d if x['name'] == DEPT)


def make_rule(name, effect, priority, target, members, resource_id=None, resource_name=None, who='HEAD', extra=None):
    body = {'name': 'DV-TEST ' + name, 'description': 'DV-TEST', 'effect': effect, 'priority': priority, 'active': True, 'resourceType': target,
            'resourceId': resource_id, 'resourceName': resource_name, 'granteeUserIds': [uid(r) for r in members], 'signatureToken': sign(who), 'reason': 'DV-TEST'}
    body.update(extra or {})
    code, d, t = attempt(who, 'POST', f'{API}/departments/{dept_id()}/rules', body)
    return code, d, t


def drop_rule(rule_id, who='HEAD'):
    code, d, t = attempt(who, 'DELETE', f'{API}/departments/{dept_id()}/rules/{rule_id}', {'signatureToken': sign(who), 'reason': 'DV-TEST'})
    return code


def doc_type_id(name):
    return sql(f"select id from document_types where name='{name}'")[0][0]


def flush():
    """The backend keeps the permissions of each user in memory until a change made through the application evicts them. A change made straight in the database (as the
    run does to play the administrator) therefore needs the backend restarted: this is the only reason for the restart."""
    subprocess.run(['docker', 'restart', 'eqms-backend'], capture_output=True)
    for _ in range(60):
        time.sleep(5)
        h = subprocess.run(['docker', 'inspect', '-f', '{{.State.Health.Status}}', 'eqms-backend'], capture_output=True, text=True).stdout.strip()
        if h == 'healthy':
            break
    time.sleep(3)


def grant_module(roles):
    """The administrator gives users the permission to open the Document Control module: the profile DV Document Viewer."""
    bk = json.load(open(os.path.join(HERE, 'backup.json'), encoding='utf-8'))
    for r in roles:
        sql(f"insert into user_access_profiles (user_id, access_profile_id) select '{uid(r)}', '{bk['dv_role']}' where not exists (select 1 from user_access_profiles where user_id='{uid(r)}' and access_profile_id='{bk['dv_role']}')")


def revoke_module(roles):
    bk = json.load(open(os.path.join(HERE, 'backup.json'), encoding='utf-8'))
    for r in roles:
        sql(f"delete from user_access_profiles where user_id='{uid(r)}' and access_profile_id='{bk['dv_role']}'")


def set_config(patch):
    """patch: a JSON object merged into the documents configuration (Document Properties)."""
    sql("update system_configurations set documents_config = documents_config || '" + json.dumps(patch).replace("'", "''") + "'::jsonb")
