const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');

test('producción dispone de supervisor externo y diagnóstico del event loop', () => {
  const paquete = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  const supervisor = fs.readFileSync(path.join(raiz, 'src/supervisor.js'), 'utf8');
  const servidor = fs.readFileSync(path.join(raiz, 'src/server.js'), 'utf8');
  const app = fs.readFileSync(path.join(raiz, 'src/app.js'), 'utf8');

  assert.equal(paquete.scripts.start, 'node src/supervisor.js');
  assert.equal(paquete.scripts['start:web'], 'node src/server.js');
  assert.match(supervisor, /SUPERVISOR_FAILURE_THRESHOLD/);
  assert.match(supervisor, /\/api\/status/);
  assert.match(supervisor, /taskkill/);
  assert.match(servidor, /iniciarMonitorEventLoop/);
  assert.match(app, /obtenerEstadoEventLoop/);
});

test('SQL posee límites para conexión y consultas', () => {
  const database = fs.readFileSync(path.join(raiz, 'src/config/database.js'), 'utf8');
  assert.match(database, /connectionTimeout/);
  assert.match(database, /requestTimeout/);
});
