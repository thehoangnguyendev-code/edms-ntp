"""Scenario 4, part c: the Supplementary training dialog. The first run could not find the button; this run reads the capability of each activity and takes the pictures of the dialog on an activity where the make-up is still to be arranged
(a fresh small activity is used when the activities of the scenarios have all their make-ups made: a make-up already arranged is not offered twice)."""
from flows31 import *

state = load()
S1, S2 = state['s1'], state['s2']
for k, aid in (('S1 rev2', S1['aid2']), ('S2', S2['aid'])):
    a = get(aid)
    print(k, a['trainingNumber'], a['status'], 'addSupplementary =', a['capabilities'].get('addSupplementary'), 'pending =', a.get('supplementaryPending'), 'blocked =', a.get('supplementaryBlocked'))
drop_shots(['S4-01', 'S4-04'])
b = Browser()


def open_dialog(pg):
    pg.get_by_role('button', name=re.compile('Supplementary training', re.I)).first.click()
    pg.wait_for_timeout(1500)


# the original activity of scenario 2 still has two people who left that cannot be offered: the notice is shown on the activity page; the dialog lists the candidates
b.shot('admin', f"/training-management/activities/{S2['aid']}/conduct", 'S4-04', 'Activity_no_document_supplementary_dialog', 'Activity không từ tài liệu: hộp thoại Supplementary training — người vắng / trượt đã có đào tạo bù được đánh dấu, 2 người nghỉ việc bị khoá kèm lý do', action=open_dialog)
b.shot('admin', f"/training-management/activities/{S1['aid2']}/conduct", 'S4-01', 'Activity_rev2_supplementary_dialog', 'Activity revision 2: hộp thoại Supplementary training — người nghỉ việc bị khoá kèm lý do, người vắng / trượt đã nằm trong đào tạo bù', action=open_dialog)
finish('p4c', b)
