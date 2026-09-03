const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function leer(ruta) {
  return fs.readFileSync(path.resolve(__dirname, '..', ruta), 'utf8');
}

test('Altas oculta anuladas por defecto y permite mostrarlas con un switch', () => {
  const vista = leer('views/altas/index.hbs');
  const js = leer('public/js/altas-index.js');

  assert.match(vista, /id="mostrarAnuladasAlta"/);
  assert.doesNotMatch(vista, /id="mostrarAnuladasAlta"[^>]*checked/);
  assert.match(js, /estado === 'ANULADO'\s*&&\s*!mostrarAnuladas/);
  assert.match(js, /function cambiarVisibilidadAnuladasAlta/);
});

test('Pedidos oculta anulados por defecto y permite mostrarlos con un switch', () => {
  const vista = leer('views/pedidos/index.hbs');
  const js = leer('public/js/pedidos-index.js');

  assert.match(vista, /id="mostrarAnuladosPedido"/);
  assert.doesNotMatch(vista, /id="mostrarAnuladosPedido"[^>]*checked/);
  assert.match(js, /mostrarAnulados \|\| estado\(p\) !== 'ANULADO'/);
  assert.match(js, /function cambiarVisibilidadAnuladosPedido/);
});

test('Seguimiento oculta altas anuladas por defecto y permite mostrarlas', () => {
  const vista = leer('views/seguimiento/index.hbs');
  const js = leer('public/js/seguimiento.js');

  assert.match(vista, /id="mostrarAnuladasSeguimiento"/);
  assert.doesNotMatch(vista, /id="mostrarAnuladasSeguimiento"[^>]*checked/);
  assert.match(js, /function cambiarVisibilidadAnuladasSeguimiento/);
  assert.match(js, /estado === 'ANULADO' && !mostrarAnuladas/);
});

test('Dashboard oculta por separado las altas y pedidos anulados', () => {
  const vista = leer('views/dashboard.hbs');
  const js = leer('public/js/dashboard.js');

  assert.match(vista, /id="mostrarAnuladasAltasDashboard"/);
  assert.match(vista, /id="mostrarAnuladosPedidosDashboard"/);
  assert.doesNotMatch(vista, /id="mostrarAnuladasAltasDashboard"[^>]*checked/);
  assert.doesNotMatch(vista, /id="mostrarAnuladosPedidosDashboard"[^>]*checked/);
  assert.match(js, /function pintarAltasDashboardFiltradas/);
  assert.match(js, /function pintarPedidosDashboardFiltrados/);
});
