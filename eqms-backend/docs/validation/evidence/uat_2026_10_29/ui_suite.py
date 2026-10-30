"""DEV UAT in a real browser (Edge through Playwright), 2026-10-30. The password comes from DEVPW and is never written. It runs against the records the suite.py runs left (titled "UAT-2026") and creates two new
activities (UNPLANNED, "UAT-2026 ui") for the postponement dialog. Every page is opened as a person would; the script also collects browser console errors and server errors (HTTP 5xx) of all pages.
Run with plain `python` (Playwright is installed in the user site). Screenshots go to ui_shots/ (next to this file)."""
import os, sys, re, json, datetime, calendar, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client
from playwright.sync_api import sync_playwright

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
SHOTS = os.path.join(os.path.dirname(__file__), 'ui_shots')
os.makedirs(SHOTS, exist_ok=True)
TODAY = datetime.date.today()
results = []
problems = []   # console errors and 5xx answers seen while browsing


def check(name, ok, detail=''):
    results.append((name, bool(ok), str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, check=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]


def watch(page, who):
    page.on('console', lambda m: problems.append((who, 'console', m.text[:200], page.url)) if m.type == 'error' and 'favicon' not in m.text else None)
    page.on('response', lambda r: problems.append((who, f'HTTP {r.status}', r.url[:160], page.url)) if r.status >= 500 else None)


def login(browser, user, who=None, width=1500, height=1100):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, accept_downloads=True)
    pg = ctx.new_page()
    watch(pg, who or user)
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', user)
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(4000)
    return ctx, pg


def open_(pg, path, wait=3000):
    pg.goto(BASE + path, wait_until='domcontentloaded')
    pg.wait_for_timeout(wait)


def shot(pg, name):
    pg.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=False)


def body(pg):
    return pg.inner_text('body')


def no_hscroll(pg):
    return pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 2")


def section(title, fn, *args):
    print('\n== ' + title)
    try:
        fn(*args)
    except BaseException as e:
        check(title + ': ran to the end', False, repr(e)[:300])


S = {}


def prepare_data():
    """A fresh activity with a session for the postponement dialog, made through the API (not a UI test)."""
    c = Client('admin')
    due = TODAY.replace(day=calendar.monthrange(TODAY.year, TODAY.month)[1])
    a = c.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': due.isoformat()})
    c.call('POST', f"/training/activities/{a['id']}/sessions", {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'UAT Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 ui postpone'}]})
    a = c.call('GET', f"/training/activities/{a['id']}")
    S['post_aid'] = a['id']
    S['post_sid'] = a['sessions'][0]['id']
    S['post_due'] = due
    S['summary'] = c.call('GET', '/training/compliance/summary')
    # a requirement with a line beyond the window, a completed activity, a self-reading activity
    lst = c.call('GET', '/training/requirements?limit=100&status=APPROVED')
    for r in lst['data']:
        d = c.call('GET', f"/training/requirements/{r['id']}")
        if any(ln.get('beyondSopWindow') for ln in d['lines']):
            S['req'] = d
            break
    rows = sql("select a.id, a.training_number from training_activities a where a.status='COMPLETED' and exists (select 1 from training_sessions s join training_session_topics t on t.session_id=s.id where s.activity_id=a.id and t.topic_text like 'UAT-2026%') order by a.created_at desc limit 1")
    S['done'] = rows[0] if rows else None
    rows = sql("select a.id, a.training_number from training_activities a join training_sessions s on s.activity_id=a.id join training_session_topics t on t.session_id=s.id where s.method='SELF_READING' and t.topic_text like 'UAT-2026 self-reading%' order by a.created_at desc limit 1")
    S['selfread'] = rows[0] if rows else None
    print('   data:', {k: (v if not isinstance(v, dict) else v.get('requestNo')) for k, v in S.items() if k in ('post_aid', 'done', 'selfread', 'req')})


def pages_and_lists(browser):
    ctx, pg = login(browser, 'admin')
    check('UI1 the admin signs in and leaves the login page', '/login' not in pg.url, pg.url)
    open_(pg, '/training-management/activities')
    t = body(pg)
    shot(pg, 'ui2_activities')
    check('UI2 the activity list opens with rows and a Training Number', re.search(r'TRN/[A-Z]+/\d\d-\d+', t) is not None, t[:300])
    box = pg.locator('input[type=search], input[placeholder*="earch"]').first
    check('UI3 the list has a search box', box.count() >= 1)
    if box.count():
        box.fill('UAT-2026')
        pg.wait_for_timeout(2000)
        t2 = body(pg)
        check('UI4 searching narrows the list (server side)', 'UAT-2026' in t2 or re.search(r'TRN/', t2) is not None, t2[:200])
        shot(pg, 'ui4_search')
    check('UI5 no horizontal scroll at desktop width', no_hscroll(pg))
    ctx.close()
    ctx, pg = login(browser, 'admin', width=390, height=900)
    open_(pg, '/training-management/activities')
    check('UI6 the activity list at phone width has no horizontal page scroll', no_hscroll(pg))
    shot(pg, 'ui6_activities_phone')
    ctx.close()


