const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');

test('el selector y la validación de proveedores no filtran por rubro', () => {
  const repositorioMaestros = fs.readFileSync(
    path.join(raiz, 'src/repositories/maestros.repository.js'),
    'utf8'
  );
  const repositorioAltas = fs.readFileSync(
    path.join(raiz, 'src/repositories/altas.repository.js'),
    'utf8'
  );
  const frontend = fs.readFileSync(
    path.join(raiz, 'public/js/alta-productos.js'),
    'utf8'
  );

  const consultaListado = repositorioMaestros.match(
    /async function buscarProveedores[\s\S]*?return resultado\.recordset;/
  )?.[0] ?? '';
  const consultaValidacion = repositorioAltas.match(
    /async function buscarProveedor[\s\S]*?return resultado\.recordset\[0\] \|\| null;/
  )?.[0] ?? '';

  assert.match(consultaListado, /P\.ACTIVO = 1/);
  assert.doesNotMatch(consultaListado, /@RUBRO/);
  assert.match(consultaValidacion, /P\.ACTIVO = 1/);
  assert.doesNotMatch(consultaValidacion, /@RUBRO/);
  assert.doesNotMatch(frontend, /\/api\/maestros\/proveedores\?marca=\$\{marca\}&rubro=/);
});
