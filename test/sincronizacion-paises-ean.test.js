const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { maestros } = require('../src/config/masters');

test('la sincronización respeta empresa en tercera columna y PAIS_EAN en cuarta', () => {
  const paises = maestros.PAISES;
  const columna = paises.columnas.find(item => item.nombre === 'PAIS_EAN');
  assert.ok(columna);
  assert.equal(paises.archivoEmpresa, 2);
  assert.equal(paises.versionImportacion, 'PAIS_EAN_V1');
  assert.deepEqual(paises.ordenStaging, [
    'ID_IMPORTACION', 'CODIGO_PAIS', 'DETALLE_PAIS', 'ID_EMPRESA', 'PAIS_EAN'
  ]);
  assert.equal(columna.archivo, 3);
  assert.equal(columna.tipo, 'VARCHAR');
  assert.equal(columna.longitud, 3);
  assert.equal(columna.requerido, true);
  assert.equal(columna.nullableStaging, true);
});

test('el importador permite configurar la posición de CODIGO_EMPRESA', () => {
  const fuente = fs.readFileSync(
    path.join(__dirname, '../src/services/importadorGenerico.service.js'),
    'utf8'
  );
  assert.match(fuente, /Number\.isInteger\(maestro\.archivoEmpresa\)/);
  assert.match(fuente, /filas\[i\]\[indiceEmpresa\]/);
  assert.match(fuente, /Array\.isArray\(maestro\.ordenStaging\)/);
  assert.match(fuente, /ordenStaging\.map\(nombre => valoresPorNombre\[nombre\]\)/);
  assert.match(fuente, /configColumna\.nullableStaging/);
  assert.match(fuente, /maestro\.versionImportacion/);
  assert.match(fuente, /hashArchivo.*versionImportacion/s);
});

test('la migración agrega PAIS_EAN al maestro y al staging', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../sql/15_agregar_pais_ean_maestros.sql'),
    'utf8'
  );
  assert.match(sql, /MAESTRO_PAISES[\s\S]*PAIS_EAN VARCHAR\(3\)/);
  assert.match(sql, /STG_MAESTRO_PAISES[\s\S]*PAIS_EAN VARCHAR\(3\)/);
  assert.match(sql, /BEGIN TRANSACTION/);
  assert.match(sql, /ROLLBACK TRANSACTION/);
});
