"""Part e: My Training is a group of the menu with two pages, My Tasks and My Records; the earlier address and the links with ?tab= still arrive."""
from flows31 import *
b = Browser()
def open_group(pg):
    pg.wait_for_timeout(1500)
    try:
        els = [e for e in pg.get_by_text('My Training', exact=True).all() if e.is_visible()]
        if els: els[0].click()
    except Exception: pass
b.shot('trainee.test1' if False else 'admin', '/training-management/my-training', 'F-20', 'My_Training_redirects_to_My_Tasks', 'Địa chỉ cũ /my-training chuyển sang My Tasks; menu My Training có hai mục con My Tasks và My Records', action=open_group)
pg = b.page('admin')
check('F-20.1 the earlier address arrives at My Tasks', pg.url.endswith('/training-management/my-training/tasks'), pg.url)
check('F-20.2 the menu shows My Tasks and My Records under My Training', pg.get_by_text('My Tasks', exact=True).count() >= 1 and pg.get_by_text('My Records', exact=True).count() >= 1, '')
tabs = [t.inner_text().split('\n')[0] for t in pg.get_by_role('tab').all() if t.is_visible()]
check('F-20.3 My Tasks has the tabs To Do and Pending My Signature', tabs[:2] == ['To Do', 'Pending My Signature'] or all(x in ' '.join(tabs) for x in ('To Do', 'Pending My Signature')), tabs)
pg.goto(BASE + '/training-management/my-training?tab=copies', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
check('F-20.4 ?tab=copies arrives at My Records, tab Copies Received', pg.url.endswith('/my-training/records?tab=copies'), pg.url)
b.shot('admin', None, 'F-21', 'My_Records_copies_tab', 'My Records: hai tab My Records và Copies Received (đang ở Copies Received); không có nút Check in')
pg.goto(BASE + '/training-management/my-training?tab=sign', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
check('F-20.5 ?tab=sign arrives at My Tasks, tab Pending My Signature', pg.url.endswith('/my-training/tasks?tab=sign'), pg.url)
b.shot('admin', None, 'F-22', 'My_Tasks_pending_signature_tab', 'My Tasks: hai tab To Do và Pending My Signature (đang ở Pending My Signature), có nút Check in')
finish('p6e', b)