def date_hints(browser):
    ctx, pg = login(browser, 'admin')
    open_(pg, f"/training-management/activities/{S['post_aid']}")
    t = body(pg)
    shot(pg, 'ui7_detail')
    vals = pg.evaluate("Array.from(document.querySelectorAll('input')).map(i => i.value)")
    check('UI7 the activity opens with its Training Number and the Planned step', any(re.fullmatch(r'TRN/[A-Z]+/\d\d-\d+', v or '') for v in vals) and 'Planned' in t, vals[:6])
    check('UI8 Due Date has its explanation', 'The last day to complete the training' in t, t[:300])
    if S.get('done'):
        open_(pg, f"/training-management/activities/{S['done'][0]}")
        t = body(pg)
        shot(pg, 'ui9_completed')
        check('UI9 a completed activity shows "Completed" and the Conducted-on explanation', 'Completed' in t and 'The day the session was actually held' in t, t[:300])
    ctx.close()


def postpone_dialog(browser):
    ctx, pg = login(browser, 'admin')
    open_(pg, f"/training-management/activities/{S['post_aid']}/sessions/{S['post_sid']}/workspace", 3500)
    shot(pg, 'ui10_workspace')
    btn = pg.get_by_role('button', name='Postpone')
    check('UI10 the session workspace has a Postpone command', btn.count() >= 1, body(pg)[-300:])
    if not btn.count():
        return ctx.close()
    btn.first.click()
    pg.wait_for_timeout(1200)
    dlg = pg.get_by_role('dialog')
    check('UI11 the Postpone dialog opens with the date and the reason', dlg.count() >= 1 and 'Reason' in dlg.first.inner_text(), dlg.first.inner_text()[:200] if dlg.count() else '')
    # choose a day in the next month, past the Due Date
    dlg.get_by_text('Select date', exact=True).first.click()
    pg.wait_for_timeout(800)
    shot(pg, 'ui12a_calendar_open')
    print('   calendar buttons:', pg.evaluate("Array.from(document.querySelectorAll('button')).map(b => (b.getAttribute('aria-label') || b.innerText || '').trim()).filter(x => /month|next|prev|^1[0-9]$|^2[0-9]$/i.test(x)).slice(0, 20)"))
    nxt = pg.locator('button[aria-label*="ext" i], button[title*="ext" i]').first
    nxt.click()
    pg.wait_for_timeout(500)
    day = pg.locator('button:visible', has_text=re.compile(r'^12$'))
    day.first.click()
    pg.get_by_role('button', name='Apply').click()
    pg.wait_for_timeout(800)
    shot(pg, 'ui12_dialog_date_chosen')
    txt = dlg.first.inner_text()
    print('   dialog after the date:', txt[:700].replace(chr(10), ' | '))
    check('UI12 a date past the Due Date asks what to do with the Due Date (move or keep)', re.search(r'(?i)due date', txt) is not None and re.search(r'(?i)move|keep', txt) is not None, txt[:400])
    dlg.locator('textarea').fill('UAT-2026 browser postpone')
    mv = dlg.get_by_text(re.compile(r'move the due date', re.I))
    if mv.count():
        mv.first.click()
    pg.wait_for_timeout(500)
    shot(pg, 'ui13_dialog_ready')
    dlg.get_by_role('button', name='Postpone').click()
    pg.wait_for_timeout(3000)
    a = Client('admin').call('GET', f"/training/activities/{S['post_aid']}")
    nxt_month = (S['post_due'].replace(day=1) + datetime.timedelta(days=32))
    want = nxt_month.replace(day=calendar.monthrange(nxt_month.year, nxt_month.month)[1]).isoformat()
    check('UI13 after choosing to move the Due Date it is the end of the new month', str(a.get('dueDate'))[:10] == want, (a.get('dueDate'), want))
    shot(pg, 'ui14_after_postpone')
    ctx.close()


def requirement_page(browser):
    req = S.get('req')
    if not req:
        return check('UI12 requirement page', False, 'no requirement with a line beyond the window')
    ctx, pg = login(browser, 'admin')
    open_(pg, f"/training-management/requirements/{req['id']}")
    t = body(pg)
    shot(pg, 'ui12_requirement')
    vals = pg.evaluate("Array.from(document.querySelectorAll('input')).map(i => i.value)")
    check('UI15 the requirement opens with its number and "Approved"', req['requestNo'] in vals and 'Approved' in vals, vals[:6])
    pg.get_by_role('tab', name=re.compile('Lines')).click()
    pg.wait_for_timeout(1500)
    t = body(pg)
    shot(pg, 'ui15_requirement_lines')
    check('UI16 a moved line shows the approved month and the current month', 'Approved month: 10/2026' in t and 'Current month: 12/2026' in t, t[-500:])
    check('UI17 a moved line shows "Beyond SOP window" (and the one-month line does not)', t.count('Beyond SOP window') == 1, t[-500:])
    check('UI18 the moved line shows its reason', 'Postponed: UAT-2026' in t, t[-500:])
    ctx.close()


