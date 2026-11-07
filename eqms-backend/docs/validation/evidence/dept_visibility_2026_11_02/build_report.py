"""Builds REPORT.md from results.json, shots.json and state.json."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
res = json.load(open(os.path.join(HERE, 'results.json'), encoding='utf-8'))
shots = json.load(open(os.path.join(HERE, 'shots.json'), encoding='utf-8'))
state = json.load(open(os.path.join(HERE, 'state.json'), encoding='utf-8'))
# the last result of each id counts (a stage that was run again replaces its first run)
last = {}
order = []
for r in res:
    if r['id'] not in last:
        order.append(r['id'])
    last[r['id']] = r
rows = [last[i] for i in order]
passed = sum(1 for r in rows if r['ok'])
first_attempt_failed = [r for r in res if not r['ok']]

TITLES = {
    'S1': 'Documents exist, no revision yet', 'S2': 'Revision 1 in Draft', 'S3': 'Pending Review', 'S4': 'Pending Approval', 'S5': 'Both documents Effective',
    'S6': 'Before any rule (and before the module permission)', 'S7': 'The Head makes two group rules', 'S8': 'The administrator grants the module permission',
    'S9': 'Deny on a status', 'S10': 'A higher Allow beats the Deny', 'S11': 'Who may manage the rules', 'S12': 'Scope of the Access Profiles (gate)', 'S13': 'Revoking',
    'S14': 'Upgrade: revision 2 (Draft)', 'S15': 'Deny on Draft for one person', 'S16': 'Revision 2 Effective', 'S17': 'Controlled Copy', 'S18': 'Uncontrolled Copy',
    'S19': 'Conveniences switched off', 'S20': 'The two older modes', 'S21': 'Knowledge Base', 'S23': 'Many SOPs: no rule', 'S24': 'Many SOPs: A sees 2, B sees 3',
    'S25': 'Deny on one document', 'S26': 'A new SOP does not widen the lists', 'S27': 'Server checks', 'S28': 'Document picker', 'S29': 'Rule of a document covers its copies',
    'S30': 'Clean-up', 'F-A': 'Flow of document A', 'F-B': 'Flow of document B',
}


def group(i):
    m = re.match(r'(F-[AB]|S\d+)', i)
    return m.group(1) if m else i


out = []
w = out.append
w('# Department rules visibility: full-flow test report (DEV, 2026-11-02/03)\n')
w(f'**Result: {passed} of {len(rows)} checks passed.** {len(first_attempt_failed)} first-attempt failures were investigated (see "Findings").\n')
w('## What was tested\n')
w('Two documents of Quality Control (a SOP and an Instruction) went through the real flow by API, signed at each step: the DCO created the document and the revision, the Author wrote it, the DCO submitted it for review, the Reviewer reviewed, the Approver approved, the DCO published it. The SOP was then **upgraded** to revision 2 and taken to Effective again; a **Controlled Copy** and an **Uncontrolled Copy** were requested. Six more SOPs (and a seventh later) were created to test **one type with many documents**.\n')
w('Record Visibility was set to **Department rules**. Everything was done through the application API as the users listed below; the database was used only to play the *administrator* (granting the module permission, scope of a profile) and to flip Document Properties settings, and the backend was restarted after those changes because it keeps each user\'s permissions in memory.\n')
w('## People\n')
w('| Role in the test | Account | Notes |\n|---|---|---|')
for r, a, n in (('DCO (creates documents, publishes)', 'dco.test1', 'holds the view-all permissions'), ('Administrator (no part in any flow)', 'user.a.test', 'holds the view-all permissions'),
                ('Author', 'author.test1', 'writes the documents'), ('Co-Author', 'coauthor.test1', ''), ('Reviewer', 'reviewer.test1', ''), ('Approver', 'approver.test1', ''),
                ('Department Head of Quality Control', 'reviewer.test2', 'named as Department Head for the run; holds the new permission'),
                ('Group 1, member A', 'coauthor.test2', 'already holds the View permission'), ('Group 1, member B', 'trainee.test1', 'receives the module permission from the administrator during the run'),
                ('Group 2, member A', 'trainee.test2', 'same'), ('Group 2, member B', 'trainer.test1', 'same')):
    w(f'| {r} | {a} | {n} |')
w('\n## Documents created (all titled "DV-TEST ...", left in DEV)\n')
w(f'- SOP **{state["A"]["number"]}** (revision 1 Effective, revision 2 Effective, one Controlled Copy for G2B, one Uncontrolled Copy for G2A)')
w(f'- Instruction **{state["B"]["number"]}** (revision 1 Effective)')
w('- SOP SOP.10412 (the probe document, Effective, one Controlled Copy)')
w('- SOPs ' + ', '.join(x['number'] for x in state['sops']) + ', ' + state['sop7']['number'] + ' (Draft)\n')
w('## Results by scenario\n')
w('Every row of a matrix checks, for one user, that the **list** and the **detail** of revisions, documents, Controlled Copies and Uncontrolled Copies agree with each other and with the expected set.\n')
cur = None
for r in rows:
    g = group(r['id'])
    if g != cur:
        cur = g
        w(f'\n### {g}: {TITLES.get(g, "")}\n')
        w('| Check | Result | Detail |\n|---|---|---|')
    d = r['detail'].replace('|', '/')[:230]
    w(f'| {r["id"]} {r["name"][:150].replace("|", "/")} | {"PASS" if r["ok"] else "**FAIL**"} | {d if not r["ok"] else ""} |')
w('\n## Pictures\n')
for s in sorted(shots, key=lambda x: (int(re.match(r"S(\d+)", x["id"]).group(1)), x["file"])):
    if os.path.exists(os.path.join(HERE, 'shots', s['file'])):
        w(f'**{s["id"]}** {s["caption"]} (as {s["user"]})\n\n![{s["id"]}](shots/{s["file"]})\n')
w('## Findings during the run, and what was done\n')
w('1. **Access Denied on the Head screen (found by the pictures, fixed).** The menu showed "Department Record Visibility" to the Head, but the page answered "Access Denied": the parent route guard of `/security` did not list the new permission. The API tests could not see this. Fixed in `SecurityRoutes.tsx`, rebuilt, the pictures were retaken.')
w('2. **Scope of several profiles is a union (documented, kept).** S12 failed at first attempt: limiting the department scope of one profile did nothing for people who also hold a profile without a scope (a scope of one profile is lifted by another profile with no scope). This is the behaviour of the existing authorization, not of the new feature. The test was corrected (S12r limits every profile of the three people) and passes. If a stricter rule is wanted (intersection), it is a separate decision.')
w('3. **"Specific documents" was missing (fixed).** The owner asked what happens when ten SOPs share one type. A rule target for named documents (up to 200 per rule, only documents of the Department, searched on the server, covers revisions and copies) was added and tested in S23-S29.')
w('4. **The backend keeps user permissions in memory.** A permission set or profile changed straight in the database is not seen until the backend restarts; changes made through the application evict the cache. Only the test harness is affected.')
w('5. **Test harness bugs fixed on the way** (a check helper argument, an interrupted first run that left rules behind, which were deleted through the Head API). They are not product defects.')
w('\n## Not covered\n')
w('- The administrator was played with `user.a.test` and direct database changes; the real administrator screens (assign Access Profile, Document Properties) were not driven for these steps, except that the Document Properties screen was photographed.\n- Rules have no expiry date and Access Review does not list the visibility granted by the Heads yet (design proposal pending the owner\'s decision).\n- Training Management does not exist yet; the design keeps room for it (training assignment as a source of read access).\n- Documents that are Obsolete or Cancelled, Controlled Copy batches, legacy import and the search page were not exercised.\n- Performance with thousands of documents was not measured.\n')
w('## DEV state afterwards\n')
w('Settings put back by `dv_restore.py`: Record Visibility mode, Department Head of Quality Control, the permission link, the temporary profile "DV Document Viewer" and the rules of the run. The documents, revisions and copies of the run stay in DEV.\n')
open(os.path.join(HERE, 'REPORT.md'), 'w', encoding='utf-8').write('\n'.join(out))
print('report', passed, '/', len(rows), 'first-attempt failures', len(first_attempt_failed))
