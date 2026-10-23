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
  const vm = require('node:vm');
  const pedido = { CODIGO_PROVEEDOR: ' pb0025 ', SERVICIO_DESCRIPCION: 'Flete', SERVICIO_PRECIO: 12.5, SERVICIO_CANTIDAD: 2, NUMERO_ORDEN: 'PO01' };
  const contexto = { pedido, filas: [], texto: v => String(v ?? '').trim(), redondear4: v => Number(v.toFixed(4)) };
  vm.runInNewContext(bloque, contexto);
  assert.equal(contexto.filas[0].cod_alfa, 'SERVICIOSPB0025');
  assert.equal(contexto.filas[0].price, 12.5);
  assert.equal(contexto.filas[0].quantity, 2);
  pedido.CODIGO_PROVEEDOR = '';
  assert.throws(() => vm.runInNewContext(bloque, contexto), /proveedor/);
  pedido.SERVICIO_DESCRIPCION = '';
  vm.runInNewContext(bloque, contexto);
  assert.equal(contexto.filas.length, 1);
  assert.match(bloque, /descripcion: texto\(pedido\.SERVICIO_DESCRIPCION\)/);
  assert.match(bloque, /price:/);
  assert.match(bloque, /quantity:/);
  assert.match(bloque, /adicionales: 0/);
});
