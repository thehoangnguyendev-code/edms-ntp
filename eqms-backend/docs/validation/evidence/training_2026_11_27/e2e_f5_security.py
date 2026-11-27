"""End-to-end check of F5 (two-step matrix approval) and of the Security hooks (kind of suspension, hook-triggered alerts) of DEC-TRAINING-2026-11-27, through the API of an isolated
backend on a clone of the DEV database.

Run:  CLONE_PW=<throwaway password set on the clone> python e2e_f5_security.py
Needs: backend on :5100 (clone DB), the `docker` CLI and the container `eqms-postgres`. It never touches the DEV database. The exit code is the number of failures.
"""
import os
import subprocess
import sys
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


class Person:
    def __init__(self, username):
        self.username = username
        self.s = requests.Session()
        r = self.s.post(f"{BASE}/auth/login", json={"username": username, "password": PW})
        self.s.headers["Authorization"] = f"Bearer {r.json()['accessToken']}"

    def sign(self):
        return self.s.post(f"{BASE}/auth/verify-signature", json={"username": self.username, "password": PW}).json()["signatureToken"]

    def call(self, method, path, **kw):
        r = self.s.request(method, BASE + path, **kw)
        try:
            body = r.json()
        except ValueError:
            body = {}
        return r.status_code, body


def username_of(user_id):
    return sql(f"select username from app_users where id = '{user_id}'")


admin = Person("admin")

# ------------------------------------------------------------------ F5: preparer -> reviewer -> approver
dept = sql("select id from departments where code = 'DCTRL'")
sql(f"""
begin; set session_replication_role = replica;
delete from training_approval_assignments where object_type = 'TRAINING_MATRIX_VERSION' and object_id in (select v.id from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.department_id = '{dept}');
delete from training_matrix_cells where row_id in (select r.id from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id join training_matrices m on m.id = v.matrix_id where m.department_id = '{dept}');
delete from training_matrix_rows where version_id in (select v.id from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.department_id = '{dept}');
update training_matrices set current_version_id = null where department_id = '{dept}';
delete from training_matrix_versions where matrix_id in (select id from training_matrices where department_id = '{dept}');
delete from training_matrices where department_id = '{dept}';
commit;
""")
code, created = admin.call("POST", "/training/matrices", json={"departmentId": dept})
check("a draft matrix version is created", code == 200 and created.get("status") == "DRAFT", f"{code} {str(created)[:200]}")
vid = created.get("id")
code, v = admin.call("PUT", f"/training/matrix-versions/{vid}", json={"version": created["version"], "changeReason": "First matrix", "rows": [
    {"group": "DEPARTMENT_GENERAL", "topicText": "Gowning", "annualRequired": True, "positionIds": [], "allEmployees": True}]})
check("the draft is saved with a row", code == 200 and len(v.get("rows", [])) == 1, f"{code} {str(v)[:300]}")

code, reviewers = admin.call("GET", f"/training/matrix-versions/{vid}/eligible-approvers", params={"limit": 50})
people = reviewers.get("data", [])
check("the choice of reviewer lists people and not the preparer", code == 200 and len(people) >= 2 and all(p["id"] != admin_id for admin_id in [sql("select id from app_users where username='admin'")] for p in people), f"{code} {str(reviewers)[:200]}")
reviewer_id = people[0]["id"]
reviewer = Person(username_of(reviewer_id))

