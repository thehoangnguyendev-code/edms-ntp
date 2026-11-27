"""dco.test1 opens SOP.10489, changes the description and saves; the request is kept for the API variations."""
import json, sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]; PW = open(S + "/pw.txt").read(); B = "http://localhost:3113"
DOC = "69344789-3e90-405a-b05f-fdc6092849bd"
with sync_playwright() as pw:
    br = pw.chromium.launch(channel="msedge", headless=True); p = br.new_page(viewport={"width": 1500, "height": 1400})
    sent = []
    p.on("request", lambda r: sent.append((r.method, r.url, r.post_data)) if r.method in ("PUT", "POST", "PATCH") and "/documents" in r.url else None)
    p.goto(B + "/login", wait_until="domcontentloaded"); p.wait_for_timeout(8000)
    p.locator("input").nth(0).press_sequentially("dco.test1", delay=30)
    p.locator("input[type=password]").press_sequentially(PW, delay=20); p.keyboard.press("Enter"); p.wait_for_timeout(9000)
    p.evaluate("u => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')) }", "/documents/all/edit/" + DOC); p.wait_for_timeout(10000)
    c = p.get_by_role("button", name="Tiếp tục làm việc")
    if c.count(): c.first.click()
    names = [t.strip() for t in p.get_by_role("button").all_inner_texts() if t.strip()]
    print(p.url, names[:14])
    for label in ["Edit", "Edit Document"]:
        b = p.get_by_role("button", name=label, exact=True)
        if b.count(): b.first.click(); p.wait_for_timeout(6000); break
    print(p.url)
    area = p.locator("textarea:not([readonly]):not([disabled])"); p.screenshot(path=S + "/ui_before.png")
    print("textareas", area.count())
    if area.count():
        area.last.fill("Updated by notification test"); p.wait_for_timeout(1000)
    for label in ["Lưu", "Save", "Lưu bản nháp", "Save Draft"]:
        b = p.get_by_role("button", name=label, exact=True)
        if b.count(): b.first.click(); p.wait_for_timeout(3000); break
    for label in ["Lưu", "Xác nhận", "Confirm", "OK"]:
        b = p.get_by_role("button", name=label, exact=True)
        if b.count(): b.last.click(); break
    p.wait_for_timeout(6000)
    p.screenshot(path=S + "/ui_save.png")
    for m, u, d in sent:
        print(m, u.split("/api")[-1], (d or "")[:100])
    json.dump([x for x in sent if x[0] == "PUT"], open(S + "/sent.json", "w", encoding="utf-8"))
    br.close()
