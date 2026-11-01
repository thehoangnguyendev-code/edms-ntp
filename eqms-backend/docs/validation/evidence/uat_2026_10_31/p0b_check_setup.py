"""Phase 0b: every UAT31 account signs in with the run password; the heads of the three departments are set for the run; one screenshot proves the browser and the name scheme work."""
from lib31 import *

step('0.1 every test account signs in')
for u in PEOPLE:
    try:
        c = U(u)
        check(f'0.1 {u} signs in', bool(c.token), c.user.get('username'))
    except SystemExit as e:
        check(f'0.1 {u} signs in', False, e)

step('0.2 the heads of the three departments are set for the run (put back by the harness)')
for dept, head in (('Quality Assurance', 'uat31.head.qa'), ('Quality Control', 'uat31.head.qc'), ('Production', 'uat31.head.prod')):
    set_head(dept, head)
    got = sql(f"select u.username from departments d join app_users u on u.id = d.department_head_id where d.name = '{dept}'")
    check(f'0.2 head of {dept}', got == [[head]], got)

step('0.3 the browser and the name scheme')
b = Browser()
b.shot('uat31.s1.pass1', '/training-management/my-training', 'S0-01', 'My_Training_of_a_trainee', 'Màn My Training của nhân sự test (uat31.s1.pass1) — kiểm tra trình duyệt và cách đặt tên ảnh')
check('0.3 the screenshot exists', os.path.exists(os.path.join(SHOTS, 'S0-01__My_Training_of_a_trainee.png')))
finish('p0b', b)
