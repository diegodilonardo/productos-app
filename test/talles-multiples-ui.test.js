const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vista = fs.readFileSync(
  path.resolve(__dirname, '../views/altas/productos.hbs'),
  'utf8'
);

const frontend = fs.readFileSync(
  path.resolve(__dirname, '../public/js/alta-productos.js'),
  'utf8'
);

test('PAR_SUELTO presenta buscador, contador y chips de talles', () => {
  assert.match(vista, /id="buscarTalle"/);
  assert.match(vista, /id="cantidadTalles"/);
  assert.match(vista, /id="tallesSeleccionados"/);
  assert.match(vista, /id="listaTalles"/);
  assert.match(vista, /Podés elegir varios talles/);
});

test('el frontend envía todos los talles seleccionados', () => {
  assert.match(frontend, /querySelectorAll\('\.talle-check:checked'\)/);
  assert.match(frontend, /payload\.codigosTalle/);
  assert.match(frontend, /seleccionarTalleConEnter/);
});
