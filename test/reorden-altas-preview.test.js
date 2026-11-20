const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _internals } = require('../src/services/reordenAlta.service');

test('la segunda se deduce cambiando solamente el dígito de clasificación', () => {
  assert.equal(_internals.deducirSegunda('2742AF00071102X'), '2742AF00072102X');
  assert.equal(_internals.deducirSegunda('2742AF00073102X'), null);
});

test('una segunda histórica con espacio prevalece sobre la deducción normalizada', () => {
  const primera = '26110MT53611040';
  assert.deepEqual(_internals.candidatosSegunda(primera), [
    '2611MT536 21040',
    '26110MT53621040'
  ]);
  assert.equal(
    _internals.resolverSegunda(primera, new Set(['2611MT536 21040'])),
    '2611MT536 21040'
  );
});

test('el histórico agrupa relaciones únicas por módulo', () => {
  const relaciones = _internals.relacionesDesdeTexto('MOD1|PRI1\nMOD1|PRI1\nMOD1|PRI2\n');
  assert.deepEqual(relaciones.get('MOD1'), ['PRI1', 'PRI2']);
});

test('la simulación deduplica módulos y no convierte relaciones excepcionales en segundas', () => {
  const filas = [
    { numeroFila: 1, codigoAlfa: '27110MOD01101A', proveedor: 'LINKHO' },
    { numeroFila: 2, codigoAlfa: '27110MOD01101A', proveedor: 'LINKHO' }
  ];
  const relaciones = new Map([['27110MOD01101A', ['27110MOD01101B', '27110MOD01301C']]]);
  const catalogos = {
    modelos: [{ CODIGO_MODELO: 'MOD01', DETALLE_MODELO: 'MODELO', MARCA_MODELO: 'MONTAGNE', RUBRO_MODELO: 'CALZADO', LICENCIA: '' }],
    marcas: [{ CODIGO_MARCA: '2', DETALLE_MARCA: 'MONTAGNE' }],
    rubros: [{ CODIGO_RUBRO: '1', DETALLE_RUBRO: 'CALZADO' }],
    temporadas: [{ CODIGO_TEMPORADA: '1', DETALLE_TEMPORADA: 'IN' }],
    anos: [{ CODIGO_ANO: '27', DETALLE_ANO: '2027' }],
    proveedores: [{ CODIGO: 'PB0001', NVA_RAZON_SOCIAL: 'LINK-HO (BELLA)' }],
    existentes: new Set(),
    atributosProductos: new Map()
  };
  const resultado = _internals.construirPreview(filas, relaciones, catalogos);
  assert.equal(resultado.resumen.modulosUnicos, 1);
  assert.equal(resultado.resumen.filasDuplicadas, 1);
  assert.equal(resultado.resumen.primeras, 1);
  assert.equal(resultado.resumen.segundasDeducidas, 1);
  assert.equal(resultado.resumen.relacionesExcepcionales, 1);
  assert.equal(resultado.resumen.modulosSinAtributos, 1);
});

test('Altas permite confirmar solamente los borradores válidos después de simular', () => {
  const vista = fs.readFileSync(path.join(__dirname, '..', 'views', 'altas', 'index.hbs'), 'utf8');
  const rutas = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'altas.routes.js'), 'utf8');
  assert.match(vista, /id="btnImportarReorden"/);
  assert.match(vista, /Simulación sin impacto/);
  assert.match(vista, /id="btnConfirmarReordenAlta"/);
  assert.match(rutas, /router\.post\('\/reorden\/preview'/);
  assert.match(rutas, /router\.post\('\/reorden\/confirmar'/);
  assert.match(rutas, /requerirEscrituraEmpresa/);
});

test('los borradores de reorden recuperan imágenes históricas sin bloquear faltantes', () => {
  const servicio = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'reordenAlta.service.js'), 'utf8');
  const imagenes = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'imagenesAlta.service.js'), 'utf8');
  assert.match(servicio, /recuperarImagenesHistoricasAlta/);
  assert.match(servicio, /errorImagenes/);
  assert.match(servicio, /segundasHistoricas/);
  assert.match(imagenes, /rutaFotosErp\(alta\)/);
  assert.match(imagenes, /producto\.CODIGO_MODELO\)}\$\{texto\(producto\.CODIGO_COLOR/);
  assert.match(imagenes, /copyFile\(historica\.archivo, destino\)/);
  assert.match(imagenes, /detalleFaltantes/);
  assert.match(imagenes, /solamente pueden recuperarse en Altas BORRADOR/);
  const rutas = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'altas.routes.js'), 'utf8');
  const cliente = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'altas-index.js'), 'utf8');
  assert.match(rutas, /\/:id\/recuperar-imagenes-historicas/);
  assert.match(cliente, /data-recuperar-imagenes-alta/);
});
