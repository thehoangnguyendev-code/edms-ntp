"""T2-C: the screens of what a training from Document Control starts with: the New Document form (Requires Training is ticked by default, 10 days), and the Add session dialog of a first-issue SOP (the topic is the
document, classroom + test, the author as trainer). Expected results: DEC-TRAINING-2026-11-24-2 and -3."""
from lib24 import *
import lib31

b = Browser()
S = load()

step('T2C.1 the New Document form starts with Requires Training ticked')
res = {}


def on_training_tab(pg):
    for label in ('Training Information', 'Training', 'Training Configuration'):
        els = [e for e in pg.get_by_text(label, exact=True).all() if e.is_visible()]
        if els:
            els[0].click()
            break
    pg.wait_for_timeout(1500)
    res['checked'] = [bool(c.is_checked()) for c in pg.locator('input[type=checkbox]').all() if c.is_visible()]


b.shot('admin', '/documents/all/new', 'T2C-01', 'New_document_training_default', 'T2-C: tạo tài liệu mới: Required Training đã tick sẵn, 10 ngày', action=on_training_tab, tall=False)
print('checkboxes on the training tab:', res)
check('T2C.1 a checkbox is ticked on the Training tab of a new document (Requires Training)', any(res.get('checked', [])), res)

step('T2C.2 a first-issue SOP: Planned, the Add session dialog is filled in')
body = {'documentName': 'RUN24 SOP for the defaults of the first session', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Control', 'author': admin.user['id'],
        'language': 'English', 'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'RUN24', 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [dco.user['id']],
        'approverUserIds': [qa.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
doc = admin.call('POST', '/documents', body)
rid = admin.call('POST', f"/documents/{doc['id']}/revisions", {})['id']
bad = approve_revision(rid, 'RUN24 defaults', 'RUN24')
check('T2C.2 the SOP is approved', not bad, bad)
aid = rows_of_document(doc['documentNumber'])[0]['id']
a = get(aid)
check('T2C.3 Planned', a['status'] == 'PLANNED', a['status'])
sd = admin.call('GET', f'/training/activities/{aid}/document-sources')['sessionDefaults']
check('T2C.4 classroom + test, the author as trainer', sd and sd['method'] == 'CLASSROOM' and sd['assessmentMethod'] == 'TEST' and sd['trainerUserId'] == admin.user['id'], sd)


def open_dialog(pg):
    pg.get_by_role('button', name='Add session').first.click()
    pg.wait_for_timeout(2500)


b.shot('admin', f'/training-management/activities/{aid}/edit', 'T2C-02', 'Add_session_prefilled', 'T2-C: hộp thoại Thêm buổi đã điền sẵn: chủ đề là SOP, Tập trung + Kiểm tra, giảng viên là tác giả', action=open_dialog, tall=False)
S['t2c'] = {'aid': aid}
save(S)
lib31.finish('T2C', b)
