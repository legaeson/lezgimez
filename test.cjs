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
  const ignored = new Set(['node_modules', '.git', 'dist']);
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

function checkSyntaxFromHtml(indexHtml) {
  const match = indexHtml.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
  assert(match, 'Inline JS block not found');
  const tmp = path.join(process.cwd(), '.tmp-inline-check.js');
  fs.writeFileSync(tmp, match[1]);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function checkSecrets(indexHtml) {
  const tokenPattern = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/;
  assert(!tokenPattern.test(indexHtml), 'Telegram bot token leaked in index.html');
  assert(!indexHtml.includes('https://api.telegram.org/bot'), 'Frontend must not call Telegram API directly');
  assert(!indexHtml.includes('TG_BOT_TOKEN'), 'Frontend must not define bot token variables');
}

function checkProjectHygiene() {
  const tokenPattern = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/;
  const files = listProjectFiles();
  const forbiddenFiles = files.filter(file => file.endsWith('.bak') || file === 'inline.js' || file.includes('__pycache__'));
  assert.strictEqual(forbiddenFiles.length, 0, `Forbidden generated/backup files: ${forbiddenFiles.join(', ')}`);

  for (const file of files) {
    if (!/\.(html|js|json|toml|yml|yaml|md|txt|css)$/.test(file)) continue;
    const text = read(file);
    assert(!tokenPattern.test(text), `Hardcoded Telegram-like token leaked in ${file}`);
  }
}

function checkRuntimeGuards(indexHtml) {
  assert(indexHtml.includes('Content-Security-Policy'), 'CSP meta tag is required');
  assert(!indexHtml.includes('DEMO_WORDS'), 'DEMO_WORDS is referenced');
  assert(indexHtml.includes('function hideLoader()'), 'hideLoader is called but not defined');
  assert(indexHtml.includes('function supportsNotifications()'), 'Notification API must be feature-detected');
  assert(!indexHtml.includes('initZoomLock'), 'Zoom lock must not exist');
  assert(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1\.0/.test(indexHtml), 'User zoom must not be blocked');
}

function checkDomIds(indexHtml) {
  const staticIds = new Set([...indexHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const requestedIds = new Set([...indexHtml.matchAll(/getElementById\('([^']+)'\)/g)].map(match => match[1]));
  const dynamicIds = new Set([
    'modal-fav-btn',
    'hint-chips',
    'flip-card',
    'modal-close-btn-grammar'
  ]);
  const optionalLegacyIds = new Set(['alphabet-count']);
  const missing = [...requestedIds].filter(id => !staticIds.has(id) && !dynamicIds.has(id) && !optionalLegacyIds.has(id));
  assert.strictEqual(missing.length, 0, `Missing static DOM ids: ${missing.join(', ')}`);
}

function checkServiceWorker() {
  const sw = read('sw.js');
  execFileSync(process.execPath, ['--check', 'sw.js'], { stdio: 'pipe' });
  assert(sw.includes("CACHE_VERSION = '2.2.8'"), 'SW cache version must match app version');
  assert(sw.includes('offlineResponse'), 'SW must have an explicit offline response helper');
  assert(sw.includes('new Response'), 'SW fallback must return Response objects');
  assert(sw.includes("cache: 'no-store'"), 'SW should fetch audio with no-store');
  assert(!sw.includes('setInterval'), 'SW must not rely on setInterval');

  const listMatch = sw.match(/const ALPHABET_AUDIO_FILES = \[([\s\S]*?)\];/);
  assert(listMatch, 'ALPHABET_AUDIO_FILES list not found');
  const audioNames = [...listMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.strictEqual(audioNames.length, 40, 'SW should know all 40 alphabet audio files');
  for (const name of audioNames) {
    assertExists(path.join('audio', 'alphabet', `${name}.mp3`));
  }
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
  ['index.html', 'output.css', 'sw.js', 'words.json', 'grammar.json', 'manifest.json', 'robots.txt', 'sitemap.xml', 'favicon.ico'].forEach(assertExists);
  assert(!fs.existsSync('__pycache__'), '__pycache__ must not be shipped');
  assert(!read('input.css').includes('rounded: 4px'), 'Invalid CSS property rounded must not be used');
}

function runTests() {
  console.log('Running LezgiMez quality tests...');
  const indexHtml = read('index.html');
  checkBuildFiles();
  checkSyntaxFromHtml(indexHtml);
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
