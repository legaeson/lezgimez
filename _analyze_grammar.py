import json
with open('grammar.json', encoding='utf-8') as f:
    data = json.load(f)
print('ВСЕГО ЮНИТОВ:', len(data))
print('ВСЕГО УПРАЖНЕНИЙ:', sum(len(u.get('exercises',[])) for u in data))
print()
print('=== Существующие юниты ===')
for u in data:
    ex = len(u.get('exercises',[]))
    print(f"  {u['id']:6s} | lvl={u.get('level','?'):10s} | ex={ex:2d} | {u['title'][:60]}")
