const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('las tarjetas de seguimiento muestran el usuario responsable del Alta', () => {
  const repositorio = fs.readFileSync(
    path.join(__dirname, '../src/repositories/seguimiento.repository.js'),
    'utf8'
  );
  const cliente = fs.readFileSync(
    path.join(__dirname, '../public/js/seguimiento.js'),
    'utf8'
  );

  assert.match(repositorio, /AS USUARIO_SEGUIMIENTO/);
  assert.match(repositorio, /E\.USUARIO_EXPORTACION/);
  assert.match(cliente, /fila\.USUARIO_SEGUIMIENTO/);
  assert.match(cliente, /<span>Usuario<\/span>/);
});
