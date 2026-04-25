import json, pathlib

data = json.loads(pathlib.Path('data/chunks.json').read_text(encoding='utf-8'))
target_pages = list(range(40, 50)) + list(range(60, 90)) + list(range(95, 115)) + list(range(110, 130))
count = 0
for chunk in data:
    pg = chunk['page_number']
    t = chunk.get('text', '')
    if pg in target_pages and len(t) > 300 and 'istock' not in t.lower() and 'copyright' not in t.lower() and 'table of contents' not in t.lower():
        cid = chunk['chunk_id']
        print(f'--- chunk {cid} page {pg} ---')
        print(t[:700])
        print()
        count += 1
        if count >= 40:
            break
