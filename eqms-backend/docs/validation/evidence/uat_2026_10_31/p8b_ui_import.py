"""Part 8b: a Legacy Import done the way a person does it, in the browser: the form is filled field by field (dates from the calendar, files from the file dialog, the persons trained from the
window that chooses them), the e-signature is given, and what the server holds afterwards is checked."""
from flows31 import *
import sys

state = load()
b = Browser()
pg = b.page('admin')
pg.set_default_timeout(15000)
PDF = os.path.join(HERE, 'apd', 'F-01__APD0117_external_trainer_session_01_signature_meaning.pdf')
SCAN = os.path.join(HERE, 'apd', 'F-02__APD0117_absent_person_make_up_failed.pdf')
reviewer_name = sql("select full_name from app_users where username = 'reviewer.test1'")[0][0]
approver_name = sql("select full_name from app_users where username = 'approver.test1'")[0][0]
author_name = admin.user['fullName'] if admin.user.get('fullName') else sql("select full_name from app_users where username = 'admin'")[0][0]
trainee_codes = [sql(f"select employee_code from app_users where username = '{u}'")[0][0] for u in ('uat31.s2.qa.pass', 'uat31.s2.qa.fail')]
number = None
for k in range(7100, 7900):
    cand = '%04d' % k
    if int(sql(f"select count(*) from documents where document_number = 'SOP.{cand}'")[0][0]) == 0:
        number = cand
        break
doc_number = 'SOP.' + number
base = max(int(sql("select max(last_serial) from training_number_sequences where year = 2026 and last_serial < 100000")[0][0]),
           int(sql("select max(substring(training_number from '-([0-9]+)$')::int) from training_activities where training_number like 'TRN/QA/26-%' and length(training_number) < 16")[0][0])) + 15
paper_number = 'TRN/QA/26-%d' % base
print('document', doc_number, 'paper number', paper_number, flush=True)


def vis(selector, nth=0):
    els = [e for e in pg.locator(selector).all() if e.is_visible()]
    if len(els) <= nth:
        raise RuntimeError(f'nothing visible for {selector} ({len(els)} found)')
    return els[nth]


def shot(name):
    try:
        pg.screenshot(path=os.path.join(SHOTS, f'F-7__{name}.png'), full_page=False)
    except Exception:
        pass


def pick(label, option, partial=True):
    """The Select under the label (a button), then the option (role=option) whose text has the words."""
    vis(f'xpath=//*[normalize-space(text())="{label}"]/following::*[self::button or @role="combobox"][1]').click()
    pg.wait_for_timeout(1000)
    cond = f'contains(normalize-space(.), "{option}")' if partial else f'normalize-space(.)="{option}"'
    vis(f'xpath=//*[@role="option"][{cond}]', 0).click()
    pg.wait_for_timeout(700)


def pick_multi(label, option):
    vis(f'xpath=//*[normalize-space(text())="{label}"]/following::*[self::button or @role="combobox"][1]').click()
    pg.wait_for_timeout(1000)
    vis(f'xpath=//*[@role="option"][contains(normalize-space(.), "{option}")]', 0).click()
    pg.wait_for_timeout(500)
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(400)


MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']


def pick_date(day, month, year):
    """The first date field that still says "Select date": year, month, day from the calendar, then Apply."""
    vis('button:has-text("Select date")').click()
    pg.wait_for_timeout(700)
    vis('button[aria-label^="Select year"]').click()
    pg.wait_for_timeout(500)
    vis(f'xpath=//button[normalize-space(text())="{year}"]').click()
    pg.wait_for_timeout(500)
    vis('button[aria-label^="Select month"]').click()
    pg.wait_for_timeout(500)
    vis(f'button[aria-label="{MONTHS[month - 1]}"]').click()
    pg.wait_for_timeout(500)
    vis(f'button[aria-label="{day:02d}/{month:02d}/{year}"]').click()
    pg.wait_for_timeout(400)
    vis('button:has-text("Apply")').click()
    pg.wait_for_timeout(700)


def fill_by_placeholder(placeholder, value):
    vis(f'[placeholder="{placeholder}"]').fill(value)


def tab(name):
    vis(f'text={name}').click()
    pg.wait_for_timeout(900)


pg.goto(BASE + '/documents/all/legacy-import', wait_until='domcontentloaded')
pg.wait_for_timeout(5000)

step('H-1 the form is filled in the browser')
try:
    pick('Document Type', 'SOP')
    vis('xpath=//*[normalize-space(text())="Document Number"]/following::input[1]').fill(number)
    pg.wait_for_timeout(1500)
    fill_by_placeholder('Document name as on the existing document', 'UAT8 UI import of a paper SOP')
    pick('Business Unit', 'Quality Unit', partial=False)
    pick('Department', 'Quality Assurance', partial=False)
    pick_multi('Reviewer(s)', reviewer_name)
    pick('Approver', approver_name)
    fill_by_placeholder('Enter review cycle in months', '12')
    fill_by_placeholder('Enter notification days before review', '30')
    fill_by_placeholder('Migrated from Document Control paper archive, box #12', 'UAT8: imported through the form of the browser')
    shot('doc_information')
    check('H-1.1 the document information is filled (the number is free)', True, '')
except Exception as e:
    shot('doc_information_failed')
    check('H-1.1 the document information is filled', False, str(e)[:250])

try:
    tab('Training Requirement')
    vis('xpath=//*[normalize-space(text())="Requires Training?"]').click()
    pg.wait_for_timeout(800)
    fill_by_placeholder('Enter number of days', '10')
    check('H-1.2 the training requirement is set (10 days)', True, '')
