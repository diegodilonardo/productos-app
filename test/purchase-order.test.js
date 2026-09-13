const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const purchaseOrderService = require('../src/services/purchaseOrder.service');

test('la Purchase Order conserva el formato y completa solamente datos del Pedido', async () => {
  const buffer = await purchaseOrderService.generar({
    pedido: {
      DETALLE_PROVEEDOR: 'LINK-HO',
      RAZON_SOCIAL: 'VICBOR S.R.L.',
      DETALLE_MARCA: 'ATOMIK',
      NUMERO_ORDEN: 'AT-100',
      FECHA_CREACION: '2026-09-11T12:00:00',
      MONEDA: 'USD',
    },
    detalles: [{
      TIPO_PRODUCTO: 'MODULO',
      CODIGO_MODELO: '135055',
      DETALLE_MODELO: 'EMMET BABY',
      DETALLE_COLOR: 'BLANCO',
      T22: 1, T23: 1, T24: 2, T25: 2, T26: 2, T27: 2, T28: 2,
      PARES_MODULO: 12,
      CANTIDAD_MODULOS: 20,
      CANTIDAD_PARES: 240,
      PRECIO_FOB_PAR: 5.6,
      TOTAL_FOB: 1344,
      TOTAL_PRODUCTO: 1392,
    }],
  });

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];

  assert.equal(hoja.getCell('A1').value, 'P&B GLOBAL TRADING CO., LTD');
  assert.equal(hoja.getCell('A3').value, 'PURCHASE ORDER');
  assert.equal(hoja.getCell('B5').value, 'LINK-HO');
  assert.equal(hoja.getCell('B7').value, 'VICBOR S.R.L.');
  assert.equal(hoja.getCell('P5').value, 'AT-100');
  assert.equal(hoja.getCell('P7').value, 'US DOLLAR');
  assert.equal(hoja.getCell('P8').value, null);
  assert.equal(hoja.getCell('B19').value, '135055');
  assert.equal(hoja.getCell('E19').value, '22-28');
  assert.deepEqual(
    ['F19', 'G19', 'H19', 'I19', 'J19', 'K19', 'L19'].map(celda => hoja.getCell(celda).value),
    [1, 1, 2, 2, 2, 2, 2]
  );
  assert.equal(hoja.getCell('P20').value, 20);
  assert.equal(hoja.getCell('Q20').value, 240);
  assert.equal(hoja.getCell('S19').value, 1392);
  assert.equal(hoja.getCell('S20').value, 1392);
  assert.equal(hoja.getCell('R18').font.color.argb, 'FF000000');
  assert.equal(hoja.getCell('R19').font.color.argb, 'FF000000');
});

test('la Purchase Order deja vacíos los datos que no existen en el Pedido', async () => {
  const buffer = await purchaseOrderService.generar({
    pedido: { NUMERO_ORDEN: 'AT-101' },
    detalles: [{
      TIPO_PRODUCTO: 'PAR_SUELTO',
      CODIGO_MODELO: '100001',
      DETALLE_MODELO: 'MODELO',
      DETALLE_COLOR: 'NEGRO',
      DETALLE_TALLE: '40',
      CANTIDAD_PARES: 10,
      PRECIO_FOB_PAR: 8,
      TOTAL_FOB: 80,
      TOTAL_PRODUCTO: 80,
    }],
  });

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  assert.equal(hoja.getCell('B5').value, null);
  assert.equal(hoja.getCell('B6').value, null);
  assert.equal(hoja.getCell('P8').value, null);
  assert.equal(hoja.getCell('O19').value, null);
  assert.equal(hoja.getCell('P19').value, null);
  assert.equal(hoja.getCell('T19').value, null);
});

test('la pantalla de Pedido ofrece descargar la Purchase Order sin reemplazar otras salidas', () => {
  const fs = require('fs');
  const vista = fs.readFileSync('views/pedidos/detalle.hbs', 'utf8');
  const cliente = fs.readFileSync('public/js/pedido-detalle.js', 'utf8');
  const rutas = fs.readFileSync('src/routes/pedidos.routes.js', 'utf8');
  assert.match(vista, /btnExportarPurchaseOrder/);
  assert.match(cliente, /exportacion\/purchase-order/);
  assert.match(rutas, /exportarPurchaseOrder/);
});

test('cada tarjeta BORRADOR o VALIDADA permite descargar su Purchase Order', () => {
  const fs = require('fs');
  const cliente = fs.readFileSync('public/js/pedidos-index.js', 'utf8');
  const rutas = fs.readFileSync('src/routes/pedidos.routes.js', 'utf8');
  const servicio = fs.readFileSync('src/services/pedidos.service.js', 'utf8');
  assert.match(cliente, /\['BORRADOR','VALIDADO'\]\.includes\(est\)/);
  assert.match(cliente, /data-purchase-order/);
  assert.match(cliente, /descargarPurchaseOrderTarjeta/);
  assert.match(rutas, /purchase-order', requerirAccesoPedido, async/);
  assert.match(servicio, /\['BORRADOR', 'VALIDADO'\]\.includes\(estado\)/);
});

test('las imágenes conservan proporción y quedan centradas dentro de PHOTO', () => {
  const ajusteHorizontal = purchaseOrderService._internals.ajustarImagenAlCentro(1600, 900, 64, 80, 5);
  assert.equal(Math.round(ajusteHorizontal.width), 54);
  assert.equal(Math.round(ajusteHorizontal.height), 30);
  assert.equal(Math.round(ajusteHorizontal.left), 5);
  assert.equal(Math.round(ajusteHorizontal.top), 25);

  const ajusteVertical = purchaseOrderService._internals.ajustarImagenAlCentro(600, 1200, 64, 80, 5);
  assert.equal(Math.round(ajusteVertical.width), 35);
  assert.equal(Math.round(ajusteVertical.height), 70);
  assert.equal(Math.round(ajusteVertical.left), 15);
  assert.equal(Math.round(ajusteVertical.top), 5);
});
