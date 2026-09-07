const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { escribirDBFGenerico } = require('../src/services/dbfWriterGenerico.service');

test('el DBF genérico permite generar auxiliares vacíos cuando se solicita', () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'dbf-vacio-'));
  const archivo = path.join(carpeta, 'PRODUCTOS_RELACION.DBI');
  try {
    const resultado = escribirDBFGenerico(archivo, [], [
      { nombre: 'CODIGO', tipo: 'C', largo: 15, decimales: 0 },
    ], { permitirVacio: true });
    const buffer = fs.readFileSync(archivo);
    assert.equal(buffer.readUInt32LE(4), 0);
    assert.equal(resultado.registros, 0);
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
});

test('la exportación limpia el destino y siempre incluye RELFORMU y RELACION', () => {
  const exportacion = fs.readFileSync(
    path.join(__dirname, '../src/services/exportacion.service.js'),
    'utf8'
  );
  const ftp = fs.readFileSync(
    path.join(__dirname, '../src/services/ftp.service.js'),
    'utf8'
  );
  assert.match(exportacion, /clave:\s*'RELFORMU'[\s\S]*?permitirVacio:\s*true/);
  assert.match(exportacion, /clave:\s*'RELACION'[\s\S]*?permitirVacio:\s*true/);
  assert.ok(exportacion.indexOf('.limpiarCarpeta(') < exportacion.indexOf('.subirArchivo('));
  assert.match(ftp, /async function limpiarCarpeta/);
  assert.match(ftp, /await cliente\.clearWorkingDir\(\)/);
  assert.match(ftp, /No se puede limpiar una carpeta FTP raíz o vacía/);
});
