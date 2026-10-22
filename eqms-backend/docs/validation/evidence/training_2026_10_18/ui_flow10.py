import os, json
from playwright.sync_api import sync_playwright
from ui import session, BASE
st = json.load(open('checkin_ui.json')); PW = os.environ['DEVPW']
with sync_playwright() as p:
    b1, pg = session(p, 'trainer.test1')
    pg.goto(f"{BASE}/training-management/activities/{st['aid']}/conduct"); pg.wait_for_timeout(3500)
    pg.get_by_role('button', name='Open the check-in').click(); pg.wait_for_timeout(2000)
    pg.screenshot(path='shots/ui_checkin_trainer.png', full_page=True)
    code = pg.get_by_label('Check-in code').inner_text().strip(); print('code', code)
    b1.close()
    b2, tp = session(p, 'trainee.test1')
    bad = []
    tp.on('response', lambda x: bad.append(f'{x.status} {x.url.split("/api")[-1][:70]}') if x.status >= 400 and '/api/' in x.url else None)
    tp.goto(f'{BASE}/training-management/check-in?code={code}'); tp.wait_for_timeout(2500)
    tp.screenshot(path='shots/ui_checkin_trainee.png')
    tp.get_by_role('button', name='Continue to sign').click(); tp.wait_for_timeout(1000)
    d = tp.locator('[role=dialog]').last
    d.locator('textarea').fill('I am present')
    d.get_by_placeholder('Enter your username').fill('trainee.test1')
    d.get_by_placeholder('Enter your password').fill(PW)
    d.get_by_role('button', name='Sign & Confirm').click(); tp.wait_for_timeout(3000)
    tp.screenshot(path='shots/ui_checkin_done.png')
    print('trainee bad', bad); b2.close()
