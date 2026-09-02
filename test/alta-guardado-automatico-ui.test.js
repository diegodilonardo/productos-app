const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vista = fs.readFileSync(
  path.resolve(__dirname, '../views/altas/productos.hbs'),
  'utf8'
);

const detalle = fs.readFileSync(
  path.resolve(__dirname, '../public/js/alta-productos.js'),
  'utf8'
);

const indice = fs.readFileSync(
  path.resolve(__dirname, '../public/js/altas-index.js'),
  'utf8'
);

test('el alta comunica el guardado automático y ofrece volver a la lista', () => {
  assert.match(vista, /id="btnVolverAltas"/);
  assert.match(vista, />\s*Volver a Altas\s*</);
  assert.match(
    vista,
    /Los productos agregados y las imágenes se guardan automáticamente\./
  );
  assert.doesNotMatch(vista, />\s*Guardar borrador\s*</);
});

test('volver conserva la verificación del estado BORRADOR', () => {
  assert.match(detalle, /async function volverAAltas\(\)/);
  assert.match(detalle, /await cargarAlta\(\)/);
  assert.match(detalle, /if \(estadoAlta\(\) !== 'BORRADOR'\)/);
  assert.match(detalle, /\/altas\?retorno=/);
  assert.match(indice, /params\.get\('retorno'\)/);
});
