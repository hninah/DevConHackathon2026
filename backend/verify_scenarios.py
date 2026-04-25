import json, pathlib

data = json.loads(pathlib.Path('../frontend/public/scenarios.json').read_text(encoding='utf-8'))
seen = set()
for s in data:
    name = s['name']
    if name in seen:
        continue
    seen.add(name)
    q = s['questions'][0]
    p1 = q['parts'][0]
    print(f'--- {name} ---')
    print('Q:', p1['prompt'])
    for c in p1['choices']:
        mark = '[CORRECT]' if c['isCorrect'] else '         '
        print(f'  {mark} {c["text"][:90]}')
    print()
