"""Exploration: the year list of the date picker and the window that chooses the persons trained."""
from flows31 import *

b = Browser()
pg = b.page('admin')
pg.goto(BASE + '/documents/all/legacy-import', wait_until='domcontentloaded')
pg.wait_for_timeout(5000)


def vis(selector):
    els = [e for e in pg.locator(selector).all() if e.is_visible()]
    if not els:
        raise RuntimeError('nothing visible for ' + selector)
    return els[0]


def dump(tag, n=45):
    print(tag, [(e.inner_text().strip()[:28], e.get_attribute('aria-label')) for e in pg.locator('button').all() if e.is_visible()][-n:], flush=True)


vis('text=Training Requirement').click(); pg.wait_for_timeout(800)
vis('xpath=//*[normalize-space(text())="Requires Training?"]').click(); pg.wait_for_timeout(800)
vis('text=Revision History').click(); pg.wait_for_timeout(800)
vis('input[placeholder="e.g. 4.0.0"]').fill('1.0.0')
vis('button:has-text("Generate Sections")').click(); pg.wait_for_timeout(1800)
vis('text=Select date').click(); pg.wait_for_timeout(1000)
vis('button[aria-label^="Select year"]').click(); pg.wait_for_timeout(800)
dump('YEAR LIST', 40)
pg.screenshot(path=os.path.join(SHOTS, 'F-99__picker_year.png'))
try:
    vis('xpath=//button[normalize-space(text())="2020"]').click(); pg.wait_for_timeout(600)
    dump('AFTER YEAR', 30)
    vis('button[aria-label^="Select month"]').click(); pg.wait_for_timeout(600)
    dump('MONTH LIST', 24)
except Exception as e:
    print('year pick failed', str(e)[:150])
b.close()
