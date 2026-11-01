"""Shared helpers of the UAT run of 2026-10-31 (DEV only): API clients, checks, SQL, the Edge browser with NAMED screenshots, the APD files, and the index of everything that was produced.
The password comes from the environment variable DEVPW (the run harness run31.sh sets a random one for the run and puts the originals back). Nothing here deletes data.
Screenshots:  shots/<ID>__<Name>.png   (ID = scenario-step, e.g. S1-12; the caption in Vietnamese is in index.json and in REPORT.md)
APD files:    apd/<ID>__<Name>.docx|pdf  (and shots/<ID>__<Name>-p<n>.png for the pages of a PDF)"""
import os, sys, json, io, re, zipfile, datetime, subprocess, time, unicodedata
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'training_2026_10_18'))
from api import Client, tick_all, finish_for_qa   # noqa: E402
from people31 import PEOPLE                        # noqa: E402

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
TODAY = datetime.date.today()
SHOTS = os.path.join(HERE, 'shots')
APDDIR = os.path.join(HERE, 'apd')
STATE = os.path.join(HERE, 'state31.json')
INDEX = os.path.join(HERE, 'index.json')
RESULTS = os.path.join(HERE, 'results.json')
for d in (SHOTS, APDDIR):
    os.makedirs(d, exist_ok=True)
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

# ------------------------------------------------------------------ people and clients
_clients = {}


def U(username):
    """A logged-in API client (cached)."""
    if username not in _clients:
        _clients[username] = Client(username)
    return _clients[username]


def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, encoding='utf-8').stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]


def sqlx(q):
    r = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise SystemExit('SQL failed: ' + r.stderr[:300])


_ids = {}


def uid(username):
    """The id of a user (any account, also a closed one, through SQL)."""
    if username not in _ids:
        rows = sql(f"select id from app_users where username='{username}'")
        _ids[username] = rows[0][0]
    return _ids[username]


def name_of(username):
    return PEOPLE[username][0] if username in PEOPLE else sql(f"select full_name from app_users where username='{username}'")[0][0]


def set_head(dept, username):
    val = f"'{uid(username)}'" if username else 'null'
    sqlx(f"update departments set department_head_id = {val} where name = '{dept}'")


def set_status(username, status, reason=None):
    """Closes or reopens a test account (what the user administration does, written directly because the run has no user-administration script)."""
    if status == 'Active':
        sqlx(f"update app_users set status='Active', termination_date=null, termination_reason=null, suspended_until=null, suspend_reason=null where username='{username}'")
    elif status == 'Terminated':
        sqlx(f"update app_users set status='Terminated', termination_date=current_date, termination_reason='{reason or 'UAT31 left the company'}' where username='{username}'")
    elif status == 'Suspended':
        sqlx(f"update app_users set status='Suspended', suspend_reason='{reason or 'UAT31 long leave'}', suspended_until=current_date + 180 where username='{username}'")
    else:
        raise ValueError(status)


# ------------------------------------------------------------------ checks
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), str(detail)[:600]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:500]) if (detail and not ok) else ''), flush=True)
    return bool(ok)


def step(t):
    print('\n== ' + t, flush=True)


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload else {}
    except Exception:
        data = {}
    return code, data, payload[:500].decode('utf-8', 'ignore')


def load():
    return json.load(open(STATE, encoding='utf-8')) if os.path.exists(STATE) else {}


