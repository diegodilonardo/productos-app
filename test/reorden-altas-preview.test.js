const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _internals } = require('../src/services/reordenAlta.service');

test('la segunda se deduce cambiando solamente el dígito de clasificación', () => {
  assert.equal(_internals.deducirSegunda('2742AF00071102X'), '2742AF00072102X');
  assert.equal(_internals.deducirSegunda('2742AF00073102X'), null);
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

test('Altas expone el importador de reorden únicamente como simulación', () => {
  const vista = fs.readFileSync(path.join(__dirname, '..', 'views', 'altas', 'index.hbs'), 'utf8');
  const rutas = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'altas.routes.js'), 'utf8');
  assert.match(vista, /id="btnImportarReorden"/);
  assert.match(vista, /Simulación sin impacto/);
  assert.match(rutas, /router\.post\('\/reorden\/preview'/);
  assert.doesNotMatch(rutas, /router\.post\('\/reorden\/confirmar'/);
});
