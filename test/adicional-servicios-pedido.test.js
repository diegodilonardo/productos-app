const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const leer = ruta => fs.readFileSync(path.join(raiz, ruta), 'utf8');

test('la migración incorpora el servicio opcional a nivel Pedido', () => {
  const sql = leer('sql/34_adicional_servicios_pedido.sql');
  assert.match(sql, /SERVICIO_DESCRIPCION/);
  assert.match(sql, /SERVICIO_CANTIDAD/);
  assert.match(sql, /SERVICIO_PRECIO/);
});

test('el Pedido permite cargar y editar descripción, cantidad y precio del servicio', () => {
  const nuevo = leer('views/pedidos/nuevo.hbs');
  const detalle = leer('views/pedidos/detalle.hbs');
  const js = leer('public/js/pedido-detalle.js');
  assert.match(nuevo, /id="servicioDescripcion"/);
  assert.match(nuevo, /id="servicioCantidad"/);
  assert.match(nuevo, /id="servicioPrecio"/);
  assert.match(detalle, /Producto SERVICIOS/);
  assert.match(js, /\/servicio`/);
});

test('el Excel agrega SERVICIOS al final con el formato del archivo de Pedido', () => {
  const servicio = leer('src/services/pedidos.service.js');
  const bloque = servicio.match(/if \(texto\(pedido\.SERVICIO_DESCRIPCION\)\) \{[\s\S]*?filas\.push\([\s\S]*?\n  \}/)?.[0] || '';
  assert.match(bloque, /cod_alfa: 'SERVICIOS'/);
  assert.match(bloque, /descripcion: texto\(pedido\.SERVICIO_DESCRIPCION\)/);
  assert.match(bloque, /price:/);
  assert.match(bloque, /quantity:/);
  assert.match(bloque, /adicionales: 0/);
});
