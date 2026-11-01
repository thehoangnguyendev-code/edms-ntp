"""DEV UAT sweep in a real browser (Edge through Playwright), 2026-10-30: every Training Management screen, for six accounts. The password comes from DEVPW and is never written.
Part 1 (access): for each account and each route, the permission the route asks for is read from the DB (user -> access profile -> permission sets, read-only) and the browser must show the screen when
the account holds it and must not show it when it does not. Part 2 (render): the admin opens every list and a detail page of each kind; the page must have a heading, no error text, and no
HTTP 5xx; the lists are also opened at phone width (no horizontal page scroll). Run with plain `python`. Screenshots: ui_shots/sweep_*.png."""
import os, sys, re, subprocess
from playwright.sync_api import sync_playwright

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
SHOTS = os.path.join(os.path.dirname(__file__), 'ui_shots')
os.makedirs(SHOTS, exist_ok=True)
results, problems, refused = [], [], []
USERS = ['admin', 'approver.test1', 'trainer.test1', 'user.a.test', 'trainee.test1', 'trainee.test2']

# route -> permission the route asks for (TrainingRoutes.tsx); None = no extra permission beyond training.module.view
LISTS = {
    'activities': 'training.activity.view', 'assessments': None, 'matrix': 'training.matrix.view', 'document-impact-assessment': 'training.matrix.view',
    'records': 'training.record.view', 'job-assignments': 'training.job_assignment.view', 'personnel-reviews': 'training.job_assignment.view',
    'specimen-signatures': None, 'record-exports': 'training.record.export', 'requirements': 'training.requirement.view', 'legacy-evidence': 'training.activity.view',
    'compliance': 'training.compliance.view', 'number-allocation-log': 'training.compliance.view', 'my-training': 'training.self.view',
}


