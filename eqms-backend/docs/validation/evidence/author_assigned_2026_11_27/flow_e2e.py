"""DEC-DOC-2026-11-27-10: who is told at each workflow step, one notice each."""
import random, sys, time, collections
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
exec(open(S + "/e2e.py", encoding="utf-8").read().split("author, trainee = login(")[0].replace("sys.stdout.reconfigure", "(lambda **k: 0)"))
tok = {u: login(u) for u in ("dco.test1", "author.test1", "reviewer.test1", "reviewer.test2", "approver.test1")}
names = ["author.test1", "coauthor.test1", "coauthor.test2", "reviewer.test1", "reviewer.test2", "approver.test1", "dco.test1"]
uid = {u: sql(f"select id from app_users where username='{u}'") for u in names}
dcos = [r.split("|")[0] for r in sql("select username from app_users u where status='Active'").splitlines()]
base = json.loads(sql("select json_build_object('documentType',document_type_id,'businessUnit',(select name from business_units where id=d.business_unit_id),"
                      "'department',(select name from departments where id=d.department_id)) from documents d where document_number='SOP.10489'"))
old = open(S + "/spike/old.docx", "rb").read()
# who holds the Document Control permission, from the server's own point of view
holders = set(sql("select u.username from app_users u where u.status='Active' and exists (select 1 from user_access_profiles p join access_profile_permission_sets ps on ps.access_profile_id=p.access_profile_id join permission_set_items sp on sp.permission_set_id=ps.permission_set_id join permissions pm on pm.id=sp.permission_id where p.user_id=u.id and pm.code='documents.workspace.manage')").split("\n")) - {""}
print("Document Control holders in the copy:", len(holders))
since = lambda: sql("select coalesce(max(created_at), now()) from user_notifications")


def sign(user):
    s, b = call("POST", "/auth/verify-signature", tok[user], {"username": user, "password": PW}); assert s == 200, b
    return {"reason": "r", "comment": "c", "signatureToken": b["signatureToken"]}


def parallel(on):
    sql("update system_configurations set documents_config = jsonb_set(coalesce(documents_config,'{}'::jsonb), '{parallelReviewEnabled}', '%s')" % ("true" if on else "false"))


def draft_in_review():
    name = "Flow check %d" % random.randint(1000, 9999)
    payload = dict(base, documentName=name, titleLocalLanguage=name, author=uid["author.test1"], description="flow", periodicReviewCycle=36, periodicReviewNotification=10,
                   requiresTraining=True, trainingPeriodDays=14, language="English", coAuthorIds=[uid["coauthor.test1"], uid["coauthor.test2"]],
                   reviewerUserIds=[uid["reviewer.test1"], uid["reviewer.test2"]], approverUserIds=[uid["approver.test1"]])
    s, doc = call("POST", "/documents", tok["dco.test1"], payload); assert s == 200, (s, doc)
    s, rev = call("POST", f"/documents/{doc['id']}/revisions/upload", tok["author.test1"], files={"file": ("a.docx", old)}); assert s == 200, (s, rev)
    return doc["id"], rev["id"]


def told(rid, mark):
    """in-app recipients of this revision since mark -> {username: count}"""
    time.sleep(3)
    rows = sql(f"select u.username from user_notifications n join app_users u on u.id=n.recipient_user_id where n.created_at > '{mark}' and (n.action_url like '%{rid}%')").splitlines()
    return collections.Counter(r for r in rows if r)


def outbox(mark_ts):
    time.sleep(1)
    rows = sql(f"select recipient_email from notification_email_outbox where created_at > '{mark_ts}'").splitlines()
    return collections.Counter(r.split("@")[0] for r in rows if r)


def step(label, action, expect_in, forbid=()):
    mark = sql("select now()")
    r = action()
    ok = r[0] == 200
    got = told(rid, mark)
    mails = outbox(mark)
    exp = set(expect_in)
    check(label + ": action ok", ok, r if not ok else "")
    check(label + ": in-app to exactly the expected people", set(got) == exp and set(got.values()) == {1}, (dict(got) if set(got) != exp else ""))
    check(label + ": e-mail: same number as people, one each", sum(mails.values()) == len(exp) and (not mails or set(mails.values()) == {1}), dict(mails))


def run(par):
    global rid
    parallel(par)
    doc, rid = draft_in_review()
    exp_dco = {u for u in holders if u != "author.test1"}
    # 3. submit
    first = {"reviewer.test1", "reviewer.test2"} if par else {"reviewer.test1"}
    step(("parallel" if par else "sequential") + " submit", lambda: call("POST", f"/revisions/{rid}/submit-review", tok["author.test1"], sign("author.test1")), first | exp_dco)
    if par:
        step("reviewer 1 completes (parallel: nobody else)", lambda: call("POST", f"/revisions/{rid}/review/complete", tok["reviewer.test1"], sign("reviewer.test1")), set())
    else:
        step("reviewer 1 completes (sequential: the next reviewer)", lambda: call("POST", f"/revisions/{rid}/review/complete", tok["reviewer.test1"], sign("reviewer.test1")), {"reviewer.test2"})
    # 4. last review completes
    step("last review completes", lambda: call("POST", f"/revisions/{rid}/review/complete", tok["reviewer.test2"], sign("reviewer.test2")), {"approver.test1"} | (exp_dco - {"reviewer.test2"}))
    # 5. approval rejected, back to draft
    step("approval rejected", lambda: call("POST", f"/revisions/{rid}/approve/reject", tok["approver.test1"], sign("approver.test1")), {"author.test1", "coauthor.test1", "coauthor.test2"} | (exp_dco - {"approver.test1"}))
    return doc


# review rejected
parallel(False)
doc, rid = draft_in_review()
call("POST", f"/revisions/{rid}/submit-review", tok["author.test1"], sign("author.test1"))
step("review rejected", lambda: call("POST", f"/revisions/{rid}/review/reject", tok["reviewer.test1"], sign("reviewer.test1")), {"author.test1", "coauthor.test1", "coauthor.test2"} | ({u for u in holders} - {"reviewer.test1"}))
run(False)
run(True)
# approve complete: only Document Control
parallel(False)
doc, rid = draft_in_review()
call("POST", f"/revisions/{rid}/submit-review", tok["author.test1"], sign("author.test1"))
call("POST", f"/revisions/{rid}/review/complete", tok["reviewer.test1"], sign("reviewer.test1"))
call("POST", f"/revisions/{rid}/review/complete", tok["reviewer.test2"], sign("reviewer.test2"))
step("approval completed: Document Control only", lambda: call("POST", f"/revisions/{rid}/approve/complete", tok["approver.test1"], sign("approver.test1")), {u for u in holders} - {"approver.test1"})
print(f"\n{sum(results)}/{len(results)} passed")
