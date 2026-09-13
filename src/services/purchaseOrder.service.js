const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'purchase-order.xlsx');
const FILA_INICIAL = 19;
const FILAS_TEMPLATE = 13;
const MAX_ASORTAMIENTO = 9;

const TALLES = [
  ['T01', '01'], ['T02', '02'], ['T03', '03'], ['T04', '04'], ['T05', '05'],
  ['T06', '06'], ['T07', '07'], ['T08', '08'], ['T10', '10'], ['T12', '12'],
  ['T14', '14'], ['T15', '15'], ['T16', '16'], ['T17', '17'], ['T18', '18'],
  ['T19', '19'], ['T20', '20'], ['T21', '21'], ['T22', '22'], ['T23', '23'],
  ['T24', '24'], ['T25', '25'], ['T26', '26'], ['T27', '27'], ['T28', '28'],
  ['T29', '29'], ['T30', '30'], ['T31', '31'], ['T32', '32'], ['T33', '33'],
  ['T34', '34'], ['T35', '35'], ['T36', '36'], ['T37', '37'], ['T38', '38'],
  ['T385', '38.5'], ['T39', '39'], ['T395', '39.5'], ['T40', '40'], ['T405', '40.5'],
  ['T41', '41'], ['T415', '41.5'], ['T42', '42'], ['T425', '42.5'], ['T43', '43'],
  ['T435', '43.5'], ['T44', '44'], ['T445', '44.5'], ['T45', '45'], ['T455', '45.5'],
  ['T46', '46'], ['T47', '47'], ['T48', '48'], ['T49', '49'], ['T50', '50'],
  ['T_XS', 'XS'], ['T_S', 'S'], ['T_M', 'M'], ['T_L', 'L'], ['T_XL', 'XL'],
  ['T_2XL', '2XL'], ['T_3XL', '3XL'],
];

function texto(valor) {
  return String(valor ?? '').trim();
}

function valorTexto(valor) {
  return texto(valor) || null;
}

function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : null;
}

function monedaDescripcion(valor) {
  const moneda = texto(valor).toUpperCase();
  if (moneda === 'USD') return 'US DOLLAR';
  return moneda;
}

function fechaExcel(valor) {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function curvaProducto(detalle) {
  const tipo = texto(detalle.TIPO_PRODUCTO).toUpperCase();
  if (tipo === 'PAR_SUELTO') {
    const talle = texto(detalle.DETALLE_TALLE || detalle.CODIGO_TALLE);
    return { talleDesdeHasta: talle, cantidades: [1] };
  }

  const activos = TALLES
    .map(([campo, talle]) => ({ talle, cantidad: numero(detalle[campo]) || 0 }))
    .filter(item => item.cantidad > 0);
  const cantidades = activos.slice(0, MAX_ASORTAMIENTO).map(item => item.cantidad);
  const talleDesdeHasta = activos.length
    ? `${activos[0].talle}-${activos[activos.length - 1].talle}`
    : texto(detalle.DETALLE_MODULO_PEDIDO || detalle.DETALLE_MODULO);

  return { talleDesdeHasta, cantidades };
}

function ajustarCantidadFilas(hoja, cantidad) {
  if (cantidad < FILAS_TEMPLATE) {
    hoja.spliceRows(FILA_INICIAL + cantidad, FILAS_TEMPLATE - cantidad);
  } else if (cantidad > FILAS_TEMPLATE) {
    hoja.duplicateRow(FILA_INICIAL + FILAS_TEMPLATE - 1, cantidad - FILAS_TEMPLATE, true);
  }
}

function limpiarImagenesDelTemplate(hoja) {
  // ExcelJS no expone una API pública para quitar imágenes existentes.
  // La colección pertenece a la hoja y se regenera al guardar el archivo.
  hoja._media = [];
}

function dimensionesImagen(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  if (buffer.subarray(1, 4).toString('ascii') === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let posicion = 2;
  while (posicion + 8 < buffer.length) {
    if (buffer[posicion] !== 0xff) { posicion += 1; continue; }
    const marcador = buffer[posicion + 1];
    const largo = buffer.readUInt16BE(posicion + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marcador)) {
      return { height: buffer.readUInt16BE(posicion + 5), width: buffer.readUInt16BE(posicion + 7) };
    }
    if (largo < 2) break;
    posicion += largo + 2;
  }
  return null;
}

function ajustarImagenAlCentro(ancho, alto, anchoCelda = 64, altoCelda = 80, margen = 5) {
  if (!(ancho > 0) || !(alto > 0)) return null;
  const escala = Math.min(
    (anchoCelda - margen * 2) / ancho,
    (altoCelda - margen * 2) / alto
  );
  const width = Math.max(1, ancho * escala);
  const height = Math.max(1, alto * escala);
  return {
    width,
    height,
    left: (anchoCelda - width) / 2,
    top: (altoCelda - height) / 2,
    anchoCelda,
    altoCelda,
  };
}

function cargarImagen(libro, hoja, fila, imagen) {
  if (!imagen?.archivo || !fs.existsSync(imagen.archivo)) return;
  const extension = path.extname(imagen.archivo).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(extension)) return;
  const buffer = fs.readFileSync(imagen.archivo);
  const dimensiones = dimensionesImagen(buffer);
  const altoCelda = Number(hoja.getRow(fila).height || 60) * 4 / 3;
  const anchoColumna = Number(hoja.getColumn(1).width || 8.43);
  const anchoCelda = Math.floor((anchoColumna + 0.71) * 7);
  const ajuste = dimensiones
    ? ajustarImagenAlCentro(dimensiones.width, dimensiones.height, anchoCelda, altoCelda)
    : ajustarImagenAlCentro(1, 1, anchoCelda, altoCelda);
  const idImagen = libro.addImage({
    buffer,
    extension: extension === '.png' ? 'png' : 'jpeg',
  });
  hoja.addImage(idImagen, {
    tl: {
      col: ajuste.left / ajuste.anchoCelda,
      row: fila - 1 + ajuste.top / ajuste.altoCelda,
    },
    ext: { width: ajuste.width, height: ajuste.height },
    editAs: 'oneCell',
  });
}