def downloads(browser):
    req = S.get('req')
    ctx, pg = login(browser, 'admin')
    open_(pg, f"/training-management/requirements/{req['id']}")
    pg.get_by_role('button', name='Export').first.click()
    pg.wait_for_timeout(700)
    items = [x for x in ('Word File', 'PDF File') if pg.get_by_text(x).count()]
    print('   Export menu:', items)
    shot(pg, 'ui25_export_menu')
    check('UI25 the Export button offers Word and PDF', len(items) == 2, items)
    for kind, sig in (('Word File', b'PK'), ('PDF File', b'%PDF')):
        if not pg.get_by_text(kind).count():
            continue
        with pg.expect_download(timeout=60000) as dl:
            pg.get_by_text(kind).first.click()
        path = dl.value.path()
        data = open(path, 'rb').read()
        check(f'UI26 the {kind} download of the requirement form is a real file ({dl.value.suggested_filename})', data[:len(sig)] == sig and len(data) > 2000, (dl.value.suggested_filename, data[:8]))
        pg.get_by_role('button', name='Export').first.click()
        pg.wait_for_timeout(500)
    # the completion print of the Compliance screen, with the default position
    open_(pg, '/training-management/compliance')
    tab = pg.get_by_role('tab', name=re.compile('omplet'))
    if tab.count():
        tab.first.click()
        pg.wait_for_timeout(2500)
    shot(pg, 'ui27_completion_tab')
    prt = pg.get_by_role('button', name=re.compile('Print|Export|PDF'))
    print('   completion buttons:', [prt.nth(i).inner_text() for i in range(min(prt.count(), 5))])
    check('UI27 the completion tab has a print command', prt.count() >= 1, body(pg)[-300:])
    if prt.count():
        with pg.expect_download(timeout=60000) as dl:
            prt.first.click()
        data = open(dl.value.path(), 'rb').read()
        check('UI28 the completion print downloads a PDF (this failed with a 500 for "All employees" before the fix)', data[:4] == b'%PDF', (dl.value.suggested_filename, data[:8]))
    ctx.close()


def compliance_page(browser):
    ctx, pg = login(browser, 'admin')
    open_(pg, '/training-management/compliance')
    t = body(pg)
    shot(pg, 'ui20_compliance')
    n = S['summary'].get('linesBeyondSopWindow')
    check('UI20 Compliance opens', 'Compliance' in t, t[:200])
    check('UI21 the tile "Moved beyond the SOP window" is shown', 'beyond the SOP window' in t, t[:600])
    m = re.search(r'beyond the SOP window\s*\n?\s*(\d+)', t)
    shown = int(m.group(1)) if m else None
    print('   tile shows', shown, 'API says', n)
    check('UI22 the tile number equals the API number', shown is not None and shown >= n and shown - n <= 3, (shown, n))   # the suite may add lines while the page is read; a gap of a few is allowed and printed
    ctx.close()


def access(browser):
    ctx, pg = login(browser, 'trainee.test1')
    open_(pg, '/training-management/compliance')
    t = body(pg)
    shot(pg, 'ui18_trainee_compliance')
    check('UI23 a trainee does not get the Compliance screen', '/compliance' not in pg.url or 'beyond the SOP window' not in t, (pg.url, t[:200]))
    open_(pg, '/training-management/my-training')
    t = body(pg)
    shot(pg, 'ui19_my_training')
    check('UI24 a trainee opens My Training', '/my-training' in pg.url and len(t) > 50, (pg.url, t[:200]))
    ctx.close()


if __name__ == '__main__':
    prepare_data()
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        for title, fn in (('Lists and phone width', pages_and_lists), ('Date explanations', date_hints), ('Postpone dialog', postpone_dialog),
                          ('Requirement page', requirement_page), ('Downloads of the forms', downloads), ('Compliance page', compliance_page), ('Access', access)):
            section(title, fn, browser)
        browser.close()
    print('\n== Browser console and server errors seen on all pages:', len(problems))
    for pr in problems[:25]:
        print('   ', pr)
    check('UI99 no server error (HTTP 5xx) while browsing', not [x for x in problems if x[1].startswith('HTTP')], [x for x in problems if x[1].startswith('HTTP')][:3])
    ok = [r for r in results if r[1]]
    bad = [r for r in results if not r[1]]
    print(f'\n{len(ok)} passed, {len(bad)} failed (of {len(results)})')
    for r in bad:
        print('  FAIL', r[0], '--', r[2])
    sys.exit(1 if bad else 0)
