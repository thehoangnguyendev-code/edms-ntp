"""Part 8c: what a person sees after a Legacy Import (revision, document, Training Details), the form left empty, and a template (no training)."""
from flows31 import *

state = load()
p8b = state['p8b']
b = Browser()
doc_number = p8b['doc']
paper = p8b['paper']
ids = sql(f"select d.id, r.id, r.training_activity_id from documents d join document_revisions r on r.document_id = d.id where d.document_number = '{doc_number}'")[0]
doc_id, rev_id, act_id = ids


def vis(pg, selector, nth=0):
    els = [e for e in pg.locator(selector).all() if e.is_visible()]
    if len(els) <= nth:
        raise RuntimeError(f'nothing visible for {selector}')
    return els[nth]


step('H-3 the revision and the document of the import')
b.shot('admin', f'/documents/revisions/{rev_id}', 'F-61', 'Imported_revision_details', 'Revision Details của tài liệu vừa nhập từ giấy: nút Training Details, trạng thái Effective', wait=7000)
pg = b.page('admin')
body = pg.inner_text('body')
check('H-3.1 the revision opens as Effective', 'Effective' in body and doc_number in body, body[:200])
check('H-3.2 there is a button Training Details (twice: header and footer)', pg.get_by_role('button', name='Training Details').count() >= 1 or pg.get_by_text('Training Details').count() >= 1, '')
try:
    vis(pg, 'button:has-text("Training Details")').click()
    pg.wait_for_timeout(5000)
    check('H-3.3 Training Details opens the historical activity of this revision', f'/training-management/activities/{act_id}' in pg.url, pg.url)
    values = [e.input_value() for e in pg.locator('input').all() if e.is_visible()]
    check('H-3.4 the activity shows the paper Training Number', paper in values, values[:6])
except Exception as e:
    check('H-3.3 Training Details opens the historical activity', False, str(e)[:200])
b.shot('admin', f'/documents/{doc_id}', 'F-62', 'Imported_document_details', 'Document Details của tài liệu nhập từ giấy', wait=7000)
pg = b.page('admin')
values = [e.input_value() for e in pg.locator('input').all() if e.is_visible()]
check('H-3.5 the document opens (Active, with the number)', doc_number in values and 'Active' in pg.inner_text('body'), values[:4])

step('H-4 the form left empty')
b.shot('admin', '/documents/all/legacy-import', 'F-63', 'Legacy_form_empty_publish', 'Form Legacy Import để trống, bấm Publish Document: báo thiếu thông tin', wait=5000,
       action=lambda pg: vis(pg, 'button:has-text("Publish Document")').click())
pg = b.page('admin')
body = pg.inner_text('body')
check('H-4.1 an empty form is not signed: it says what is missing (Document Type first)', 'Missing information' in body or 'Document Type' in body, body[-300:])
check('H-4.2 no e-signature window opens for an empty form', pg.get_by_text('Electronic Signature').count() == 0, '')

step('H-5 a template needs no training')
def template(pg):
    pg.evaluate("document.getElementById('legacyIsTemplate').click()")
    pg.wait_for_timeout(1200)


b.shot('admin', '/documents/all/legacy-import', 'F-64', 'Legacy_form_template', 'Form Legacy Import khi chọn Is Template: tab Training Requirement biến mất', wait=5000, action=template)
pg = b.page('admin')
tabs = [e.inner_text().strip() for e in pg.locator('button').all() if e.is_visible() and e.inner_text().strip().startswith(('Document Information', 'Training Requirement', 'Revision History'))]
check('H-5.1 with Is Template the tab Training Requirement is gone', not any(t.startswith('Training Requirement') for t in tabs) and any(t.startswith('Revision History') for t in tabs), tabs)
finish('p8c', b)
