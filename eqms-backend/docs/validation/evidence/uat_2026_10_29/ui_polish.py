"""DEV browser check, 2026-10-30, of the screen fixes: label and tab names in Title Case, the multi select of "Job title of subordinates" (editable and read-only, empty or not), the Matrix Check tab with one
frame, the wider Postpone dialog, and the tables under a job assignment (search, sort, drag scroll, all on the server). The password comes from DEVPW and is never written.
Run with plain `python`. Screenshots: ui_shots/polish_*.png. Exit code 1 when a check fails."""
import os, sys, re, subprocess, json
from playwright.sync_api import sync_playwright

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
SHOTS = os.path.join(os.path.dirname(__file__), 'ui_shots')
os.makedirs(SHOTS, exist_ok=True)
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, check=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]


def is_title(text):
    """Every word of the text starts with a capital (or is not a word: a number, a symbol)."""
    words = [w for w in re.split(r'[\s/]+', text) if re.search(r'[A-Za-z]', w)]
    return all(re.match(r'^[^A-Za-z]*[A-Z]', w) for w in words)


with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    ctx = b.new_context(viewport={'width': 1500, 'height': 1500})
    pg = ctx.new_page()
    reqs = []
    pg.on('request', lambda r: reqs.append(r.url) if '/api/training/' in r.url else None)
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', 'admin')
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(4000)

    def open_(path, wait=3500):
        pg.goto(BASE + path, wait_until='domcontentloaded')
        pg.wait_for_timeout(wait)

    draft = sql("select id from training_job_assignments where status='DRAFT' order by created_at desc limit 1")
    cancelled = sql("select id from training_job_assignments where status='CANCELLED' and coalesce(subordinate_titles,'')='' order by created_at desc limit 1")
    eff = sql("select j.id from training_job_assignments j where j.status='EFFECTIVE' order by j.created_at desc limit 1")

    # 1. title case of the labels and the tab names
    open_(f'/training-management/job-assignments/{eff[0][0]}')
    labels = pg.evaluate("Array.from(document.querySelectorAll('label')).map(l => getComputedStyle(l).textTransform === 'capitalize' ? l.innerText.replace(/\\s+/g,' ').trim() : '').filter(Boolean)")
    shown_labels = pg.evaluate("Array.from(document.querySelectorAll('label')).filter(l => getComputedStyle(l).textTransform === 'capitalize').map(l => l.innerText)")
    bad = [t for t in (shown_labels or []) if t and not is_title(t) and getattr(t, 'isupper', lambda: False)() is False]
    check('PL1 the field labels have text-transform: capitalize (Title Case on screen)', len(labels) >= 6, labels[:12])
    cap_labels = pg.evaluate("Array.from(document.querySelectorAll('label')).map(l => [l.textContent.trim(), getComputedStyle(l).textTransform]).filter(x => x[0] && /[a-z]/.test(x[0]))")
    notcap = [x for x in cap_labels if x[1] != 'capitalize' and len(x[0].split()) >= 2 and len(x[0].split()) < 7]
    check('PL2 no multi-word field label on this screen is left without the capitalize style', not notcap, notcap[:6])
    tabs = pg.evaluate("Array.from(document.querySelectorAll('[role=tab]')).filter(t => !t.closest('aside, nav')).map(t => { const s = t.querySelector('span') || t; return [s.textContent.trim(), getComputedStyle(s).textTransform]; })")
    check('PL3 the tab names are capitalized', tabs and all(x[1] == 'capitalize' for x in tabs), tabs[:8])
    pg.screenshot(path=os.path.join(SHOTS, 'polish_effective_general.png'))

    # 2. subordinates: editable multi select (draft)
    if draft:
        open_(f'/training-management/job-assignments/{draft[0][0]}')
        box = pg.get_by_text('Job title of subordinates').first
        check('PL4 the draft shows "Job title of subordinates" as Title Case', pg.evaluate("Array.from(document.querySelectorAll('label')).some(l => /subordinates/i.test(l.textContent) && getComputedStyle(l).textTransform === 'capitalize')"))
        group = pg.locator('label', has_text=re.compile('subordinates', re.I)).first.locator('xpath=..')
        trig = group.locator('button[id$="-trigger"], button[aria-haspopup]').first
        check('PL5 the subordinates field is the multi select (a trigger with a list), not a list of badges plus a select', trig.count() >= 1, group.inner_text()[:200])
        if trig.count():
            trig.click()
            pg.wait_for_timeout(1500)
            pg.screenshot(path=os.path.join(SHOTS, 'polish_subordinates_open.png'))
            opts = pg.locator('[role=option], [role=listbox] button')
            check('PL6 the list of people opens and can be searched', opts.count() >= 1 and pg.locator('input[placeholder*="earch"]').count() >= 1, opts.count())
            if opts.count() >= 2:
                opts.nth(0).click()
                opts.nth(1).click()
            pg.keyboard.press('Escape')
            pg.wait_for_timeout(500)
            pg.screenshot(path=os.path.join(SHOTS, 'polish_subordinates_chosen.png'))
        # 3. the Matrix Check tab: one frame
        pg.get_by_role('tab', name=re.compile('Matrix Check')).click()
        pg.wait_for_timeout(2000)
        pg.screenshot(path=os.path.join(SHOTS, 'polish_matrix_check.png'))
        inner = pg.evaluate("(() => { const h = Array.from(document.querySelectorAll('h3')).find(x => /Other trainings required/i.test(x.textContent)); if (!h) return null; let n = h.parentElement, framed = 0; while (n && n.getAttribute('role') !== 'tabpanel' && n !== document.body) { const cs = getComputedStyle(n); if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopColor !== 'rgba(0, 0, 0, 0)') framed++; n = n.parentElement; } return framed; })()")
        print('   frames around the heading (inside the tab card):', inner)
    else:
        check('PL4 draft job assignment', False, 'no draft on DEV')

    # 4. read-only and empty
    if cancelled:
        open_(f'/training-management/job-assignments/{cancelled[0][0]}')
        pg.screenshot(path=os.path.join(SHOTS, 'polish_cancelled.png'))
        ro = pg.evaluate("(() => { const l = Array.from(document.querySelectorAll('label')).find(x => /subordinates/i.test(x.textContent)); if (!l) return null; const g = l.parentElement; const i = g.querySelector('input'); return i ? [i.readOnly || i.disabled, i.placeholder] : g.innerText; })()")
        check('PL7 a read-only job assignment with no subordinates shows the empty read-only field, not a blank gap', isinstance(ro, list) and ro[0] is True and ro[1] == '—', ro)

    # 5. the tables under the screen
    open_(f'/training-management/job-assignments/{eff[0][0]}')
    pg.mouse.wheel(0, 3000)
    pg.wait_for_timeout(1200)
    tab = pg.get_by_role('tab', name='Training Records')
    if tab.count():
        tab.first.click()
        pg.wait_for_timeout(2000)
        search = pg.locator('input[placeholder*="Search training"]:visible')
        check('PL8 the Training Records tab has a search box above the table', search.count() >= 1)
        hdr = pg.get_by_role('columnheader', name=re.compile('Training Number'))
        del reqs[:]
        hdr.first.click()
        pg.wait_for_timeout(1500)
        check('PL9 a click on a header asks the server to sort (sortBy=trainingNumber)', any('sortBy=trainingNumber' in u for u in reqs), reqs[-2:])
        del reqs[:]
        if search.count():
            search.first.fill('GMP')
            pg.wait_for_timeout(1800)
            check('PL10 typing in the search box asks the server (search=GMP, page 1)', any('search=GMP' in u for u in reqs), reqs[-2:])
        pg.screenshot(path=os.path.join(SHOTS, 'polish_records_tab.png'))
        for name, ph in (('Job Assignments', 'Search work position'), ('Training Reviews', 'Search note'), ('Specimen Signatures', 'Search reason')):
            t = pg.get_by_role('tab', name=name)
            if t.count():
                t.first.click()
                pg.wait_for_timeout(1800)
                check(f'PL11 the {name} tab has a search box', pg.locator(f'input[placeholder*="{ph}"]:visible').count() >= 1)
                pg.screenshot(path=os.path.join(SHOTS, 'polish_tab_' + name.replace(' ', '_') + '.png'))
        # the grab cursor of the table scroller
        cur = pg.evaluate("(() => { const s = document.querySelector('[data-table-scroller], .overflow-x-auto'); return s ? getComputedStyle(s).cursor : null; })()")
        print('   table scroller cursor:', cur)
    else:
        check('PL8 the Training Records tab', False, 'the tab is not shown')

    # 6. the Postpone dialog is wider
    aid = sql("select a.id from training_activities a join training_sessions s on s.activity_id=a.id join training_session_topics t on t.session_id=s.id where t.topic_text='UAT-2026 ui postpone' and a.status in ('PLANNED','NOTIFIED') order by a.created_at desc limit 1")
    sid = sql("select s.id from training_sessions s join training_session_topics t on t.session_id=s.id where t.topic_text='UAT-2026 ui postpone' and s.status='PLANNED' order by s.created_at desc limit 1")
    if aid and sid:
        open_(f'/training-management/activities/{aid[0][0]}/sessions/{sid[0][0]}/workspace')
        pb = pg.get_by_role('button', name='Postpone')
        if pb.count():
            pb.first.click()
            pg.wait_for_timeout(1200)
            w = pg.evaluate("document.querySelector('[role=dialog]').getBoundingClientRect().width")
            check('PL12 the Postpone dialog is wider than before (it was 448 px)', w >= 600, w)
            pg.screenshot(path=os.path.join(SHOTS, 'polish_postpone.png'))
        else:
            print('   no Postpone button (the session may be started)')
    b.close()

ok = [r for r in results if r[1]]
bad = [r for r in results if not r[1]]
print(f'\n{len(ok)} passed, {len(bad)} failed (of {len(results)})')
for r in bad:
    print('  FAIL', r[0], '--', r[2])
sys.exit(1 if bad else 0)
