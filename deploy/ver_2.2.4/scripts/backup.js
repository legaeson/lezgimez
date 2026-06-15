const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
    console.log('=========================================');
    console.log('       СИСТЕМА РЕЗЕРВНОГО КОПИРОВАНИЯ');
    console.log('=========================================');

    // 1. Read current version from package.json
    const packageJsonPath = path.join(__dirname, '../package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.error('Ошибка: package.json не найден!');
        process.exit(1);
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version || '1.0.0';

    console.log(`Текущая версия приложения: ${currentVersion}`);
    console.log('\nВыберите тип изменений:');
    
    // Calculate potential new versions
    const parts = currentVersion.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        console.error('Ошибка: Некорректный формат версии в package.json. Ожидается X.Y.Z');
        process.exit(1);
    }
    
    const patchVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    const minorVersion = `${parts[0]}.${parts[1] + 1}.0`;
    const majorVersion = `${parts[0] + 1}.0.0`;

    console.log(`[1] Мелкие исправления / Багфиксы (Патч) -> ${patchVersion}`);
    console.log(`[2] Новая функция / Улучшение (Минор)  -> ${minorVersion}`);
    console.log(`[3] Крупное обновление / Релиз (Мажор) -> ${majorVersion}`);
    console.log(`[4] Оставить текущую версию           -> ${currentVersion}`);

    let choice = '';
    while (!['1', '2', '3', '4'].includes(choice)) {
        choice = (await question('\nВаш выбор (1-4): ')).trim();
    }

    let newVersion = currentVersion;
    if (choice === '1') newVersion = patchVersion;
    if (choice === '2') newVersion = minorVersion;
    if (choice === '3') newVersion = majorVersion;

    console.log(`\nНовая версия приложения: ${newVersion}`);

    // 2. Ask what was changed
    console.log('\nПодсказка: Для голосового ввода в Windows нажмите [Win + H]');
    const changes = (await question('Что было изменено? (краткое описание): ')).trim() || 'Описание не указано';

    // Create deploy directory if not exists
    const versionsDir = path.join(__dirname, '../deploy');
    if (!fs.existsSync(versionsDir)) {
        fs.mkdirSync(versionsDir, { recursive: true });
    }

    // 3. Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
    console.log('✓ package.json обновлен');

    // 4. Update index.html UI display version number
    const indexHtmlPath = path.join(__dirname, '../index.html');
    if (fs.existsSync(indexHtmlPath)) {
        let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        const indexHtmlRegex = /(<span class="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">)([^<]+)(<\/span>)/;
        if (indexHtmlRegex.test(indexHtml)) {
            indexHtml = indexHtml.replace(indexHtmlRegex, `$1${newVersion}$3`);
            fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
            console.log('✓ index.html (отображаемая версия на UI) обновлен');
        } else {
            console.warn('Предупреждение: Не удалось найти блок версии в index.html для обновления');
        }
    }

    // 5. Update sw.js CACHE_NAME version number
    const swPath = path.join(__dirname, '../sw.js');
    if (fs.existsSync(swPath)) {
        let swCode = fs.readFileSync(swPath, 'utf8');
        const swRegex = /(const CACHE_NAME = 'lezgin-pwa-v)(\d+)(';)/;
        if (swRegex.test(swCode)) {
            const currentCacheNum = parseInt(swCode.match(swRegex)[2], 10);
            const newCacheNum = currentCacheNum + 1;
            swCode = swCode.replace(swRegex, `$1${newCacheNum}$3`);
            fs.writeFileSync(swPath, swCode, 'utf8');
            console.log(`✓ sw.js (кэш PWA обновлен: v${currentCacheNum} -> v${newCacheNum})`);
        } else {
            console.warn('Предупреждение: Не удалось найти константу CACHE_NAME в sw.js');
        }
    }

    // 6. Append to changelog.txt
    const changelogPath = path.join(versionsDir, 'changelog.txt');
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    
    const archiveName = `deploy\\ver_${newVersion}.zip`;
    
    const logEntry = `[${dateStr}]\n` +
                     `Version: ${newVersion}\n` +
                     `Changes: ${changes}\n` +
                     `File: ${archiveName}\n` +
                     `--------------------------------------------------\n`;
                     
    fs.appendFileSync(changelogPath, logEntry, 'utf8');
    console.log('✓ changelog.txt обновлен');

    // 7. Compress project to ZIP using PowerShell
    const archiveFullPath = path.join(versionsDir, `ver_${newVersion}.zip`);
    console.log(`\nСоздание резервной копии: ${archiveName}...`);

    try {
        // Build PowerShell command to exclude deploy, versions, 1Vers, node_modules, .git, and make_backup.bat
        const psCommand = `powershell.exe -Command "$items = Get-ChildItem -Path . | Where-Object { $_.Name -ne 'deploy' -and $_.Name -ne 'versions' -and $_.Name -ne '1Vers' -and $_.Name -ne 'node_modules' -and $_.Name -ne '.git' -and $_.Name -ne 'make_backup.bat' -and $_.Name -notmatch '\\.zip$' }; Compress-Archive -Path $items.FullName -DestinationPath '${archiveFullPath}' -Force"`;
        execSync(psCommand, { stdio: 'inherit' });
        console.log('\n=========================================');
        console.log('✓ Резервная копия успешно создана!');
        console.log(`Файл: ${archiveName}`);
        console.log('=========================================');
    } catch (err) {
        console.error('Ошибка при создании архива:', err);
    }

    rl.close();
}

main().catch(err => {
    console.error('Непредвиденная ошибка:', err);
    rl.close();
});
