const test = require('node:test');
const assert = require('node:assert/strict');
const { maestros } = require('../src/config/masters');

test('TBL_MODELOS respeta código, rubro, modelo, licencia, marca y proveedor', () => {
  const configuracion = maestros.MODELOS;
  const columnas = configuracion.columnas;

  assert.deepEqual(
    columnas.map(item => [item.archivo, item.nombre]),
    [
      [0, 'CODIGO_MODELO'],
      [1, 'RUBRO_MODELO'],
      [2, 'DETALLE_MODELO'],
      [3, 'LICENCIA'],
      [4, 'MARCA_MODELO'],
      [5, 'C_PROVEEDO']
    ]
  );
  assert.equal(columnas[5].requerido, false);
  assert.equal(configuracion.versionImportacion, '2-proveedor-posicion-6');
});
