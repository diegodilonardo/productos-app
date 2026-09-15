const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');

test('la validación de un Alta consulta conflictos y ERP de forma masiva', () => {
  const servicio = fs.readFileSync(path.join(raiz, 'src/services/altas.service.js'), 'utf8');
  const repositorio = fs.readFileSync(path.join(raiz, 'src/repositories/altas.repository.js'), 'utf8');
  const validar = servicio.match(/async function validarAlta[\s\S]*?\/\* ============================================================\n   ANULAR ALTA/)?.[0] || '';

  assert.match(validar, /obtenerValidacionesMasivasAlta\(id\)/);
  assert.doesNotMatch(validar, /await altasRepository\.buscarCodigoAlfaEnOtraAlta/);
  assert.doesNotMatch(validar, /await altasRepository\.buscarProductoERP/);
  assert.match(repositorio, /async function obtenerValidacionesMasivasAlta/);
  assert.match(repositorio, /OUTER APPLY/);
  assert.match(repositorio, /AS OTRA_ID_ALTA/);
  assert.match(repositorio, /ERP_ID_PRODUCTO/);
});
