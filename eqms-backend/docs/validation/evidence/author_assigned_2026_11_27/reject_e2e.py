"""A rejection (review, then approval) is told to the Author and Co-Authors only, one e-mail each."""
import random, sys, time, collections
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
exec(open(S + "/e2e.py", encoding="utf-8").read().split("author, trainee = login(")[0].replace("sys.stdout.reconfigure", "(lambda **k: 0)"))
from email.header import decode_header, make_header
dco, author, reviewer, approver = (login(u) for u in ("dco.test1", "author.test1", "reviewer.test1", "approver.test1"))
names = ["author.test1", "reviewer.test1", "approver.test1", "coauthor.test1", "coauthor.test2", "dco.test1"]
uid = {u: sql(f"select id from app_users where username='{u}'") for u in names}
base = json.loads(sql("select json_build_object('documentType',document_type_id,'businessUnit',(select name from business_units where id=d.business_unit_id),"
                      "'department',(select name from departments where id=d.department_id)) from documents d where document_number='SOP.10489'"))
old = open(S + "/spike/old.docx", "rb").read()


def signature(user, token):
    s, b = call("POST", "/auth/verify-signature", token, {"username": user, "password": PW})
    assert s == 200, (s, b)
    return b["signatureToken"]


def make_pending_review():
    name = "Rework check %d" % random.randint(1000, 9999)
    payload = dict(base, documentName=name, titleLocalLanguage=name, author=uid["author.test1"], description="rework check", periodicReviewCycle=36,
                   periodicReviewNotification=10, requiresTraining=True, trainingPeriodDays=14, language="English",
                   coAuthorIds=[uid["coauthor.test1"], uid["coauthor.test2"]], reviewerUserIds=[uid["reviewer.test1"]], approverUserIds=[uid["approver.test1"]])
    s, doc = call("POST", "/documents", dco, payload)
    assert s == 200, (s, doc)
    s, rev = call("POST", f"/documents/{doc['id']}/revisions/upload", author, files={"file": ("a.docx", old)})
    assert s == 200, (s, rev)
    s, b = call("POST", f"/revisions/{rev['id']}/submit-review", author, {"reason": "ready", "comment": "ready", "signatureToken": signature("author.test1", author)})
    check("submitted for review", s == 200, (s, b if s != 200 else ""))
    return doc["documentNumber"], rev["id"]


def mails(number, since):
    items = json.load(urllib.request.urlopen("http://localhost:8025/api/v2/messages?limit=200"))["items"]
    found = []
    for m in items:
        subject = str(make_header(decode_header(m["Content"]["Headers"]["Subject"][0])))
        if m["ID"] not in since and ("reject" in subject.lower() or "từ chối" in subject.lower()):
            found.append((m["To"][0]["Mailbox"], subject, m["ID"]))
    return found


def verify(label, event, number, rid):
    expected = {"author.test1", "coauthor.test1", "coauthor.test2"}
    for _ in range(40):
        if sql(f"select count(*) from notification_email_outbox where event_code='{event}' and status<>'SENT'") == "0" and \
           sql(f"select count(*) from notification_email_outbox where event_code='{event}'") != "0":
            break
        time.sleep(2)
    time.sleep(4)
    inapp = sql(f"select string_agg(u.username, ',' order by u.username) from user_notifications n join app_users u on u.id=n.recipient_user_id where n.action_url like '%{rid}%' and (n.title ilike '%reject%' or n.title ilike '%từ chối%')")
    check(label + ": in-app to author and co-authors only", set(inapp.split(",")) == expected, inapp)
    got = mails(number, seen)
    per = collections.Counter(to for to, _, _ in got)
    check(label + ": e-mail to author and co-authors only, one each", set(per) == expected and set(per.values()) == {1}, sorted((t, s) for t, s, _ in got))
    check(label + ": one outbox row per person", sql(f"select count(*) from notification_email_outbox where event_code='{event}'") == "3")
    for _, subject, mail_id in got:
        seen.add(mail_id)
        created.append(mail_id)


created = []
seen = {m["ID"] for m in json.load(urllib.request.urlopen("http://localhost:8025/api/v2/messages?limit=250"))["items"]}

number, rid = make_pending_review()
s, b = call("POST", f"/revisions/{rid}/review/reject", reviewer, {"reason": "please fix", "comment": "please fix", "signatureToken": signature("reviewer.test1", reviewer)})
check("reviewer rejects", s == 200, (s, b if s != 200 else ""))
verify("review rejection", "document.review_rejected", number, rid)

number, rid = make_pending_review()
s, b = call("POST", f"/revisions/{rid}/review/complete", reviewer, {"reason": "ok", "comment": "ok", "signatureToken": signature("reviewer.test1", reviewer)})
if s == 404:
    s, b = call("POST", f"/revisions/{rid}/complete-review", reviewer, {"reason": "ok", "comment": "ok", "signatureToken": signature("reviewer.test1", reviewer)})
check("reviewer completes", s == 200, (s, b if s != 200 else ""))
s, b = call("POST", f"/revisions/{rid}/approve/reject", approver, {"reason": "not yet", "comment": "not yet", "signatureToken": signature("approver.test1", approver)})
check("approver rejects", s == 200, (s, b if s != 200 else ""))
verify("approval rejection", "document.approval_rejected", number, rid)
open(S + "/mails.json", "w").write(json.dumps(created))
print(f"\n{sum(results)}/{len(results)} passed")
