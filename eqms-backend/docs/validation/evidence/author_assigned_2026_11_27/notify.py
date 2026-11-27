"""document.author_assigned: no repeat on another Save, Vietnamese wording for a Vietnamese account, nothing without the required participants, a new Author is told."""
import json, subprocess, sys, time, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
API = "http://localhost:5100/api"
import random
NAME = "Notification test %d" % random.randint(1000, 9999)
PW = open(S + "/pw.txt").read()
DOC = "69344789-3e90-405a-b05f-fdc6092849bd"
payload = json.loads(json.load(open(S + "/sent.json", encoding="utf-8"))[0][2])
results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (" -- " + str(detail)[:250] if detail else ""))


def sql(q):
    return subprocess.check_output(["docker", "exec", "eqms-postgres", "psql", "-U", "eqms", "-d", "eqms_compare_clone", "-Atc", q]).decode("utf-8").strip()


def call(method, path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        with urllib.request.urlopen(urllib.request.Request(API + path, json.dumps(body).encode() if body is not None else None, headers, method=method), timeout=100) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


dco = call("POST", "/auth/login", body={"username": "dco.test1", "password": PW})[1]["accessToken"]
AUTHOR = sql("select id from app_users where username='author.test1'")


def notices(user="author.test1"):
    return int(sql(f"select count(*) from user_notifications n join app_users u on u.id=n.recipient_user_id where u.username='{user}' and n.action_url like '%{DOC}%' "
                   "and (n.title like 'You are the Author%' or n.title like 'Bạn đã được chỉ định%')"))


def emails():
    return int(sql("select count(*) from notification_email_outbox where event_code='document.author_assigned'"))


def save(**changes):
    status, body = call("PUT", f"/documents/{DOC}", dco, dict(payload, **changes))
    assert status == 200, (status, body)


n, e = notices(), emails()
save(description="second save")
save(description="second save")
check("saving again sends nothing", notices() == n and emails() == e, (notices(), emails()))

sql("delete from notification_email_outbox")
status, created = call("POST", "/documents", dco, dict(payload, documentName=NAME, titleLocalLanguage="Tai lieu thu thong bao", requiresTraining=True, trainingPeriodDays=14, reviewerUserIds=[], approverUserIds=[]))
assert status == 200, (status, created)
NEW = created["id"]
check("new document without Approver: nothing", emails() == 0, emails())
sql(f"insert into user_localization_preferences(user_id, language) values ('{AUTHOR}','vi') on conflict (user_id) do update set language='vi'")
def save_new(**changes):
    status, body = call("PUT", f"/documents/{NEW}", dco, dict(payload, documentName=NAME, titleLocalLanguage="Tai lieu thu thong bao", requiresTraining=True, trainingPeriodDays=14, **changes))
    assert status == 200, (status, body)


save_new(description="participants added", reviewerUserIds=["bf6eab8a-7aa0-4a15-a2ee-84bee788e193"], approverUserIds=["42809b4c-9a6b-4df6-8e2b-01105ff5c1a4"])
DOC = NEW
NUMBER = sql(f"select document_number from documents where id='{NEW}'")
check("told once the participants are saved", notices() == 1 and emails() == 1, (notices(), emails()))
title, message = sql(f"select title, message from user_notifications where recipient_user_id='{AUTHOR}' and action_url like '%{DOC}%' order by created_at desc limit 1").split("|", 1)
check("in-app wording in Vietnamese", title.startswith("Bạn đã được chỉ định làm Tác giả tài liệu " + NUMBER) and "hãy thực hiện upload revision" in message, title + " / " + message)
check("opens the document", sql(f"select action_url from user_notifications where recipient_user_id='{AUTHOR}' and action_url like '%{DOC}%' order by created_at desc limit 1").endswith(DOC))
save_new(description="saved once more")
check("no repeat for the new document", notices() == 1 and emails() == 1, (notices(), emails()))

for _ in range(30):
    if sql("select coalesce(max(status),'') from notification_email_outbox where event_code='document.author_assigned'") not in ("PENDING", "SENDING"):
        break
    time.sleep(2)
check("e-mail sent", sql("select max(status) from notification_email_outbox where event_code='document.author_assigned'") == "SENT")
mail = json.load(urllib.request.urlopen("http://localhost:8025/api/v2/search?kind=to&query=author.test1@example.local&limit=1"))["items"][0]
from email.header import decode_header, make_header
subject = str(make_header(decode_header(mail["Content"]["Headers"]["Subject"][0])))
check("e-mail subject in Vietnamese", "Bạn đã được chỉ định làm Tác giả tài liệu " + NUMBER in subject, subject)
open(S + "/mail_id.txt", "w").write(mail["ID"])
print(f"\n{sum(results)}/{len(results)} passed")
