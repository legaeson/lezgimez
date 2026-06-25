const fs = require('fs');

const lines = fs.readFileSync('js/app.js', 'utf8').split('\n');

const files = {
    'js/utils.js': [],
    'js/state.js': [],
    'js/srs.js': [],
    'js/ui.js': [],
    'js/app.js': [],
    'js/course.js': []
};

function getTargetFile(i) {
    const lineNum = i + 1;
    if (lineNum >= 1 && lineNum <= 64) return 'js/utils.js';
    if (lineNum >= 65 && lineNum <= 386) return 'js/state.js';
    if (lineNum >= 387 && lineNum <= 445) return 'js/srs.js';
    if (lineNum >= 446 && lineNum <= 471) return 'js/ui.js';
    if (lineNum >= 472 && lineNum <= 638) return 'js/app.js';
    if (lineNum >= 639 && lineNum <= 706) return 'js/ui.js';
    if (lineNum >= 707 && lineNum <= 756) return 'js/app.js';
    if (lineNum >= 757 && lineNum <= 2189) return 'js/ui.js';
    if (lineNum >= 2190 && lineNum <= 2969) return 'js/srs.js';
    if (lineNum >= 2970 && lineNum <= 3012) return 'js/ui.js';
    if (lineNum >= 3013 && lineNum <= 3298) return 'js/app.js';
    if (lineNum >= 3299 && lineNum <= 4267) return 'js/course.js';
    if (lineNum >= 4268 && lineNum <= 4300) return 'js/app.js'; // Covers the rest
    return 'js/app.js'; // fallback
}

lines.forEach((line, i) => {
    const target = getTargetFile(i);
    files[target].push(line);
});

// Write files
for (const [file, fileLines] of Object.entries(files)) {
    fs.writeFileSync(file, fileLines.join('\n'));
    console.log(`Wrote ${file} - ${fileLines.length} lines`);
}
