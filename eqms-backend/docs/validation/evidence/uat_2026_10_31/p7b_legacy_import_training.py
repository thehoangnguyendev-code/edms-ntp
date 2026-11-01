"""Part 7: Legacy Import and Training Management, end to end on DEV (owner decisions D1-D6 and the round of 2026-11-01, DECISION_LOG LEGACY-IMPORT-TRAINING-2026-11-01).
A document imported from paper with a paper Training Number: the historical activity, the scan, the persons, the topic, the trainer and the mode, the records written when the import is signed
(no second person verifies), a number shared by documents, the counter that goes on after the paper log, and what is refused. The helpers are in lib7.py."""
from lib7 import *

state = load()
N1 = 'TRN/QA/26-%d' % (max(int(sql("select max(last_serial) from training_number_sequences where year = 2026 and last_serial < 100000")[0][0]), int(sql("select max(substring(training_number from '-([0-9]+)$')::int) from training_activities where training_number like 'TRN/QA/26-%' and length(training_number) < 16")[0][0])) + 10)
NEXT_AFTER = int(N1.split('-')[-1])

step('F-31 a document imported from paper with a paper Training Number, the scan and the persons')
doc1 = free_number()
code, data, text = do_import(doc1, 'UAT7 Legacy Cleaning of rooms', [section(number=N1, people=trainees)], [SCAN])
check('F-31.1 the import is accepted', code == 200, (code, text[:300]))
rev1 = revision_of(doc1)
check('F-31.2 the revision is linked to a historical activity and is not manual', len(rev1) == 1 and rev1[0][1] not in (None, '') and rev1[0][2] == 'INTEGRATED' and rev1[0][4] == 'LEGACY_IMPORT', rev1)
act = sql(f"select id, kind, status, training_number, organizer_department_id, serial, year from training_activities where training_number = '{N1}'")
check('F-31.3 one activity of kind LEGACY, completed, with the paper number', len(act) == 1 and act[0][1] == 'LEGACY' and act[0][2] == 'COMPLETED' and act[0][5] == str(NEXT_AFTER), act)
act_id = act[0][0] if act else None
ev = sql(f"select id, status, activity_id, not_evidenced, original_name from training_legacy_evidence where activity_id = '{act_id}'")
check('F-31.4 the evidence is FILED for the activity at once (nobody else verifies it)', len(ev) == 1 and ev[0][1] == 'FILED' and not ev[0][3] == 't', ev)
ev_id = ev[0][0] if ev else None
people = sql(f"select role, count(*) from training_legacy_people where evidence_id = '{ev_id}' group by role order by role")
check('F-31.5 the two trainees and the signatory (the author) are named', dict((r[0], int(r[1])) for r in people) == {'SIGNATORY': 1, 'TRAINEE': 2}, people)
written = sql(f"select method, count(*) from training_records where activity_id = '{act_id}' group by 1 order by 1")
check('F-31.6 the records are written at once: 2 trainees and the author', dict((r[0], int(r[1])) for r in written) == {'PAPER': 2, 'SIGNATORY': 1}, written)
seq = int(sql(f"select last_serial from training_number_sequences where department_id = '{qa}' and year = 2026")[0][0])
check('F-31.7 the counter of the department was raised to the paper number', seq >= NEXT_AFTER, seq)
act_row = sql(f"select paper_topic, paper_trainer, paper_method from training_activities where id = '{act_id}'")[0]
check('F-31.8 the topic, the trainer and the mode of the paper record are kept on the activity', act_row == ['UAT7 Gowning in grade B', 'Nguyen Van A (paper)', 'CLASSROOM'], act_row)
detail = admin.call('GET', f'/training/activities/{act_id}')
check('F-31.9 the activity detail carries them and the topic comes from the paper', detail.get('paperMethod') == 'CLASSROOM' and detail.get('paperTrainer') == 'Nguyen Van A (paper)' and 'Gowning in grade B' in str(detail.get('trainingTopics', '')), {k: detail.get(k) for k in ('paperMethod', 'paperTrainer', 'trainingTopics')})
for field, value, word in (('trainingTopic', None, 'Training Topic'), ('trainingTrainer', None, 'Trainer'), ('trainingMethod', None, 'Mode'), ('trainingMethod', 'WEBINAR', 'Mode is not one of')):
    code, data, text = do_import(free_number(), 'UAT7 missing ' + field, [section(number=FRESH(), **{field: value})], [SCAN])
    check('F-31.10 refused: ' + field + ' = ' + str(value), code == 400 and word in text, (code, text[:200]))
