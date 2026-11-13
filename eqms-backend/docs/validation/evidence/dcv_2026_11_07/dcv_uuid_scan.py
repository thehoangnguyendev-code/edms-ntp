"""DEV only: crawl the screens an account can reach and report any UUID visible to the user (text, input values, placeholder/title/aria-label).
Usage: DEVPW=... python dcv_uuid_scan.py <ROLE> [<ROLE> ...]   (role keys of dcv_lib.ROLES; SEC = dcv.secadmin)"""
import os, sys, re, json
sys.path.insert(0, os.path.dirname(__file__))
import dcv_lib
dcv_lib.ROLES['SEC'] = 'dcv.secadmin'
from dcv_lib import *

UUID = re.compile(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')
JS = """() => {
  const out = [];
  const add = (kind, t) => { if (t) out.push([kind, t]); };
  add('text', document.body.innerText);
  document.querySelectorAll('input,textarea').forEach(e => add('value', e.value));
  document.querySelectorAll('[placeholder]').forEach(e => add('placeholder', e.getAttribute('placeholder')));
  document.querySelectorAll('[title]').forEach(e => add('title', e.getAttribute('title')));
  document.querySelectorAll('[aria-label]').forEach(e => add('aria-label', e.getAttribute('aria-label')));
  return out;
}"""
roles = sys.argv[1:]
b = Browser()
found = {}
visited = set()


def scan(pg, where):
    try:
        items = pg.evaluate(JS)
    except Exception:
        return
    for kind, t in items:
        # the address bar is not page content; ids in the URL are fine
        for m in UUID.finditer(t):
            ctx = t[max(0, m.start() - 40): m.end() + 10].replace('\n', ' ')
            found.setdefault((where, kind, m.group(0)), ctx)


for role in roles:
    pg = b.page(role)
    pg.set_default_timeout(20000)
    pg.goto(BASE + '/', wait_until='domcontentloaded')
    pg.wait_for_timeout(4000)
    hrefs = [x.strip() for x in open(os.path.join(HERE, 'routes_list.txt')) if x.strip()]
    print(role, 'links', len(hrefs), flush=True)
    for h in hrefs:
        key = (role, h)
        if key in visited:
            continue
        visited.add(key)
        try:
            pg.goto(BASE + h, wait_until='domcontentloaded', timeout=30000)
            pg.wait_for_timeout(3000)
        except Exception as e:
            print('  skip', h, str(e)[:60]); continue
        scan(pg, f'{role} {h}')
        # open the first row (detail page) and every tab on it
        try:
            row = pg.locator('table tbody tr').first
            if row.count():
                row.click(timeout=4000)
                pg.wait_for_timeout(3500)
                if pg.url.rstrip('/') != (BASE + h).rstrip('/'):
                    scan(pg, f'{role} {h} -> detail')
                    tabs = pg.locator('[role=tab]')
                    for i in range(min(tabs.count(), 12)):
                        try:
                            tabs.nth(i).click(timeout=3000)
                            pg.wait_for_timeout(1800)
                            scan(pg, f'{role} {h} -> detail tab{i}')
                        except Exception:
                            pass
        except Exception:
            pass
    print(role, 'done; findings so far', len(found), flush=True)

b.close()
out = [{'where': w, 'kind': k, 'uuid': u, 'context': c} for (w, k, u), c in found.items()]
json.dump(out, open(os.path.join(HERE, 'uuid_scan_result.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('TOTAL', len(out))
for o in out[:60]:
    print(o['where'], '|', o['kind'], '|', o['context'])
