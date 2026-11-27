"""Side by side: right files for the right panes, refusals, and synchronised scrolling in a real browser."""
import io, sys, zipfile
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
exec(open(S + "/e2e.py", encoding="utf-8").read().split("author, trainee = login(")[0].replace("sys.stdout.reconfigure", "(lambda **k: 0)"))
from playwright.sync_api import sync_playwright
author, reviewer, trainee = login("author.test1"), login("reviewer.test1"), login("trainee.test1")
a_bytes, b_bytes = open(S + "/proto/a.docx", "rb").read(), open(S + "/proto/b.docx", "rb").read()
s, created = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"file": ("b.docx", b_bytes)})
assert s == 200, (s, created)
rid = created["id"]
sql(f"update document_revisions set status_code='PENDING_REVIEW', editing_status='COMPLETED', source_locked=true where id='{rid}'")


def config(token=reviewer, baseline=EFF):
    return call("GET", f"/revisions/{rid}/onlyoffice/side-by-side-config?baselineId={baseline}", token)


def fetch(url):
    return call("GET", url.replace("host.docker.internal", "localhost"), raw=True)


def text(content):
    return zipfile.ZipFile(io.BytesIO(content)).read("word/document.xml").decode()


s, data = config()
check("config for both panes", s == 200 and data["baseline"]["revisionId"] == EFF and data["current"]["revisionId"] == rid, (s, data if s != 200 else ""))
left, right = data["baseline"]["config"], data["current"]["config"]
s, edit = call("GET", f"/revisions/{rid}/onlyoffice/edit-config", reviewer)
keys = [left["document"]["key"], right["document"]["key"], edit["document"]["key"]]
check("three different document keys (two panes and the editing session)", len(set(keys)) == 3, keys)
check("both panes read only", all(not any(c["document"]["permissions"][k] for k in ("edit", "review", "comment", "download", "print")) for c in (left, right)))
check("left final, right with markup", left["editorConfig"]["customization"]["review"]["reviewDisplay"] == "final" and right["editorConfig"]["customization"]["review"]["reviewDisplay"] == "markup")
la, ra = fetch(left["document"]["url"])[1], fetch(right["document"]["url"])[1]
check("left pane gets the effective file, right pane the revision under review", "A dòng 1:" in text(la) and "B dòng 1:" in text(ra) and "B dòng" not in text(la))
swapped = left["document"]["url"].replace("revision-side-final", "revision-side-current")
check("a pane token cannot be used for the other pane", fetch(swapped)[0] >= 400)
other_rev = left["document"]["url"].replace(EFF, rid)
check("nor for another revision", fetch(other_rev)[0] >= 400)
check("refused without view permission", config(trainee)[0] == 403)
other = sql(f"select id from document_revisions where document_id<>'{DOC}' and status_code='EFFECTIVE' limit 1")
check("a revision of another document refused", config(baseline=other)[0] >= 400)
check("the revision itself refused as baseline", config(baseline=rid)[0] >= 400)
sha = sql(f"select source_file_checksum from document_revisions where id='{EFF}'")
sql(f"update document_revisions set source_file_checksum=repeat('0',64) where id='{EFF}'")
s, b = config()
check("a stored file that does not match its checksum is not shown", s >= 400 and "REVISION_FILE_INTEGRITY_MISMATCH" in json.dumps(b), (s, b))
sql(f"update document_revisions set source_file_checksum='{sha}' where id='{EFF}'")

