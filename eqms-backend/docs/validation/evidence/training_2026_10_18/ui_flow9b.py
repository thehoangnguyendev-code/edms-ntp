import os, json, time
from playwright.sync_api import sync_playwright
from ui import session, BASE
st = json.load(open('exam_ui.json')); PW = os.environ['DEVPW']
with sync_playwright() as p:
    # 2. the trainee screen
    b2, pg = session(p, 'trainee.test2')
    bad2 = []
    pg.on('response', lambda x: bad2.append(f'{x.status} {x.url.split("/api")[-1][:70]}') if x.status >= 400 and '/api/' in x.url else None)
    pg.goto(f'{BASE}/training-management/my-training'); pg.wait_for_timeout(3000)
    pg.screenshot(path='shots/ui_trainee_todo.png')
    pg.get_by_role('button', name='TRN/QA', exact=False).first.click(); pg.wait_for_timeout(2500)
    pg.screenshot(path='shots/ui_exam_start.png')
    if pg.get_by_role('button', name='Start the test').count(): pg.get_by_role('button', name='Start the test').click(); pg.wait_for_timeout(1500)
    pg.screenshot(path='shots/ui_exam_questions.png')
    pg.get_by_text('B. 70%').click()
    pg.get_by_text('A. Attributable').click()
    pg.get_by_text('C. Legible').click()
    pg.get_by_text('True', exact=True).click()
    pg.screenshot(path='shots/ui_exam_answered.png')
    pg.get_by_role('button', name='Finish and sign').click(); pg.wait_for_timeout(1000)
    dlg = pg.locator('[role=dialog]').last
    dlg.locator('textarea').fill('I completed the test')
    dlg.get_by_placeholder('Enter your username').fill('trainee.test2')
    dlg.get_by_placeholder('Enter your password').fill(PW)
    dlg.get_by_role('button', name='Sign & Confirm').click(); pg.wait_for_timeout(3500)
    pg.screenshot(path='shots/ui_exam_result.png')
    print('trainee bad', bad2)
    b2.close()