pe = admin.call('GET', f'/training/legacy-evidence/activities/{act_id}/people?limit=50')
check('F-31.11 the persons of the activity are listed (2 trainees and the author) and every record is written', pe['evidenceStatus'] == 'FILED' and len(pe['data']) == 3 and all(p['recordWritten'] for p in pe['data']), pe['data'])
queue = admin.call('GET', f'/training/legacy-evidence?limit=50&search={doc1}')
row1 = [r for r in queue['data'] if r['documentNumber'] == doc1][0]
check('F-31.12 the queue says Filed and no longer offers anything to verify', row1['evidenceStatus'] == 'FILED' and 'pendingForMe' not in row1, row1)
for verb in ('verify', 'reject'):
    code, data, text = attempt(admin, 'POST', f'/training/legacy-evidence/{ev_id}/{verb}', {'signatureToken': sign(admin), 'reason': 'x'})
    check('F-31.13 there is no endpoint to ' + verb, code in (404, 405), (code, text[:120]))
code, data, text = do_import(free_number(), 'UAT7 verifier sent', [section(number=OLD_YEAR(), trainingVerifierId=uuid_hex())], [SCAN])
check('F-31.14 an old client that still sends a verifier is not refused for it (the field is ignored)', 'verif' not in text.lower() or code == 200, (code, text[:200]))

step('F-32 one paper number for several documents')
doc2 = free_number()
code, data, text = do_import(doc2, 'UAT7 Legacy Gowning', [section(number=N1, scan=False)], [])
check('F-32.1 the second document joins the number without a scan or persons', code == 200, (code, text[:300]))
rev2 = revision_of(doc2)
check('F-32.2 its revision points to the same activity', len(rev2) == 1 and rev2[0][1] == act_id, (rev2, act_id))
check('F-32.3 there is still one activity and one evidence for the number', int(sql(f"select count(*) from training_activities where upper(training_number) = upper('{N1}')")[0][0]) == 1
      and int(sql(f"select count(*) from training_legacy_evidence where activity_id = '{act_id}'")[0][0]) == 1, '')
info = admin.call('GET', '/training/legacy-evidence/number-info?number=' + urllib.parse.quote(N1))
check('F-32.4 the form is told that the number is shared and has its evidence filed', info.get('exists') and info.get('legacy') and info.get('evidenceStatus') == 'FILED' and len(info.get('documents', [])) == 2, info)
code, data, text = do_import(free_number(), 'UAT7 Legacy Gowning with another scan', [section(number=N1, scan=True)], [SCAN])
check('F-32.5 a scan attached again to a number that has its evidence is refused', code in (400, 409) and 'already has its evidence' in text, (code, text[:300]))
code, data, text = do_import(free_number(), 'UAT7 join with details', [section(number=N1, scan=False, paper=True)], [])
check('F-32.6 a topic, trainer or mode given for a number that already has its evidence is refused', code in (400, 409) and 'do not enter them again' in text, (code, text[:200]))
by_method = dict((r[0], int(r[1])) for r in sql(f"select method, count(*) from training_records where activity_id = '{act_id}' group by 1"))
check('F-32.7 the second document has its records at once (2 persons x 2 documents, and the author of each)', by_method == {'PAPER': 4, 'SIGNATORY': 2}, by_method)
topic_ok = int(sql(f"select count(*) from training_records where activity_id = '{act_id}' and topic_text = 'UAT7 Gowning in grade B'")[0][0])
check('F-32.8 the records carry the topic of the paper record', topic_ok == 6, topic_ok)
one = sql(f"select method, result, completed_on, training_number, document_number from training_records where activity_id = '{act_id}' and method = 'PAPER' limit 1")
check('F-32.9 a record carries the paper number, the document and the completion day', one and one[0][3] == N1 and one[0][2] == '2020-09-21', one)

