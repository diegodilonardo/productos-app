const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('las solicitudes de maestros muestran y permiten copiar cada ID sin casillas de selección', () => {
  const vista = fs.readFileSync('views/altas-maestros/index.hbs', 'utf8');
  const interfaz = fs.readFileSync('public/js/altas-maestros.js', 'utf8');

  assert.match(vista, /<th>ID<\/th>/);
  assert.doesNotMatch(vista, /id="btnCopiarIdsMaestros"/);
  assert.doesNotMatch(vista, /id="seleccionarTodosIdsMaestros"/);
  assert.match(interfaz, /ID_ALTA_MAESTRO/);
  assert.match(interfaz, /data-copiar-id-maestro/);
  assert.doesNotMatch(interfaz, /seleccionar-id-maestro/);
  assert.match(interfaz, /navigator\.clipboard/);
});
