const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const out = path.join(__dirname, 'dist');

if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js', 'config.js']) {
  fs.copyFileSync(path.join(src, file), path.join(out, file));
}

console.log('Dashboard built to dist/');