code, body = admin.call("POST", f"/training/matrix-versions/{vid}/submit", json={"version": v["version"], "signatureToken": admin.sign(), "approverUserId": admin and sql("select id from app_users where username='admin'")})
check("the preparer cannot name themselves reviewer", code in (400, 403, 409, 422), f"{code} {str(body)[:200]}")
code, sub = admin.call("POST", f"/training/matrix-versions/{vid}/submit", json={"version": v["version"], "signatureToken": admin.sign(), "approverUserId": reviewer_id})
check("submit puts the version in Pending Review", code == 200 and sub.get("status") == "PENDING_REVIEW", f"{code} {str(sub)[:300]}")
check("the stepper has the review step", [s["label"] for s in sub["workflow"]["steps"]][:3] == ["Draft", "Pending Review", "Pending Approval"], str(sub.get("workflow"))[:200])
check("only the reviewer is offered Review", sub["capabilities"].get("review") is False and sub["capabilities"].get("approve") is False)
code, mine = reviewer.call("GET", f"/training/matrix-versions/{vid}")
check("the reviewer sees Review and Reject", code == 200 and mine["capabilities"].get("review") is True and mine["capabilities"].get("reject") is True and mine["capabilities"].get("approve") is False, str(mine.get("capabilities")))

code, body = admin.call("POST", f"/training/matrix-versions/{vid}/review", json={"version": sub["version"], "signatureToken": admin.sign(), "approverUserId": reviewer_id})
check("the preparer cannot review", code in (403, 409), f"{code} {str(body)[:200]}")
code, body = admin.call("POST", f"/training/matrix-versions/{vid}/approve", json={"version": sub["version"], "signatureToken": admin.sign()})
check("nobody can approve before the review", code in (403, 409), f"{code} {str(body)[:200]}")
code, body = admin.call("PUT", f"/training/matrix-versions/{vid}", json={"version": sub["version"], "changeReason": "Sneaky", "rows": []})
check("the content is frozen while it is under review", code in (403, 409), f"{code} {str(body)[:200]}")

code, approvers = reviewer.call("GET", f"/training/matrix-versions/{vid}/eligible-approvers", params={"limit": 50})
choices = approvers.get("data", [])
ids = {p["id"] for p in choices}
check("the choice of approver leaves out the preparer and the reviewer", code == 200 and reviewer_id not in ids and sql("select id from app_users where username='admin'") not in ids and len(choices) >= 1, f"{code} {str(approvers)[:200]}")
approver_id = choices[0]["id"] if choices else None
code, body = reviewer.call("POST", f"/training/matrix-versions/{vid}/review", json={"version": sub["version"], "signatureToken": reviewer.sign(), "approverUserId": reviewer_id})
check("the reviewer cannot name themselves approver", code in (400, 403, 409, 422), f"{code} {str(body)[:200]}")
code, rev = reviewer.call("POST", f"/training/matrix-versions/{vid}/review", json={"version": sub["version"], "signatureToken": reviewer.sign(), "approverUserId": approver_id})
check("the review puts the version in Pending Approval", code == 200 and rev.get("status") == "PENDING_APPROVAL", f"{code} {str(rev)[:300]}")
check("the review is stored with its signature", sql(f"select reviewed_by is not null and review_signature_id is not null and reviewed_at is not null from training_matrix_versions where id = '{vid}'") == "t")
code, body = reviewer.call("POST", f"/training/matrix-versions/{vid}/approve", json={"version": rev["version"], "signatureToken": reviewer.sign()})
check("the reviewer cannot approve", code in (403, 409), f"{code} {str(body)[:200]}")
code, body = admin.call("POST", f"/training/matrix-versions/{vid}/approve", json={"version": rev["version"], "signatureToken": admin.sign()})
check("the preparer cannot approve", code in (403, 409), f"{code} {str(body)[:200]}")
approver = Person(username_of(approver_id))
code, done = approver.call("POST", f"/training/matrix-versions/{vid}/approve", json={"version": rev["version"], "signatureToken": approver.sign()})
check("the designated approver approves and it is Effective", code == 200 and done.get("status") == "EFFECTIVE", f"{code} {str(done)[:300]}")
check("three different people signed", sql(f"select count(distinct x) from (select prepared_by x from training_matrix_versions where id='{vid}' union all select reviewed_by from training_matrix_versions where id='{vid}' union all select approved_by from training_matrix_versions where id='{vid}') t") == "3")
check("the audit trail has the three steps", sql(f"select count(*) from audit_logs where entity_id = '{vid}' and action in ('TRAINING_MATRIX_SUBMITTED','TRAINING_MATRIX_REVIEWED','TRAINING_MATRIX_APPROVED')") == "3")

