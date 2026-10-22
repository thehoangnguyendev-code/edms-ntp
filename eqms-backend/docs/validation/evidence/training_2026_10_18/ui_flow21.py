import os
from playwright.sync_api import sync_playwright
from ui import session, BASE
from api import Client
aid = open('editor_act.txt').read().strip()
with sync_playwright() as p:
    b, pg = session(p, 'admin'); bad = []
    pg.on('response', lambda x: bad.append(f'{x.status} {x.url.split("/api")[-1][:90]}') if x.status >= 400 and '/api/' in x.url else None)
    pg.goto(f'{BASE}/training-management/activities/{aid}/edit'); pg.wait_for_timeout(3500)
    pg.get_by_role('tab', name='Assessment').click(); pg.wait_for_timeout(2500)
    pg.screenshot(path='shots/ui_ed_zone.png', full_page=True)
    pg.get_by_role('button', name='Start from APD.0009 2.0.0').click()
    pg.wait_for_timeout(8000); pg.screenshot(path='shots/ui_ed_after_click.png'); print('bad so far', bad)
    pg.wait_for_selector('iframe', timeout=60000); pg.wait_for_timeout(15000)
    pg.screenshot(path='shots/ui_ed_open.png')
    pg.mouse.click(600, 420); pg.wait_for_timeout(500)
    pg.keyboard.press('Control+End'); pg.keyboard.type(' EDITED BY PLAYWRIGHT ', delay=40); pg.wait_for_timeout(1000)
    pg.mouse.click(141, 71); pg.wait_for_timeout(9000)
    pg.screenshot(path='shots/ui_ed_typed.png')
    pg.get_by_label('Close editor').click(); pg.wait_for_timeout(12000)
    pg.screenshot(path='shots/ui_ed_closed.png', full_page=True)
    print('bad', bad); b.close()
a = Client('admin'); f = a.call('GET', f'/training/activities/{aid}/files')
print([(m['purpose'], m['originalName'], m['sha256'][:10], m.get('removedAt') is not None) for m in f['materials']])
