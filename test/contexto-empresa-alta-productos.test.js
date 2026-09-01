const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('la pantalla de productos propaga la empresa del Alta a los maestros', () => {
  const fuente = fs.readFileSync(
    path.resolve(__dirname, '../public/js/alta-productos.js'),
    'utf8'
  );

  assert.match(
    fuente,
    /altaActual\?\.ID_EMPRESA[\s\S]*headers\.set\('x-id-empresa', String\(idEmpresa\)\)/
  );
  assert.match(
    fuente,
    /async function apiJson[\s\S]*opcionesConEmpresa\(opciones\)/
  );
  assert.match(
    fuente,
    /\/api\/maestros\/modelos\?\$\{params\.toString\(\)\}`,[\s\S]*opcionesConEmpresa\(\)/
  );
});
