const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtmlPath = path.join(root, 'index.html');
const jsDir = path.join(root, 'js');

console.log('Синхронизация JavaScript файлов из index.html (динамический поиск границ)...');

if (!fs.existsSync(indexHtmlPath)) {
    console.error('Ошибка: index.html не найден!');
    process.exit(1);
}

const content = fs.readFileSync(indexHtmlPath, 'utf8');
const startTag = '<script>';
const endTag = '</script>';

const startIndex = content.indexOf(startTag);
const endIndex = content.lastIndexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
    console.error('Ошибка: Скрипты не найдены в index.html!');
    process.exit(1);
}

const jsContent = content.substring(startIndex + startTag.length, endIndex);
const appJsPath = path.join(jsDir, 'app.js');

if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir);
}

fs.writeFileSync(appJsPath, jsContent, 'utf8');

// Нарезка по файлам (динамический поиск границ)
const lines = jsContent.split('\n');
const files = {
    'js/utils.js': [],
    'js/state.js': [],
    'js/srs.js': [],
    'js/ui.js': [],
    'js/app.js': [],
    'js/course.js': []
};

// Функция для поиска индекса маркера
const findMarker = (pattern) => {
    const idx = lines.findIndex(line => line.includes(pattern));
    if (idx === -1) {
        console.warn(`Предупреждение: не найден маркер "${pattern}". Используем приближенное значение.`);
    }
    return idx;
};

const idxState = findMarker('// Global state');
const idxSrs1 = findMarker('const SRS_RATING = Object.freeze');
const idxUi1 = findMarker('function toggleFavorite(');
const idxApp1 = findMarker("window.addEventListener('beforeinstallprompt'");
const idxUi2 = findMarker('function normalizeLezgiSearch(');
const idxApp2 = findMarker('// Embedded dictionary (full offline support)');
const idxUi3 = findMarker('function buildCategoryOptions(');
const idxSrs2 = findMarker('const SHOW_PRACTICE_IPA = false;');
const idxUi4 = findMarker('// =============== ТЁМНАЯ ТЕМА ===============');
const idxApp3 = findMarker('function hideLoader(');
const idxCourse = findMarker('// ==================== COURSE ENGINE ====================');
const idxApp4 = findMarker('// ==================== END COURSE ENGINE ====================');

console.log('Найденные индексы (0-indexed):', {
    idxState, idxSrs1, idxUi1, idxApp1, idxUi2, idxApp2,
    idxUi3, idxSrs2, idxUi4, idxApp3, idxCourse, idxApp4
});

// Helper to check if index is valid, else fallback
const getIdx = (val, fallback) => (val !== -1 ? val : fallback);

function getTargetFile(i) {
    const lineNum = i + 1; // 1-indexed
    
    // We map lineNum against the dynamic boundaries
    // utils.js: 1 to idxState
    if (lineNum <= getIdx(idxState, 64)) return 'js/utils.js';
    // state.js: idxState + 1 to idxSrs1
    if (lineNum <= getIdx(idxSrs1, 386)) return 'js/state.js';
    // srs.js (first part): idxSrs1 + 1 to idxUi1
    if (lineNum <= getIdx(idxUi1, 445)) return 'js/srs.js';
    // ui.js (first part): idxUi1 + 1 to idxApp1
    if (lineNum <= getIdx(idxApp1, 471)) return 'js/ui.js';
    // app.js (first part): idxApp1 + 1 to idxUi2
    if (lineNum <= getIdx(idxUi2, 638)) return 'js/app.js';
    // ui.js (second part): idxUi2 + 1 to idxApp2
    if (lineNum <= getIdx(idxApp2, 706)) return 'js/ui.js';
    // app.js (second part): idxApp2 + 1 to idxUi3
    if (lineNum <= getIdx(idxUi3, 756)) return 'js/app.js';
    // ui.js (third part): idxUi3 + 1 to idxSrs2
    if (lineNum <= getIdx(idxSrs2, 2189)) return 'js/ui.js';
    // srs.js (second part): idxSrs2 + 1 to idxUi4
    if (lineNum <= getIdx(idxUi4, 2969)) return 'js/srs.js';
    // ui.js (fourth part): idxUi4 + 1 to idxApp3
    if (lineNum <= getIdx(idxApp3, 3012)) return 'js/ui.js';
    // app.js (third part): idxApp3 + 1 to idxCourse
    if (lineNum <= getIdx(idxCourse, 3298)) return 'js/app.js';
    // course.js: idxCourse + 1 to idxApp4
    if (lineNum <= getIdx(idxApp4, 4267)) return 'js/course.js';
    // app.js (fourth part): idxApp4 + 1 to end
    return 'js/app.js';
}

lines.forEach((line, i) => {
    const target = getTargetFile(i);
    files[target].push(line);
});

for (const [file, fileLines] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, file), fileLines.join('\n'), 'utf8');
}

console.log('✅ JavaScript файлы успешно синхронизированы.');
