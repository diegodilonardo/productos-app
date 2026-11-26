const XLSX = require('xlsx');
const altas = require('./altas.service');

const columnas = ['COD_ALFA_ORIGEN', 'COD_COLOR_DESTINO', 'COD_CURVA_DESTINO', 'COD_PROVEEDOR'];
const texto = valor => String(valor ?? '').trim().toUpperCase();

async function importar({ archivoBase64, idEmpresa, usuario, confirmar, contextoUsuario }) {
  const libro = XLSX.read(Buffer.from(archivoBase64 || '', 'base64'), { type: 'buffer' });
  const filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, raw: false, blankrows: true });
  const encabezado = filas.shift()?.map(texto) || [];
  const posiciones = columnas.map(c => encabezado.indexOf(c));
  if (posiciones.includes(-1)) throw new Error('El Excel debe incluir ' + columnas.join(', ') + '.');
  if (filas.length > 250) throw new Error('Importá hasta 250 filas por archivo.');
  const grupos = new Map();
  const rechazadas = [];
  const vistos = new Set();
  let fichas;
  const cargarFichas = () => fichas ||= require('./productosErpSync.service').cargarFichasVariantes(idEmpresa);

  for (const [i, fila] of filas.entries()) {
    if (!fila.some(texto)) continue;
    const [codigoAlfaOrigen, codigoColor, codigoModulo, codigoProveedor] = posiciones.map(p => texto(fila[p]));
    const numero = i + 2;
    try {
      if (!/^PB[A-Z0-9]{4}$/.test(codigoProveedor)) throw new Error('Ingresá un COD_PROVEEDOR válido (PBXXXX).');
      const { origen, datos } = await altas.resolverVarianteModulo(idEmpresa, {
        codigoAlfaOrigen, codigoColor, codigoModulo, codigoProveedor, usuario
      }, contextoUsuario, cargarFichas);
      const cabecera = {
        codigoMarca: origen.CODIGO_MARCA, codigoRubro: origen.CODIGO_RUBRO,
        codigoAno: origen.CODIGO_ANO, codigoTemporada: origen.CODIGO_TEMPORADA,
        tipoProducto: 'MODULO', idEmpresa, usuario
      };
      const licencia = texto(origen.LICENCIA) || 'SIN LICENCIA';
      const clave = JSON.stringify([cabecera.codigoMarca, cabecera.codigoRubro, cabecera.codigoAno, cabecera.codigoTemporada, licencia]);
      const simulado = await altas.prepararDetalleProducto(null, datos, {
        altaSimulada: { ...origen, ESTADO: 'BORRADOR', TIPO_PRODUCTO: 'MODULO' },
        contextoUsuario, codigosGenerados: new Set(), prefijoClave: 'P1'
      });
      if (simulado.detallesAGuardar.some(d => (texto(d.LICENCIA) || 'SIN LICENCIA') !== licencia)) {
        throw new Error('La licencia actual del modelo difiere de la ficha de origen.');
      }
      const modulo = simulado.detallesAGuardar.find(d => d.TIPO_PRODUCTO_DETALLE === 'MODULO');
      if (!modulo || vistos.has(modulo.CODIGO_ALFA)) throw new Error('El módulo destino está duplicado en el archivo.');
      vistos.add(modulo.CODIGO_ALFA);
      if (!grupos.has(clave)) grupos.set(clave, {
        cabecera, licencia, marca: origen.DETALLE_MARCA, rubro: origen.DETALLE_RUBRO,
        temporada: origen.DETALLE_TEMPORADA, filas: [], productos: []
      });
      const grupo = grupos.get(clave);
      grupo.filas.push({ numero, codigoAlfaOrigen, productos: simulado.detallesAGuardar.map(d => ({
        codigo: d.CODIGO_ALFA, detalle: d.DETALLE_PRODUCTO, estado: d.ESTADO_VALIDACION
      })) });
      grupo.productos.push(datos);
    } catch (e) {
      rechazadas.push({ numero, codigoAlfaOrigen, motivo: e.message });
    }
  }

  const altasPropuestas = [];
  for (const { productos, ...grupo } of grupos.values()) {
    if (confirmar) {
      let alta;
      try {
        alta = await altas.crearAlta(grupo.cabecera, contextoUsuario);
        await altas.agregarDetalle(alta.ID_ALTA, { usuario, productos }, contextoUsuario);
        grupo.idAlta = alta.ID_ALTA;
        grupo.codigoAlta = alta.CODIGO_ALTA;
      } catch (e) {
        grupo.error = e.message;
        if (alta?.ID_ALTA) {
          try { await altas.anularAlta(alta.ID_ALTA, { usuario, motivo: 'Importación de variantes incompleta.' }); }
          catch { grupo.error += ' Revisá el borrador ' + alta.CODIGO_ALTA + '.'; }
        }
      }
    }
    altasPropuestas.push(grupo);
  }
  return { grupos: altasPropuestas, rechazadas };
}

module.exports = { importar };
