"""DEV browser check, 2026-10-30, of the impact assessment dialog of Document Impact Assessment (was Document Trainings): the second result is shown as unavailable with its reason, and the Work Positions are a table (search, sort, paging,
choice kept across pages) answered by the server. Nothing is signed or saved. The password comes from DEVPW and is never written. Run with plain `python`; screenshots ui_shots/impact_*.png."""
import os, sys, re
from playwright.sync_api import sync_playwright

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
SHOTS = os.path.join(os.path.dirname(__file__), 'ui_shots')
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    ctx = b.new_context(viewport={'width': 1500, 'height': 1300})
    pg = ctx.new_page()
    reqs = []
    pg.on('request', lambda r: reqs.append(r.url) if '/impact-assessment/positions' in r.url else None)
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', 'admin')
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(4000)
    pg.goto(BASE + '/training-management/document-impact-assessment', wait_until='domcontentloaded')
    pg.wait_for_timeout(3500)
    pg.get_by_role('button', name='More actions').first.click()
    pg.get_by_text(re.compile('Assess Impact|Assess Again')).first.click()
    pg.get_by_text('Result Of The Assessment').first.wait_for(timeout=15000)
    pg.wait_for_timeout(800)
    dlg = pg.get_by_role('dialog')
    pg.screenshot(path=os.path.join(SHOTS, 'impact_dialog_open.png'))
    covers = pg.get_by_label('The effective matrix already covers the document')
    disabled = covers.get_attribute('aria-disabled') == 'true' or covers.is_disabled()
    has_hint = pg.get_by_text('Available only when the effective matrix already has this document.').count() == 1
    ctx_text = dlg.inner_text()
    if 'does not have this document' in ctx_text or 'no effective matrix' in ctx_text:
        check('IM1 the second result is unavailable here, and the dialog says why', disabled and has_hint, (disabled, has_hint))
    else:
        check('IM1 the second result is available when the effective matrix has the document (no hint)', (not disabled) and not has_hint, (disabled, has_hint))
    pg.get_by_label('The matrix must be updated').check()
    pg.wait_for_timeout(1500)
    pg.screenshot(path=os.path.join(SHOTS, 'impact_positions_table.png'))
    check('IM2 the Work Positions are a table with a search box above', dlg.get_by_role('textbox', name='Search Work Positions').count() == 1 and dlg.get_by_role('columnheader', name=re.compile('Work Position', re.I)).count() >= 1)
    check('IM3 the table has sortable headers and the column "In The Matrix"', dlg.get_by_role('columnheader', name=re.compile('Code', re.I)).count() == 1 and dlg.get_by_role('columnheader', name=re.compile('In The Matrix', re.I)).count() == 1)
    rows = dlg.locator('tbody tr')
    n1 = rows.count()
    check('IM4 a page holds 10 rows at most (paging by the server)', 1 <= n1 <= 10, n1)
    first = dlg.get_by_role('checkbox').nth(1)
    pg.locator('label[for="' + first.get_attribute('id') + '"]').click()   # the box is a hidden input with a drawn label
    check('IM5 a position can be selected and the count is shown', dlg.get_by_text('1 selected').count() == 1)
    nxt = dlg.get_by_role('button', name='Next')
    if nxt.count() and nxt.first.is_enabled():
        nxt.first.click()
        pg.wait_for_timeout(1500)
        check('IM6 the choice is kept on the next page', dlg.get_by_text('1 selected').count() == 1)
        check('IM7 the second page was asked from the server (page=2)', any('page=2' in u for u in reqs), reqs[-2:])
    else:
        print('   only one page of positions')
    del reqs[:]
    dlg.get_by_role('textbox', name='Search Work Positions').fill('QA')
    pg.wait_for_timeout(1800)
    check('IM8 typing in the search asks the server (search=QA, page=1)', any('search=QA' in u and 'page=1' in u for u in reqs), reqs[-2:])
    del reqs[:]
    dlg.get_by_role('columnheader', name=re.compile('Code', re.I)).click()
    pg.wait_for_timeout(1500)
    check('IM9 a click on a header sorts on the server (sortBy=code)', any('sortBy=code' in u for u in reqs), reqs[-2:])
    pg.screenshot(path=os.path.join(SHOTS, 'impact_positions_after.png'))
    w = pg.evaluate("document.querySelector('[role=dialog]').getBoundingClientRect().width")
    print('   dialog width:', w)
    b.close()

ok = [r for r in results if r[1]]
bad = [r for r in results if not r[1]]
print(f'\n{len(ok)} passed, {len(bad)} failed (of {len(results)})')
for r in bad:
    print('  FAIL', r[0], '--', r[2])
sys.exit(1 if bad else 0)
