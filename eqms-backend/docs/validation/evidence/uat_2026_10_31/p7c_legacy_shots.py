"""Part 7, screens: the Legacy Import form with the paper training evidence, the queue of Legacy Training Evidence, the historical activity, the activities list."""
from flows31 import *

state = load()
p7 = state['p7']
b = Browser()
act = p7['activity']
SEARCH = 'Search training number, document number or name…'


def search_queue(pg):
    [e for e in pg.locator('input').all() if e.is_visible() and e.get_attribute('placeholder') == SEARCH][0].fill(p7['number'])
    pg.wait_for_timeout(2500)


b.shot('admin', '/training-management/legacy-evidence', 'F-38', 'Legacy_evidence_shared_number',
       'Legacy Training Evidence: một Training Number dùng chung cho 3 tài liệu, cột Persons Trained, trạng thái Verified', wait=5000, action=search_queue)
pg = b.page('admin')
text = pg.inner_text('body')
check('F-38.1 the queue shows the shared number on its documents with the evidence verified', text.count(p7['number']) >= 3 and 'Verified' in text, text[:300])
check('F-38.2 the column Persons Trained is there', 'PERSONS TRAINED' in text.upper(), '')

b.shot('admin', f'/training-management/activities/{act}', 'F-39', 'Legacy_activity_detail',
       'Chi tiết activity lịch sử (Paper Training - Legacy Import): Training Number giấy, tài liệu dùng chung số, ngày hoàn thành, không có buổi học', wait=7000)
pg = b.page('admin')
body = pg.inner_text('body')
check('F-39.1 the historical activity opens and shows its Training Number', p7['number'] in [e.input_value() for e in pg.locator('input').all() if e.is_visible()], body[:200])
check('F-39.2 the text says that there is no session because the training was done on paper', 'done on paper before the system' in body, body[-400:])


def search_activities(pg):
    [e for e in pg.locator('input').all() if e.is_visible() and (e.get_attribute('placeholder') or '').startswith('Search')][0].fill(p7['number'])
    pg.wait_for_timeout(2500)


b.shot('admin', '/training-management/activities', 'F-40', 'Activities_list_legacy_type', 'Training Activities: activity lịch sử có loại Paper Training (Legacy Import)', wait=5000, action=search_activities)
pg = b.page('admin')
check('F-40.1 the list shows the historical activity with its type', 'Paper Training (Legacy Import)' in pg.inner_text('body'), '')


def vis(pg, selector):
    els = [e for e in pg.locator(selector).all() if e.is_visible()]
    if not els:
        raise RuntimeError('nothing visible for ' + selector)
    return els[0]


def pick(pg, label, option):
    """Opens the Select under the label and chooses the option by its text (best effort: the picture is taken in any case)."""
    try:
        field = vis(pg, f'xpath=//*[normalize-space(text())="{label}"]/following::*[self::button or @role="combobox"][1]')
        field.click(timeout=6000)
        pg.wait_for_timeout(900)
        vis(pg, f'xpath=//*[normalize-space(text())="{option}"]').click(timeout=6000)
        pg.wait_for_timeout(900)
    except Exception as e:
        print('   pick failed', label, str(e)[:120])


def form_with_training(pg):
    pick(pg, 'Business Unit', 'Quality Unit')
    pick(pg, 'Department', 'Quality Assurance')
    try:
        vis(pg, 'text=Training Requirement').click(timeout=6000)
        pg.wait_for_timeout(1200)
        vis(pg, 'xpath=//*[normalize-space(text())="Requires Training?"]').click(timeout=6000)
        pg.wait_for_timeout(1000)
        vis(pg, 'text=Revision History').click(timeout=6000)
        pg.wait_for_timeout(1200)
        vis(pg, 'input[placeholder="e.g. 4.0.0"]').fill('1.0.0', timeout=6000)
        vis(pg, 'button:has-text("Generate Sections")').click(timeout=6000)
        pg.wait_for_timeout(2500)
        vis(pg, 'input[placeholder="e.g. TRN/QA/19-012"]').fill(p7['number'], timeout=6000)
    except Exception as e:
        print('   form step failed', str(e)[:160])
    pg.wait_for_timeout(3000)


b.shot('admin', '/documents/all/legacy-import', 'F-41', 'Legacy_import_form_training_evidence',
       'Form Legacy Import, tab Revision History: khối Paper training record (Training Number dùng chung đã có bằng chứng thì chỉ hiện thông báo)', wait=5000, action=form_with_training, full=True)
pg = b.page('admin')
body = pg.inner_text('body')
check('F-41.1 the form shows the block of the paper training record', 'Paper training record of revision' in body, body[:200])
check('F-41.2 a number that is already filed is shown as shared, nothing to attach again', 'is already filed with' in body, '')


def form_new_number(pg):
    form_with_training(pg)
    try:
        field = vis(pg, 'input[placeholder="e.g. TRN/QA/19-012"]')
        field.fill('TRN/QA/26-777001', timeout=6000)
    except Exception as e:
        print('   new number failed', str(e)[:120])
    pg.wait_for_timeout(3500)


b.shot('admin', '/documents/all/legacy-import', 'F-42', 'Legacy_import_form_new_number',
       'Form Legacy Import với Training Number mới: ô scan APD.0108/0117 (cảnh báo không xóa được), danh sách người học (giao diện như bước Training của tài liệu thường), người xác nhận', wait=5000, action=form_new_number, full=True)
pg = b.page('admin')
body = pg.inner_text('body')
check('F-42.1 a new number asks for the scan, the persons trained and the verifier', 'scan of the paper training record (apd.0108 or apd.0117)' in body.lower() and 'persons who were trained' in body.lower() and 'who verifies' in body.lower(), body[:200])
check('F-42.2 the warning that a stored scan cannot be deleted is shown', 'cannot be deleted or replaced' in body, '')
finish('p7c', b)
