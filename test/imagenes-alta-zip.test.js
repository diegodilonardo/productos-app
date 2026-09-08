const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const altasRepository = require('../src/repositories/altas.repository');
const imagenesAltaService = require('../src/services/imagenesAlta.service');

test('prepara imágenes únicas y referencias de toda la familia', async () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'imagenes-alta-'));
  const rutaAnterior = process.env.IMAGENES_PRODUCTOS_PATH;
  const obtenerAltaOriginal = altasRepository.obtenerAltaPorId;
  const obtenerDetalleOriginal = altasRepository.obtenerDetalleAlta;

  try {
    process.env.IMAGENES_PRODUCTOS_PATH = carpeta;
    fs.writeFileSync(path.join(carpeta, '27VE12345608.jpg'), Buffer.from([0xff, 0xd8, 0xff]));

    altasRepository.obtenerAltaPorId = async () => ({
      ID_ALTA: 10,
      CODIGO_ALTA: 'ALT-PRUEBA',
      CODIGO_ANO: '27',
      CODIGO_TEMPORADA: 'VE',
      ESTADO: 'VALIDADO'
    });
    altasRepository.obtenerDetalleAlta = async () => ([
      {
        ID_DETALLE: 1,
        CODIGO_ALFA: 'ALFA-PRINCIPAL',
        CODIGO_MODELO: '123456',
        CODIGO_COLOR: '08',
        TIPO_PRODUCTO_DETALLE: 'MODULO',
        GENERADO_AUTOMATICO: false,
        FAMILIAS_PADRE: []
      },
      {
        ID_DETALLE: 2,
        CODIGO_ALFA: 'ALFA-OTRA-CURVA',
        CODIGO_MODELO: '123456',
        CODIGO_COLOR: '08',
        TIPO_PRODUCTO_DETALLE: 'MODULO',
        GENERADO_AUTOMATICO: false,
        FAMILIAS_PADRE: []
      },
      {
        ID_DETALLE: 3,
        CODIGO_ALFA: 'ALFA-PRIMERA',
        CODIGO_MODELO: '123456',
        CODIGO_COLOR: '08',
        TIPO_PRODUCTO_DETALLE: 'PRIMERA',
        GENERADO_AUTOMATICO: true,
        FAMILIAS_PADRE: [1]
      }
    ]);

    const resultado = await imagenesAltaService.prepararDescargaImagenesAlta(10);

    assert.equal(resultado.nombreArchivo, 'IMAGENES_ALT-PRUEBA.zip');
    assert.equal(resultado.archivos.length, 1);
    assert.equal(resultado.archivos[0].nombre, '27VE12345608.jpg');
    assert.match(resultado.csv, /ALFA-PRINCIPAL/);
    assert.match(resultado.csv, /ALFA-OTRA-CURVA/);
    assert.match(resultado.csv, /ALFA-PRIMERA/);
    assert.match(resultado.csv, /AUTOMATICO/);
  } finally {
    altasRepository.obtenerAltaPorId = obtenerAltaOriginal;
    altasRepository.obtenerDetalleAlta = obtenerDetalleOriginal;
    if (rutaAnterior === undefined) delete process.env.IMAGENES_PRODUCTOS_PATH;
    else process.env.IMAGENES_PRODUCTOS_PATH = rutaAnterior;
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
});

