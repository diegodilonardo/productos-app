const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Altas pagina tarjetas y tabla en grupos de doce', () => {
  const vista = fs.readFileSync('views/altas/index.hbs', 'utf8');
  const cliente = fs.readFileSync('public/js/altas-index.js', 'utf8');
  assert.match(vista, /id="paginacionAltas"/);
  assert.match(cliente, /ALTAS_POR_PAGINA = 12/);
  assert.match(cliente, /filtradas\.slice\(desdeIndice, desdeIndice \+ ALTAS_POR_PAGINA\)/);
  assert.match(cliente, /function cambiarPaginaAltas/);
  assert.match(cliente, /function cambiarFiltrosAltas/);
});

test('Pedidos pagina tarjetas y tabla en grupos de doce', () => {
  const vista = fs.readFileSync('views/pedidos/index.hbs', 'utf8');
  const cliente = fs.readFileSync('public/js/pedidos-index.js', 'utf8');
  assert.match(vista, /id="paginacionPedidos"/);
  assert.match(vista, /pedidos-list-card/);
  assert.match(cliente, /PEDIDOS_POR_PAGINA = 12/);
  assert.match(cliente, /lista\.slice\(desdeIndice, desdeIndice \+ PEDIDOS_POR_PAGINA\)/);
  assert.match(cliente, /function cambiarPaginaPedidos/);
  assert.match(cliente, /function cambiarFiltrosPedidos/);
});
