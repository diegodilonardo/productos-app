const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const altasRepository = require('../src/repositories/altas.repository');
const borradorExcelService = require('../src/services/borradorExcel.service');

const encabezadosEsperados = [
  'IMAGEN',
  'DETALLE RUBRO',
  'DETALLE AÑO',
  'DETALLE TEMPORADA',
  'DETALLE_MODELO',
  'DETALLE_CURVA',
  'PARES',
  'DETALLE_EDAD',
  'DETALLE_CLASIFICACION',
  'DETALLE_COLOR',
  'CODIGO_ALFA',
  'CO_NEW',
  'MUESTRA',
  'COMENTARIO',
  'CORRECCIONES',
  'MATERIAL_CALZADO',
  'MATERIAL_SUELA',
  'TIPO_AJUSTE',
  'DESCRIPCION',
  'FLOW',
];

test('el Excel incluye la información adicional durante todo el circuito del Alta', async () => {
  const originales = {
    obtenerAltaPorId: altasRepository.obtenerAltaPorId,
    obtenerDetalleAlta: altasRepository.obtenerDetalleAlta,
    buscarAno: altasRepository.buscarAno,
  };

  let estado = 'BORRADOR';

  altasRepository.obtenerAltaPorId = async () => ({
    ID_ALTA: 1,
    CODIGO_ALTA: 'ALT-PRUEBA',
    ESTADO: estado,
    CODIGO_ANO: '27',
    CODIGO_TEMPORADA: 'VE',
    DETALLE_TEMPORADA: 'VE',
    DETALLE_RUBRO: 'CALZADO',
    TIPO_PRODUCTO: 'MODULO',
  });

  altasRepository.buscarAno = async () => ({ DETALLE_ANO: '2027' });
  altasRepository.obtenerDetalleAlta = async () => [{
    TIPO_PRODUCTO_DETALLE: 'MODULO',
    CODIGO_MODELO: 'M1',
    CODIGO_COLOR: '01',
    DETALLE_MODELO: 'MODELO TEST',
    DETALLE_MODULO: '35 AL 40 X 12',
    PARES: 12,
    DETALLE_EDAD: 'ADULTO',
    DETALLE_CLASIFICACION: 'MOD.UNI',
    DETALLE_COLOR: 'NEGRO',
    CODIGO_ALFA: '262147048810641',
    CO_NEW: 'CO-1',
    MUESTRA: 'MUESTRA-1',
    COMENTARIO: 'Comentario',
    CORRECCIONES: 'Corrección',
    MATERIAL_CALZADO: 'Cuero',
    MATERIAL_SUELA: 'Goma',
    TIPO_AJUSTE: 'Cordón',
    DESCRIPCION: 'Descripción extendida',
    FLOW: 'FLOW-1',
  }];

  try {
    for (const caso of [
      ['BORRADOR', 'BORRADOR_ALT-PRUEBA.xlsx', 'BORRADOR'],
      ['VALIDADO', 'ALTA_VALIDADA_ALT-PRUEBA.xlsx', 'ALTA VALIDADA'],
      ['SIN_NOVEDADES_ERP', 'ALTA_VALIDADA_ALT-PRUEBA.xlsx', 'ALTA VALIDADA'],
    ]) {
      estado = caso[0];
      const resultado = await borradorExcelService.generarBorradorExcel(
        1,
        'http://127.0.0.1:1'
      );

      assert.equal(resultado.nombreArchivo, caso[1]);

      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(resultado.buffer);
      const hoja = libro.getWorksheet(caso[2]);

      assert.ok(
        hoja,
        `No se encontró la hoja ${caso[2]}. Hojas: ${libro.worksheets.map(item => item.name).join(', ')}`
      );

      assert.match(String(hoja.getCell('A1').value), new RegExp(`^${caso[2]}`));
      assert.deepEqual(hoja.getRow(3).values.slice(1), encabezadosEsperados);
      assert.deepEqual(
        hoja.getRow(4).values.slice(12, 21),
        ['CO-1', 'MUESTRA-1', 'Comentario', 'Corrección', 'Cuero', 'Goma', 'Cordón', 'Descripción extendida', 'FLOW-1']
      );
      assert.ok(
        hoja.getCell('K4').value === '262147048810641',
        'El CODIGO_ALFA no fue exportado en la columna K.'
      );
      assert.ok(
        hoja.autoFilter === 'A3:T3' ||
        hoja.autoFilter?.to?.column === 20,
        `Rango de autofiltro inesperado: ${JSON.stringify(hoja.autoFilter)}`
      );
    }
  } finally {
    Object.assign(altasRepository, originales);
  }
});

test('el Excel de un Alta BORRADOR PAR SUELTO incorpora el producto y su imagen', async () => {
  const originales = {
    obtenerAltaPorId: altasRepository.obtenerAltaPorId,
    obtenerDetalleAlta: altasRepository.obtenerDetalleAlta,
    buscarAno: altasRepository.buscarAno,
    fetch: global.fetch,
  };

  altasRepository.obtenerAltaPorId = async () => ({
    ID_ALTA: 2,
    CODIGO_ALTA: 'ALT-BORRADOR-IMAGEN',
    ESTADO: 'BORRADOR',
    CODIGO_ANO: '27',
    CODIGO_TEMPORADA: 'VE',
    DETALLE_TEMPORADA: 'VE',
    DETALLE_RUBRO: 'CALZADO',
    TIPO_PRODUCTO: 'PAR_SUELTO',
  });
  altasRepository.buscarAno = async () => ({ DETALLE_ANO: '2027' });
  altasRepository.obtenerDetalleAlta = async () => [{
    TIPO_PRODUCTO_DETALLE: 'PAR_SUELTO',
    GENERADO_AUTOMATICO: false,
    CODIGO_MODELO: 'M1',
    CODIGO_COLOR: '01',
    DETALLE_MODELO: 'MODELO CON IMAGEN',
    DETALLE_TALLE: '36',
    PARES: 1,
  }];

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );

  global.fetch = async () => ({
    ok: true,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => png,
  });

  try {
    const resultado = await borradorExcelService.generarBorradorExcel(
      2,
      'http://productos.test'
    );
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(resultado.buffer);
    const hoja = libro.getWorksheet('BORRADOR');

    assert.equal(resultado.nombreArchivo, 'BORRADOR_ALT-BORRADOR-IMAGEN.xlsx');
    assert.equal(hoja.getImages().length, 1);
    assert.equal(hoja.getCell('F4').value, '36');
    assert.equal(resultado.cantidadProductos, 1);
    assert.equal(resultado.cantidadModulos, 0);
  } finally {
    altasRepository.obtenerAltaPorId = originales.obtenerAltaPorId;
    altasRepository.obtenerDetalleAlta = originales.obtenerDetalleAlta;
    altasRepository.buscarAno = originales.buscarAno;
    global.fetch = originales.fetch;
  }
});
