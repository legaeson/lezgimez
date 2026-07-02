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
    'course.json',
    'notifications.json',
    'manifest.json',
    'favicon.ico'
];

const hostingFilesToCopy = [
    'robots.txt',
    'sitemap.xml',
    '.htaccess'
];

const foldersToCopy = [
    'icons',
    'fa',
    'audio',
    'assets',
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

function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

for (const folder of foldersToCopy) {
    const srcFolder = path.join(root, folder);
    const destFolder = path.join(dist, folder);
    if (fs.existsSync(srcFolder)) {
        copyDirRecursive(srcFolder, destFolder);
    }
}

console.log('\n=========================================');
console.log('✅ Сборка успешно завершена!');
console.log('=========================================');
console.log('Папка "dist" готова к загрузке.');
console.log('Теперь вы можете загрузить содержимое папки "dist" на ваш хостинг.');
