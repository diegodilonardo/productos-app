const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const pedidosService = require('../src/services/pedidos.service');

const {
  crearPlantillaCargaPedido,
  leerPlantillaCargaPedido,
  COLUMNAS_TEMPLATE_CARGA_PEDIDO,
} = pedidosService._internals;

const productos = [
  {
    ID_PRODUCTO: 101,
    CODIGO_ALFA: 'ALFA-MOD-1',
    DETALLE_MODELO: 'MODELO UNO',
    TALLE_CURVA: '35 AL 40',
    PARES: 12,
    TIPO_PRODUCTO_DETALLE: 'MODULO',
  },
  {
    ID_PRODUCTO: 102,
    CODIGO_ALFA: 'ALFA-SUELTO-1',
    DETALLE_MODELO: 'MODELO DOS',
    TALLE_CURVA: '40',
    PARES: 1,
    TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO',
  },
];

test('el template de carga contiene referencias y únicamente cuatro campos editables', async () => {
  const buffer = await crearPlantillaCargaPedido(productos, 'PED-PRUEBA');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];

  assert.deepEqual(hoja.getRow(1).values.slice(1), COLUMNAS_TEMPLATE_CARGA_PEDIDO);
  assert.equal(hoja.getCell('A2').value, 'ALFA-MOD-1');
  assert.equal(hoja.getCell('B2').value, 'MODELO UNO');
  assert.equal(hoja.getCell('C2').value, '35 AL 40');
  assert.equal(hoja.getCell('D2').value, 12);
  assert.equal(hoja.getCell('E2').value, '');
  assert.equal(hoja.getCell('F2').value, '');
});

test('la importación prepara cantidades, FOB, adicional y observaciones por COD_ALFA', async () => {
  const buffer = await crearPlantillaCargaPedido(productos, 'PED-PRUEBA');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  hoja.getCell('E2').value = 24;
  hoja.getCell('F2').value = 10.5;
  hoja.getCell('G2').value = 1.25;
  hoja.getCell('H2').value = 'Entrega especial';
  const importado = await leerPlantillaCargaPedido(
    Buffer.from(await libro.xlsx.writeBuffer()), productos
  );

  assert.deepEqual(importado, [{
    idProducto: 101,
    codigoAlfa: 'ALFA-MOD-1',
    cantidadPares: 24,
    precioFobPar: 10.5,
    adicional: 1.25,
    observaciones: 'Entrega especial',
  }]);
});

test('la importación rechaza cantidades incompatibles con los pares del módulo', async () => {
  const buffer = await crearPlantillaCargaPedido(productos, 'PED-PRUEBA');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  hoja.getCell('E2').value = 13;
  hoja.getCell('F2').value = 10;

  await assert.rejects(
    leerPlantillaCargaPedido(Buffer.from(await libro.xlsx.writeBuffer()), productos),
    /debe ser múltiplo de 12/
  );
});
