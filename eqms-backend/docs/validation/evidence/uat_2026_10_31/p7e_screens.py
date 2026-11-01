"""Part 7e, screens: the links of Legacy Training Evidence, the scan read from the store in the window with one Close, the historical activity with Persons Trained, the Number Counters tab,
the Legacy Import form with Training Topic, Trainer and Mode."""
from flows31 import *

state = load()
p7 = state['p7']
b = Browser()
act = p7['activity']
SEARCH = 'Search training number, document number or name…'


def vis(pg, selector):
    els = [e for e in pg.locator(selector).all() if e.is_visible()]
    if not els:
        raise RuntimeError('nothing visible for ' + selector)
    return els[0]


def search_queue(pg):
    vis(pg, f'input[placeholder="{SEARCH}"]').fill(p7['number'])
    pg.wait_for_timeout(2500)


b.shot('admin', '/training-management/legacy-evidence', 'F-47', 'Legacy_evidence_links',
       'Legacy Training Evidence: Training Number, Document Number và Document Revision là liên kết sang màn chi tiết', wait=5000, action=search_queue)
pg = b.page('admin')
hrefs = [a.get_attribute('href') for a in pg.locator('table a').all() if a.is_visible()]
check('F-47.1 the Training Number links to the activity', any(h == f'/training-management/activities/{act}' for h in hrefs), hrefs[:6])
check('F-47.2 the Document Number links to the document', any(h and h.startswith('/documents/') and '/revisions/' not in h for h in hrefs), hrefs[:6])
check('F-47.3 the Document Revision links to the revision', any(h and h.startswith('/documents/revisions/') for h in hrefs), hrefs[:6])


def view_real_scan(pg):
    search_queue(pg)
    vis(pg, 'button[aria-label="More actions"]').click()
    pg.wait_for_timeout(600)
    vis(pg, 'text=View Scan').click()
    pg.wait_for_timeout(8000)


b.shot('admin', '/training-management/legacy-evidence', 'F-48', 'Legacy_scan_window_from_the_store',
       'View Scan: bản scan thật đọc từ kho lưu (không giả lập), cửa sổ chỉ còn một nút Close, không có nút Download', wait=5000, action=view_real_scan)
pg = b.page('admin')
dialog = pg.get_by_role('dialog')
check('F-48.1 the window of the scan is open', dialog.count() >= 1 and pg.get_by_text('Scan of the paper training record').first.is_visible(), '')
check('F-48.2 the scan was read from the store and shown (no error)', pg.get_by_text('Error loading document').count() == 0, '')
buttons = [bt.inner_text().strip() for bt in dialog.locator('button').all() if bt.is_visible()]
check('F-48.3 the footer has one Close and no Download', buttons.count('Close') == 1 and not any('Download' in x for x in buttons), buttons)

b.shot('admin', f'/training-management/activities/{act}', 'F-49', 'Legacy_activity_mode_trainer',
       'Activity lịch sử: Training Topic, Mode và Trainer lấy từ bản giấy', wait=7000)
pg = b.page('admin')
values = [e.input_value() for e in pg.locator('input, textarea').all() if e.is_visible()]
check('F-49.1 the topic, the mode and the trainer of the paper record are shown', 'UAT7 Gowning in grade B' in ' '.join(values) and 'Classroom training' in values and 'Nguyen Van A (paper)' in values, values)


def persons_tab(pg):
    vis(pg, 'text=Persons Trained').click()
    pg.wait_for_timeout(3500)


b.shot('admin', f'/training-management/activities/{act}', 'F-50', 'Legacy_persons_trained_tab',
       'Tab Persons Trained của activity lịch sử: người học trên giấy và người ký, bản ghi đào tạo đã ghi sau khi người xác nhận ký', wait=6000, action=persons_tab)
pg = b.page('admin')
body = pg.inner_text('body')
check('F-50.1 the tab lists the persons and the records are written', 'Trained on paper' in body and 'Written' in body and 'Signatory of' in body, body[-600:])


def raise_counter(pg):
    vis(pg, 'button:has-text("Raise Counter")').click()
    pg.wait_for_timeout(1500)


b.shot('admin', '/settings/administration/training/properties?tab=numbers', 'F-51', 'Number_counters_tab',
       'Training Properties, tab Number Counters: bộ đếm số của từng phòng ban và năm, nút Raise Counter', wait=6000, action=raise_counter)
pg = b.page('admin')
body = pg.inner_text('body')
check('F-51.1 the tab shows the counters, the next number and the raise window', 'Next Number' in body.title() or 'NEXT NUMBER' in body.upper(), body[:200])
check('F-51.2 the window to raise the counter is open', 'Last Serial of the Paper Log' in body or 'LAST SERIAL OF THE PAPER LOG' in body.upper(), '')
reason = pg.locator('textarea').last
resize = reason.evaluate('e => getComputedStyle(e).resize')
rows = reason.get_attribute('rows')
width = pg.get_by_role('dialog').first.evaluate('e => e.getBoundingClientRect().width') if pg.get_by_role('dialog').count() else 0
check('F-51.3 the reason box cannot be dragged to another size and has three lines', resize == 'none' and rows == '3', (resize, rows))
check('F-51.4 the window is wide (more than 600 px)', width > 600, width)


def pick(pg, label, option):
    try:
        field = vis(pg, f'xpath=//*[normalize-space(text())="{label}"]/following::*[self::button or @role="combobox"][1]')
        field.click(timeout=6000)
        pg.wait_for_timeout(900)
        vis(pg, f'xpath=//*[normalize-space(text())="{option}"]').click(timeout=6000)
        pg.wait_for_timeout(900)
    except Exception as e:
        print('   pick failed', label, str(e)[:120])


def form_new_number(pg):
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
        vis(pg, 'input[placeholder="e.g. TRN/QA/19-012"]').fill('TRN/QA/26-777001', timeout=6000)
    except Exception as e:
        print('   form step failed', str(e)[:160])
    pg.wait_for_timeout(3500)


b.shot('admin', '/documents/all/legacy-import', 'F-52', 'Legacy_form_topic_trainer_mode',
       'Form Legacy Import (đã tách file): Training Topic, Trainer, Mode, ô scan, người học, người xác nhận', wait=5000, action=form_new_number, full=True)
pg = b.page('admin')
body = pg.inner_text('body').lower()
check('F-52.1 the form asks for the Training Topic, the Trainer and the Mode, and no longer for a verifier', 'training topic' in body and 'trainer' in body and 'mode' in body and 'who verifies' not in body, '')


def training_tab(pg):
    pick(pg, 'Business Unit', 'Quality Unit')
    pick(pg, 'Department', 'Quality Assurance')
    vis(pg, 'text=Training Requirement').click(timeout=6000)
    pg.wait_for_timeout(1200)
    vis(pg, 'xpath=//*[normalize-space(text())="Requires Training?"]').click(timeout=6000)
    pg.wait_for_timeout(1500)


b.shot('admin', '/documents/all/legacy-import', 'F-53', 'Legacy_training_requirement_tab',
       'Tab Training Requirement của Legacy Import: không còn khối List of participants trống, có dòng chỉ dẫn nơi chọn người học', wait=5000, action=training_tab)
pg = b.page('admin')
body = pg.inner_text('body')
check('F-53.1 the empty list of participants is gone from the tab', 'List of participants in the Training' not in body, '')
check('F-53.2 the tab says where the persons who were trained are chosen', 'chosen in the tab Revision History' in body, '')
finish('p7e', b)
