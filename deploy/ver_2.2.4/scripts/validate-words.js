const fs = require('fs');
const path = require('path');

let errors = 0;
let warnings = 0;

function fail(message) {
  errors += 1;
  console.error(`❌ ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`⚠️ ${message}`);
}

function readJson(file) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) {
    fail(`Файл не найден: ${file}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    fail(`Не удалось прочитать JSON ${file}: ${e.message}`);
    return null;
  }
}

function validateWords() {
  const words = readJson('words.json');
  if (!Array.isArray(words)) {
    fail('words.json должен быть массивом');
    return new Set();
  }

  const ids = new Set();
  const pairs = new Set();
  const categories = new Set();

  for (const [index, word] of words.entries()) {
    if (!word || typeof word !== 'object' || Array.isArray(word)) {
      fail(`words.json[${index}] должен быть объектом`);
      continue;
    }

    for (const field of ['id', 'lz', 'ru', 'cat']) {
      if (typeof word[field] !== 'string' || !word[field].trim()) {
        fail(`words.json[${index}] поле ${field} обязательно`);
      }
    }

    if (typeof word.id === 'string') {
      if (ids.has(word.id)) fail(`Дубликат id в words.json: ${word.id}`);
      ids.add(word.id);
    }

    if (typeof word.lz === 'string' && typeof word.ru === 'string') {
      const pair = `${word.lz.trim().toLowerCase()}::${word.ru.trim().toLowerCase()}`;
      if (pairs.has(pair)) warn(`Возможный дубль пары слово/перевод: ${word.id || index}`);
      pairs.add(pair);
    }

    if (typeof word.cat === 'string') categories.add(word.cat);
    if (word.ex !== undefined && typeof word.ex !== 'string') fail(`Поле ex должно быть строкой: ${word.id}`);
    if (word.ipa !== undefined && typeof word.ipa !== 'string') fail(`Поле ipa должно быть строкой: ${word.id}`);
    if (word.tags !== undefined && !Array.isArray(word.tags)) fail(`Поле tags должно быть массивом: ${word.id}`);
  }

  const emptyExamples = words.filter(word => !word.ex || !word.ex.trim()).length;
  if (emptyExamples > words.length * 0.5) {
    warn(`У ${emptyExamples}/${words.length} слов нет примеров — это контентная задача, не блокер сборки.`);
  }

  console.log(`✅ words.json: ${words.length} слов, ${categories.size} категорий`);
  return ids;
}

function validateGrammar() {
  const grammar = readJson('grammar.json');
  if (!Array.isArray(grammar)) {
    fail('grammar.json должен быть массивом');
    return;
  }

  const unitIds = new Set();
  for (const [unitIndex, unit] of grammar.entries()) {
    if (!unit || typeof unit !== 'object' || Array.isArray(unit)) {
      fail(`grammar.json[${unitIndex}] должен быть объектом`);
      continue;
    }
    for (const field of ['id', 'title', 'content']) {
      if (typeof unit[field] !== 'string' || !unit[field].trim()) {
        fail(`grammar unit ${unitIndex}: поле ${field} обязательно`);
      }
    }
    if (unitIds.has(unit.id)) fail(`Дубликат grammar unit id: ${unit.id}`);
    unitIds.add(unit.id);
    if (!Array.isArray(unit.exercises) || unit.exercises.length === 0) {
      fail(`grammar unit ${unit.id}: exercises должен быть непустым массивом`);
      continue;
    }
    for (const [exerciseIndex, exercise] of unit.exercises.entries()) {
      const label = `${unit.id}/exercise[${exerciseIndex}]`;
      if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
        fail(`${label}: должен быть объектом`);
        continue;
      }
      if (typeof exercise.question !== 'string' || !exercise.question.trim()) fail(`${label}: question обязателен`);
      if (!exercise.options || typeof exercise.options !== 'object' || Array.isArray(exercise.options)) {
        fail(`${label}: options должен быть объектом`);
        continue;
      }
      const optionKeys = Object.keys(exercise.options);
      if (optionKeys.length < 2) fail(`${label}: нужно минимум 2 варианта ответа`);
      if (!optionKeys.includes(exercise.correct)) fail(`${label}: correct должен существовать в options`);
      if (typeof exercise.explanation !== 'string' || !exercise.explanation.trim()) fail(`${label}: explanation обязателен`);
    }
    if (!unit.level) warn(`grammar unit ${unit.id}: нет level — добавить в контентном релизе`);
  }
  console.log(`✅ grammar.json: ${grammar.length} юнитов`);
}

function validateNewWords() {
  if (!fs.existsSync('words/newwords.json')) return;
  const newWords = readJson('words/newwords.json');
  if (!Array.isArray(newWords)) {
    warn('words/newwords.json найден, но это не массив');
    return;
  }
  const emptyLz = newWords.filter(word => !word || typeof word.lz !== 'string' || !word.lz.trim()).length;
  if (emptyLz) warn(`words/newwords.json содержит ${emptyLz} записей без lz; файл считается staging-контентом и не копируется в dist.`);
  console.log(`ℹ️ words/newwords.json: ${newWords.length} staging-записей`);
}

validateWords();
validateGrammar();
validateNewWords();

if (errors > 0) {
  console.error(`🛑 Валидация провалена: ${errors} ошибок, ${warnings} предупреждений.`);
  process.exit(1);
}

console.log(`✅ Валидация пройдена: ${warnings} предупреждений.`);
