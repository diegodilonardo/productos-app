const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const archivoJob = path.join(
  __dirname,
  '..',
  'src',
  'jobs',
  'importarMaestros.job.js'
);

test('el cron de maestros también sincroniza el maestro de proveedores', () => {
  const fuente = fs.readFileSync(archivoJob, 'utf8');

  assert.match(
    fuente,
    /require\(\s*['"]\.\.\/services\/proveedoresSync\.service['"]\s*\)/
  );
  assert.match(fuente, /await sincronizarProveedores\(\)/);

  const inicioWorker = fuente.indexOf('async function ejecutarWorker');
  const inicioScheduler = fuente.indexOf('function ejecutarMaestros', inicioWorker);
  const worker = fuente.slice(inicioWorker, inicioScheduler);

  assert.ok(
    worker.indexOf('await importarMaestrosMultiempresa()') <
      worker.indexOf('await sincronizarProveedores()'),
    'proveedores debe sincronizarse después de los maestros multiempresa'
  );
  assert.match(
    worker,
    /try\s*\{[\s\S]*await sincronizarProveedores\(\)[\s\S]*\}\s*catch\s*\(error\)/
  );
});
