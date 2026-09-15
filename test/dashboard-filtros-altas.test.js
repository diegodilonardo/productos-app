const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');

test('el dashboard filtra Altas por proveedor, rubro, año y temporada', () => {
  const vista = fs.readFileSync(path.join(raiz, 'views/dashboard.hbs'), 'utf8');
  const interfaz = fs.readFileSync(path.join(raiz, 'public/js/dashboard.js'), 'utf8');
  const repositorio = fs.readFileSync(path.join(raiz, 'src/repositories/seguimiento.repository.js'), 'utf8');

  for (const campo of ['filtroProveedorAltaDashboard', 'filtroRubroAltaDashboard', 'filtroAnoAltaDashboard', 'filtroTemporadaAltaDashboard']) {
    assert.match(vista, new RegExp(`id="${campo}"`));
    assert.match(interfaz, new RegExp(campo));
  }
  assert.match(vista, /id="limpiarFiltrosAltasDashboard"/);
  assert.match(interfaz, /PROVEEDORES_ALTA/);
  assert.match(repositorio, /AS PROVEEDORES_ALTA/);
  assert.match(repositorio, /DP\.DETALLE_PROVEEDOR/);
});

test('el dashboard filtra Pedidos por proveedor, rubro, año y temporada', () => {
  const vista = fs.readFileSync(path.join(raiz, 'views/dashboard.hbs'), 'utf8');
  const interfaz = fs.readFileSync(path.join(raiz, 'public/js/dashboard.js'), 'utf8');

  for (const campo of ['filtroProveedorPedidoDashboard', 'filtroRubroPedidoDashboard', 'filtroAnoPedidoDashboard', 'filtroTemporadaPedidoDashboard']) {
    assert.match(vista, new RegExp(`id="${campo}"`));
    assert.match(interfaz, new RegExp(campo));
  }
  assert.match(vista, /id="limpiarFiltrosPedidosDashboard"/);
  assert.match(interfaz, /function cargarOpcionesFiltrosPedidosDashboard/);
  assert.match(interfaz, /function pintarPedidosDashboardFiltrados/);
});
