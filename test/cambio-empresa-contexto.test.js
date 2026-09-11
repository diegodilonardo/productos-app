const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('cambiar empresa abandona detalles pertenecientes al contexto anterior', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/js/navbar-session.js'), 'utf8');
  assert.match(js, /obtenerDestinoSeguroCambioEmpresa/);
  assert.match(js, /\^\\\/altas\\\//);
  assert.match(js, /return '\/altas'/);
  assert.match(js, /return '\/pedidos'/);
  assert.match(js, /return '\/seguimiento'/);
  assert.match(js, /window\.location\.assign\(destinoSeguro\)/);
});

test('Maestros acepta la empresa visible y limpia el aviso de selección tardía', () => {
  const maestros = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  assert.match(maestros, /navbarEmpresaSelector/);
  assert.match(maestros, /maximoMs = 15000/);
  assert.match(maestros, /function limpiarAvisoEmpresa/);
  assert.match(maestros, /limpiarAvisoEmpresa\(\)/);
});
