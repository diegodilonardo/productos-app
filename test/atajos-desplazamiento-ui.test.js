const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Altas y Pedidos disponen de atajos para ir al comienzo y al final', () => {
  const layout = fs.readFileSync(path.resolve(__dirname, '../views/layouts/main.hbs'), 'utf8');
  const frontend = fs.readFileSync(path.resolve(__dirname, '../public/js/scroll-shortcuts.js'), 'utf8');

  assert.match(layout, /id="atajoIrArriba"/);
  assert.match(layout, /id="atajoIrAbajo"/);
  assert.match(frontend, /\^\\\/\(altas\|pedidos\)/);
  assert.match(frontend, /scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
  assert.match(frontend, /document\.documentElement\.scrollHeight/);
});