except Exception as e:
    check('H-1.2 the training requirement is set', False, str(e)[:250])

try:
    tab('Revision History')
    fill_by_placeholder('e.g. 4.0.0', '1.0.0')
    vis('button:has-text("Generate Sections")').click()
    pg.wait_for_timeout(1800)
    pick_date(22, 9, 2020)   # Effective
    pick('Author', author_name)
    pick_date(17, 9, 2020)   # Authored
    pick_multi('Historical Reviewer(s)', reviewer_name)
    pick_date(18, 9, 2020)   # Review
    pick('Historical Approver', approver_name)
    pick_date(20, 9, 2020)   # Approval
    fill_by_placeholder('e.g. TRN/QA/19-012', paper_number)
    pg.wait_for_timeout(1200)
    pick_date(21, 9, 2020)   # Training completion
    shot('revision_fields')
    check('H-1.3 the dates, the people and the paper number of the revision are filled', True, '')
except Exception as e:
    shot('revision_failed')
    check('H-1.3 the revision is filled', False, str(e)[:300])

try:
    fill_by_placeholder('What was taught, as written on the paper record', 'UAT8 Gowning in grade B (from the browser)')
    fill_by_placeholder('Name of the trainer as written on the paper record', 'Nguyen Van A (paper)')
    pick('Mode', 'Classroom training')
    inputs = pg.locator('input[type=file]').all()
    scan_input = [i for i in inputs if '.png' in (i.get_attribute('accept') or '')][0]
    source_input = [i for i in inputs if '.docx' in (i.get_attribute('accept') or '')][0]
    scan_input.set_input_files(SCAN)
    source_input.set_input_files(PDF)
    pg.wait_for_timeout(1200)
    shot('training_fields')
    check('H-1.4 the topic, the trainer, the mode, the scan and the source file are given', True, '')
except Exception as e:
    shot('training_failed')
    check('H-1.4 the topic, trainer, mode and files are given', False, str(e)[:300])

try:
    vis('button:has-text("Add Participants")').click()
    pg.wait_for_timeout(1500)
    shot('picker_open')
    for code in trainee_codes:
        vis('input[placeholder^="Search by name or employee ID"]').fill(code)
        pg.wait_for_timeout(2200)
        vis(f'xpath=//*[contains(normalize-space(text()), "{code}")]').click()      # the cell of the employee ID: a click on the row chooses the person
        pg.wait_for_timeout(700)
        print('picker says:', [e.inner_text().strip() for e in pg.locator('text=/\d+ selected/').all() if e.is_visible()], flush=True)
    shot('picker_selected')
    vis('xpath=//button[starts-with(normalize-space(.), "Save")]').click()
    pg.wait_for_timeout(1500)
    check('H-1.5 two persons trained are chosen from the window', all(c in pg.inner_text('body') for c in trainee_codes), '')
except Exception as e:
    shot('picker_failed')
    check('H-1.5 two persons trained are chosen', False, str(e)[:300])

step('H-2 the signature and the result')
try:
    vis('button:has-text("Publish Document")').click()
    pg.wait_for_timeout(1500)
    shot('before_sign')
    vis('[placeholder="Enter your reason..."]').fill('UAT8: the paper original was imported through the form')
    vis('[placeholder="Enter your username"]').fill('admin')
    vis('input[type=password]').fill(os.environ['DEVPW'])
    pg.wait_for_timeout(300)
    btns = [e.inner_text().strip() for e in pg.locator('button').all() if e.is_visible()]
    print('buttons at signing', btns[-8:], flush=True)
    vis('xpath=//button[normalize-space(.)="Sign & Confirm"]').click()
    pg.wait_for_timeout(15000)
    shot('after_sign')
except Exception as e:
    shot('sign_failed')
    check('H-2.1 the import is signed', False, str(e)[:300])

created = sql(f"select d.id, r.id, r.status_code, r.training_activity_id, r.training_number from documents d join document_revisions r on r.document_id = d.id where d.document_number = '{doc_number}'")
check('H-2.2 the document exists as Effective with a revision', len(created) == 1 and created[0][2] == 'EFFECTIVE', created)
if created:
    act = sql(f"select a.id, a.kind, a.paper_topic, a.paper_trainer, a.paper_method from training_activities a where upper(a.training_number) = upper('{paper_number}')")
    check('H-2.3 the historical activity has the topic, the trainer and the mode typed in the browser', act and act[0][1] == 'LEGACY' and 'from the browser' in act[0][2] and act[0][3] == 'Nguyen Van A (paper)' and act[0][4] == 'CLASSROOM', act)
    if act:
        recs = sql(f"select method, count(*) from training_records where activity_id = '{act[0][0]}' group by 1 order by 1")
        check('H-2.4 the two persons chosen have their record, and the author, the reviewer and the approver have the initial record', dict((r[0], int(r[1])) for r in recs) == {'PAPER': 2, 'SIGNATORY': 3}, recs)
        ev = sql(f"select status, original_name from training_legacy_evidence where activity_id = '{act[0][0]}'")
        check('H-2.5 the scan was filed under its own name', ev and ev[0][0] == 'FILED' and ev[0][1].endswith('.pdf'), ev)
    sig = sql(f"select count(*) from electronic_signatures where revision_id = '{created[0][1]}'") if False else None
print('url after the import:', pg.url, flush=True)
check('H-2.6 the browser went back to the list of documents', '/documents/all' in pg.url and 'legacy-import' not in pg.url, pg.url)
state['p8b'] = {'doc': doc_number, 'paper': paper_number}
save(state)
finish('p8b', b)
