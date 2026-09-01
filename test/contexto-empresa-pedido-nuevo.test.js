const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Nuevo Pedido propaga la empresa también al POST de creación', () => {
  const fuente = fs.readFileSync(
    path.resolve(__dirname, '../public/js/pedido-nuevo.js'),
    'utf8'
  );

  const api = fuente.match(
    /async function api\([\s\S]*?return data;\s*}/
  )?.[0] ?? '';
  const crear = fuente.match(
    /async function crearPedido[\s\S]*?function formatearTipo/
  )?.[0] ?? '';

  assert.match(api, /'x-id-empresa': String\(idEmpresaPedido\)/);
  assert.match(crear, /api\(\s*'\/api\/pedidos'/);
  assert.match(fuente, /sessionStorage\.getItem\('app\.idEmpresa'\)/);
});
