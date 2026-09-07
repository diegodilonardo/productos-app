const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Nueva Alta queda disponible solamente dentro de la sección Altas', () => {
  const dashboard = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'dashboard.hbs'),
    'utf8'
  );
  const navbar = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'partials', 'navbar.hbs'),
    'utf8'
  );
  const altas = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'altas', 'index.hbs'),
    'utf8'
  );

  assert.doesNotMatch(dashboard, /href="\/altas\/nueva"/);
  assert.doesNotMatch(navbar, /href="\/altas\/nueva"/);
  assert.match(altas, /href="\/altas\/nueva"/);
  assert.match(dashboard, /href="\/pedidos\/nuevo"/);
  assert.match(dashboard, /id="btnActualizar"/);
});
