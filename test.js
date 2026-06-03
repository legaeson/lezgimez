const fs = require('fs');
const assert = require('assert');

function runTests() {
  console.log("Running smoke tests...");
  
  // 1. Build checks
  assert(fs.existsSync('index.html'), "index.html is missing");
  assert(fs.existsSync('output.css'), "output.css is missing - tailwind build failed");
  assert(fs.existsSync('sw.js'), "sw.js is missing");
  assert(fs.existsSync('words.json'), "words.json is missing");
  assert(fs.existsSync('manifest.json'), "manifest.json is missing");

  // 2. Code integrity checks
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert(!indexHtml.includes('state.progress'), "Found references to dead state layer in index.html");
  assert(!indexHtml.includes('state.words'), "Found references to dead state layer in index.html");
  
  assert(!indexHtml.includes('innerHTML = `<div><div class="font-bold lezgin-text text-xl text-emerald-900">${opt.lz}</div>'), "Found innerHTML usage which may be XSS vulnerability");

  // 4. Words DB format check
  const words = JSON.parse(fs.readFileSync('words.json', 'utf8'));
  assert(Array.isArray(words), "words.json is not an array");
  assert(words.length > 0, "words.json is empty");
  
  // 5. SW cache checks
  const swJs = fs.readFileSync('sw.js', 'utf8');
  assert(!swJs.includes('audio/alphabet/а.wav'), "SW is caching non-existent audio files");
  assert(!swJs.includes('setInterval'), "SW is using unreliable setInterval");
  assert(swJs.includes("cache: 'no-store'"), "SW should fetch audio with no-store so updated recordings are not stale");
  assert(!swJs.includes('Cache-first for audio files'), "SW should not use cache-first for audio files");
  
  console.log("All smoke tests passed!");
}

try {
  runTests();
} catch(e) {
  console.error("TEST FAILED:", e.message);
  process.exit(1);
}
