"""The people of the UAT run of 2026-10-31 (DEV only). Username -> (full name, department, position/title, role in the story, profile).
All accounts are test accounts: the username starts with uat31. and the full name ends with "(UAT)". Passwords: the shared DEV test hash is copied from admin (see p0a_users.py);
the run harness sets a random password for the run and puts the original back."""

QA, QC, PROD = 'Quality Assurance', 'Quality Control', 'Production'

# username: (full name, department, title, story, profile)   profile: TRAINEE | TRAINER (a head of department holds the trainer set, as trainer.test1 did in earlier runs)
PEOPLE = {
    # --- heads of department (confirm the self-reading list APD.0108 of their department)
    'uat31.head.qa':   ('Lương Thị Hạnh (UAT)',    QA,   'QA Manager',  'head of Quality Assurance', 'TRAINER'),
    'uat31.head.qc':   ('Tạ Văn Hùng (UAT)',       QC,   'QC Manager',  'head of Quality Control',   'TRAINER'),
    'uat31.head.prod': ('Cao Thị Kim (UAT)',       PROD, 'Production Manager', 'head of Production',   'TRAINER'),
    # --- scenario 1: a document revision, five people of Quality Control
    'uat31.s1.pass1':  ('Nguyễn Văn An (UAT)',     QC,   'QC Analyst',  'S1 passes the test',          'TRAINEE'),
    'uat31.s1.pass2':  ('Trần Thị Bình (UAT)',     QC,   'QC Analyst',  'S1 passes the test',          'TRAINEE'),
    'uat31.s1.absent': ('Lê Văn Cường (UAT)',      QC,   'QC Analyst',  'S1 is absent',                'TRAINEE'),
    'uat31.s1.fail':   ('Phạm Thị Dung (UAT)',     QC,   'QC Analyst',  'S1 fails the test',           'TRAINEE'),
    'uat31.s1.left':   ('Hoàng Văn Em (UAT)',      QC,   'QC Analyst',  'S1 leaves the company midway', 'TRAINEE'),
    # --- scenario 2: an activity that does not start from a document, three departments, ten people
    'uat31.s2.qa.pass':   ('Vũ Thị Giang (UAT)',   QA,   'QA Specialist', 'S2 QA passes',            'TRAINEE'),
    'uat31.s2.qa.fail':   ('Đặng Văn Hải (UAT)',   QA,   'QA Specialist', 'S2 QA fails',             'TRAINEE'),
    'uat31.s2.qa.absent': ('Bùi Thị Hoa (UAT)',    QA,   'QA Specialist', 'S2 QA is absent',         'TRAINEE'),
    'uat31.s2.qa.left':   ('Ngô Văn Khánh (UAT)',  QA,   'QA Specialist', 'S2 QA leaves midway',     'TRAINEE'),
    'uat31.s2.qc.pass':   ('Đỗ Thị Lan (UAT)',     QC,   'QC Analyst',    'S2 QC passes',            'TRAINEE'),
    'uat31.s2.qc.fail1':  ('Hồ Văn Minh (UAT)',    QC,   'QC Analyst',    'S2 QC fails',             'TRAINEE'),
    'uat31.s2.qc.fail2':  ('Dương Thị Ngọc (UAT)', QC,   'QC Analyst',    'S2 QC fails',             'TRAINEE'),
    'uat31.s2.qc.absent': ('Lý Văn Phúc (UAT)',    QC,   'QC Analyst',    'S2 QC is absent',         'TRAINEE'),
    'uat31.s2.pr.fail':   ('Phan Thị Quyên (UAT)', PROD, 'Production Operator', 'S2 Production fails', 'TRAINEE'),
    'uat31.s2.pr.left':   ('Trịnh Văn Sơn (UAT)',  PROD, 'Production Operator', 'S2 Production leaves midway', 'TRAINEE'),
    # --- scenario 3: a QC employee who is to be appointed to two more Work Positions
    'uat31.s3.new':    ('Mai Văn Tâm (UAT)',       QC,   'QC Analyst',  'S3 is appointed to QC Microbiology and QC Physicochemistry', 'TRAINEE'),
}
