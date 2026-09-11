const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fuente = fs.readFileSync(
  path.resolve(__dirname, '../public/js/alta-productos.js'),
  'utf8'
);

test('el modelo selecciona por defecto su proveedor PBXXXX', () => {
  assert.match(fuente, /\['C_PROVEEDO', 'cProveedo', 'CODIGO_PROVEEDOR', 'codigoProveedor'\]/);
  assert.match(fuente, /seleccionarProveedorDelModelo\(modelo\.codigoProveedor\)/);
  assert.match(fuente, /seleccionarBuscadorMaestro\(\s*'Proveedor',\s*proveedor\s*\)/);
});

test('un modelo sin proveedor deja el campo de proveedor vacío', () => {
  const inicio = fuente.indexOf('function seleccionarProveedorDelModelo');
  const fin = fuente.indexOf('function limpiarModeloSeleccionado', inicio);
  const funcion = fuente.slice(inicio, fin);

  assert.match(funcion, /limpiarBuscadorMaestro\('Proveedor'\)/);
  assert.match(funcion, /if \(!codigo\) return/);
  assert.ok(
    funcion.indexOf("limpiarBuscadorMaestro('Proveedor')") <
    funcion.indexOf('if (!codigo) return')
  );
});

test('el proveedor del modelo usa el maestro y el Alta de maestros como respaldo', () => {
  const repository = fs.readFileSync(
    path.resolve(__dirname, '../src/repositories/maestros.repository.js'),
    'utf8'
  );

  assert.match(repository, /COALESCE\([\s\S]*?M\.C_PROVEEDO[\s\S]*?AM\.C_PROVEEDO[\s\S]*?AS C_PROVEEDO/);
  assert.match(repository, /OUTER APPLY \([\s\S]*?dbo\.ALTAS_MAESTROS AS A/);
  assert.match(repository, /A\.CODIGO = M\.CODIGO_MODELO/);
  assert.match(repository, /A\.ESTADO <> 'ANULADO'/);
});

test('el proveedor del modelo también cruza el código Presea con su PBXXXX', () => {
  assert.match(fuente, /\['PRESEA', 'presea', 'CODIGO_PRESEA', 'codigoPresea'\]/);
  assert.match(fuente, /\.includes\(codigo\)/);
});

function cargarFormateadorComposicion() {
  const inicio = fuente.indexOf(
    'function composicionModuloParaMostrar('
  );
  const fin = fuente.indexOf(
    'function claveOrdenModulo',
    inicio
  );

  assert.notEqual(inicio, -1);
  assert.notEqual(fin, -1);

  const contexto = {};

  vm.runInNewContext(
    `${fuente.slice(inicio, fin)}; ` +
    'globalThis.formatear = composicionModuloParaMostrar;',
    contexto
  );

  return contexto.formatear;
}

test('las curvas consecutivas muestran únicamente cantidades', () => {
  const formatear = cargarFormateadorComposicion();

  assert.equal(
    formatear('40:2 | 41:2 | 42:3 | 43:3 | 44:1 | 45:1'),
    '2 | 2 | 3 | 3 | 1 | 1'
  );
});

test('las curvas con salteos conservan talle y cantidad', () => {
  const formatear = cargarFormateadorComposicion();

  assert.equal(
    formatear('40:4 | 42:5 | 44:2 | 46:1'),
    '40:4 | 42:5 | 44:2 | 46:1'
  );
});

test('la recarga del alta conserva el modelo ya seleccionado', () => {
  assert.match(
    fuente,
    /const modeloYaSeleccionado\s*=\s*Boolean/
  );
  assert.match(
    fuente,
    /if \(modeloYaSeleccionado\)[\s\S]*?panelModelo\?\.classList\.remove[\s\S]*?return;/
  );
});

test('Enter selecciona el modelo solamente cuando existe una coincidencia', () => {
  assert.match(
    fuente,
    /addEventListener\(\s*'keydown',\s*seleccionarModeloConEnter\s*\)/
  );
  assert.match(
    fuente,
    /async function seleccionarModeloConEnter\([\s\S]*?event\.key !== 'Enter'/
  );
  assert.match(
    fuente,
    /if \(modelosFiltrados\.length === 1\)[\s\S]*?seleccionarModelo/
  );
});

test('Enter aplica la selección única a maestros, curvas y colores', () => {
  assert.match(
    fuente,
    /function seleccionarBuscadorMaestroConEnter\(/
  );
  assert.match(
    fuente,
    /if \(coincidencias\.length === 1\)[\s\S]*?seleccionarBuscadorMaestro/
  );
  assert.match(
    fuente,
    /function seleccionarModuloConEnter\([\s\S]*?modulosFiltrados\.length !== 1/
  );
  assert.match(
    fuente,
    /function seleccionarColorConEnter\([\s\S]*?coincidencias\.length !== 1/
  );
});
