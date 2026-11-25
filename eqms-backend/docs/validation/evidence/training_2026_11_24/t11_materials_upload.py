"""T11: a training that starts from a document still lets the organizer add the trainer's own slides, pictures or videos (a file or a link) in the planning step."""
from lib24 import *
import lib31
from lib31 import tab

b = Browser()
body = {'documentName': 'RUN24 SOP for the extra material (T11)', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance', 'author': admin.user['id'],
        'language': 'English', 'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'RUN24', 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [dco.user['id']],
        'approverUserIds': [qa.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
doc = admin.call('POST', '/documents', body)
rid = admin.call('POST', f"/documents/{doc['id']}/revisions", {})['id']
bad = approve_revision(rid, 'RUN24 T11', 'RUN24')
check('T11.0 the SOP is approved', not bad, bad)
aid = rows_of_document(doc['documentNumber'])[0]['id']
a = get(aid)
check('T11.1 the activity is Planned and starts from a document', a['status'] == 'PLANNED' and a.get('documentNumber'), (a['status'], a.get('documentNumber')))
files = admin.call('GET', f'/training/activities/{aid}/files')
check('T11.2 the server offers the upload of a material', files.get('canUploadMaterial') is True, files.get('canUploadMaterial'))
text = {}


def grab(pg):
    pg.wait_for_timeout(3000)
    els = [e for e in pg.get_by_text('Training Materials', exact=True).all() if e.is_visible()]
    els[-1].click()
    pg.wait_for_timeout(3000)
    text['t'] = pg.inner_text('body')
    text['add'] = pg.get_by_text('Add', exact=False).count()


b.shot('admin', f'/training-management/activities/{aid}/edit', 'T11-01', 'Materials_tab_document_based', 'T11: tab Training Materials của đào tạo từ tài liệu: vẫn có chỗ thêm tệp hoặc liên kết', action=grab, tall=True)
t = text.get('t', '')
check('T11.3 the screen shows the documents of Document Control and the place to add a file or a link', 'Documents from Document Control' in t and ('Add material' in t or 'Upload File' in t), t[:300])
code, d, tt = attempt(admin, 'POST', f'/training/activities/{aid}/material-links', {'title': 'RUN24 extra video', 'url': 'https://example.com/run24-video'})
check('T11.4 a link can be added next to the document', code == 200, (code, tt[:150]))
a2 = get(aid)
check('T11.5 the material counts next to the document (the document stays the material)', a2['contentRules']['materialsSource'] == 'DOCUMENT', a2['contentRules'])
lib31.finish('T11', b)