step('F-34 a third document joins the same number later')
doc3 = free_number()
code, data, text = do_import(doc3, 'UAT7 Legacy Sampling', [section(number=N1, scan=False)], [])
check('F-34.1 the import is accepted', code == 200, (code, text[:300]))
n3 = int(sql(f"select count(*) from training_records r where r.activity_id = '{act_id}' and r.document_number = '{doc3}'")[0][0])
check('F-34.2 the persons of the number have their record for the new document at once (and the author the initial one)', n3 == 3, n3)

step('F-35 the numbers the system issues go on after the paper log')
created = admin.call('POST', '/training/activities', {'departmentId': qa, 'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'remarks': 'UAT7 number after the paper log'})
issued = created.get('trainingNumber') or created.get('training_number')
check('F-35.1 the next number of the department is after the paper number', issued and int(issued.split('-')[-1]) > NEXT_AFTER, issued)

step('F-36 what is refused')
code, data, text = do_import(free_number(), 'UAT7 no evidence', [section(number=FRESH(), scan=False)], [])
check('F-36.1 a training document with a paper number and no scan or declaration is refused', code == 400 and 'paper training record' in text, (code, text[:260]))
check('F-36.2 and nothing is created (the number is free, the counter is not raised)', int(sql(f"select count(*) from training_activities where training_number = '{FRESH_LAST}'")[0][0]) == 0 and int(sql("select max(last_serial) from training_number_sequences where year = 2026")[0][0]) < 500000, '')
native = sql("select training_number from training_activities where kind <> 'LEGACY' order by created_at limit 1")[0][0]
code, data, text = do_import(free_number(), 'UAT7 native number', [section(number=native, scan=True)], [SCAN])
check('F-36.3 a paper number equal to a number issued by the system is refused', code == 400 and 'issued by Training Management' in text, (code, text[:260]))
code, data, text = do_import(free_number(), 'UAT7 unknown author', [section(number=FRESH(), author='00000000-0000-0000-0000-000000000099')], [SCAN])
check('F-36.4 an author who is not a user is refused', code == 400 and 'not a user of the system' in text, (code, text[:260]))
code, data, text = do_import(free_number(), 'UAT7 trainees without number', [section(number=None, people=trainees)], [SCAN])
check('F-36.5 persons trained without a Training Number are refused', code == 400 and 'Training Number' in text, (code, text[:260]))
code, data, text = do_import(doc1, 'UAT7 duplicate', [section(number=FRESH())], [SCAN])
check('F-36.6 a document number already in use is refused clearly', code in (400, 409) and 'already in use' in text, (code, text[:260]))

step('F-37 the paper is lost')
doc4 = free_number()
code, data, text = do_import(doc4, 'UAT7 Legacy lost paper', [section(number=None, scan=False, lost=True)], [])
check('F-37.1 a declaration with a reason is accepted', code == 200, (code, text[:300]))
lost = sql(f"select e.status, e.not_evidenced, e.activity_id is null from training_legacy_evidence e join document_revisions r on r.id = e.revision_id join documents d on d.id = r.document_id where d.document_number = '{doc4}'")
check('F-37.2 the evidence is a declaration, filed, with no activity and no person', lost and lost[0][0] == 'FILED' and lost[0][1] == 't' and lost[0][2] == 't', lost)

state['p7'] = {'doc1': doc1, 'doc2': doc2, 'doc3': doc3, 'doc4': doc4, 'activity': act_id, 'evidence': ev_id, 'number': N1}
save(state)
finish('p7b')
