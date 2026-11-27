"""End-to-end check of the SOP.0003 adjustment (DEC-TRAINING-2026-11-27-01) through the API of an isolated backend on a clone of the DEV database.

Run:  CLONE_PW=<throwaway password set on the clone> python e2e_sop_adjustment.py
It needs: backend on :5100 (clone DB), the `docker` CLI and the container `eqms-postgres` (to seed the audit rows of a return after absence, and to read state).
It never touches the DEV database. Every check prints ok or FAIL; the exit code is the number of failures.
"""
import json
import os
import subprocess
import sys
import uuid

import requests

BASE = "http://localhost:5100/api"
PW = os.environ["CLONE_PW"]
DB = "eqms_train_clone"
fails = 0


def sql(query):
    out = subprocess.run(["docker", "exec", "-i", "eqms-postgres", "sh", "-c", f'psql -U "$POSTGRES_USER" -d {DB} -At -q -v ON_ERROR_STOP=1'], input=query, capture_output=True, text=True, encoding="utf-8")
    if out.returncode:
        raise RuntimeError(out.stderr)
    return out.stdout.strip()


def check(name, ok, detail=""):
    global fails
    print(("ok   " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    if not ok:
        fails += 1


s = requests.Session()
token = s.post(f"{BASE}/auth/login", json={"username": "admin", "password": PW}).json()["accessToken"]
s.headers["Authorization"] = f"Bearer {token}"


def sign():
    return s.post(f"{BASE}/auth/verify-signature", json={"username": "admin", "password": PW}).json()["signatureToken"]


def call(method, path, **kw):
    r = s.request(method, BASE + path, **kw)
    try:
        body = r.json()
    except ValueError:
        body = {}
    return r.status_code, body


# ------------------------------------------------------------------ 1. alerts: new employee, return after absence, transfer, position change
new_hire = "82c363d5-8f55-4feb-9179-5e77e34f73a1"  # linhttd
returner = "eb2e3998-b2ce-4d8b-bc36-377a817fe7c4"  # toanlv
mover = "f47c9e66-9d6a-4566-ac2d-3dd82f8e276f"  # hadt
# a clean start on the clone: the reviews and alerts of earlier runs of this script (today) are removed with the triggers that protect them off; the DEV database is never touched
sql("""
begin; set session_replication_role = replica;
delete from training_personnel_events;
delete from training_approval_assignments where object_type = 'TRAINING_PERSONNEL_REVIEW' and object_id in (select id from training_personnel_reviews where created_at > current_date);
delete from training_personnel_review_items where review_id in (select id from training_personnel_reviews where created_at > current_date);
delete from training_personnel_reviews where created_at > current_date;
delete from training_review_templates where locked = false;
delete from training_matrix_cells where row_id in (select r.id from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id join training_matrices m on m.id = v.matrix_id where m.scope = 'FACTORY');
delete from training_matrix_rows where version_id in (select v.id from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.scope = 'FACTORY');
delete from training_matrix_versions where matrix_id in (select id from training_matrices where scope = 'FACTORY');
delete from training_matrices where scope = 'FACTORY';
delete from training_impact_assessments where activity_id in (select id from training_activities where training_number like 'TRN/QA/99-%');
delete from training_impact_departments where activity_id in (select id from training_activities where training_number like 'TRN/QA/99-%');
delete from training_activities where training_number like 'TRN/QA/99-%';
commit;
""")
sql("update departments set department_head_id = (select id from app_users where username = 'approver.test1') where name = 'Quality Assurance'")  # a head who holds the permission to close reviews
sql(f"update app_users set start_date = current_date - 3 where id = '{new_hire}'")
# a suspension of 8 months followed by a reinstatement, as the audit trail of User Management would hold it; and a department change
sql(f"""
insert into audit_logs select (jsonb_populate_record(null::audit_logs, to_jsonb(a) || jsonb_build_object('id', gen_random_uuid(), 'entity_id', '{returner}', 'created_at', now() - interval '9 months', 'event_time', now() - interval '9 months', 'comment', 'Suspended user: long leave')))
  .* from audit_logs a where a.action = 'USER_SUSPENDED' and a.comment not ilike '%time-limited%' limit 1;
insert into audit_logs select (jsonb_populate_record(null::audit_logs, to_jsonb(a) || jsonb_build_object('id', gen_random_uuid(), 'entity_id', '{returner}', 'created_at', now() - interval '2 days', 'event_time', now() - interval '2 days')))
  .* from audit_logs a where a.action = 'USER_REINSTATED' limit 1;
""")
code, body = call("POST", "/training/personnel-events/scan")
check("the scan finds events", code == 200 and body.get("found", 0) >= 2, f"{code} {body}")
code, body = call("GET", "/training/personnel-events", params={"status": "OPEN", "limit": 100})
kinds = {(e["personUserId"], e["kind"]) for e in body.get("data", [])}
check("a new employee is recognised", (new_hire, "NEW_HIRE") in kinds)
check("a return after more than six months is recognised", (returner, "ABSENCE_RETURN") in kinds)
code2, body2 = call("POST", "/training/personnel-events/scan")
code3, body3 = call("GET", "/training/personnel-events", params={"status": "OPEN", "limit": 100})
check("the same event is never alerted twice", len([e for e in body3["data"] if e["personUserId"] == new_hire and e["kind"] == "NEW_HIRE"]) == 1)
count = call("GET", "/training/personnel-events/count")[1].get("open", 0)
check("the menu count includes the alerts", count >= 2, str(count))

# opening the review ends the alert
event = next(e for e in body["data"] if e["personUserId"] == new_hire and e["kind"] == "NEW_HIRE")
code, review = call("POST", "/training/personnel-reviews", json={"personUserId": new_hire, "kind": "NEW_HIRE", "eventDate": event["eventDate"][:10]})
check("a review of a new employee can be opened", code == 200, f"{code} {review}")
rid = review.get("id")
left = {e["id"] for e in call("GET", "/training/personnel-events", params={"status": "OPEN", "limit": 100})[1]["data"]}
check("opening the review ends the alert", event["id"] not in left)

# dismissing needs a reason and a signature
back = next(e for e in body["data"] if e["personUserId"] == returner and e["kind"] == "ABSENCE_RETURN")
code, _ = call("POST", f"/training/personnel-events/{back['id']}/dismiss", json={"reason": " ", "signatureToken": sign()})
check("dismissing without a reason is refused", code == 400, str(code))
code, _ = call("POST", f"/training/personnel-events/{back['id']}/dismiss", json={"reason": "Returned after a rotation, no retraining", "signatureToken": ""})
check("dismissing without a signature is refused", code == 400, str(code))
code, done = call("POST", f"/training/personnel-events/{back['id']}/dismiss", json={"reason": "Returned after a rotation, no retraining", "signatureToken": sign()})
check("dismissing with a reason and a signature works", code == 200 and done.get("status") == "DISMISSED", f"{code} {done}")

# ------------------------------------------------------------------ 2. the review checklist comes from the matrix and needs records
items_before = call("GET", f"/training/personnel-reviews/{rid}")[1]["items"]
check("without a Job Role chosen the matrix lines of that position are not guessed", not any(i.get("checkType") == "TRAINING" for i in items_before))
# the Job Role of the position: its column of the matrix gives the lines (B1)
code, review = call("PUT", f"/training/personnel-reviews/{rid}/job-roles", json={"jobRoleIds": ["0eaf220b-2362-4b96-988a-8911d5b66f2b"]})
check("Job Roles can be chosen on the review", code == 200 and review.get("jobRoles"), f"{code} {review}")
items = review["items"]
trainings = [i for i in items if i.get("checkType") == "TRAINING"]
check("the training lines come from the matrix", len(trainings) >= 1, str([i["label"] for i in items]))
check("no fixed three-part items remain pending", not any(i["itemCode"] in ("RULES_SAFETY", "GMP_GENERAL", "JOB_SPECIFIC") and i["status"] == "PENDING" for i in items))
line = trainings[0]
code, body = call("PUT", f"/training/personnel-reviews/{rid}/items/{line['itemCode']}", json={"status": "DONE"})
check("a training line cannot be marked done by hand", code == 409, f"{code} {body}")
code, body = call("PUT", f"/training/personnel-reviews/{rid}/items/{line['itemCode']}", json={"status": "NOT_NEEDED"})
check("setting a line aside needs a reason", code == 400, f"{code} {body}")
code, body = call("POST", f"/training/personnel-reviews/{rid}/close", json={"signatureToken": sign()})
check("a review with a pending line cannot be closed", code in (403, 409), f"{code} {body}")

# ------------------------------------------------------------------ 3. one initial class for several new employees; the next one joins it or gets a new class
code, cls = call("GET", f"/training/personnel-reviews/{rid}/classes")
check("the dialog offers a new class", cls.get("canCreate") is True and isinstance(cls.get("open"), list), str(cls))
code, made = call("POST", f"/training/personnel-reviews/{rid}/classes", json={})
check("a class is created from the matrix", code == 200 and made.get("createdActivityId"), f"{code} {made}")
act = made.get("createdActivityId")
row = sql(f"select kind, status, (select count(*) from training_sessions s where s.activity_id = a.id), (select count(*) from training_participants p where p.activity_id = a.id) from training_activities a where a.id = '{act}'")
check("it is one INITIAL activity with a session and the person on its list", row.startswith("INITIAL|PLANNED|") and row.endswith("|1") and not row.split("|")[2] == "0", row)
second_user = "a46c0b3f-8507-4177-ac9f-24f9b96ef435"  # quality.lead1
code, r2 = call("POST", "/training/personnel-reviews", json={"personUserId": second_user, "kind": "NEW_HIRE", "eventDate": event["eventDate"][:10]})
rid2 = r2.get("id")
call("PUT", f"/training/personnel-reviews/{rid2}/job-roles", json={"jobRoleIds": ["0eaf220b-2362-4b96-988a-8911d5b66f2b"]})
code, cls2 = call("GET", f"/training/personnel-reviews/{rid2}/classes")
check("the next employee finds the open class", any(c["activityId"] == act for c in cls2.get("open", [])), str(cls2.get("open")))
code, joined = call("POST", f"/training/personnel-reviews/{rid2}/classes/{act}/add")
check("and joins it", code == 200, f"{code} {joined}")
people = sql(f"select count(*) from training_participants where activity_id = '{act}'")
check("one class now has both people", int(people) == 2, people)
code, again = call("POST", f"/training/personnel-reviews/{rid2}/classes/{act}/add")
check("joining twice adds nobody twice", int(sql(f"select count(*) from training_participants where activity_id = '{act}'")) == 2, f"{code}")
code, copy = call("POST", f"/training/personnel-reviews/{rid2}/classes", json={"copyFromActivityId": act})
check("a class can be copied from the earlier one", code == 200 and copy.get("createdActivityId") not in (None, act), f"{code} {copy}")
if copy.get("createdActivityId"):
    n = sql(f"select count(*) from training_participants where activity_id = '{copy['createdActivityId']}' and person_user_id <> '{second_user}'")
    check("a copy brings no people but the new one", int(n) == 0, n)

# ------------------------------------------------------------------ 4. the matrix, the factory-wide list and the one rule of the standing
code, fac = call("POST", "/training/matrices", json={"departmentId": sql("select id from departments where code = 'QA'"), "factory": True})
check("the factory-wide list can be created by Training Administration", code == 200 and fac.get("scope") == "FACTORY", f"{code} {fac}")
code, lst = call("GET", "/training/matrices", params={"limit": 100})
check("the list shows it with its scope", any(m.get("scope") == "FACTORY" for m in lst.get("data", [])))
code, again = call("POST", "/training/matrices", json={"departmentId": sql("select id from departments where code = 'QA'"), "factory": True})
check("a second factory-wide list is refused", code == 409, f"{code} {again}")
code, gaps = call("GET", f"/training/personnel-reviews/{rid}/matrix-gaps")
check("the gaps carry the new standing", code == 200 and "updateNeeded" in gaps, str(gaps)[:200])

# ------------------------------------------------------------------ 5. the checklist template
code, tpl = call("GET", "/training/review-templates", params={"limit": 100})
locked = [t for t in tpl.get("data", []) if t["locked"]]
check("the template holds the items of the SOP, locked", len(locked) >= 6, str(len(locked)))
t0 = locked[0]
code, body = call("PUT", f"/training/review-templates/{t0['id']}", json={"title": t0["title"], "active": False, "version": t0["version"], "reason": "test"})
check("an item of the SOP cannot be switched off", code == 409, f"{code} {body}")
code, added = call("POST", "/training/review-templates", json={"kind": "NEW_HIRE", "title": "Health certificate seen", "titleVi": "Đã xem giấy khám sức khoẻ", "checkType": "MANUAL"})
check("the company can add an item", code == 200 and not added.get("locked"), f"{code} {added}")
code, r3 = call("POST", "/training/personnel-reviews", json={"personUserId": "2c96dfc6-4bd3-4534-9819-f80b74c91012", "kind": "NEW_HIRE", "eventDate": event["eventDate"][:10]})
labels = [i["label"] for i in r3.get("items", [])]
check("a review opened afterwards has it", "Health certificate seen" in labels, str(labels))

# ------------------------------------------------------------------ 6. a person away stays on the list, and nobody is invited by mistake
sql("update app_users set status = 'Suspended' where username = 'perm.restricted1'")
code, body = call("POST", f"/training/activities/{act}/participants", json={"sessionId": sql(f"select id from training_sessions where activity_id = '{act}' limit 1"), "personUserIds": ["2c96dfc6-4bd3-4534-9819-f80b74c91012"], "reason": "On the list although away"})
away = sql(f"select planned_absence from training_participants where activity_id = '{act}' and person_user_id = '2c96dfc6-4bd3-4534-9819-f80b74c91012' limit 1")
check("a suspended account is put on the list as away", code == 200 and away.startswith("Account suspended"), f"{code} {away}")
sql("update app_users set status = 'Active' where username = 'perm.restricted1'")

# ------------------------------------------------------------------ 7. materials used again, and a line of the preparation given to a department
session = sql(f"select id from training_sessions where activity_id = '{act}' order by session_no limit 1")
code, body = call("POST", f"/training/activities/{act}/material-links", json={"title": "Company rules slides (video)", "url": "https://example.com/rules"})
check("a material is added to the first class", code == 200, f"{code} {body}")
code, lib = call("GET", "/training/materials/library", params={"search": "Company rules"})
check("the library lists it once", code == 200 and len([m for m in lib.get("data", []) if m["title"].startswith("Company rules")]) == 1, str(lib))
code, other = call("POST", "/training/activities", json={"kind": "INITIAL", "kindReason": "NEW_HIRE"})
other_id = other.get("id")
check("a second class is made", code == 200 and other_id, f"{code} {other}")
if other_id and lib.get("data"):
    code, files = call("POST", f"/training/activities/{other_id}/materials/from-library", json={"materialId": lib["data"][0]["id"]})
    check("the material is used again by copy", code == 200 and any(m["title"].startswith("Company rules") for m in files.get("materials", [])), f"{code} {str(files)[:200]}")
hr = sql("select id from departments where code <> 'QA' and is_active order by name limit 1")
code, prep = call("PUT", f"/training/sessions/{session}/preparation/VENUE", json={"status": "PENDING", "assignedDepartmentId": hr})
row = next((i for ss in (prep if isinstance(prep, list) else []) for i in ss["items"] if i["itemCode"] == "VENUE" and ss["sessionId"] == session), {})
check("a line of the preparation is given to a department", code == 200 and row.get("assignedDepartmentId") == hr, f"{code} {row}")

# ------------------------------------------------------------------ 8. one requirement for the whole plant
sql("""
begin; set session_replication_role = replica;
delete from training_requirement_lines where requirement_id in (select id from training_requirements where plant_wide);
delete from training_approval_assignments where object_type = 'TRAINING_REQUIREMENT' and object_id in (select id from training_requirements where plant_wide);
delete from training_requirements where plant_wide;
commit;
""")
code, req = call("POST", "/training/requirements", json={"year": 2031, "kind": "ANNUAL", "plantWide": True})
check("a plant-wide annual requirement is created", code == 200 and req.get("plantWide") is True, f"{code} {req}")
code, dup = call("POST", "/training/requirements", json={"year": 2031, "kind": "ANNUAL", "plantWide": True})
check("a second one for the same year is refused", code == 409, f"{code} {dup}")
code, sug = call("GET", "/training/requirements/suggestions", params={"year": 2031, "plantWide": "true"})
check("its suggestions come from every department", code == 200 and isinstance(sug.get("data"), list), str(sug)[:150])
code, detail = call("GET", f"/training/requirements/{req['id']}")
check("the contents of SOP.0003 5.3.2 that no line covers are named", set(detail.get("missingMandatory", [])) >= {"General GMP", "Data integrity", "Aseptic technique"}, str(detail.get("missingMandatory")))
code, ap = call("GET", f"/training/requirements/{req['id']}/eligible-approvers", params={"step": "REQUIREMENT_REVIEW"})
check("approvers carry the Quality Manager mark", code == 200 and all("role" in p for p in ap.get("data", [])), str(ap)[:150])

# ------------------------------------------------------------------ 9. the yearly review of the matrix is reminded
sql("update training_settings set matrix_review_reminder_month = extract(month from current_date)::int where id = 1")
before = int(sql("select count(*) from training_notification_log where event_code = 'TRAINING_MATRIX_REVIEW_DUE'") or 0)
code, run = call("POST", "/training/notifications/run-reminders")
after = int(sql("select count(*) from training_notification_log where event_code = 'TRAINING_MATRIX_REVIEW_DUE'") or 0)
old = int(sql("select count(*) from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where v.status = 'EFFECTIVE' and m.scope = 'DEPARTMENT' and v.effective_at < now() - interval '11 months'"))
check("the reminder run works", code == 200, f"{code} {run}")
check("the heads of the departments with an old matrix are reminded (or no matrix is old)", after > before or old == 0, f"{before}->{after}, old={old}")


# ------------------------------------------------------------------ 10. the related departments assess the impact of a new version too (A3)
qa_id = sql("select id from departments where code = 'QA'")
doc = sql("select d.id from documents d join document_revisions r on r.document_id = d.id and r.status_code = 'EFFECTIVE' where d.document_number is not null limit 1")
imp = str(uuid.uuid4())
serial = 100 + int(imp[:3], 16) % 800
sql(f"""
begin; set session_replication_role = replica;
insert into training_activities select (jsonb_populate_record(null::training_activities, to_jsonb(a) || jsonb_build_object('id', '{imp}', 'training_number', 'TRN/QA/99-{serial}', 'base_number', 'TRN/QA/99-{serial}', 'serial', {serial},
  'kind', 'UNPLANNED', 'kind_reason', 'SOP_VERSION', 'status', 'PLANNED', 'document_id', '{doc}', 'document_number', 'SOP.TEST', 'revision_number', '2.0.0', 'parent_activity_id', null, 'suffix', null))).* from training_activities a where a.id = '{act}';
commit;
""")
code, lines = call("GET", "/training/document-impact-assessments", params={"departmentId": qa_id, "status": "OPEN", "limit": 100})
mine = [r for r in lines.get("data", []) if r["id"] == imp]
check("the owner department has a line to assess", code == 200 and len(mine) == 1 and mine[0]["impactStatus"] == "PENDING", f"{code} {str(lines)[:200]}")
other_dept = sql("select id from departments where code <> 'QA' and is_active order by name limit 1")
code, ctx = call("GET", f"/training/activities/{imp}/impact-assessment")
check("the context says the department owns the document", code == 200 and ctx.get("ownerDepartment") is True, str(ctx)[:200])
code, done = call("POST", f"/training/activities/{imp}/impact-assessment", json={"outcome": "NO_TRAINING_IMPACT", "reason": "Editorial change in the owner department", "positionIds": [], "signatureToken": sign(), "relatedDepartmentIds": [other_dept]})
check("the owner assesses and names a related department", code == 200, f"{code} {done}")
code, theirs = call("GET", "/training/document-impact-assessments", params={"departmentId": other_dept, "status": "OPEN", "limit": 100})
line = [r for r in theirs.get("data", []) if r["id"] == imp]
check("the related department now has its own line", code == 200 and len(line) == 1 and line[0]["impactStatus"] == "PENDING" and line[0].get("ownerDepartment") is False, f"{code} {str(theirs)[:200]}")
code, mine2 = call("GET", "/training/document-impact-assessments", params={"departmentId": qa_id, "limit": 100})
check("the owner line is done", any(r["id"] == imp and r["impactStatus"] == "DONE" for r in mine2.get("data", [])))
code, ctx2 = call("GET", f"/training/activities/{imp}/impact-assessment")
check("the related department is listed with its state", any(d["id"] == other_dept and d["assessed"] is False for d in ctx2.get("relatedDepartments", [])), str(ctx2.get("relatedDepartments")))


print(f"\n{fails} failure(s)")
sys.exit(fails)
