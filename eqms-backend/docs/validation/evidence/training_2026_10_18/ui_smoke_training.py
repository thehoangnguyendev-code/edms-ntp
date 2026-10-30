"""DEV: opens every screen of Training Management and of Training Administration in the real Edge browser (Playwright), signed in as the administrator, and reports what the browser saw: the
errors of the console, the exceptions of the page, the calls of the API that failed, and whether the page has its title and some content. It also takes a picture of each screen into the folder given
as the first argument. It is a smoke test: it proves that a screen opens and loads its data, not that every button does the right thing. The password comes from DEVPW."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)
BASE = 'http://localhost:3000'
ROUTES = [
    ('my-training', '/training-management/my-training'), ('activities', '/training-management/activities'), ('activity-new', '/training-management/activities/new'),
    ('assessments', '/training-management/assessments'), ('matrix', '/training-management/matrix'), ('document-trainings', '/training-management/document-trainings'),
    ('requirements', '/training-management/requirements'), ('job-assignments', '/training-management/job-assignments'), ('personnel-reviews', '/training-management/personnel-reviews'),
    ('specimen-signatures', '/training-management/specimen-signatures'), ('records', '/training-management/records'), ('compliance', '/training-management/compliance'),
    ('compliance-gaps', '/training-management/compliance?tab=gaps'), ('compliance-completion', '/training-management/compliance?tab=completion'),
    ('number-log', '/training-management/number-log'), ('record-exports', '/training-management/record-exports'), ('legacy-evidence', '/training-management/legacy-evidence'),
    ('properties', '/settings/administration/training/properties'), ('properties-assessment', '/settings/administration/training/properties?tab=assessment'),
    ('vendors', '/settings/administration/training/vendors'), ('job-roles', '/settings/administration/training/job-roles'),
    ('notifications', '/settings/administration/training/notifications'),
]

USER = os.environ.get('SMOKE_USER', 'admin')
bad = 0
bad = 0
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    # the person signs in on the screen of the application, as a user does
    login = context.new_page()
    login.goto(BASE + '/login', wait_until='domcontentloaded', timeout=30000)
    login.fill('#username', USER)
    login.fill('#current-password', os.environ['DEVPW'])
    login.click('button[type=submit]')
    login.wait_for_timeout(4000)
    if '/login' in login.url:
        print('THE SIGN IN FAILED: the screens below cannot be checked')
        sys.exit(1)
    login.close()
    for name, route in ROUTES:
        page = context.new_page()
        console, errors, failed = [], [], []
        page.on('console', lambda m, c=console: c.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e, x=errors: x.append(str(e)))
        page.on('response', lambda r, f=failed: f.append(f'{r.status} {r.url.split("/api/")[-1][:90]}') if r.status >= 400 and '/api/' in r.url else None)
        try:
            page.goto(BASE + route, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)
            title = (page.locator('h1').first.inner_text(timeout=3000) if page.locator('h1').count() else '')
            text = page.inner_text('body'); old = ('Job Role' in text)
            page.screenshot(path=os.path.join(OUT, name + '.png'))
        except Exception as e:  # the page did not open
            title, text, old = '', '', False
            errors.append('NOT OPENED: ' + str(e)[:160])
        signed_out = 'Sign In To Your Account' in title or '/login' in page.url
        if signed_out:
            errors.append('SIGNED OUT')
        ok = bool(title) and len(text) > 200 and not errors
        # the console error of a failed call repeats the call: only the calls and the exceptions are reported
        real_console = [c for c in console if 'Failed to load resource' not in c]
        flag = 'OK  ' if ok and not failed and not real_console and not old else 'CHECK'
        if flag != 'OK  ':
            bad += 1
        print(f'{flag} {name:24} h1="{title[:40]}" chars={len(text)}' + (f' failed={failed[:3]}' if failed else '') + (f' console={real_console[:2]}' if real_console else '') + (f' errors={errors[:2]}' if errors else '') + (' OLD-NAME Job Role' if old else ''))
        page.close()
    browser.close()
print('screens with something to look at:', bad, 'of', len(ROUTES))
