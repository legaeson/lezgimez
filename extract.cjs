const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');
const scriptContent = html.slice(scriptStart + 8, scriptEnd);
fs.writeFileSync('src/main.js', scriptContent.trim());
html = html.slice(0, scriptStart) + '<script type="module" src="/src/main.js"></script>\n    ' + html.slice(scriptEnd + 9);
fs.writeFileSync('index.html', html);
console.log('Extraction complete');
