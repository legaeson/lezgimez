const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');

const startTag = '<script>';
const endTag = '</script>';

const startIndex = content.indexOf(startTag);
const endIndex = content.lastIndexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Script tags not found');
  process.exit(1);
}

const jsContent = content.substring(startIndex + startTag.length, endIndex);
fs.writeFileSync('js/app.js', jsContent);

const newHtml = content.substring(0, startIndex) + '<script src="js/app.js"></script>\n' + content.substring(endIndex + endTag.length);
fs.writeFileSync('index.html', newHtml);

console.log('Extraction to app.js successful.');
