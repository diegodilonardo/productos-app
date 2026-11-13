const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');

test('cada Alta ofrece actualizar su estado ERP desde tarjetas y tabla', () => {
  const fuente = fs.readFileSync(
    path.join(raiz, 'public', 'js', 'altas-index.js'),
    'utf8'
  );

  assert.match(fuente, /data-actualizar-erp-alta/);
  assert.equal(
    (fuente.match(/\$\{botonActualizarErpAlta\(id\)\}/g) || []).length,
    2
  );
  assert.match(fuente, /\/api\/altas\/\$\{encodeURIComponent\(idAlta\)\}\/actualizar-erp/);
});

test('la actualización manual limita la sincronización a la empresa del Alta', () => {
  const rutas = fs.readFileSync(
    path.join(raiz, 'src', 'routes', 'altas.routes.js'),
    'utf8'
  );
  const scheduler = fs.readFileSync(
    path.join(raiz, 'src', 'jobs', 'productosErpSync.scheduler.js'),
    'utf8'
  );

  assert.match(rutas, /router\.post\('\/:id\/actualizar-erp'/);
  assert.match(rutas, /ejecutarProductosErpProgramado\(\s*alta\.CODIGO_EMPRESA/);
  assert.match(scheduler, /`--empresa=\$\{codigoEmpresaNormalizado\}`/);
});
