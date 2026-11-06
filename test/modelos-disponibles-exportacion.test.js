const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('la espera de modelos se confirma contra el maestro por empresa', () => {
  const fuente = fs.readFileSync('src/repositories/exportacion.repository.js', 'utf8');
  assert.match(fuente, /async function modelosAltaDisponiblesEnMaestro/);
  assert.match(fuente, /M\.ID_EMPRESA = X\.ID_EMPRESA/);
  assert.match(fuente, /LTRIM\(RTRIM\(M\.CODIGO_MODELO\)\) = X\.CODIGO_MODELO/);
  assert.match(fuente, /FROM dbo\.MAESTRO_MODELOS M/);
});
