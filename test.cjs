const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

function assertExists(file) {
  assert(fs.existsSync(path.join(process.cwd(), file)), `${file} is missing`);
}

function listProjectFiles(dir = process.cwd(), prefix = '') {
  const ignored = new Set(['node_modules', '.git', 'dist', 'temp_extracted']);
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const rel = prefix ? path.join(prefix, entry.name) : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listProjectFiles(full, rel));
    else result.push(rel);
  }
  return result;
}

function checkSyntax() {
  const files = ['src/main.js', 'src/srs-engine.js', 'sw.js'];
  for (const file of files) {
    execFileSync(process.execPath, ['--check', path.join(process.cwd(), file)], { stdio: 'pipe' });
  }
}

function checkSecrets(indexHtml) {
  const tokenPattern = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/;
  assert(!tokenPattern.test(indexHtml), 'Telegram bot token leaked in index.html');
  assert(!indexHtml.includes('https://api.telegram.org/bot'), 'Frontend must not call Telegram API directly');
  assert(!indexHtml.includes('TG_BOT_TOKEN'), 'Frontend must not define bot token variables');
  
  // Check JS files as well
  const files = ['src/main.js', 'src/srs-engine.js'];
  for (const file of files) {
    const content = read(file);
    assert(!tokenPattern.test(content), `Telegram bot token leaked in ${file}`);
    assert(!content.includes('https://api.telegram.org/bot'), `Frontend must not call Telegram API directly in ${file}`);
  }
}

function checkProjectHygiene() {
  const tokenPattern = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/;
  const files = listProjectFiles();
  const forbiddenFiles = files.filter(file => file.endsWith('.bak') || file === 'inline.js' || file.includes('__pycache__'));
  assert.strictEqual(forbiddenFiles.length, 0, `Forbidden generated/backup files: ${forbiddenFiles.join(', ')}`);

  for (const file of files) {
    if (!/\.(html|js|json|toml|yml|yaml|md|txt|css|cjs)$/.test(file)) continue;
    const text = read(file);
    assert(!tokenPattern.test(text), `Hardcoded Telegram-like token leaked in ${file}`);
  }
}

function checkRuntimeGuards(indexHtml) {
  assert(indexHtml.includes('Content-Security-Policy'), 'CSP meta tag is required');
  assert(!indexHtml.includes('DEMO_WORDS'), 'DEMO_WORDS is referenced');
}

function checkDomIds(indexHtml) {
  const staticIds = new Set([...indexHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  
  // Collect getElementById calls from JS files
  const jsContent = ['src/main.js'].map(read).join('\n');
  const requestedIds = new Set([...jsContent.matchAll(/getElementById\('([^']+)'\)/g)].map(match => match[1]));
  
  const dynamicIds = new Set([
    'modal-fav-btn',
    'hint-chips',
    'flip-card',
    'modal-close-btn-grammar',
    'today-card',
    'today-due',
    'today-new',
    'today-weak',
    'today-summary',
    'today-start-btn',
    'today-mistakes-btn'
  ]);
  const optionalLegacyIds = new Set(['alphabet-count']);
  const missing = [...requestedIds].filter(id => !staticIds.has(id) && !dynamicIds.has(id) && !optionalLegacyIds.has(id));
  assert.strictEqual(missing.length, 0, `Missing static DOM ids: ${missing.join(', ')}`);
}

function checkServiceWorker() {
  assertExists('dist/sw.js');
  execFileSync(process.execPath, ['--check', 'dist/sw.js'], { stdio: 'pipe' });
}

function checkData() {
  const words = JSON.parse(read('words.json'));
  const grammar = JSON.parse(read('grammar.json'));
  const manifest = JSON.parse(read('manifest.json'));

  assert(Array.isArray(words) && words.length > 1000, 'words.json should contain a real dictionary');
  assert(Array.isArray(grammar) && grammar.length > 10, 'grammar.json should contain grammar units');
  assert(manifest.shortcuts && manifest.shortcuts.length >= 3, 'Manifest should expose useful app shortcuts');

  const wordIds = new Set();
  for (const word of words) {
    assert(word.id && word.lz && word.ru && word.cat, `Invalid word row: ${JSON.stringify(word)}`);
    assert(!wordIds.has(word.id), `Duplicate word id: ${word.id}`);
    wordIds.add(word.id);
  }

  const grammarIds = new Set();
  for (const unit of grammar) {
    assert(unit.id && unit.title && unit.content, `Invalid grammar unit: ${JSON.stringify(unit)}`);
    assert(!grammarIds.has(unit.id), `Duplicate grammar id: ${unit.id}`);
    grammarIds.add(unit.id);
    assert(Array.isArray(unit.exercises) && unit.exercises.length > 0, `Grammar unit has no exercises: ${unit.id}`);
    for (const exercise of unit.exercises) {
      assert(exercise.options && Object.prototype.hasOwnProperty.call(exercise.options, exercise.correct), `Invalid correct option in ${unit.id}/${exercise.id}`);
      assert(exercise.explanation, `Missing explanation in ${unit.id}/${exercise.id}`);
    }
  }
}

function checkBuildFiles() {
  assertExists('dist/index.html');
  assertExists('dist/words.json');
  assertExists('dist/grammar.json');
  assertExists('dist/manifest.webmanifest');
  assertExists('dist/robots.txt');
  assertExists('dist/sitemap.xml');
  assertExists('dist/favicon.ico');
  assert(!fs.existsSync('__pycache__'), '__pycache__ must not be shipped');
  assert(!read('input.css').includes('rounded: 4px'), 'Invalid CSS property rounded must not be used');
}

function runTests() {
  console.log('Running LezgiMez quality tests...');
  const indexHtml = read('index.html');
  checkBuildFiles();
  checkSyntax();
  checkSecrets(indexHtml);
  checkProjectHygiene();
  checkRuntimeGuards(indexHtml);
  checkDomIds(indexHtml);
  checkServiceWorker();
  checkData();
  console.log('All quality tests passed.');
}

try {
  runTests();
} catch (error) {
  console.error('TEST FAILED:', error.message);
  process.exit(1);
}
