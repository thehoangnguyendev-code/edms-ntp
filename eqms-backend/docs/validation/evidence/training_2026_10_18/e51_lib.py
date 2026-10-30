"""Shared helpers of the full Training Management run on DEV (e51_*.py). The password comes from the environment variable DEVPW (never written). Records are titled "E2E51 ...".
Screenshots go to shots/e51/. State between the phases is kept in e51_state.json."""
import os, sys, json, io, re, zipfile, datetime, subprocess, traceback
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf, attempt, check, sign, results, TODAY

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots', 'e51')
OUT = os.path.join(HERE, 'exports', 'e51')
STATE = os.path.join(HERE, 'e51_state.json')
BASE = 'http://localhost:3000'
PW = os.environ['DEVPW']
os.makedirs(SHOTS, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

admin = Client('admin')                   # QA manager: organizes, conducts, prepares
qa = Client('approver.test1')             # QA specialist: reviews content, confirms completion
trainer = Client('trainer.test1')         # the trainer
t1 = Client('trainee.test1')
t2 = Client('trainee.test2')
t3 = Client('user.a.test')
reviewer_doc = Client('dco.test1')        # reviews documents
author = Client('author.test1')
TRAINEES = [t1, t2, t3]


def load():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def save(state):
    json.dump(state, open(STATE, 'w'), indent=1)


def step(t):
    print('\n== ' + t)


def get(aid):
    return admin.call('GET', f'/training/activities/{aid}')


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


def words(docx):
    z = zipfile.ZipFile(io.BytesIO(docx))
    xml = ''.join(z.read(n).decode('utf8') for n in z.namelist() if n.startswith('word/') and n.endswith('.xml') and ('document' in n or 'header' in n or 'footer' in n))
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', xml))


def fetch(client, path, name):
    st, body = client.call('GET', path, raw=True)
    if st == 200:
        open(os.path.join(OUT, name), 'wb').write(body)
    return st, body


def render_pdf(pdf_bytes, name, dpi=80):
    """The pages of a PDF as PNG in shots/e51 (what the person sees on the page). Returns the number of pages."""
    import fitz
    doc = fitz.open(stream=pdf_bytes, filetype='pdf')
    for i, page in enumerate(doc):
        page.get_pixmap(dpi=dpi).save(os.path.join(SHOTS, f'{name}-p{i + 1}.png'))
    return len(doc)


def mini_docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


class Browser:
    """One Edge, one logged-in page per user, for the screenshots."""
    def __init__(self):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        self.b = self.pw.chromium.launch(channel='msedge', headless=True)
        self.pages = {}

    def page(self, username):
        if username not in self.pages:
            ctx = self.b.new_context(viewport={'width': 1500, 'height': 950}, accept_downloads=True)
            pg = ctx.new_page()
            pg.goto(BASE + '/login', wait_until='domcontentloaded')
            pg.fill('input[name=username]', username)
            pg.fill('input[name=password]', PW)
            pg.get_by_role('button', name='Sign In').click()
            pg.wait_for_timeout(4500)
            self.pages[username] = pg
        return self.pages[username]

    def shot(self, username, path, name, wait=3500, full=False, action=None):
        f = os.path.join(SHOTS, name + '.png')
        try:
            pg = self.page(username)
            pg.set_default_timeout(25000)
            pg.goto(BASE + path, wait_until='domcontentloaded', timeout=30000)
            pg.wait_for_timeout(wait)
            if action:
                action(pg)
            pg.screenshot(path=f, full_page=full, timeout=30000)
        except Exception as e:  # a screen that does not open is reported, it does not stop the run
            print('   SHOT FAILED', name, str(e)[:120])
            check('screenshot ' + name, False, str(e)[:200])
        return f

    def close(self):
        self.b.close()
        self.pw.stop()


def finish(browser=None):
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
    for r in failed:
        print('FAILED:', r[0], '--', str(r[2])[:300])
    if browser:
        browser.close()
    sys.exit(1 if failed else 0)
