import json
import re
import os

words_path = r'c:\Users\super\OneDrive\Рабочий стол\meth\app\words.json'
with open(words_path, 'r', encoding='utf-8') as f:
    words = json.load(f)

anomalies = []

# Heuristic 1: Russian translations ending in 'ть' or 'ться' should be in 'глаголы'
# Conversely, if category is 'глаголы', it should end in 'ть', 'ться', 'ти', or have a verb meaning.
for w in words:
    ru = w.get('ru', '').strip()
    cat = w.get('cat', '')
    
    # 1. Non-verb in 'глаголы'
    if cat == 'глаголы':
        # Check if it doesn't end with ть/ться/ти
        if not re.search(r'(ть|ться|ти|чь|нуть)$', ru.lower()) and not ',' in ru:
            anomalies.append({
                "id": w['id'], "lz": w['lz'], "ru": ru, "cat": cat,
                "reason": "Categorized as verb (глаголы) but translation does not look like a Russian verb."
            })
            
    # 2. Verb not in 'глаголы'
    if cat != 'глаголы' and cat != 'фразы' and cat != 'общее':
        if re.search(r'\b\w+(ть|ться)\b', ru.lower()):
            anomalies.append({
                "id": w['id'], "lz": w['lz'], "ru": ru, "cat": cat,
                "reason": f"Looks like a verb (ends in ть/ться) but categorized as '{cat}' instead of 'глаголы'."
            })
            
    # 3. Mismatched body/anatomy
    if cat == 'анатомия':
        # List of words that are definitely not anatomy
        non_anatomy = ['вечность', 'сирота', 'короткий', 'безглазый', 'белобокий', 'быстрота', 'грот', 'доброта', 'добротный', 'жалобно', 'жалобщик', 'желоб', 'живность', 'занос', 'запороть', 'злобный', 'кожанка', 'кожаный', 'краткость', 'кроткий', 'кухонный', 'леность', 'личность', 'лобзание', 'лобзать']
        for na in non_anatomy:
            if na in ru.lower():
                anomalies.append({
                    "id": w['id'], "lz": w['lz'], "ru": ru, "cat": cat,
                    "reason": f"Categorized as anatomy (анатомия) but meaning is '{ru}' which is not anatomical."
                })
                
    # 4. Mismatched food (еда)
    if cat == 'еда':
        # 'рисунок' was categorized as food
        if 'рисунок' in ru.lower() or 'зарисовка' in ru.lower():
            anomalies.append({
                "id": w['id'], "lz": w['lz'], "ru": ru, "cat": cat,
                "reason": f"Categorized as food (еда) but translation is '{ru}' (prefix 'рис' prefix matching bug)."
            })

with open(r'C:\Users\super\.gemini\antigravity-ide\scratch\category_anomalies.json', 'w', encoding='utf-8') as out:
    json.dump(anomalies, out, indent=2, ensure_ascii=False)
print(f"Category anomalies check complete. Found {len(anomalies)} anomalies.")
