"""Part 8f: where else the paper training shows: the person's own records (My Training) and the log of the allocated Training Numbers."""
from lib7 import *
import urllib.parse

state = load()
p8 = state['p8']
Na, docD, Nc = p8['Na'], p8['docD'], p8['Nc']
t1 = trainees[0]
person = U('uat31.s2.qa.pass')

step('H-10 the employee sees what was recorded for them')
mine = person.call('GET', '/training/me/records?limit=100')
rows = mine.get('data', mine) if isinstance(mine, dict) else mine
numbers = {r.get('trainingNumber') for r in rows}
check('H-10.1 the employee sees the records of the paper training in My Training (Records)', Na in numbers, sorted(n for n in numbers if n)[:8])
code, data, text = attempt(person, 'GET', f'/training/records?personId={trainees[1]}&limit=5')
check('H-10.2 the employee cannot read the records of another person', code in (401, 403) or not data.get('data'), (code, text[:120]))

step('H-11 the log of the Training Numbers')
for year, label in ((2026, 'the year of the number'), (2020, 'the year of the paper training')):
    c, d, t = attempt(admin, 'GET', f'/training/number-allocation-log?year={year}&search={urllib.parse.quote(Na)}&limit=20')
    found = c == 200 and any(r.get('trainingNumber') == Na for r in d.get('data', []))
    print(f'   log for {year} ({label}): found={found} code={c}', flush=True)
c, d, t = attempt(admin, 'GET', f'/training/number-allocation-log?search={urllib.parse.quote(Na)}&limit=20')
check('H-11.1 the log lists the paper Training Number when no year is asked', c == 200 and any(r.get('trainingNumber') == Na for r in d.get('data', [])), (c, t[:200]))
c2, d2, t2 = attempt(admin, 'GET', f'/training/number-allocation-log?year=2026&search={urllib.parse.quote(Na)}&limit=20')
check('H-11.2 the log of 2026 lists a number whose year is 26', c2 == 200 and any(r.get('trainingNumber') == Na for r in d2.get('data', [])), (c2, str(d2)[:200]))
row = [r for r in d.get('data', []) if r.get('trainingNumber') == Na]
print('log row', row[:1], flush=True)
finish('p8f')
