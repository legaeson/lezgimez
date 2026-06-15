const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Создание сборки для деплоя (папка dist)...');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

if (fs.existsSync(dist)) {
    fs.rmSync(dist, { recursive: true, force: true });
}
fs.mkdirSync(dist);

const filesToCopy = [
    'index.html',
    'output.css',
    'sw.js',
    'words.json',
    'grammar.json',
    'manifest.json',
    'favicon.ico'
];

const hostingFilesToCopy = [
    'robots.txt',
    'sitemap.xml'
];

const foldersToCopy = [
    'icons',
    'fa',
    'audio',
    'api'
];

console.log('Используем существующий output.css...');

for (const file of filesToCopy) {
    if (fs.existsSync(path.join(root, file))) {
        fs.copyFileSync(path.join(root, file), path.join(dist, file));
    }
}

for (const file of hostingFilesToCopy) {
    if (fs.existsSync(path.join(root, 'hosting', file))) {
        fs.copyFileSync(path.join(root, 'hosting', file), path.join(dist, file));
    }
}

for (const folder of foldersToCopy) {
    if (fs.existsSync(path.join(root, folder))) {
        fs.cpSync(path.join(root, folder), path.join(dist, folder), { recursive: true });
    }
}

console.log('\n=========================================');
console.log('✅ Сборка успешно завершена!');
console.log('=========================================');
console.log('Папка "dist" готова к загрузке.');
console.log('Теперь вы можете загрузить содержимое папки "dist" на ваш хостинг Beget (в директорию public_html).');
