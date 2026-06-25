const fs = require('fs');

let content = fs.readFileSync('js/app.js', 'utf8');

function extractChunk(startStr, endStr) {
  const startIndex = content.indexOf(startStr);
  if (startIndex === -1) throw new Error('Start not found: ' + startStr.substring(0, 50));
  
  let endIndex;
  if (endStr) {
    endIndex = content.indexOf(endStr, startIndex);
    if (endIndex === -1) throw new Error('End not found: ' + endStr);
  } else {
    endIndex = content.length;
  }
  
  const chunk = content.substring(startIndex, endIndex);
  content = content.substring(0, startIndex) + content.substring(endIndex);
  return chunk;
}

// 1. Course Engine
const courseJs = extractChunk('// ==================== COURSE ENGINE ====================', '// ==================== END COURSE ENGINE ====================') + '\n// ==================== END COURSE ENGINE ====================\n';

// 2. Practice Engine
const practiceJs = extractChunk('let practiceState = {', '// =============== ТЁМНАЯ ТЕМА ===============');

// 3. Grammar UI & Logic
const grammarJs = extractChunk('function loadGrammar() {', 'function startFlashcards() {'); // wait, startFlashcards is part of practice. Let's use let practiceState = { instead. Oh wait, practiceState is already extracted. So 'let practiceState = {' is gone. 

// Let's do it based on function names that remain.