def check(name, ok, detail=''):
    results.append((name, bool(ok), str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, check=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]


def perms_of(user):
    rows = sql("select distinct p.code from app_users u join user_access_profiles uap on uap.user_id=u.id join access_profile_permission_sets aps on aps.access_profile_id=uap.access_profile_id "
               "join permission_set_items psi on psi.permission_set_id=aps.permission_set_id join permissions p on p.id=psi.permission_id where u.username='" + user + "'")
    return {r[0] for r in rows}


def login(browser, user, width=1500, height=1000):
    ctx = browser.new_context(viewport={'width': width, 'height': height})
    pg = ctx.new_page()
    pg.on('console', lambda m: problems.append((user, 'console', m.text[:160], pg.url)) if m.type == 'error' and 'favicon' not in m.text else None)
    pg.on('response', lambda r: problems.append((user, f'HTTP {r.status}', r.url[:140], pg.url)) if r.status >= 500 else None)
    pg.on('response', lambda r: refused.append((user, r.status, r.request.method, r.url.replace('http://localhost:3000', '')[:110], pg.url.replace(BASE, ''))) if 400 <= r.status < 500 and '/api/' in r.url else None)
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', user)
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(3500)
    return ctx, pg


ERROR_RE = re.compile(r"something went wrong|unexpected error|access denied|not authorized|forbidden|page not found|no permission|don't have permission|do not have permission", re.I)


def classify(pg, path):
    """'shown' when the screen of the route is on the page; 'denied' when the app sent the person away or says so; 'error' on a broken page."""
    pg.goto(BASE + '/training-management/' + path, wait_until='domcontentloaded')
    pg.wait_for_timeout(2200)
    t = pg.inner_text('body')
    if '/training-management/' + path.split('?')[0] not in pg.url or ERROR_RE.search(t):
        return 'denied'
    return 'shown' if pg.locator('h1').count() else 'error'


def part1_access(browser):
    print('\n== Part 1: access by account (route shown only when the permission is held)')
    for user in USERS:
        have = perms_of(user)
        ctx, pg = login(browser, user)
        wrong = []
        rows = []
        for path, perm in LISTS.items():
            got = classify(pg, path)
            want_shown = ('training.module.view' in have) and (perm is None or perm in have)
            rows.append(f"{path}:{got}")
            if (got == 'shown') != want_shown:
                wrong.append((path, perm, 'expected ' + ('shown' if want_shown else 'denied'), 'got ' + got))
            if user == 'trainee.test1':
                pg.screenshot(path=os.path.join(SHOTS, f"sweep_access_{user}_{path}.png")) if got != 'denied' and path in ('activities', 'compliance') else None
        print('  ', user, ' '.join(rows))
        check(f'AC {user}: every screen is shown exactly when its permission is held ({len(have)} permissions)', not wrong, wrong[:4])
        ctx.close()


def ids():
    q = lambda s: (sql(s) or [[None]])[0][0]
    return {
        'matrix': q("select v.id from training_matrix_versions v order by v.created_at desc limit 1"),
        'job-assignments': q("select id from training_job_assignments where status='EFFECTIVE' order by created_at desc limit 1"),
        'job-assignments (draft)': q("select id from training_job_assignments where status='DRAFT' order by created_at desc limit 1"),
        'personnel-reviews': q("select id from training_personnel_reviews order by created_at desc limit 1"),
        'specimen-signatures': q("select id from training_specimen_signatures order by created_at desc limit 1"),
        'assessments': q("select id from training_assessment_defs order by created_at desc limit 1"),
        'requirements': q("select id from training_requirements order by created_at desc limit 1"),
    }


def part2_render(browser):
    print('\n== Part 2: the admin opens every list and a detail page of each kind')
    ctx, pg = login(browser, 'admin')
    for path in LISTS:
        pg.goto(BASE + '/training-management/' + path, wait_until='domcontentloaded')
        pg.wait_for_timeout(2500)
        t = pg.inner_text('body')
        pg.screenshot(path=os.path.join(SHOTS, f'sweep_list_{path}.png'))
        check(f'RD list {path}: a heading, no error text', pg.locator('h1').count() >= 1 and not ERROR_RE.search(t), t[:160])
        empty = re.search(r'No .* (found|yet)|No data|Nothing', t, re.I)
        print('   ', path, 'rows/empty:', 'empty state' if empty else 'has content')
    for kind, id_ in ids().items():
        base = kind.split(' ')[0]
        if not id_:
            check(f'RD detail {kind}', False, 'no such record on DEV to open (NOT RUN in effect)')
            continue
        pg.goto(BASE + f'/training-management/{base}/{id_}', wait_until='domcontentloaded')
        pg.wait_for_timeout(3000)
        t = pg.inner_text('body')
        pg.screenshot(path=os.path.join(SHOTS, f"sweep_detail_{kind.replace(' ', '_').replace('(', '').replace(')', '')}.png"))
        check(f'RD detail {kind}: a heading, tabs, no error text', pg.locator('h1').count() >= 1 and pg.get_by_role('tab').count() >= 1 and not ERROR_RE.search(t), t[:160])
    ctx.close()
    ctx, pg = login(browser, 'admin', width=390, height=900)
    bad = []
    for path in LISTS:
        pg.goto(BASE + '/training-management/' + path, wait_until='domcontentloaded')
        pg.wait_for_timeout(2000)
        if not pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 2"):
            bad.append(path)
            pg.screenshot(path=os.path.join(SHOTS, f'sweep_phone_{path}.png'))
    check('RD phone width: no list has a horizontal page scroll', not bad, bad)
    ctx.close()


if __name__ == '__main__':
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        for fn in (part1_access, part2_render):
            try:
                fn(browser)
            except BaseException as e:
                check(fn.__name__ + ': ran to the end', False, repr(e)[:300])
        browser.close()
    print()
    print('== requests the server refused (4xx) while browsing:', len(refused))
    seen = {}
    for u, st, m, url, page in refused:
        seen.setdefault((u, st, m, url.split('?')[0], page), 0)
        seen[(u, st, m, url.split('?')[0], page)] += 1
    for k, n in seen.items():
        print('   ', n, k)
    keys = [x for x in problems if x[1] == 'console' and 'unique "key"' in x[2]]
    others = [x for x in problems if x[1] == 'console' and 'unique "key"' not in x[2]]
    five = [x for x in problems if x[1].startswith('HTTP')]
    print(f'\n== browser problems: {len(keys)} "unique key" warnings, {len(others)} other console errors, {len(five)} HTTP 5xx')
    for x in (others + five)[:15]:
        print('   ', x)
    check('RD99 no HTTP 5xx while browsing every screen', not five, five[:3])
    check('RD98 no "unique key" warning', not keys, len(keys))
    ok = [r for r in results if r[1]]
    bad = [r for r in results if not r[1]]
    print(f'\n{len(ok)} passed, {len(bad)} failed (of {len(results)})')
    for r in bad:
        print('  FAIL', r[0], '--', r[2])
    sys.exit(1 if bad else 0)
