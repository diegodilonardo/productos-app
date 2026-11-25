const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('la pantalla permite actualizar los maestros de Presea manualmente', () => {
  const vista = fs.readFileSync(path.join(process.cwd(), 'views/altas-maestros/index.hbs'), 'utf8');
  const cliente = fs.readFileSync(path.join(process.cwd(), 'public/js/altas-maestros.js'), 'utf8');
  const rutas = fs.readFileSync(path.join(process.cwd(), 'src/routes/altasMaestros.routes.js'), 'utf8');

  assert.match(vista, /id="btnActualizarMaestros"[\s\S]*Actualizar maestros/);
  assert.match(cliente, /actualizarMaestrosDesdePresea/);
  assert.match(cliente, /\/api\/altas-maestros\/sincronizar/);
  assert.match(cliente, /btnActualizarMaestros'\)\.addEventListener\('click', actualizarMaestrosDesdePresea\)/);
  assert.match(rutas, /router\.post\('\/sincronizar', requerirEscrituraEmpresa/);
  assert.match(rutas, /ejecutarMaestrosEmpresaAhora/);
});

test('el worker manual limita la sincronización a la empresa seleccionada', () => {
  const job = fs.readFileSync(path.join(process.cwd(), 'src/jobs/importarMaestros.job.js'), 'utf8');

  assert.match(job, /async function ejecutarWorker\([\s\S]*codigoEmpresa = null/);
  assert.match(job, /importarMaestrosMultiempresa\([\s\S]*codigoEmpresa/);
  assert.match(job, /function ejecutarMaestrosEmpresaAhora/);
  assert.match(job, /'MANUAL_WEB'/);
});
