"""DEV browser scan for flashes on the tabs of the detail screens, 2026-10-30. For each detail screen it clicks each tab in turn and records (1) the sequence of different contents the tab card shows after the click
(a MutationObserver), and (2) the GET requests of the API made by the click. It reports a tab when (a) an "empty" or "create" text shows first and is replaced by the data (the flash the Participants tab had),
(b) the same GET is made more than twice for one click (React StrictMode of the dev server already makes it twice), (c) more than 3 different contents follow. The password comes from DEVPW and is never written. Read-only: it only opens screens.
Run with plain `python`. Prints one line per tab; exit code 1 when a flash or a double load is found."""
import os, sys, re, json, subprocess
from collections import Counter
from playwright.sync_api import sync_playwright

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
SHOTS = os.path.join(os.path.dirname(__file__), 'ui_shots')
os.makedirs(SHOTS, exist_ok=True)


def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, check=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]


def one(q):
    r = sql(q)
    return r[0][0] if r else None


SCREENS = [
    ('Training activity (completed)', lambda: one("select id from training_activities where status='COMPLETED' and exists (select 1 from training_participants p where p.activity_id=training_activities.id) order by created_at desc limit 1"), '/training-management/activities/{id}'),
    ('Training activity (planned)', lambda: one("select id from training_activities where status='PLANNED' order by created_at desc limit 1"), '/training-management/activities/{id}'),
    ('Training activity (self-reading)', lambda: one("select a.id from training_activities a join training_sessions s on s.activity_id=a.id where s.method='SELF_READING' order by a.created_at desc limit 1"), '/training-management/activities/{id}'),
    ('Job assignment (effective)', lambda: one("select id from training_job_assignments where status='EFFECTIVE' order by created_at desc limit 1"), '/training-management/job-assignments/{id}'),
    ('Job assignment (draft)', lambda: one("select id from training_job_assignments where status='DRAFT' order by created_at desc limit 1"), '/training-management/job-assignments/{id}'),
    ('Training requirement', lambda: one("select id from training_requirements where status='APPROVED' order by created_at desc limit 1"), '/training-management/requirements/{id}'),
    ('Matrix version', lambda: one("select v.id from training_matrix_versions v where v.status='EFFECTIVE' order by v.created_at desc limit 1"), '/training-management/matrix/{id}'),
    ('Personnel review', lambda: one("select id from training_personnel_reviews order by created_at desc limit 1"), '/training-management/personnel-reviews/{id}'),
    ('Specimen signature', lambda: one("select id from training_specimen_signatures order by created_at desc limit 1"), '/training-management/specimen-signatures/{id}'),
    ('Assessment', lambda: one("select id from training_assessment_defs order by created_at desc limit 1"), '/training-management/assessments/{id}'),
    ('Document', lambda: one("select id from documents order by created_at desc limit 1"), '/documents/{id}'),
    ('Revision', lambda: one("select id from document_revisions order by created_at desc limit 1"), '/documents/revisions/{id}'),
]

OBS = """
window.__snaps = []; window.__last = '';
window.__panel = () => {
  const tabs = Array.from(document.querySelectorAll('[role=tab]')).filter(t => !t.closest('aside, nav'));
  const tl = tabs.length ? (tabs[0].closest('[role=tablist]') || tabs[0].parentElement) : null;
  const card = tl ? (tl.closest('.rounded-xl') || tl.parentElement) : document.body;
  return (card.innerText || '').replace(/\\s+/g, ' ');
};
window.__grab = () => { const t = window.__panel(); if (t !== window.__last) { window.__snaps.push([Math.round(performance.now()), t.slice(-420), t.slice(0, 4000)]); window.__last = t; } };
new MutationObserver(window.__grab).observe(document.body, { childList: true, subtree: true, characterData: true });
"""
EMPTY = re.compile(r"No [A-Za-z ]+(yet|found|selected|matches)|Nothing|Add a session first|No Participants|Loading", re.I)
DATA_TEXT = re.compile(r"\d", re.I)

found = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    ctx = b.new_context(viewport={'width': 1500, 'height': 1300})
    pg = ctx.new_page()
    gets = []
    pg.on('request', lambda r: gets.append(r.url.split('?')[0] + ('?' + r.url.split('?')[1] if '?' in r.url else '')) if r.method == 'GET' and '/api/' in r.url else None)
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', 'admin')
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(4000)
    for name, finder, route in SCREENS:
        try:
            id_ = finder()
        except Exception as e:
            print(f'{name}: no data ({e})')
            continue
        if not id_:
            print(f'{name}: no record on DEV')
            continue
        pg.goto(BASE + route.format(id=id_), wait_until='domcontentloaded')
        pg.wait_for_timeout(4000)
        names = pg.evaluate("Array.from(document.querySelectorAll('[role=tab]')).filter(t => !t.closest('aside, nav')).map(t => (t.innerText || '').replace(/\\s+/g, ' ').trim())")
        print(f'\n== {name} ({len(names)} tabs)')
        for tab in names:
            label = re.sub(r'\s*\d+$', '', tab)
            loc = pg.get_by_role('tab').filter(has_text=label)
            loc = loc.filter(visible=True) if hasattr(loc, 'filter') else loc
            if loc.count() == 0:
                continue
            pg.evaluate(OBS)
            del gets[:]
            tabs_before = pg.evaluate("Array.from(document.querySelectorAll('[role=tab]')).filter(t => !t.closest('aside, nav')).map(t => (t.innerText || '').replace(/\s+/g, ' ').trim())")
            try:
                loc.last.click(timeout=5000)
            except Exception as e:
                print(f'   {label}: could not click ({str(e)[:60]})')
                continue
            pg.wait_for_timeout(1800)
            tabs_after = pg.evaluate("Array.from(document.querySelectorAll('[role=tab]')).filter(t => !t.closest('aside, nav')).map(t => (t.innerText || '').replace(/\s+/g, ' ').trim())")
            snaps = pg.evaluate('window.__snaps') or []   # None when the click left the page (a tab that opens another screen)
            # the dev server runs React StrictMode: an effect at mount runs twice, so the same GET twice is normal here; more than twice is a real repeat
            dup = [u for u, n in Counter(gets).items() if n > 2 and '/notifications' not in u and 'summary' not in u]
            texts = [s[1] for s in snaps]
            fulls = [s[2] for s in snaps]
            flash = False
            # an empty/loading text shows first and a later snapshot has no such text and has data (numbers) -> the empty one was a flash, unless it is a plain loading text that lasts one step
            empties = [i for i, t in enumerate(texts) if EMPTY.search(t) and not re.search(r'Loading', t, re.I)]
            if empties and len(texts) > empties[-1] + 1 and not EMPTY.search(texts[-1]):
                flash = True
            # a heading with a count of zero that is on the screen at first and gone at the end is an empty block that flashed (the three empty groups of the Participants tab)
            zero = lambda t: {' '.join(w[max(0, k - 2):k]) for w in [t.split(' ')] for k, x in enumerate(w) if x == '(0)'}
            vanished = set().union(*[zero(t) for t in fulls[:-1]]) - zero(fulls[-1]) if len(fulls) > 1 else set()
            if vanished:
                flash = True
            badge = [(a, b2) for a, b2 in zip(tabs_before, tabs_after) if a != b2]   # the number on a tab label changed because of the click
            many = len(texts) > 3
            status = []
            if flash: status.append('EMPTY-THEN-DATA' + (' ' + ','.join(sorted(vanished)) if vanished else ''))
            if dup: status.append('DOUBLE-LOAD ' + ','.join(u[-60:] for u in dup[:2]))
            if badge: status.append('TAB-COUNT-CHANGED ' + '; '.join(f'{a} -> {b2}' for a, b2 in badge[:2]))
            if many: status.append(f'{len(texts)} CHANGES')
            print(f'   {label:34s} changes={len(texts)} gets={len(gets)} {"  <-- " + "; ".join(status) if status else ""}')
            if status:
                found.append((name, label, status, [re.sub(r'^.*?(Other trainings required)', r'', f)[:360] for f in fulls[:4]]))
    b.close()

print(f'\n{len(found)} tab(s) with a flash, a double load or many changes')
for name, label, status, texts in found:
    print('  *', name, '/', label, '|', '; '.join(status))
    for t in texts[:3]:
        print('       ', t[-200:])
sys.exit(1 if found else 0)
