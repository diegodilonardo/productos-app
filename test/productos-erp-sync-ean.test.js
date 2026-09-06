const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('la sincronizacion refresca el EAN de productos ya confirmados en ERP', () => {
  const fuente = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'productosErpSync.service.js'),
    'utf8'
  );

  assert.match(
    fuente,
    /E\.ESTADO_ERP = 'GENERADO_OK_EN_ERP'[\s\S]*?ISNULL\(E\.EAN_ERP, ''\)[\s\S]*?P\.CODIGO_EAN/
  );
});
