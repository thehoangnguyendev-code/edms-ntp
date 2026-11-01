"""Scenario 1, part c: the pictures of the final state of the activity of revision 2 (each tab), of the Training Information of the revision, and of the work-suspension flag of the person who failed.
Replaces the first pictures that opened on the General Information tab only."""
from flows31 import *

state = load()
S = state['s1']
aid, rid = S['aid2'], S['rid2']
drop_shots(['S1-04', 'S1-06', 'S1-09', 'S1-10'])
b = Browser()
A = f'/training-management/activities/{aid}'
b.shot('admin', A, 'S1-14', 'Activity_rev2_Participants_tab', 'Activity revision 2, tab Participants: 5 nhân sự với trạng thái và kết quả (đạt / trượt / vắng / nghỉ việc)', action=tab('Participants'))
b.shot('admin', A, 'S1-15', 'Activity_rev2_Assessment_tab', 'Activity revision 2, tab Assessment: điểm số từng người', action=tab('Assessment'))
b.shot('admin', A, 'S1-16', 'Activity_rev2_Signatures_tab', 'Activity revision 2, tab Signatures: các chữ ký điện tử (danh sách, nội dung, gửi danh sách, Finish Training, QA xác nhận)', action=tab('Signatures'))
b.shot('admin', A, 'S1-17', 'Activity_rev2_Audit_Trail_tab', 'Activity revision 2, tab Audit Trail: lịch sử thao tác', action=tab('Audit Trail'))
b.shot('admin', f'/documents/revisions/{rid}', 'S1-18', 'Revision_2_Training_Information_tab', 'Revision 2 (Effective), tab Training Information: thông tin đào tạo gắn với revision', action=tab('Training Information'))
b.shot('admin', '/training-management/compliance', 'S1-19', 'Compliance_open_tab', 'Màn Compliance (mở lần đầu) để tìm cờ tạm ngừng việc của người trượt')
check('S1-c.1 the pictures were taken', all(os.path.exists(os.path.join(SHOTS, x['file'])) for x in json.load(open(INDEX, encoding='utf-8')) if x['kind'] == 'shot' and x['id'].startswith('S1-1') and 'path' in x))
finish('p1c', b)