def save(state):
    json.dump(state, open(STATE, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


def finish(phase, browser=None):
    """Prints the summary, keeps the results of this phase in results.json, and exits non-zero when a check failed."""
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)} of {len(results)} checks passed', flush=True)
    for r in failed:
        print('FAILED:', r[0], '--', r[2][:300])
    old = json.load(open(RESULTS, encoding='utf-8')) if os.path.exists(RESULTS) else {}
    old[phase] = [{'check': r[0], 'ok': r[1], 'detail': '' if r[1] else r[2]} for r in results]
    json.dump(old, open(RESULTS, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    if browser:
        browser.close()
    sys.exit(1 if failed else 0)


# ------------------------------------------------------------------ the index of shots and APD files
def slug(text):
    t = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+', '_', t).strip('_')[:70]


def note(kind, id_, file, caption, extra=None):
    idx = json.load(open(INDEX, encoding='utf-8')) if os.path.exists(INDEX) else []
    idx = [x for x in idx if not (x['id'] == id_ and x['kind'] == kind and x['file'] == file)]
    idx.append({'kind': kind, 'id': id_, 'file': file, 'caption': caption, 'time': datetime.datetime.now().isoformat(timespec='seconds'), **(extra or {})})
    json.dump(idx, open(INDEX, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


def drop_shots(ids):
    """Removes pictures (files and index lines) that are to be taken again, by ID. Only for pictures made by Browser.shot."""
    idx = json.load(open(INDEX, encoding='utf-8')) if os.path.exists(INDEX) else []
    keep = []
    for x in idx:
        if x['kind'] == 'shot' and x['id'] in ids and 'path' in x:
            try:
                os.remove(os.path.join(SHOTS, x['file']))
            except OSError:
                pass
        else:
            keep.append(x)
    json.dump(keep, open(INDEX, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


# ------------------------------------------------------------------ APD files
def get_bytes(client, path):
    return client.call('GET', path, raw=True)


def words(docx):
    z = zipfile.ZipFile(io.BytesIO(docx))
    xml = ''.join(z.read(n).decode('utf8') for n in z.namelist() if n.startswith('word/') and n.endswith('.xml') and ('document' in n or 'header' in n or 'footer' in n))
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', xml))


def pdf_text(pdf):
    import fitz
    return ''.join(pg.get_text() for pg in fitz.open(stream=pdf, filetype='pdf'))


def save_apd(sid, name, caption, data, ext, pages=2, dpi=85):
    """Keeps an APD file as produced by the system (docx or pdf). A PDF is also drawn as PNG (first pages) so that it can be looked at as a picture."""
    f = f'{sid}__{slug(name)}.{ext}'
    open(os.path.join(APDDIR, f), 'wb').write(data)
    note('apd', sid, f, caption)
    if ext == 'pdf':
        import fitz
        doc = fitz.open(stream=data, filetype='pdf')
        for i, page in enumerate(doc):
            if i >= pages:
                break
            png = f'{sid}__{slug(name)}-p{i + 1}.png'
            page.get_pixmap(dpi=dpi).save(os.path.join(SHOTS, png))
            note('shot', sid, png, f'{caption} (trang {i + 1}/{len(doc)})')
    return f


# ------------------------------------------------------------------ the browser
class Browser:
    """One Edge, one signed-in page per user. Every picture gets a NAME (the file) and a CAPTION (index.json / REPORT.md)."""

    def __init__(self):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        self.b = self.pw.chromium.launch(channel='msedge', headless=True)
        self.pages = {}

    def page(self, username):
        if username not in self.pages:
            ctx = self.b.new_context(viewport={'width': 1500, 'height': 1250}, accept_downloads=True)
            pg = ctx.new_page()
            pg.goto(BASE + '/login', wait_until='domcontentloaded')
            pg.fill('input[name=username]', username)
            pg.fill('input[name=password]', PW)
            pg.get_by_role('button', name='Sign In').click()
            pg.wait_for_timeout(4500)
            self.pages[username] = pg
        return self.pages[username]

    def shot(self, username, path, sid, name, caption, wait=3500, full=False, action=None, tall=True):
        """Opens `path` as `username`, runs `action(page)` if given (clicks a tab...), and saves shots/<sid>__<name>.png.
        The app scrolls inside a container, so a tall viewport is used for the picture (tall=True) and put back."""
        f = f'{sid}__{slug(name)}.png'
        try:
            pg = self.page(username)
            pg.set_default_timeout(25000)
            if path:
                pg.goto(BASE + path, wait_until='domcontentloaded', timeout=30000)
                pg.wait_for_timeout(wait)
            if action:
                action(pg)
                pg.wait_for_timeout(1800)
            if tall:
                pg.set_viewport_size({'width': 1500, 'height': 2300})
                pg.wait_for_timeout(1200)
            pg.screenshot(path=os.path.join(SHOTS, f), full_page=full, timeout=30000)
            if tall:
                pg.set_viewport_size({'width': 1500, 'height': 1250})
            note('shot', sid, f, caption, {'user': username, 'path': path})
        except Exception as e:   # a screen that does not open is reported and does not stop the run
            print('   SHOT FAILED', f, str(e)[:160], flush=True)
            check('screenshot ' + f, False, str(e)[:200])
        return f

    def click(self, pg, text, exact=True, nth=None):
        els = [e for e in pg.get_by_text(text, exact=exact).all() if e.is_visible()]
        if not els:
            raise RuntimeError('no visible text ' + text)
        (els[nth or 0]).click()

    def close(self):
        self.b.close()
        self.pw.stop()


def tab(label):
    """An action for Browser.shot: click the tab or text `label`."""
    def run(pg):
        els = [e for e in pg.get_by_text(label, exact=True).all() if e.is_visible()]
        if els:
            els[0].click()
    return run


def mini_pdf(text):
    """A one-page PDF (the exam paper / material) made with PyMuPDF."""
    import fitz
    d = fitz.open()
    p = d.new_page()
    p.insert_text((72, 90), text, fontsize=14)
    return d.tobytes()


def mini_docx(text, extra=()):
    buf = io.BytesIO()
    paras = ''.join('<w:p><w:r><w:t>' + t + '</w:t></w:r></w:p>' for t in (text, *extra))
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paras + '</w:body></w:document>')
    return buf.getvalue()