test('informa cuando el Alta no tiene imágenes cargadas', async () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'imagenes-alta-vacia-'));
  const rutaAnterior = process.env.IMAGENES_PRODUCTOS_PATH;
  const obtenerAltaOriginal = altasRepository.obtenerAltaPorId;
  const obtenerDetalleOriginal = altasRepository.obtenerDetalleAlta;

  try {
    process.env.IMAGENES_PRODUCTOS_PATH = carpeta;
    altasRepository.obtenerAltaPorId = async () => ({
      ID_ALTA: 11,
      CODIGO_ALTA: 'ALT-SIN-FOTO',
      CODIGO_ANO: '27',
      CODIGO_TEMPORADA: 'VE',
      ESTADO: 'BORRADOR'
    });
    altasRepository.obtenerDetalleAlta = async () => ([{
      ID_DETALLE: 1,
      CODIGO_ALFA: 'SIN-FOTO',
      CODIGO_MODELO: '000001',
      CODIGO_COLOR: '01',
      GENERADO_AUTOMATICO: false
    }]);

    await assert.rejects(
      imagenesAltaService.prepararDescargaImagenesAlta(11),
      /no tiene imágenes cargadas/i
    );
  } finally {
    altasRepository.obtenerAltaPorId = obtenerAltaOriginal;
    altasRepository.obtenerDetalleAlta = obtenerDetalleOriginal;
    if (rutaAnterior === undefined) delete process.env.IMAGENES_PRODUCTOS_PATH;
    else process.env.IMAGENES_PRODUCTOS_PATH = rutaAnterior;
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
});

test('detecta cada familia sin foto antes de validar el Alta', async () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'imagenes-validacion-alta-'));
  const rutaAnterior = process.env.IMAGENES_PRODUCTOS_PATH;

  try {
    process.env.IMAGENES_PRODUCTOS_PATH = carpeta;
    fs.writeFileSync(path.join(carpeta, '27VE10000101.jpg'), Buffer.from([0xff, 0xd8, 0xff]));

    const listarOriginal = require('../src/repositories/imagenesAlta.repository').listarImagenesAlta;
    const guardarOriginal = require('../src/repositories/imagenesAlta.repository').guardarImagenFamilia;
    require('../src/repositories/imagenesAlta.repository').listarImagenesAlta = async () => [];
    require('../src/repositories/imagenesAlta.repository').guardarImagenFamilia = async datos => datos;
    const faltantes = await imagenesAltaService.listarFamiliasSinImagen(
      {
        ID_EMPRESA: 1,
        CODIGO_ANO: '27',
        CODIGO_TEMPORADA: 'VE',
      },
      [
        { CODIGO_MODELO: '100001', CODIGO_COLOR: '01', GENERADO_AUTOMATICO: false },
        { CODIGO_MODELO: '100001', CODIGO_COLOR: '01', GENERADO_AUTOMATICO: true },
        {
          CODIGO_MODELO: '100002', CODIGO_COLOR: '02',
          DETALLE_MODELO: 'MODELO DOS', DETALLE_COLOR: 'ROJO',
          GENERADO_AUTOMATICO: false,
        },
        { CODIGO_MODELO: '100002', CODIGO_COLOR: '02', GENERADO_AUTOMATICO: false },
      ]
    );

    assert.deepEqual(faltantes, [{
      codigoModelo: '100002',
      detalleModelo: 'MODELO DOS',
      codigoColor: '02',
      detalleColor: 'ROJO',
    }]);
    require('../src/repositories/imagenesAlta.repository').listarImagenesAlta = listarOriginal;
    require('../src/repositories/imagenesAlta.repository').guardarImagenFamilia = guardarOriginal;
  } finally {
    if (rutaAnterior === undefined) delete process.env.IMAGENES_PRODUCTOS_PATH;
    else process.env.IMAGENES_PRODUCTOS_PATH = rutaAnterior;
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
});

test('la migración registra una imagen única por familia del Alta', () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../sql/19_registrar_imagenes_altas.sql'),
    'utf8'
  );
  assert.match(sql, /ALTAS_PRODUCTOS_IMAGENES/);
  assert.match(sql, /UNIQUE \(ID_EMPRESA, ID_ALTA, CODIGO_MODELO, CODIGO_COLOR\)/);
  assert.match(sql, /NOMBRE_ARCHIVO VARCHAR\(260\) NOT NULL/);
  assert.match(sql, /NOMBRE_ORIGINAL VARCHAR\(260\) NULL/);
});

test('la validación del Alta bloquea familias sin imágenes', () => {
  const fuente = fs.readFileSync(
    path.resolve(__dirname, '../src/services/altas.service.js'),
    'utf8'
  );

  assert.match(fuente, /imagenesAltaService\.listarFamiliasSinImagen/);
  assert.match(fuente, /No se puede validar el Alta\. Faltan fotos/);
});
