from flows31 import *
b = Browser(); pg = b.page('admin')
pg.goto(BASE + '/documents/all/legacy-import', wait_until='domcontentloaded'); pg.wait_for_timeout(4500)
def vis(sel, n=0):
    els = [e for e in pg.locator(sel).all() if e.is_visible()]
    return els[n]
vis('text=Revision History').click(); pg.wait_for_timeout(700)
vis('input[placeholder="e.g. 4.0.0"]').fill('1.0.0'); vis('button:has-text("Generate Sections")').click(); pg.wait_for_timeout(1500)
vis('xpath=//*[normalize-space(text())="Author"]/following::*[self::button or @role="combobox"][1]').click(); pg.wait_for_timeout(1500)
print('OPTIONS role', [e.inner_text().strip()[:60] for e in pg.locator('[role=option]').all() if e.is_visible()][:6])
print('LISTBOX', [e.get_attribute('class')[:60] if e.get_attribute('class') else '' for e in pg.locator('[role=listbox]').all() if e.is_visible()][:3])
html = pg.evaluate("""() => { const o = [...document.querySelectorAll('[role=option]')].find(e => e.offsetParent); return o ? o.parentElement.outerHTML.slice(0, 700) : 'no role=option'; }""")
print('HTML', html)
b.close()