async function generar({ pedido, detalles, imagenes = [] }) {
  if (!pedido) throw new Error('Pedido no informado para generar la Purchase Order.');
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new Error('El pedido no contiene productos para generar la Purchase Order.');
  }

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(TEMPLATE_PATH);
  const hoja = libro.worksheets[0];
  limpiarImagenesDelTemplate(hoja);
  // El archivo de referencia trae fórmulas compartidas en sus renglones de
  // ejemplo. Se quitan antes de ajustar filas para evitar referencias rotas.
  for (let fila = FILA_INICIAL; fila <= 34; fila += 1) {
    for (let columna = 1; columna <= 20; columna += 1) {
      hoja.getRow(fila).getCell(columna).value = null;
    }
  }
  ajustarCantidadFilas(hoja, detalles.length);

  hoja.getCell('A1').value = 'P&B GLOBAL TRADING CO., LTD';
  hoja.getCell('R18').font = { ...hoja.getCell('R18').font, color: { argb: 'FF000000' } };
  hoja.getCell('B5').value = valorTexto(pedido.DETALLE_PROVEEDOR);
  hoja.getCell('B6').value = null;
  hoja.getCell('B7').value = valorTexto(pedido.RAZON_SOCIAL);
  hoja.getCell('B8').value = valorTexto(pedido.DETALLE_MARCA || pedido.CODIGO_MARCA);
  hoja.getCell('P5').value = valorTexto(pedido.NUMERO_ORDEN);
  hoja.getCell('P6').value = fechaExcel(pedido.FECHA_CREACION);
  hoja.getCell('P6').numFmt = 'm/d/yy';
  hoja.getCell('P7').value = valorTexto(monedaDescripcion(pedido.MONEDA));
  hoja.getCell('P8').value = null;

  let totalCajas = 0;
  let totalPares = 0;
  let totalImporte = 0;

  detalles.forEach((detalle, indice) => {
    const fila = FILA_INICIAL + indice;
    const row = hoja.getRow(fila);
    for (let columna = 1; columna <= 20; columna += 1) row.getCell(columna).value = null;

    const curva = curvaProducto(detalle);
    const esModulo = texto(detalle.TIPO_PRODUCTO).toUpperCase() === 'MODULO';
    const cajas = esModulo ? numero(detalle.CANTIDAD_MODULOS) : null;
    const paresModulo = esModulo ? numero(detalle.PARES_MODULO) : null;
    const pares = numero(detalle.CANTIDAD_PARES);
    const fob = numero(detalle.PRECIO_FOB_PAR);
    // El Pedido ya conserva el total comercial definitivo del renglón.
    // No se vuelve a calcular desde pares y FOB, porque puede incluir adicional.
    const total = numero(detalle.TOTAL_PRODUCTO);

    row.getCell(2).value = texto(detalle.CODIGO_MODELO);
    row.getCell(3).value = texto(detalle.DETALLE_MODELO);
    row.getCell(4).value = texto(detalle.DETALLE_COLOR);
    row.getCell(5).value = curva.talleDesdeHasta;
    curva.cantidades.forEach((cantidad, posicion) => {
      row.getCell(6 + posicion).value = cantidad;
    });
    row.getCell(15).value = paresModulo;
    row.getCell(16).value = cajas;
    row.getCell(17).value = pares;
    row.getCell(18).value = fob;
    row.getCell(19).value = total;
    row.getCell(20).value = null;

    row.getCell(17).numFmt = '#,##0';
    row.getCell(18).numFmt = '#,##0.00##';
    row.getCell(18).font = { ...row.getCell(18).font, color: { argb: 'FF000000' } };
    row.getCell(19).numFmt = '#,##0.00';
    cargarImagen(libro, hoja, fila, imagenes[indice]);

    if (cajas !== null) totalCajas += cajas;
    if (pares !== null) totalPares += pares;
    if (total !== null) totalImporte += total;
  });

  const filaTotal = FILA_INICIAL + detalles.length;
  hoja.getCell(`O${filaTotal}`).value = 'TOTAL AMOUNT >>>';
  hoja.getCell(`P${filaTotal}`).value = totalCajas || null;
  hoja.getCell(`Q${filaTotal}`).value = totalPares;
  hoja.getCell(`S${filaTotal}`).value = totalImporte;
  hoja.getCell(`P${filaTotal}`).numFmt = '#,##0';
  hoja.getCell(`Q${filaTotal}`).numFmt = '#,##0';
  hoja.getCell(`S${filaTotal}`).numFmt = '#,##0.00';

  const filaFirmas = filaTotal + 2;
  hoja.getCell(`C${filaFirmas}`).value = valorTexto(pedido.DETALLE_PROVEEDOR);
  hoja.getCell(`Q${filaFirmas}`).value = null;
  libro.calcProperties.fullCalcOnLoad = true;

  return Buffer.from(await libro.xlsx.writeBuffer());
}

module.exports = {
  generar,
  _internals: { curvaProducto, monedaDescripcion, dimensionesImagen, ajustarImagenAlCentro },
};
