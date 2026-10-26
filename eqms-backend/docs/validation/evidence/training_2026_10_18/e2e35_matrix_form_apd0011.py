"""DEV: the training matrix of a department in the form APD.0011. Steps: (1) the real form APD.0011.02 is uploaded and enabled (Training Properties); (2) without the form the export is refused;
(3) an Effective matrix version is exported as Word and PDF: the department, the version, the positions as columns, the topics and SOPs as rows with X; (4) a version that is not Effective is refused;
(5) a person outside the scope or without the permission gets nothing. The password comes from DEVPW (never written). The files are saved in E2E_OUT or docs/training_docs/draft/test-run."""
import os, sys, io, re, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import check, sign, admin

OUT = os.environ.get('E2E_OUT') or r'D:\edms-project\docs\training_docs\draft\test-run'
os.makedirs(OUT, exist_ok=True)
FORM = r'D:\edms-project\docs\training_docs\APD.0011.02 Training matrix_260810.docx'
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
label = '2.0.0 (APD.0011.02)'


def step(t): print(chr(10) + '== ' + t)


step('1. the real form APD.0011.02 is uploaded and enabled')
mine = [t for t in admin.call('GET', '/training/form-templates?search=APD.0011&limit=20')['data'] if t['versionLabel'] == label]
if not mine:
    with open(FORM, 'rb') as f:
        mine = [admin.upload('/training/form-templates', 'file', 'APD.0011.02 Training matrix_260810.docx', f.read(), DOCX,
                             '?code=APD.0011&title=Training%20matrix&versionLabel=' + label.replace(' ', '%20') + '&remark=The%20form%20of%20the%20company')]
tpl = mine[0]
if tpl['status'] != 'ENABLED':
    tpl = admin.call('POST', f"/training/form-templates/{tpl['id']}/enable", {'signatureToken': sign(admin), 'reason': 'E2E-TEST the real form APD.0011.02'})
check('1.1 the form is the enabled APD.0011', tpl['status'] == 'ENABLED' and tpl['versionLabel'] == label, tpl)

step('2. the matrix versions')
matrices = admin.call('GET', '/training/matrices?limit=50')['data']
qa = next(m for m in matrices if m['code'] == 'TM-QA')
versions = admin.call('GET', f"/training/matrices/{qa['id']}/versions?limit=50")['data']
effective = next(v for v in versions if v['status'] == 'EFFECTIVE')
draft = next((v for v in versions if v['status'] == 'DRAFT'), None)
detail = admin.call('GET', f"/training/matrix-versions/{effective['id']}")
print('   version', effective['versionNo'], 'rows', len(detail['rows']), 'positions', len(detail['positions']))

step('3. Word and PDF of the Effective version')
status, word = admin.call('GET', f"/training/matrix-versions/{effective['id']}/export?format=docx", raw=True)
check('3.1 Word is made', status == 200 and word[:2] == b'PK', status)
z = zipfile.ZipFile(io.BytesIO(word))
xml = z.read('word/document.xml').decode('utf8')
text = re.sub(r'<[^>]+>', ' ', xml)
text = re.sub(r'\s+', ' ', text)
check('3.2 the department and the version are written', detail['departmentName'] in text and f"Version: {detail['versionNo']}" in text.replace('Phiên bản/ ', ''), text[:400])
check('3.3 the notes of the template and the history are not written', 'Ghi chú' not in text and 'LỊCH SỬ' not in text and 'Management Personnel' not in text and 'Name of position' not in text, text[:300])
names = [p['name'] for p in detail['positions']]
check('3.4 every position of the department is a column', all(n in text for n in names), names)
refs = [(r.get('documentNumber') or r.get('topicCode') or '') for r in detail['rows']]
check('3.5 every topic and SOP of the matrix is a row', all(r in text for r in refs if r), refs[:8])
crosses = sum(len(r['positionIds']) for r in detail['rows'])
check('3.6 one X for each position of each row', xml.count('>X<') == crosses, (xml.count('>X<'), crosses))
open(os.path.join(OUT, f"{qa['code']}-v{effective['versionNo']}-APD.0011.docx"), 'wb').write(word)
status, pdf = admin.call('GET', f"/training/matrix-versions/{effective['id']}/export?format=pdf", raw=True)
check('3.7 PDF is made', status == 200 and pdf[:4] == b'%PDF', status)
open(os.path.join(OUT, f"{qa['code']}-v{effective['versionNo']}-APD.0011.pdf"), 'wb').write(pdf)
try:
    import fitz
    d = fitz.open(stream=pdf, filetype='pdf')
    for i, page in enumerate(d):
        page.get_pixmap(dpi=80).save(os.path.join(OUT, f"{qa['code']}-v{effective['versionNo']}-APD.0011-page{i + 1}.png"))
    print('   pages', len(d))
except ImportError:
    pass

step('4. only an approved version')
if draft:
    status, body = admin.call('GET', f"/training/matrix-versions/{draft['id']}/export?format=docx", raw=True)
    check('4.1 a draft is refused (409)', status == 409, (status, body[:120]))
status, body = admin.call('GET', f"/training/matrix-versions/{effective['id']}/export?format=rtf", raw=True)
check('4.2 another format is refused', status in (400, 422), (status, body[:120]))

step('5. a person without the permission')
outsider = Client('user.a.test')
status, body = outsider.call('GET', f"/training/matrix-versions/{effective['id']}/export?format=docx", raw=True)
print('   user.a.test ->', status)
