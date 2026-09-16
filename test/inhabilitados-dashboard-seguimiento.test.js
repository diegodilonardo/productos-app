const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const leer = archivo => fs.readFileSync(path.join(__dirname, '..', archivo), 'utf8');

test('dashboard y seguimiento identifican los productos inhabilitados en tarjetas', () => {
  const repository = leer('src/repositories/seguimiento.repository.js');
  const dashboard = leer('public/js/dashboard.js');
  const seguimiento = leer('public/js/seguimiento.js');
  assert.match(repository, /MAX\(I\.CANTIDAD_PRODUCTOS_INHABILITADOS\)/);
  assert.match(repository, /PI\.C_ESTADIO[\s\S]*= '9'/);
  assert.match(dashboard, /badgeProductosInhabilitadosDashboard\(alta\)/);
  assert.match(dashboard, /badgeProductosInhabilitadosDashboard\(pedido\)/);
  assert.match(seguimiento, /CANTIDAD_PRODUCTOS_INHABILITADOS/);
  assert.match(seguimiento, /inhabilitado/);
});

test('productos inhabilitados no están disponibles al agregar productos a pedidos', () => {
  const repository = leer('src/repositories/pedidos.repository.js');
  const service = leer('src/services/pedidos.service.js');
  assert.ok((repository.match(/ISNULL\(P\.C_ESTADIO, ''\)\)\) <> '9'/g) || []).length >= 3);
  assert.match(service, /const producto = productos\.find\(item => Number\(item\.ID_PRODUCTO\) === idProducto\)/);
});
