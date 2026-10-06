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
  assert.match(database, /useUTC:\s*false/);
});

test('las fechas locales de SQL no reciben una conversión UTC adicional en el navegador', () => {
  const app = fs.readFileSync(path.join(raiz, 'src/app.js'), 'utf8');
  const serializador = fs.readFileSync(path.join(raiz, 'src/utils/jsonFechaLocal.js'), 'utf8');
  const pedido = fs.readFileSync(path.join(raiz, 'public/js/pedido-detalle.js'), 'utf8');
  const seguimiento = fs.readFileSync(path.join(raiz, 'public/js/seguimiento-detalle.js'), 'utf8');
  assert.match(app, /json replacer/);
  assert.match(serializador, /fechaLocalSinZona/);
  assert.doesNotMatch(pedido, /endsWith\('Z'\).*slice\(0,-1\)/);
  assert.doesNotMatch(seguimiento, /endsWith\('Z'\).*slice\(0, -1\)/);
});

test('el JSON conserva la hora local de SQL sin agregar una zona UTC', () => {
  const { reemplazarFechaLocalJson } = require('../src/utils/jsonFechaLocal');
  const salida = JSON.stringify(
    { FECHA_CREACION: new Date('2026-10-06T12:22:59.000Z') },
    reemplazarFechaLocalJson
  );
  assert.equal(salida, '{"FECHA_CREACION":"2026-10-06T12:22:59.000"}');
});
