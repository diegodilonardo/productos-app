const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('las tarjetas y la tabla de Altas permiten consultar el detalle de productos', () => {
  const vista = fs.readFileSync(path.join(__dirname, '../views/altas/index.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '../public/js/altas-index.js'), 'utf8');

  assert.match(vista, /id="modalProductosAlta"/);
  assert.match(vista, />Modelo</);
  assert.match(vista, />Color</);
  assert.match(vista, />Curva \/ Talle</);
  assert.match(vista, />Pares \/ Unidades</);
  assert.match(cliente, /data-ver-productos-alta/);
  assert.match(cliente, /function mostrarProductosAlta/);
  assert.match(cliente, /GENERADO_AUTOMATICO/);
  assert.match(cliente, /combinaci[oó]n/);
});
