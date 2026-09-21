const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Pedidos utiliza únicamente la empresa global del navbar', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/pedidos/index.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/pedidos-index.js'), 'utf8');
  assert.doesNotMatch(vista, /selectorEmpresaPedido/);
  assert.doesNotMatch(cliente, /selectorEmpresaPedido/);
  assert.doesNotMatch(cliente, /function cambiarEmpresaPedido/);
  assert.match(cliente, /sessionStorage\.getItem\('app\.idEmpresa'\)/);
  assert.match(cliente, /app:empresa-cambiada/);
  assert.match(cliente, /await cargarPedidos\(\)/);
});
