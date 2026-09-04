const fs = require('fs');
const path = require('path');

const altasRepository = require('../repositories/altas.repository');

const EXTENSIONES = ['.jpg', '.jpeg', '.png'];
const ESTADOS_HABILITADOS = new Set([
  'BORRADOR',
  'VALIDADO',
  'EXPORTADO',
  'PARCIAL_ERP',
  'GENERADO_OK_EN_ERP',
  'SIN_NOVEDADES_ERP'
]);

function texto(valor) {
  return String(valor ?? '').trim();
}

function esVerdadero(valor) {
  return valor === true || valor === 1 || texto(valor).toUpperCase() === 'TRUE';
}

function nombreSeguro(valor, respaldo = 'imagen') {
  return texto(valor).replace(/[^A-Za-z0-9._-]/g, '_') || respaldo;
}

function carpetaImagenes() {
  const configurada = texto(process.env.IMAGENES_PRODUCTOS_PATH);
  return configurada
    ? path.resolve(configurada)
    : path.resolve(process.cwd(), 'storage', 'imagenes-productos');
}

function buscarImagen(clave) {
  const carpeta = carpetaImagenes();
  if (!fs.existsSync(carpeta)) return null;

  for (const extension of EXTENSIONES) {
    const archivo = path.join(carpeta, `${clave}${extension}`);
    if (fs.existsSync(archivo)) {
      return {
        archivo,
        nombre: path.basename(archivo),
        extension
      };
    }
  }

  const objetivo = clave.toLowerCase();
  const nombre = fs.readdirSync(carpeta).find(item => {
    const parsed = path.parse(item);
    return parsed.name.toLowerCase() === objetivo && EXTENSIONES.includes(parsed.ext.toLowerCase());
  });

  return nombre
    ? {
        archivo: path.join(carpeta, nombre),
        nombre,
        extension: path.extname(nombre).toLowerCase()
      }
    : null;
}

function csvValor(valor) {
  const dato = texto(valor).replaceAll('"', '""');
  return `"${dato}"`;
}

async function prepararDescargaImagenesAlta(idAlta) {
  const id = Number(idAlta);
  if (!Number.isInteger(id) || id <= 0) throw new Error('ID_ALTA inválido.');

  const alta = await altasRepository.obtenerAltaPorId(id);
  if (!alta) throw new Error('Alta no encontrada.');

  const estado = texto(alta.ESTADO).toUpperCase();
  if (!ESTADOS_HABILITADOS.has(estado)) {
    throw new Error('Las imágenes no están disponibles para el estado actual del Alta.');
  }

  const detalle = await altasRepository.obtenerDetalleAlta(id);
  const principales = detalle.filter(item => !esVerdadero(item.GENERADO_AUTOMATICO));
  const imagenPorPadre = new Map();
  const archivos = [];
  const archivoPorClave = new Map();

  for (const producto of principales) {
    const clave = [
      alta.CODIGO_ANO,
      alta.CODIGO_TEMPORADA,
      producto.CODIGO_MODELO,
      producto.CODIGO_COLOR
    ].map(texto).join('');
    const claveNormalizada = clave.toLowerCase();
    let imagen = archivoPorClave.get(claveNormalizada);

    if (!imagen) {
      const encontrada = buscarImagen(clave);
      if (!encontrada) continue;

      imagen = {
        ...encontrada,
        nombre: encontrada.nombre,
        clave
      };
      archivoPorClave.set(claveNormalizada, imagen);
      archivos.push(imagen);
    }

    imagenPorPadre.set(Number(producto.ID_DETALLE), imagen.nombre);
  }

  if (!archivos.length) {
    throw new Error('El Alta no tiene imágenes cargadas para descargar.');
  }

  const filas = [
    ['CODIGO_ALFA', 'ARCHIVO_IMAGEN', 'MODELO', 'COLOR', 'TIPO', 'ORIGEN']
  ];

  for (const producto of detalle) {
    const automatico = esVerdadero(producto.GENERADO_AUTOMATICO);
    const padres = automatico
      ? (Array.isArray(producto.FAMILIAS_PADRE) ? producto.FAMILIAS_PADRE : [producto.ID_DETALLE_PADRE])
      : [producto.ID_DETALLE];

    for (const idPadre of padres.filter(Boolean)) {
      const nombreImagen = imagenPorPadre.get(Number(idPadre));
      if (!nombreImagen) continue;
      filas.push([
        producto.CODIGO_ALFA,
        nombreImagen,
        producto.CODIGO_MODELO,
        producto.CODIGO_COLOR,
        producto.TIPO_PRODUCTO_DETALLE || producto.TIPO_PRODUCTO,
        automatico ? 'AUTOMATICO' : 'PRINCIPAL'
      ]);
    }
  }

  const csv = '\uFEFF' + filas.map(fila => fila.map(csvValor).join(';')).join('\r\n');
  const codigoAlta = nombreSeguro(alta.CODIGO_ALTA || `ALTA_${id}`, `ALTA_${id}`);

  return {
    archivos,
    csv,
    nombreArchivo: `IMAGENES_${codigoAlta}.zip`
  };
}

module.exports = {
  prepararDescargaImagenesAlta
};
