const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

if (!fs.existsSync(dist)) {
    console.error('Error: dist directory does not exist. Run vite build first.');
    process.exit(1);
}

const filesToCopy = [
    'words.json',
    'grammar.json',
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
    'api'
];

console.log('Copying static assets to dist...');

for (const file of filesToCopy) {
    const src = path.join(root, file);
    const dest = path.join(dist, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✓ Copied ${file}`);
    }
}

for (const file of hostingFilesToCopy) {
    const src = path.join(root, 'hosting', file);
    const dest = path.join(dist, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✓ Copied hosting/${file}`);
    }
}

for (const folder of foldersToCopy) {
    const src = path.join(root, folder);
    const dest = path.join(dist, folder);
    if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        console.log(`✓ Copied folder ${folder}/`);
    }
}

console.log('Static assets copying complete!');
