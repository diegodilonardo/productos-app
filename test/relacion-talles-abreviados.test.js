const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('RELACION mapea 2X y 3X a las cantidades XL del módulo', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../src/services/exportacion.service.js'), 'utf8');
  assert.match(fuente, /"2X": "T_2XL"/);
  assert.match(fuente, /"3X": "T_3XL"/);
});

test('relaciones reutilizadas reconocen talles 2X y 3X de otras altas', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '../src/repositories/exportacion.repository.js'), 'utf8');
  assert.match(fuente, /WHEN '2XL' THEN '2X'/);
  assert.match(fuente, /WHEN '3XL' THEN '3X'/);
});
