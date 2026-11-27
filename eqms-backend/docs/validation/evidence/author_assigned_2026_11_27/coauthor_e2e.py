"""document.coauthor_edit_ready: told when the Draft gets its first file, not on a replacement; the Co-Author can edit it."""
import random, sys, time
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
exec(open(S + "/e2e.py", encoding="utf-8").read().split("author, trainee = login(")[0].replace("sys.stdout.reconfigure", "(lambda **k: 0)"))
dco, author = login("dco.test1"), login("author.test1")
uid = {u: sql(f"select id from app_users where username='{u}'") for u in ("author.test1", "reviewer.test1", "approver.test1", "coauthor.test1", "coauthor.test2")}
template = sql("select json_build_object('documentType',document_type_id,'businessUnit',(select name from business_units where id=d.business_unit_id),"
               "'department',(select name from departments where id=d.department_id)) from documents d where document_number='SOP.10489'")
base = json.loads(template)
name = "Co-author notification test %d" % random.randint(1000, 9999)
payload = dict(base, documentName=name, titleLocalLanguage=name, author=uid["author.test1"], description="co-author test",
               periodicReviewCycle=36, periodicReviewNotification=10, requiresTraining=True, trainingPeriodDays=14, language="English",
               coAuthorIds=[uid["coauthor.test1"], uid["coauthor.test2"]], reviewerUserIds=[uid["reviewer.test1"]], approverUserIds=[uid["approver.test1"]])
s, doc = call("POST", "/documents", dco, payload)
check("document with co-authors created", s == 200, (s, doc))
DOC = doc["id"]


def notices(user, rid):
    return int(sql(f"select count(*) from user_notifications where recipient_user_id='{uid[user]}' and action_url like '%{rid}%' and action_url like '%revisions/edit%'"))


def emails():
    return int(sql("select count(*) from notification_email_outbox where event_code='document.coauthor_edit_ready'"))


check("nothing before the upload", emails() == 0)
old = open(S + "/spike/old.docx", "rb").read()
new = open(S + "/spike/new.docx", "rb").read()
s, created = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"file": ("a.docx", old)})
check("author uploads the revision", s == 200, (s, created if s != 200 else ""))
rid = created["id"]
check("both co-authors told in the app", notices("coauthor.test1", rid) == 1 and notices("coauthor.test2", rid) == 1, (notices("coauthor.test1", rid), notices("coauthor.test2", rid)))
check("both co-authors e-mailed", emails() == 2, emails())
check("the author is not told", notices("author.test1", rid) == 0)
title, message = sql(f"select title, message from user_notifications where recipient_user_id='{uid['coauthor.test1']}' and action_url like '%{rid}%' limit 1").split("|", 1)
check("Vietnamese account gets Vietnamese", "mời bạn vào cùng soạn thảo" in title and "hãy vào cùng soạn thảo" in message, title + " / " + message)
s, b = call("POST", f"/revisions/{rid}/upload", author, files={"file": ("b.docx", new)})
check("replacing the file sends nothing", s == 200 and emails() == 2 and notices("coauthor.test1", rid) == 1, (s, emails()))
s, config = call("GET", f"/revisions/{rid}/onlyoffice/edit-config", login("coauthor.test1"))
check("co-author may edit online", s == 200 and config["document"]["permissions"]["edit"], (s, config if s != 200 else ""))
open(S + "/rid.txt", "w").write(rid)
print(f"\n{sum(results)}/{len(results)} passed")
