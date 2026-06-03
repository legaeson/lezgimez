const fs = require('fs');
const path = require('path');

/**
 * Валидатор базы слов words.json
 * Проверяет:
 * 1. Уникальность ID
 * 2. Заполненность обязательных полей (lz, ru)
 * 3. Наличие категории и ее соответствие списку разрешенных
 */

const wordsPath = path.join(__dirname, '../words.json');

if (!fs.existsSync(wordsPath)) {
    console.error('❌ Ошибка: файл words.json не найден!');
    process.exit(1);
}

const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));

const ids = new Set();
const VALID_CATEGORIES = [
    'фразы', 'торговля', 'семья', 'общение', 'люди', 'быт', 'еда', 
    'природа', 'работа', 'время', 'глаголы', 'качество', 'наречия', 
    'цвета', 'числа', 'места', 'местоим.', 'здоровье', 'транспорт', 
    'животные', 'обучение', 'общее', 'одежда', 'понятия', 'тело', 
    'предметы', 'эмоции', 'искусство', 'события', 'спорт', 'материалы', 
    'война', 'мера', 'ощущения', 'религия'
];

let errors = 0;
let warnings = 0;

console.log(`🔍 Начинаю проверку ${words.length} слов...\n`);

words.forEach((w, i) => {
    // 1. Проверка ID
    if (!w.id) {
        console.error(`❌ [Ошибка] Слово #${i} не имеет id`);
        errors++;
    } else {
        if (ids.has(w.id)) {
            console.error(`❌ [Ошибка] Дубль id: ${w.id}`);
            errors++;
        }
        ids.add(w.id);
    }

    if (!w.lz || !w.lz.trim()) { console.error(`❌ [Ошибка] Пустое поле 'lz' (лезгинский): ${w.id || i}`); errors++; }
    if (!w.ru || !w.ru.trim()) { console.error(`❌ [Ошибка] Пустое поле 'ru' (русский): ${w.id || i}`); errors++; }

    // 3. Проверка категорий
    if (!w.cat) {
        console.error(`❌ [Ошибка] Отсутствует категория: ${w.id}`);
        errors++;
    } else if (!VALID_CATEGORIES.includes(w.cat)) {
        console.warn(`⚠️ [Предупреждение] Неизвестная категория '${w.cat}': ${w.id}`);
        warnings++;
    }
});

console.log('-----------------------------------');
if (errors > 0) {
    console.error(`🛑 Проверка завершена: найдено ${errors} критических ошибок.`);
    process.exit(1);
} else {
    console.log(`✅ Проверка пройдена успешно!`);
    if (warnings > 0) {
        console.log(`💡 Найдено ${warnings} предупреждений (неизвестные категории).`);
    }
    process.exit(0);
}
