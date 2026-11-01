"""Part h: Legacy Training Evidence: the columns Training Number / Document Number / Document Name / Document Revision, the action "View Scan" (a window with the scan, audited as a view)
and the download under the name the file was uploaded with."""
from flows31 import *
import urllib.request, urllib.parse
import api as _api

b = Browser()
HERE = os.path.dirname(os.path.abspath(__file__))
PATH = '/training-management/legacy-evidence'


def raw(path):
    req = urllib.request.Request(_api.BASE + path, method='GET')
    req.add_header('Authorization', 'Bearer ' + admin.token)
    with admin.opener.open(req) as resp:
        return resp.headers.get('Content-Disposition', ''), resp.headers.get('Content-Type', ''), resp.read()


q = admin.call('GET', '/training/legacy-evidence?limit=20')
rows = [r for r in q['data'] if r.get('evidenceId') and not r.get('notEvidenced')]
check('F-27.1 the queue has a row with a scan to look at', len(rows) >= 1, len(q['data']))
row = rows[0]
for key in ('documentNumber', 'documentName', 'revisionNumber', 'paperTrainingNumber'):
    check('F-27.2 the row carries ' + key, row.get(key) not in (None, ''), row.get(key))

for key in ('document', 'documentName', 'revision', 'paperNo'):
    c, d, t = attempt(admin, 'GET', f'/training/legacy-evidence?limit=5&sortBy={key}&sortDirection=desc', None)
    check('F-27.3 the server sorts by ' + key, c == 200, (c, t[:120]))

before = int(sql("select count(*) from audit_logs where action = 'TRAINING_LEGACY_EVIDENCE_VIEWED'")[0][0])
head, ctype, body = raw(f"/training/legacy-evidence/{row['evidenceId']}/download?inline=true")
check('F-27.4 the view answers inline with the file', head.lower().startswith('inline') and body[:4] == b'%PDF', head)
after = int(sql("select count(*) from audit_logs where action = 'TRAINING_LEGACY_EVIDENCE_VIEWED'")[0][0])
check('F-27.5 a view is written to the audit trail as a view', after == before + 1, (before, after))
head, ctype, body = raw(f"/training/legacy-evidence/{row['evidenceId']}/download")
name = urllib.parse.unquote(re.search(r"filename\*=UTF-8''([^;]+)", head).group(1)) if "filename*" in head else head
check('F-27.6 the download is an attachment under the uploaded name', head.lower().startswith('attachment') and name == row['originalName'], (head, row['originalName']))


def open_menu(pg):
    pg.get_by_label('More actions').first.click()
    pg.wait_for_timeout(600)


REAL_PDF = os.path.join(HERE, 'apd', 'F-01__APD0117_external_trainer_session_01_signature_meaning.pdf')
REAL_PNG = os.path.join(HERE, 'shots', 'F-01__APD0117_external_trainer_session_01_signature_meaning-p1.png')


def view_scan_of(path, ctype):
    """The scan on DEV is a 45-byte stub (not a readable PDF), so the browser is given a real file in its place: the path View Scan > blob > viewer is the real one."""
    def run(pg):
        data = open(path, 'rb').read()
        pg.route('**/training/legacy-evidence/*/download*', lambda route: route.fulfill(status=200, body=data, headers={'Content-Type': ctype, 'Content-Disposition': 'inline'}))
        open_menu(pg)
        pg.get_by_text('View Scan', exact=True).click()
        pg.wait_for_timeout(7000)
    return run


view_scan = view_scan_of(REAL_PDF, 'application/pdf')
view_image = view_scan_of(REAL_PNG, 'image/png')


b.shot('admin', PATH, 'F-27', 'Legacy_evidence_columns', 'Legacy Training Evidence: các cột Training Number, Document Number, Document Name, Document Revision', wait=4500)
b.shot('admin', PATH, 'F-28', 'Legacy_evidence_menu', 'Menu thao tác của một dòng có bản scan: View Scan, Download the scan', wait=4500, action=open_menu)
b.shot('admin', PATH, 'F-29', 'Legacy_evidence_view_scan', 'View Scan: bản scan mở trong cửa sổ xem PDF của hệ thống, có nút Download', wait=4500, action=view_scan)
pg = b.page('admin')
check('F-29.0 the viewer shows the PDF without an error', pg.get_by_text('Error loading document').count() == 0, '')
check('F-29.1 the window with the scan is open', pg.get_by_text('Scan of the paper training record').first.is_visible(), '')
with pg.expect_download(timeout=20000) as dl:
    pg.get_by_role('button', name='Download').first.click()
check('F-29.2 the browser saves the file under the uploaded name', dl.value.suggested_filename == row['originalName'], dl.value.suggested_filename)
pg.unroute('**/training/legacy-evidence/*/download*')
pg.get_by_role('button', name='Close').first.click()
pg.wait_for_timeout(800)
b.shot('admin', PATH, 'F-30', 'Legacy_evidence_view_scan_image', 'View Scan của một bản scan dạng ảnh PNG/JPEG: ảnh hiện trong cửa sổ, có nút Download', wait=4500, action=view_image)
img = b.page('admin')
check('F-30.1 an image scan is shown in the window', img.locator('img[alt]').filter(has=None).count() >= 1 and img.get_by_text('Scan of the paper training record').first.is_visible(), '')
img.unroute('**/training/legacy-evidence/*/download*')
finish('p6h', b)