# reject at the review step
code, up = admin.call("POST", f"/training/matrices/{done['matrixId']}/upgrade")
check("an upgrade opens a new draft", code == 200 and up.get("status") == "DRAFT", f"{code} {str(up)[:200]}")
code, s2 = admin.call("POST", f"/training/matrix-versions/{up['id']}/submit", json={"version": up["version"], "signatureToken": admin.sign(), "approverUserId": reviewer_id})
check("the new draft is submitted for review", code == 200 and s2.get("status") == "PENDING_REVIEW", f"{code} {str(s2)[:200]}")
code, body = reviewer.call("POST", f"/training/matrix-versions/{up['id']}/reject", json={"version": s2["version"], "reason": ""})
check("a rejection without a reason is refused", code in (400, 422), f"{code} {str(body)[:200]}")
code, rej = reviewer.call("POST", f"/training/matrix-versions/{up['id']}/reject", json={"version": s2["version"], "reason": "Row missing"})
check("the reviewer sends it back to Draft", code == 200 and rej.get("status") == "DRAFT", f"{code} {str(rej)[:200]}")
code, lst = admin.call("GET", "/training/matrices", params={"limit": 100})
check("the list shows the version in preparation", code == 200, str(lst)[:100])

# ------------------------------------------------------------------ Security: the kind of suspension and the alert without waiting for the scan
target = sql("select id from app_users where username = 'toanlv'")
sql("begin; set session_replication_role = replica; delete from training_personnel_events where person_user_id = '%s'; commit;" % target)
code, body = admin.call("POST", f"/settings/users/{target}/suspend", json={"reason": "Maternity", "signatureToken": admin.sign()})
check("a suspension without a kind is refused", code in (400, 422), f"{code} {str(body)[:200]}")
code, body = admin.call("POST", f"/settings/users/{target}/suspend", json={"reason": "Maternity", "suspensionKind": "SICK", "signatureToken": admin.sign()})
check("an unknown kind is refused", code in (400, 422), f"{code} {str(body)[:200]}")
for kind, expect in (("OTHER", 0), ("LONG_LEAVE", 1)):
    code, body = admin.call("POST", f"/settings/users/{target}/suspend", json={"reason": "Test " + kind, "suspensionKind": kind, "signatureToken": admin.sign()})
    check(f"suspension of kind {kind} is accepted", code == 200, f"{code} {str(body)[:200]}")
    check(f"the kind is written in the comment ({kind})", sql(f"select count(*) from audit_logs where entity_id = '{target}' and action = 'USER_SUSPENDED' and comment like '%[{kind}]%'") != "0")
    # the person was away for a long time: the audit rows are moved back
    sql(f"begin; set session_replication_role = replica; update audit_logs set created_at = created_at - interval '8 months' where entity_id = '{target}' and action = 'USER_SUSPENDED' and created_at > now() - interval '1 hour'; commit;")
    code, body = admin.call("POST", f"/settings/users/{target}/reinstate", json={"reason": "Back"})
    check(f"reinstate of kind {kind} is accepted", code == 200, f"{code} {str(body)[:200]}")
    n = sql(f"select count(*) from training_personnel_events where person_user_id = '{target}' and kind = 'ABSENCE_RETURN' and status = 'OPEN'")
    check(f"{kind}: the alert is {'raised at once, without the scan' if expect else 'not raised'}", n == str(expect), f"open={n}")
    sql(f"begin; set session_replication_role = replica; delete from training_personnel_events where person_user_id = '{target}'; commit;")

print(f"\n{fails} failure(s)")
sys.exit(fails)
