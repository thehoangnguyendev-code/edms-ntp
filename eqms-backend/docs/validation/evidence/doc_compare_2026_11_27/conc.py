"""Two creations at once, then the reviewer's view in Pending Review."""
import sys, threading, runpy
S = sys.argv[1]
sys.argv = ["x", S]
src = open(S + "/e2e.py", encoding="utf-8").read()
head = src[:src.index('author, trainee = login(')]
exec(head)
author = login("author.test1")


def reset():
    sql(f"update document_revisions set status_code='CLOSED_CANCELLED' where document_id='{DOC}' and status_code in ('DRAFT','PENDING_REVIEW')")
    sql(f"update documents set next_revision_configured_at=now() where id='{DOC}'")


reset()
out = []
gate = threading.Barrier(2)


def go():
    gate.wait()
    out.append(call("POST", f"/documents/{DOC}/revisions/upload", author, files={"useEffectiveSource": "true"})[0])


threads = [threading.Thread(target=go) for _ in range(2)]
[t.start() for t in threads]
[t.join() for t in threads]
open_count = int(sql(f"select count(*) from document_revisions where document_id='{DOC}' and status_code='DRAFT'"))
check("two creations at once leave one draft", open_count == 1, (sorted(out), open_count))

rid = sql(f"select id from document_revisions where document_id='{DOC}' and status_code='DRAFT' order by created_at desc limit 1")
new = open(S + "/spike/new.docx", "rb").read()
call("POST", f"/revisions/{rid}/upload", author, files={"file": ("changed.docx", new)})
open(S + "/rid.txt", "w").write(rid)
print("participants", sql(f"select u.username||':'||p.participant_type from revision_workflow_participants p join app_users u on u.id=p.user_id where p.revision_id='{rid}'"))
