import json, pathlib

data = json.loads(pathlib.Path('data/chunks.json').read_text(encoding='utf-8'))

keywords = ['hands-on activity', 'activity:', 'report #', 'incident report', 'sample report', 'case study', 'example scenario', 'for example', 'jane j. officer', 'prairie mall']
for chunk in data:
    t = chunk.get('text', '')
    tl = t.lower()
    for kw in keywords:
        if kw in tl:
            cid = chunk['chunk_id']
            pg = chunk['page_number']
            print(f'=== chunk {cid} page {pg} [{kw}] ===')
            print(t[:900])
            print()
            break
