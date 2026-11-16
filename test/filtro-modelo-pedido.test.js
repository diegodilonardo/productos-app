const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('el detalle del Pedido filtra por código o descripción de modelo en ambas vistas', () => {
  const vista = fs.readFileSync('views/pedidos/detalle.hbs', 'utf8');
  const cliente = fs.readFileSync('public/js/pedido-detalle.js', 'utf8');

  assert.match(vista, /id="filtroModeloPedido"[^>]*type="search"/);
  assert.match(cliente, /filtroModeloPedido'\)\?\.addEventListener\('input',pintarDetalle\)/);
  assert.match(cliente, /d\.CODIGO_MODELO\|\|''/);
  assert.match(cliente, /d\.DETALLE_MODELO\|\|''/);
  assert.match(cliente, /detalleVisible\.length} de \$\{detalle\.length}/);
  assert.match(cliente, /No hay productos para el modelo buscado/);
});