BASE = "http://localhost:3113"
with sync_playwright() as pw:
    br = pw.chromium.launch(channel="msedge", headless=True)
    p = br.new_page(viewport={"width": 1700, "height": 900})
    errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(BASE + "/login", wait_until="domcontentloaded"); p.wait_for_timeout(8000)
    p.locator("input").nth(0).press_sequentially("reviewer.test1", delay=30)
    p.locator("input[type=password]").press_sequentially(PW, delay=20); p.keyboard.press("Enter"); p.wait_for_timeout(8000)
    p.goto(f"{BASE}/documents/revisions/{rid}/onlyoffice-editor", wait_until="domcontentloaded"); p.wait_for_timeout(16000)
    p.get_by_role("button", name="Compare with Effective").click(); p.wait_for_timeout(1000)
    p.screenshot(path=S + "/sbs_chooser.png")
    p.get_by_role("button", name="Compare", exact=True).click(); p.wait_for_timeout(25000)
    p.screenshot(path=S + "/sbs.png")
    together = p.get_by_role("button", name="Scroll together")
    check("scroll synchronisation connected", together.count() == 1 and together.is_enabled(), p.locator("[role=status]").all_inner_texts())

    def editors():
        found = []
        for frame in p.frames:
            if "documenteditor" in frame.url:
                box = frame.frame_element().bounding_box()
                found.append((box["x"], box["width"], box["y"], frame))
        return sorted(found, key=lambda item: item[0])

    all_editors = editors()
    panes = [e for e in all_editors if e[1] < 1000]
    check("two panes of equal width side by side", len(panes) == 2 and abs(panes[0][1] - panes[1][1]) <= 2, [(e[0], e[1]) for e in all_editors])
    pl, pr = panes[0][3], panes[1][3]
    y = lambda f: f.evaluate("() => window.Asc.editor.WordControl.m_dScrollY")
    pl.evaluate("() => window.Asc.editor.WordControl.m_oScrollVerApi.scrollToY(1800)"); p.wait_for_timeout(1000)
    check("scrolling the left moves the right", abs(y(pr) - y(pl)) <= 3 and y(pl) > 1500, (y(pl), y(pr)))
    pr.evaluate("() => window.Asc.editor.WordControl.m_oScrollVerApi.scrollToY(900)"); p.wait_for_timeout(1000)
    check("scrolling the right moves the left", abs(y(pr) - y(pl)) <= 3 and abs(y(pr) - 900) < 5, (y(pl), y(pr)))
    box = panes[0]
    before = (y(pl), y(pr))
    p.mouse.move(box[0] + box[1] / 2, box[2] + 300)
    for _ in range(6):
        p.mouse.wheel(0, 500); p.wait_for_timeout(150)
    p.wait_for_timeout(1000)
    check("the mouse wheel moves both", y(pl) > before[0] + 50 and abs(y(pr) - y(pl)) <= 3, (before, y(pl), y(pr)))
    p.screenshot(path=S + "/sbs_scrolled.png")
    together.click(); p.wait_for_timeout(500)
    held = y(pr)
    pl.evaluate("() => window.Asc.editor.WordControl.m_oScrollVerApi.scrollToY(200)"); p.wait_for_timeout(900)
    check("switched off, they scroll separately", abs(y(pr) - held) < 2 and abs(y(pl) - 200) < 5, (y(pl), y(pr), held))
    p.get_by_role("button", name="Scroll separately").click(); p.wait_for_timeout(500)
    offset = y(pr) - y(pl)
    pl.evaluate("() => window.Asc.editor.WordControl.m_oScrollVerApi.scrollToY(500)"); p.wait_for_timeout(900)
    check("switched on again, the alignment is kept", abs((y(pr) - y(pl)) - offset) <= 3, (offset, y(pr) - y(pl)))
    s_up, _ = call("POST", f"/revisions/{rid}/upload", author, files={"file": ("x.docx", a_bytes)})
    sql(f"update document_revisions set source_file_checksum='{'1' * 64}' where id='{rid}'")
    p.wait_for_timeout(7000)
    check("a new save is announced", p.get_by_text("was saved again").count() == 1, p.locator("[role=alert]").all_inner_texts())
    p.screenshot(path=S + "/sbs_stale.png")
    s, b = call("GET", right["document"]["url"].replace("host.docker.internal", "localhost").split("/api", 1)[1] if False else f"/revisions/{rid}/comparison-info", reviewer)
    p.get_by_role("button", name="Close Compare").click(); p.wait_for_timeout(3000)
    check("closing removes both viewers and keeps the editor", len(editors()) == 1, len(editors()))
    p.set_viewport_size({"width": 900, "height": 800}); p.wait_for_timeout(800)
    p.get_by_role("button", name="Compare with Effective").click(); p.wait_for_timeout(800)
    check("side by side not offered on a narrow screen", p.get_by_label("One document with changes marked").is_checked())
    check("no page error", not errors, errors[:2])
    br.close()
print(f"\n{sum(results)}/{len(results)} passed")
