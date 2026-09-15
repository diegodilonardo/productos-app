const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');

test('el listado calcula y muestra solamente los módulos principales', () => {
  const repositorio = fs.readFileSync(
    path.join(raiz, 'src/repositories/altas.repository.js'),
    'utf8'
  );
  const interfaz = fs.readFileSync(
    path.join(raiz, 'public/js/altas-index.js'),
    'utf8'
  );

  const consulta = repositorio.match(
    /async function listarAltas[\s\S]*?return resultado\.recordset;/
  )?.[0] ?? '';

  assert.match(consulta, /TIPO_PRODUCTO_DETALLE[\s\S]*= 'MODULO'/);
  assert.match(consulta, /ISNULL\(DM\.GENERADO_AUTOMATICO, 0\) = 0/);
  assert.match(consulta, /AS CANTIDAD_MODULOS/);
  assert.match(consulta, /AS CANTIDAD_PARES/);
  assert.match(consulta, /DP\.PARES/);
  assert.match(consulta, /ISNULL\(DP\.GENERADO_AUTOMATICO, 0\) = 0/);
  assert.match(interfaz, /alta\.CANTIDAD_MODULOS/);
  assert.match(interfaz, />Módulos<\/span>/);
});

test('el dashboard muestra pares y módulos en cada tarjeta de Alta', () => {
  const dashboard = fs.readFileSync(
    path.join(raiz, 'public/js/dashboard.js'),
    'utf8'
  );
  const seguimiento = fs.readFileSync(
    path.join(raiz, 'src/repositories/seguimiento.repository.js'),
    'utf8'
  );

  assert.match(dashboard, /alta\.CANTIDAD_PARES/);
  assert.match(dashboard, /alta\.CANTIDAD_MODULOS/);
  assert.match(dashboard, />Pares<\/span>/);
  assert.match(dashboard, />Módulos<\/span>/);
  assert.match(seguimiento, /AS CANTIDAD_PARES/);
  assert.match(seguimiento, /AS CANTIDAD_MODULOS/);
  assert.match(seguimiento, /ISNULL\(D\.GENERADO_AUTOMATICO, 0\) = 0/);
});
