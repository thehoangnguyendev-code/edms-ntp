"""T4-C, the one shot that failed in the first run (the button is "Huỷ buổi" in Vietnamese): the Cancel session dialog in Vietnamese on the Planned activity of that run."""
import re
from lib24 import *
import lib31

b = Browser()
S = load()
A = 'uat31.s2.qa.pass'
pl = new_activity('T4 Vietnamese cancel dialog')
v1 = add_session(pl, 'CLASSROOM', 'TEST', 'RUN24 T4C dialog part 1')
v2 = add_session(pl, 'CLASSROOM', 'TEST', 'RUN24 T4C dialog part 2')
people_on(pl, v1, [A])
people_on(pl, v2, [A])
link(pl, 'RUN24 T4C material')
choose_test(pl, v1)
choose_test(pl, v2)
confirm_list(pl)
mine = admin.call('GET', '/auth/me/localization-settings')
admin.call('PUT', '/auth/me/localization-settings', {**mine, 'language': 'vi'})
try:
    def open_cancel_dialog(pg):
        pg.get_by_role('button', name=re.compile('Cancel session|Huỷ buổi')).last.click()
        pg.wait_for_timeout(1800)
    b.shot('admin', f'/training-management/activities/{pl}/edit', 'T4C-05', 'VI_cancel_session_dialog', 'T4-C (tiếng Việt): hộp thoại Huỷ buổi', action=open_cancel_dialog, tall=False)
finally:
    admin.call('PUT', '/auth/me/localization-settings', {**mine, 'language': mine.get('language')})
lib31.finish('T4_vi', b)
