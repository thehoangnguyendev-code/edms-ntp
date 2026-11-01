"""Exploration (not evidence): what does the appointment check list as required for the new QC employee and the two positions?"""
from flows31 import *

S = load()['s3']
person = uid('uat31.s3.new')
el = admin.call('GET', f"/training/job-assignments/eligibility?person={person}&position={S['micro']}")
print('MICRO only:', {k: el.get(k) for k in ('complete', 'missingCount', 'matrixMissing')})
for i in el.get('items', []):
    print('   ', i.get('source'), '|', i.get('code'), '|', i.get('title'), '|', i.get('lastDone'), '|', i.get('jobRoleName'))
el = admin.call('GET', f"/training/job-assignments/eligibility?person={person}&position={S['phys']}")
print('PHYS only:', {k: el.get(k) for k in ('complete', 'missingCount', 'matrixMissing')})
for i in el.get('items', []):
    print('   ', i.get('source'), '|', i.get('code'), '|', i.get('title'), '|', i.get('lastDone'), '|', i.get('jobRoleName'))
print('held positions:', admin.call('GET', f'/training/job-assignments/work-position/{person}'))
