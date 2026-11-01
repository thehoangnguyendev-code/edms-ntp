"""DEV browser check, 2026-10-30: typing in a table search keeps the rows on screen (dimmed) and never swaps the table for the loading block. Password from DEVPW, never written. Plain `python`."""
import os, sys
from playwright.sync_api import sync_playwright
PW = os.environ['DEVPW']; BASE = 'http://localhost:3000'
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_context(viewport={'width': 1500, 'height': 1000}).new_page()
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', 'admin'); pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click(); pg.wait_for_timeout(4000)
    res = {}
    for name, url in [('training activities', '/training-management/document-impact-assessment'), ('users', '/security-authorization/user-management')]:
        pg.goto(BASE + url, wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
        pg.evaluate("""() => { window.__gaps = 0; window.__busy = 0; const t = () => { const rows = document.querySelectorAll('tbody tr').length; if (rows === 0) window.__gaps++; if (document.querySelector('[aria-busy=true]')) window.__busy++; requestAnimationFrame(t); }; t(); }""")
        box = pg.locator('input[aria-label^=Search]:visible').first
        if box.count() == 0: print('no search box on', name); continue
        box.click(); box.press_sequentially('a', delay=120); pg.wait_for_timeout(1500); box.fill(''); pg.wait_for_timeout(1500)
        res[name] = pg.evaluate('[window.__gaps, window.__busy]')
        print(name, 'frames without rows / frames busy:', res[name])
    b.close()
bad = [k for k, v in res.items() if v[0] > 0]
print('FAIL' if bad or not res else 'PASS', bad); sys.exit(1 if bad or not res else 0)
