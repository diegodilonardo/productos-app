const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('el Dashboard no duplica el acceso a Nueva Alta', () => {
  const vista = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'dashboard.hbs'),
    'utf8'
  );

  assert.doesNotMatch(vista, /href="\/altas\/nueva"/);
  assert.match(vista, /href="\/pedidos\/nuevo"/);
  assert.match(vista, /id="btnActualizar"/);
});
